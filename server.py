from flask import Flask, jsonify, request, send_from_directory
from fim import fim_bp #fim
from vulnerability_discovery import vuln_bp #vulnerability-discovery
from search_analytics import search_analytics_bp #search-analytics
from threat_intel import threat_intel_bp, init_threat_intel_client #threat-intel
from case_management import case_management_bp #case-management
from uba import uba_bp  #uba
from flask_cors import CORS
import requests
import json
import pandas as pd
from datetime import datetime, timedelta
import urllib3
import logging
from typing import Dict, List, Any, Optional
import os
from dataclasses import dataclass
from config import Config
import asyncio
import threading
import time
import random
import sys
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file



# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure detailed logging to dashboard.log
def setup_logging():
    """Setup centralized logging configuration for all modules"""
    
    # Clear any existing handlers
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    
    # Create file handler ONLY (no console handler)
    file_handler = logging.FileHandler('dashboard.log')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # Create console handler only for WARNING and above (no debug/info)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)  # Only show warnings and errors
    console_handler.setFormatter(formatter)
    
    # Configure root logger with ONLY file handler
    logging.basicConfig(
        level=logging.DEBUG,
        handlers=[file_handler]  # Removed console_handler
    )

# Setup logging before creating the app
setup_logging()


log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Registering blueprints
app.register_blueprint(fim_bp)
app.register_blueprint(vuln_bp)
app.register_blueprint(search_analytics_bp)
app.register_blueprint(threat_intel_bp)
app.register_blueprint(case_management_bp)
app.register_blueprint(uba_bp)

@dataclass
class DashboardConfig:
    """Configuration for SOC Dashboard"""
    REFRESH_INTERVAL: int = 30  # seconds
    MAX_ALERTS: int = 5000
    TIMEZONE: str = 'UTC'
    ENABLE_REALTIME: bool = True


