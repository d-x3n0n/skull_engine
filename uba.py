from flask import Blueprint, jsonify, request
import requests
import logging
from datetime import datetime, timedelta
import json
from config import Config

uba_bp = Blueprint('uba', __name__)

logger = logging.getLogger(__name__)

class WazuhUBAClient:
    """Professional UBA client for Wazuh Anomaly Detection"""
    
    def __init__(self, host: str, username: str, password: str, verify_ssl: bool = False):
        self.base_url = f"https://{host}:9200"
        self.auth = (username, password)
        self.verify_ssl = verify_ssl
        self.session = requests.Session()
        self.session.auth = self.auth
        self.session.verify = self.verify_ssl
        self.logger = logging.getLogger(__name__)
    
    def get_anomaly_results(self, detector_id: str = None, min_anomaly_grade: float = 0.1) -> dict:
        """Get anomaly detection results from Wazuh UBA"""
        try:
            url = f"{self.base_url}/_plugins/_anomaly_detection/detectors/results/_search"
            
            query = {
                "query": {
                    "bool": {
                        "filter": [
                            {"range": {"anomaly_grade": {"gt": min_anomaly_grade}}}
                        ],
                        "must_not": [
                            {"exists": {"field": "task_id"}}
                        ]
                    }
                },
                "size": 1000,
                "sort": [{"execution_start_time": {"order": "desc"}}]
            }
            
            # Add detector filter if specified
            if detector_id:
                query["query"]["bool"]["filter"].append({"term": {"detector_id": detector_id}})
            
            self.logger.info(f"🔍 Fetching UBA anomalies with grade > {min_anomaly_grade}")
            response = self.session.post(url, json=query, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            total_hits = result['hits']['total']['value']
            self.logger.info(f"📊 Found {total_hits} UBA anomalies")
            
            return result
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ UBA request failed: {e}")
            return {"error": str(e), "hits": {"hits": [], "total": {"value": 0}}}
    
    def get_detectors(self) -> dict:
        """Get list of anomaly detectors"""
        try:
            url = f"{self.base_url}/_plugins/_anomaly_detection/detectors/_search"
            query = {"size": 100}
            
            response = self.session.get(url, json=query, timeout=30)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Detectors request failed: {e}")
            return {"error": str(e), "hits": {"hits": [], "total": {"value": 0}}}

class UBADataProcessor:
    """Process UBA data for dashboard consumption"""
    
    @staticmethod
    def process_anomalies_for_dashboard(raw_anomalies: dict) -> dict:
        """Process raw UBA data into dashboard format"""
        logging.debug("🔄 Processing UBA anomalies for dashboard")
        
        if not raw_anomalies or 'hits' not in raw_anomalies:
            logging.warning("❌ No UBA anomalies data")
            return UBADataProcessor.get_empty_uba_data()
        
        hits = raw_anomalies['hits']['hits']
        total_anomalies = raw_anomalies['hits']['total']['value']
        
        logging.info(f"🔄 Processing {total_anomalies} UBA anomalies")
        
        anomalies_data = []
        detector_stats = {}
        feature_attribution = {}
        time_series_data = {}
        
        for hit in hits:
            anomaly = UBADataProcessor.process_single_anomaly(hit)
            anomalies_data.append(anomaly)
            
            # Update statistics
            detector_id = anomaly['detector_id']
            detector_stats[detector_id] = detector_stats.get(detector_id, 0) + 1
            
            # Feature attribution analysis
            for attribution in anomaly.get('relevant_attribution', []):
                feature_id = attribution['feature_id']
                feature_attribution[feature_id] = feature_attribution.get(feature_id, 0) + attribution['data']
            
            # Time series data
            day_key = datetime.fromtimestamp(anomaly['execution_start_time'] / 1000).strftime('%Y-%m-%d')
            time_series_data[day_key] = time_series_data.get(day_key, 0) + 1
        
        # Get top contributing features
        top_features = dict(sorted(feature_attribution.items(), key=lambda x: x[1], reverse=True)[:10])
        
        result = {
            'summary': UBADataProcessor.calculate_uba_summary(total_anomalies, detector_stats, anomalies_data),
            'charts': {
                'anomalies_over_time': time_series_data,
                'detector_distribution': detector_stats,
                'feature_attribution': top_features,
                'anomaly_grades': [a['anomaly_grade'] for a in anomalies_data],
                'confidence_levels': [a['confidence'] for a in anomalies_data]
            },
            'anomalies': anomalies_data,
            'risk_indicators': UBADataProcessor.extract_risk_indicators(anomalies_data),
            'last_updated': datetime.now().isoformat()
        }
        
        logging.info(f"✅ Processed {len(anomalies_data)} UBA anomalies")
        return result
    
    @staticmethod
    def process_single_anomaly(hit: dict) -> dict:
        """Process a single anomaly record"""
        source = hit.get('_source', {})
        
        # Extract feature data
        feature_data = {}
        for feature in source.get('feature_data', []):
            feature_name = feature.get('feature_name', 'unknown')
            feature_data[feature_name] = feature.get('data', 0)
        
        # Extract relevant attribution
        relevant_attribution = []
        for attribution in source.get('relevant_attribution', []):
            relevant_attribution.append({
                'feature_id': attribution.get('feature_id'),
                'data': attribution.get('data', 0)
            })
        
        return {
            'id': hit.get('_id'),
            'detector_id': source.get('detector_id'),
            'anomaly_grade': source.get('anomaly_grade', 0),
            'anomaly_score': source.get('anomaly_score', 0),
            'confidence': source.get('confidence', 0),
            'execution_start_time': source.get('execution_start_time'),
            'data_start_time': source.get('data_start_time'),
            'data_end_time': source.get('data_end_time'),
            'feature_data': feature_data,
            'relevant_attribution': relevant_attribution,
            'expected_values': source.get('expected_values', []),
            'user': source.get('user', {}),
            'threshold': source.get('threshold', 0.8),
            'model_id': source.get('model_id')
        }
    
    @staticmethod
    def calculate_uba_summary(total_anomalies: int, detector_stats: dict, anomalies: list) -> dict:
        """Calculate UBA summary metrics"""
        high_confidence_anomalies = sum(1 for a in anomalies if a['confidence'] > 0.7)
        high_grade_anomalies = sum(1 for a in anomalies if a['anomaly_grade'] > 0.5)
        
        avg_anomaly_grade = sum(a['anomaly_grade'] for a in anomalies) / len(anomalies) if anomalies else 0
        avg_confidence = sum(a['confidence'] for a in anomalies) / len(anomalies) if anomalies else 0
        
        return {
            'total_anomalies': total_anomalies,
            'high_confidence_anomalies': high_confidence_anomalies,
            'high_grade_anomalies': high_grade_anomalies,
            'active_detectors': len(detector_stats),
            'avg_anomaly_grade': round(avg_anomaly_grade, 3),
            'avg_confidence': round(avg_confidence, 3),
            'time_range': f"Last Update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            'data_freshness': datetime.now().isoformat()
        }
    
    @staticmethod
    def extract_risk_indicators(anomalies: list) -> list:
        """Extract high-risk indicators from anomalies"""
        risk_indicators = []
        
        for anomaly in anomalies:
            if anomaly['anomaly_grade'] > 0.7 or anomaly['confidence'] > 0.8:
                risk_indicators.append({
                    'detector_id': anomaly['detector_id'],
                    'anomaly_grade': anomaly['anomaly_grade'],
                    'confidence': anomaly['confidence'],
                    'timestamp': datetime.fromtimestamp(anomaly['execution_start_time'] / 1000).isoformat(),
                    'top_features': list(anomaly['feature_data'].keys())[:3],
                    'risk_level': 'HIGH' if anomaly['anomaly_grade'] > 0.8 else 'MEDIUM'
                })
        
        return sorted(risk_indicators, key=lambda x: x['anomaly_grade'], reverse=True)[:10]
    
    @staticmethod
    def get_empty_uba_data():
        return {
            'summary': {
                'total_anomalies': 0,
                'high_confidence_anomalies': 0,
                'high_grade_anomalies': 0,
                'active_detectors': 0,
                'avg_anomaly_grade': 0,
                'avg_confidence': 0,
                'time_range': 'No data available',
                'data_freshness': datetime.now().isoformat()
            },
            'charts': {
                'anomalies_over_time': {},
                'detector_distribution': {},
                'feature_attribution': {},
                'anomaly_grades': [],
                'confidence_levels': []
            },
            'anomalies': [],
            'risk_indicators': []
        }

# Initialize UBA client with your Wazuh credentials
uba_client = WazuhUBAClient(
    host=Config.WAZUH_HOST,
    username=Config.WAZUH_USERNAME, 
    password=Config.WAZUH_PASSWORD,  
    verify_ssl=False
)

uba_processor = UBADataProcessor()

# UBA API Routes
@uba_bp.route('/api/uba/anomalies')
def get_uba_anomalies():
    """Get UBA anomalies with optional filtering"""
    try:
        detector_id = request.args.get('detector_id')
        min_grade = float(request.args.get('min_grade', 0.1))
        days = int(request.args.get('days', 7))
        
        # Get raw anomalies from Wazuh
        raw_anomalies = uba_client.get_anomaly_results(detector_id, min_grade)
        
        # Check if there was an error in the request
        if 'error' in raw_anomalies:
            return jsonify({"error": raw_anomalies['error']}), 500
        
        # Process the data for the dashboard
        processed_data = uba_processor.process_anomalies_for_dashboard(raw_anomalies)
        
        return jsonify(processed_data)
        
    except Exception as e:
        logging.error(f"❌ UBA anomalies error: {e}")
        return jsonify({"error": str(e)}), 500

@uba_bp.route('/api/uba/detectors')
def get_uba_detectors():
    """Get list of UBA detectors"""
    try:
        detectors_data = uba_client.get_detectors()
        
        # Check if there was an error
        if 'error' in detectors_data:
            return jsonify({"error": detectors_data['error']}), 500
        
        # Format the detectors data
        detectors = []
        for hit in detectors_data.get('hits', {}).get('hits', []):
            source = hit.get('_source', {})
            detectors.append({
                'id': hit.get('_id'),
                'name': source.get('name', 'Unknown Detector'),
                'description': source.get('description', ''),
                'detector_type': source.get('detector_type'),
                'indices': source.get('indices', []),
                'feature_attributes': source.get('feature_attributes', []),
                'last_update_time': source.get('last_update_time')
            })
        
        return jsonify({
            "detectors": detectors,
            "total": detectors_data.get('hits', {}).get('total', {}).get('value', 0)
        })
        
    except Exception as e:
        logging.error(f"❌ UBA detectors error: {e}")
        return jsonify({"error": str(e)}), 500

@uba_bp.route('/api/uba/health')
def uba_health_check():
    """UBA health check"""
    try:
        # Test both detectors and anomalies endpoints
        test_detectors = uba_client.get_detectors()
        test_anomalies = uba_client.get_anomaly_results()
        
        detectors_healthy = 'error' not in test_detectors
        anomalies_healthy = 'error' not in test_anomalies
        
        anomalies_detected = test_anomalies.get('hits', {}).get('total', {}).get('value', 0) if anomalies_healthy else 0
        
        status = "healthy" if detectors_healthy and anomalies_healthy else "unhealthy"
        
        return jsonify({
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "anomalies_detected": anomalies_detected,
            "components": {
                "uba_connection": anomalies_healthy,
                "detectors_accessible": detectors_healthy
            }
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@uba_bp.route('/api/uba/summary')
def get_uba_summary():
    """Get UBA summary for dashboard cards"""
    try:
        days = int(request.args.get('days', 7))
        raw_anomalies = uba_client.get_anomaly_results()
        
        if 'error' in raw_anomalies:
            return jsonify({"error": raw_anomalies['error']}), 500
        
        processed_data = uba_processor.process_anomalies_for_dashboard(raw_anomalies)
        return jsonify(processed_data['summary'])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