class ProfessionalWazuhClient:
    """Enhanced Wazuh client with professional error handling and caching"""
    
    def __init__(self, host: str, username: str, password: str, verify_ssl: bool = False):
        self.base_url = f"https://{host}:9200"
        self.auth = (username, password)
        self.verify_ssl = verify_ssl
        self.session = requests.Session()
        self.session.auth = self.auth
        self.session.verify = self.verify_ssl
        self.logger = logging.getLogger(__name__)
        self._cache = {}
        self._cache_timeout = 300  # 5 minutes
        
    def _make_request(self, endpoint: str, query: Dict = None) -> Dict[str, Any]:
        """Make authenticated request with error handling"""
        try:
            url = f"{self.base_url}/{endpoint}"
            self.logger.debug(f"🔍 Making request to: {url}")
            self.logger.debug(f"🔍 Query: {json.dumps(query, indent=2)}")
            
            response = self.session.get(url, json=query, verify=self.verify_ssl, timeout=30)
            self.logger.debug(f"🔍 Response status: {response.status_code}")
            
            response.raise_for_status()
            result = response.json()
            
            self.logger.debug(f"🔍 Response keys: {list(result.keys())}")
            if 'hits' in result:
                total_hits = result['hits']['total']['value']
                actual_hits = len(result['hits']['hits'])
                self.logger.debug(f"🔍 Total hits: {total_hits}, Actual hits: {actual_hits}")
                
                if actual_hits > 0:
                    first_hit = result['hits']['hits'][0]
                    source = first_hit.get('_source', {})
                    self.logger.debug(f"🔍 First hit ID: {first_hit.get('_id')}")
                    self.logger.debug(f"🔍 First hit timestamp: {source.get('@timestamp')}")
                    self.logger.debug(f"🔍 First hit rule groups: {source.get('rule', {}).get('groups', [])}")
            
            return result
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Request failed for {endpoint}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                self.logger.error(f"❌ Response content: {e.response.text}")
            return {"error": str(e), "hits": {"hits": [], "total": {"value": 0}}}
    
    def get_alerts_by_time_range(self, start_time: str, end_time: str, size: int = 1000) -> Dict[str, Any]:
        """Get alerts with advanced time range filtering"""
        cache_key = f"alerts_{start_time}_{end_time}_{size}"
        if cache_key in self._cache and time.time() - self._cache[cache_key]['timestamp'] < self._cache_timeout:
            return self._cache[cache_key]['data']
            
        query = {
            "query": {
                "range": {
                    "@timestamp": {
                        "gte": start_time,
                        "lte": end_time,
                        "format": "strict_date_optional_time"
                    }
                }
            },
            "size": size,
            "sort": [{"@timestamp": {"order": "desc"}}],
            "aggs": {
                "severity_stats": {"stats": {"field": "rule.level"}},
                "top_agents": {"terms": {"field": "agent.name.keyword", "size": 10}},
                "alerts_over_time": {"date_histogram": {"field": "@timestamp", "calendar_interval": "hour"}}
            }
        }
        
        self.logger.info(f"📊 Getting alerts from {start_time} to {end_time}")
        result = self._make_request("wazuh-alerts-4.x-*/_search", query)
        self._cache[cache_key] = {'data': result, 'timestamp': time.time()}
        return result
    
    def get_todays_alerts(self) -> Dict[str, Any]:
        """Get today's alerts with optimized query"""
        today = datetime.now().strftime("%Y.%m.%d")
        start_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        end_time = datetime.now().isoformat()
        
        self.logger.info(f"📊 Getting today's alerts")
        return self.get_alerts_by_time_range(start_time, end_time)
    
    def get_severity_summary(self) -> Dict[str, Any]:
        """Get severity level summary for dashboard metrics"""
        query = {
            "size": 0,
            "aggs": {
                "severity_breakdown": {
                    "terms": {"field": "rule.level", "size": 15}
                },
                "total_alerts": {"value_count": {"field": "rule.level"}}
            }
        }
        self.logger.info("📊 Getting severity summary")
        return self._make_request("wazuh-alerts-4.x-*/_search", query)
    
    def get_mitre_coverage(self) -> Dict[str, Any]:
        """Get MITRE ATT&CK technique coverage"""
        query = {
            "size": 0,
            "aggs": {
                "mitre_tactics": {
                    "terms": {"field": "rule.mitre.tactic.keyword", "size": 20}
                },
                "mitre_techniques": {
                    "terms": {"field": "rule.mitre.technique.keyword", "size": 50}
                }
            }
        }
        self.logger.info("📊 Getting MITRE coverage")
        return self._make_request("wazuh-alerts-4.x-*/_search", query)
    
    def get_fim_events(self, start_time: str = None, end_time: str = None) -> Dict[str, Any]:
        """Get File Integrity Monitoring events"""
        if not start_time:
            start_time = (datetime.now() - timedelta(hours=24)).isoformat()
        if not end_time:
            end_time = datetime.now().isoformat()
            
        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "@timestamp": {
                                    "gte": start_time,
                                    "lte": end_time
                                }
                            }
                        },
                        {
                            "term": {
                                "rule.groups": "syscheck"
                            }
                        }
                    ]
                }
            },
            "size": 1000,
            "sort": [{"@timestamp": {"order": "desc"}}]
        }
        
        self.logger.info(f"🔍 Getting FIM events from {start_time} to {end_time}")
        result = self._make_request("wazuh-alerts-4.x-*/_search", query)
        
        # Log FIM-specific debug info
        if result and 'hits' in result:
            total_hits = result['hits']['total']['value']
            actual_hits = len(result['hits']['hits'])
            self.logger.info(f"🔍 FIM Query Results - Total: {total_hits}, Returned: {actual_hits}")
            
            if actual_hits > 0:
                first_hit = result['hits']['hits'][0]
                source = first_hit.get('_source', {})
                self.logger.debug(f"🔍 First FIM hit - ID: {first_hit.get('_id')}")
                self.logger.debug(f"🔍 First FIM hit timestamp: {source.get('@timestamp')}")
                self.logger.debug(f"🔍 First FIM hit rule groups: {source.get('rule', {}).get('groups', [])}")
                self.logger.debug(f"🔍 First FIM hit has syscheck: {'syscheck' in source}")
                if 'syscheck' in source:
                    self.logger.debug(f"🔍 Syscheck keys: {list(source['syscheck'].keys())}")
            else:
                self.logger.warning("🔍 No FIM hits returned, but total hits > 0")
        
        return result

class SOCDataProcessor:
    """Professional data processing for SOC dashboard"""
    
    @staticmethod
    def process_alerts_for_dashboard(raw_alerts: Dict[str, Any]) -> Dict[str, Any]:
        """Process raw alerts into professional SOC format"""
        logging.debug("🔄 Processing alerts for dashboard")
        
        if not raw_alerts or 'hits' not in raw_alerts:
            logging.warning("❌ No raw alerts data or hits missing")
            return {
                'summary': SOCDataProcessor.get_empty_summary(),
                'charts': SOCDataProcessor.get_empty_charts(),
                'alerts': [],
                'timeline': [],
                'threat_indicators': []
            }
        
        total_hits = raw_alerts['hits']['total']['value']
        actual_hits = len(raw_alerts['hits']['hits'])
        logging.info(f"🔄 Processing {total_hits} total alerts, {actual_hits} returned")
        
        alerts_data = []
        severity_counts = {i: 0 for i in range(1, 16)}
        agent_alerts = {}
        rule_categories = {}
        mitre_tactics = {}
        timeline_data = {}
        threat_indicators = []
        
        for hit in raw_alerts['hits']['hits']:
            alert = SOCDataProcessor.process_single_alert(hit)
            alerts_data.append(alert)
            
            # Update metrics
            severity = alert['severity']
            if severity in severity_counts:
                severity_counts[severity] += 1
            
            agent_name = alert['agent_name']
            agent_alerts[agent_name] = agent_alerts.get(agent_name, 0) + 1
            
            # MITRE ATT&CK processing
            for tactic in alert['mitre_tactics']:
                mitre_tactics[tactic] = mitre_tactics.get(tactic, 0) + 1
            
            # Timeline data
            hour_key = alert['timestamp'][:13]  # Group by hour
            timeline_data[hour_key] = timeline_data.get(hour_key, 0) + 1
            
            # Threat indicators for high severity alerts
            if severity >= 10:
                threat_indicators.append({
                    'timestamp': alert['timestamp'],
                    'severity': severity,
                    'description': alert['rule_description'],
                    'agent': agent_name,
                    'mitre_tactics': alert['mitre_tactics']
                })
        
        result = {
            'summary': SOCDataProcessor.calculate_summary_metrics(
                raw_alerts, severity_counts, len(agent_alerts), threat_indicators
            ),
            'charts': {
                'severity_distribution': severity_counts,
                'top_agents': dict(sorted(agent_alerts.items(), key=lambda x: x[1], reverse=True)[:10]),
                'mitre_tactics': dict(sorted(mitre_tactics.items(), key=lambda x: x[1], reverse=True)[:15]),
                'timeline': timeline_data,
                'rule_categories': rule_categories
            },
            'alerts': alerts_data,
            'threat_indicators': sorted(threat_indicators, key=lambda x: x['severity'], reverse=True)[:20],
            'last_updated': datetime.now().isoformat()
        }
        
        logging.info(f"✅ Processed {len(alerts_data)} alerts for dashboard")
        return result
    
    @staticmethod
    def process_single_alert(hit: Dict) -> Dict[str, Any]:
        """Process a single alert with comprehensive field extraction"""
        source = hit.get('_source', {})
        rule = source.get('rule', {})
        agent = source.get('agent', {})
        manager = source.get('manager', {})
        data = source.get('data', {})
        
        # Extract MITRE ATT&CK information
        mitre = rule.get('mitre', {})
        
        return {
            'id': hit.get('_id', ''),
            'timestamp': source.get('@timestamp', ''),
            'severity': rule.get('level', 0),
            'rule_id': rule.get('id', ''),
            'rule_description': rule.get('description', ''),
            'agent_name': agent.get('name', 'Unknown'),
            'agent_ip': agent.get('ip', ''),
            'agent_id': agent.get('id', ''),
            'manager': manager.get('name', ''),
            'location': source.get('location', ''),
            'groups': rule.get('groups', []),
            'fired_times': rule.get('firedtimes', 1),
            'mitre_tactics': mitre.get('tactic', []),
            'mitre_techniques': mitre.get('technique', []),
            'mitre_ids': mitre.get('id', []),
            'full_log': source.get('full_log', ''),
            'compliance_frameworks': {
                'pci_dss': rule.get('pci_dss', []),
                'hipaa': rule.get('hipaa', []),
                'nist_800_53': rule.get('nist_800_53', []),
                'gdpr': rule.get('gdpr', []),
                'gpg13': rule.get('gpg13', [])
            },
            'raw_data': source  # Keep original data for advanced analysis
        }
    
    @staticmethod
    def calculate_summary_metrics(raw_alerts, severity_counts, unique_agents, threat_indicators):
        """Calculate professional SOC metrics"""
        total_alerts = raw_alerts['hits']['total']['value']
        high_severity = sum(count for sev, count in severity_counts.items() if sev >= 10)
        critical_alerts = sum(count for sev, count in severity_counts.items() if sev >= 12)
        
        return {
            'total_alerts': total_alerts,
            'high_severity_alerts': high_severity,
            'critical_alerts': critical_alerts,
            'unique_agents': unique_agents,
            'active_threats': len(threat_indicators),
            'mitre_techniques_count': len(set(
                tech for indicator in threat_indicators 
                for tech in indicator.get('mitre_tactics', [])
            )),
            'time_range': f"Last Update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            'data_freshness': datetime.now().isoformat()
        }
    
    @staticmethod
    def get_empty_summary():
        return {
            'total_alerts': 0,
            'high_severity_alerts': 0,
            'critical_alerts': 0,
            'unique_agents': 0,
            'active_threats': 0,
            'mitre_techniques_count': 0,
            'time_range': 'No data available',
            'data_freshness': datetime.now().isoformat()
        }
    
    @staticmethod
    def get_empty_charts():
        return {
            'severity_distribution': {},
            'top_agents': {},
            'mitre_tactics': {},
            'timeline': {},
            'rule_categories': {}
        }


# Initialize components
config = DashboardConfig()
wazuh_client = ProfessionalWazuhClient(
    host = Config.WAZUH_HOST,
    username = Config.WAZUH_USERNAME,
    password = Config.WAZUH_PASSWORD,  # Replace with actual password
    verify_ssl = Config.WAZUH_VERIFY_SSL
)
data_processor = SOCDataProcessor()

# Initialize threat intelligence client
init_threat_intel_client(wazuh_client=wazuh_client)

# Real-time data management
class RealTimeDataManager:
    """Manage real-time data updates and caching"""
    
    def __init__(self):
        self.current_data = None
        self.last_update = None
        self.is_updating = False
        self.subscribers = []
    
    def update_data(self):
        """Update data in background"""
        if self.is_updating:
            return
        
        self.is_updating = True
        try:
            raw_alerts = wazuh_client.get_todays_alerts()
            processed_data = data_processor.process_alerts_for_dashboard(raw_alerts)
            self.current_data = processed_data
            self.last_update = datetime.now()
            
            # Notify subscribers (for WebSocket implementation)
            for callback in self.subscribers:
                callback(processed_data)
                
        except Exception as e:
            logging.error(f"❌ Data update failed: {e}")
        finally:
            self.is_updating = False

# Initialize real-time manager
data_manager = RealTimeDataManager()

# API Routes
@app.route('/')
def serve_dashboard():
    """Serve the main SOC dashboard"""
    return send_from_directory('static', 'index.html')

@app.route('/search-analytics')
def serve_search_analytics():
    """Serve the Search & Analytics dashboard"""
    return send_from_directory('static', 'search-analytics.html')

@app.route('/fim')
def serve_fim():
    """Serve the FIM dashboard"""
    return send_from_directory('static', 'fim.html')

@app.route('/uba')
def serve_uba():
    """Serve the UBA dashboard"""
    return send_from_directory('static', 'uba.html')

@app.route('/threat-intel')
def serve_threat_intel():
    """Serve the Threat Intelligence dashboard"""
    return send_from_directory('static', 'threat-intel.html')

@app.route('/vulnerability-discovery')
def serve_vulnerability_discovery():
    """Serve the Vulnerability Discovery dashboard"""
    return send_from_directory('static', 'vulnerability-discovery.html')

@app.route('/case-management')
def serve_case_management():
    """Serve the Case Management dashboard"""
    return send_from_directory('static', 'case-management.html')

#@app.route('/soar')
#def serve_soar():
#    """Serve the SOAR dashboard"""
#    return "SOAR Dashboard - Coming Soon", 200

@app.route('/api/dashboard-data')
def get_dashboard_data():
    """Get comprehensive dashboard data"""
    try:
        time_range = request.args.get('time_range', 'today')
        if time_range == 'today':
            raw_alerts = wazuh_client.get_todays_alerts()
        else:
            # Handle custom time ranges
            hours = int(request.args.get('hours', 24))
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=hours)
            raw_alerts = wazuh_client.get_alerts_by_time_range(
                start_time.isoformat(), 
                end_time.isoformat()
            )
        
        processed_data = data_processor.process_alerts_for_dashboard(raw_alerts)
        return jsonify(processed_data)
        
    except Exception as e:
        logging.error(f"❌ Dashboard data error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts')
def get_alerts():
    """Get alerts with advanced filtering"""
    try:
        # Extract filter parameters
        severity = request.args.get('severity')
        agent = request.args.get('agent')
        search = request.args.get('search')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Build query based on filters
        raw_alerts = wazuh_client.get_todays_alerts()
        processed_data = data_processor.process_alerts_for_dashboard(raw_alerts)
        
        # Apply filters
        filtered_alerts = processed_data['alerts']
        if severity:
            filtered_alerts = [a for a in filtered_alerts if a['severity'] >= int(severity)]
        if agent:
            filtered_alerts = [a for a in filtered_alerts if agent.lower() in a['agent_name'].lower()]
        if search:
            filtered_alerts = [
                a for a in filtered_alerts 
                if search.lower() in a['rule_description'].lower() or 
                   search.lower() in a['agent_name'].lower()
            ]
        
        # Pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_alerts = filtered_alerts[start_idx:end_idx]
        
        return jsonify({
            'alerts': paginated_alerts,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': len(filtered_alerts),
                'pages': (len(filtered_alerts) + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/severity-summary')
def get_severity_summary():
    """Get severity level summary"""
    try:
        summary = wazuh_client.get_severity_summary()
        return jsonify(summary)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/mitre-coverage')
def get_mitre_coverage():
    """Get MITRE ATT&CK coverage"""
    try:
        coverage = wazuh_client.get_mitre_coverage()
        return jsonify(coverage)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health')
def health_check():
    """Comprehensive health check"""
    try:
        # Test Wazuh connectivity
        test_alerts = wazuh_client.get_todays_alerts()
        is_healthy = 'error' not in test_alerts
        
        return jsonify({
            "status": "healthy" if is_healthy else "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "components": {
                "wazuh_connection": is_healthy,
                "data_processor": True,
                "api_endpoints": True
            },
            "version": "1.0.0",
            "uptime": "0"  # Would track actual uptime in production
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# Background data updater
def background_data_updater():
    """Update data in background at regular intervals"""
    while True:
        try:
            data_manager.update_data()
            time.sleep(config.REFRESH_INTERVAL)
        except Exception as e:
            logging.error(f"❌ Background update error: {e}")
            time.sleep(60)  # Wait longer on error

# Start background thread
if config.ENABLE_REALTIME:
    updater_thread = threading.Thread(target=background_data_updater, daemon=True)
    updater_thread.start()

if __name__ == '__main__':
    logging.info("🚀 Starting Professional SOC Dashboard with Enhanced Debug Logging...")
    print(f"📊 Server running at: http://{Config.FLASK_HOST}:{Config.FLASK_PORT}")
    print("Press CTRL+C to stop the server")
    app.run(
        host=Config.FLASK_HOST, 
        port=Config.FLASK_PORT, 
        debug=Config.FLASK_DEBUG
    )
