from flask import Blueprint, jsonify, request
import requests
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json
import urllib3

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Create Blueprint
case_management_bp = Blueprint('case_management', __name__)

logger = logging.getLogger(__name__)

class IrisClient:
    """Professional DFIR-IRIS API client with correct endpoints"""
    
    def __init__(self, base_url: str, api_key: str, verify_ssl: bool = False):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.verify_ssl = verify_ssl
        self.session = requests.Session()
        
        # Configure session headers
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
        
        # Handle SSL verification
        if not verify_ssl:
            self.session.verify = False
        
        self.logger = logging.getLogger(__name__)
    
    def _make_request(self, endpoint: str, method: str = 'GET', data: Dict = None, params: Dict = None) -> Dict[str, Any]:
        """Make authenticated request to IRIS API"""
        try:
            url = f"{self.base_url}{endpoint}"
            self.logger.debug(f"🔍 Making {method} request to: {url}")
            
            # Request parameters
            request_params = {
                'verify': self.verify_ssl,
                'timeout': 30
            }
            
            if params:
                request_params['params'] = params
            
            if method.upper() == 'GET':
                response = self.session.get(url, **request_params)
            elif method.upper() == 'POST':
                request_params['json'] = data
                response = self.session.post(url, **request_params)
            elif method.upper() == 'PUT':
                request_params['json'] = data
                response = self.session.put(url, **request_params)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, **request_params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            self.logger.debug(f"🔍 Response status: {response.status_code}")
            
            # Handle 204 No Content responses
            if response.status_code == 204:
                return {"status": "success", "message": "No content"}
                
            response.raise_for_status()
            
            # Try to parse JSON
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            self.logger.error(f"❌ HTTP Error {e.response.status_code}: {e}")
            return {"error": f"HTTP {e.response.status_code}: {str(e)}"}
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ IRIS API request failed: {e}")
            return {"error": str(e)}
    
    def get_cases(self, page: int = 1, per_page: int = 50) -> Dict[str, Any]:
        """Get all cases with pagination - CORRECT ENDPOINT"""
        endpoint = "/manage/cases/list"
        params = {
            'page': page,
            'per_page': per_page
        }
        return self._make_request(endpoint, params=params)
    
    def get_case_details(self, case_id: int) -> Dict[str, Any]:
        """Get detailed information about a specific case"""
        # Try different endpoint patterns
        endpoints = [
            f"/case/{case_id}/view",
            f"/manage/case/{case_id}",
            f"/case/{case_id}"
        ]
        
        for endpoint in endpoints:
            result = self._make_request(endpoint)
            if 'error' not in result:
                return result
        
        return {"error": "Could not find case details endpoint"}
    
    def get_case_stats(self) -> Dict[str, Any]:
        """Get case statistics and summary"""
        # Try to get stats from cases list
        cases_data = self.get_cases(per_page=1000)  # Get all cases for stats
        if 'error' not in cases_data:
            return {"data": cases_data, "message": "Stats derived from cases list"}
        
        return {"error": "Could not get case statistics"}
    
    def get_case_timeline(self, case_id: int) -> Dict[str, Any]:
        """Get case timeline events"""
        endpoint = f"/case/timeline/{case_id}"
        return self._make_request(endpoint)
    
    def get_case_assets(self, case_id: int) -> Dict[str, Any]:
        """Get case assets"""
        endpoint = f"/case/assets/{case_id}"
        return self._make_request(endpoint)
    
    def get_case_iocs(self, case_id: int) -> Dict[str, Any]:
        """Get case IOCs"""
        endpoint = f"/case/ioc/list"
        params = {'case_id': case_id}
        return self._make_request(endpoint, params=params)
    
    def get_users(self) -> Dict[str, Any]:
        """Get users list"""
        endpoint = "/manage/users/list"
        return self._make_request(endpoint)
    
    def get_groups(self) -> Dict[str, Any]:
        """Get groups list"""
        endpoint = "/manage/groups/list"
        return self._make_request(endpoint)
    
    def test_connection(self) -> bool:
        """Test connection to IRIS API"""
        try:
            result = self.get_cases(per_page=1)
            return 'error' not in result
        except Exception as e:
            self.logger.error(f"❌ Connection test failed: {e}")
            return False

# Initialize IRIS client
iris_client = IrisClient(
    base_url="https://10.10.192.205:4433",
    api_key="eXxBbULqFxmWmnAgTkLPZ4Kj7QlsimyaqM1ODQrv0etpGsIrsOwr0rslDhodU38uyWk879GZ7UHYgiop4zTjqA",  # REPLACE WITH YOUR ACTUAL API KEY
    verify_ssl=False
)

class CaseManagementProcessor:
    """Process case data for dashboard display"""
    
    @staticmethod
    def process_cases_summary(raw_cases: Dict[str, Any]) -> Dict[str, Any]:
        """Process raw cases data into dashboard summary"""
        if not raw_cases or 'error' in raw_cases:
            logging.warning("❌ No valid cases data received from IRIS")
            return CaseManagementProcessor.get_empty_summary()
        
        # Extract cases from response
        cases = CaseManagementProcessor.extract_cases_from_response(raw_cases)
        total_cases = len(cases)
        
        logging.info(f"📊 Processing {total_cases} cases from IRIS")
        
        if total_cases == 0:
            return CaseManagementProcessor.get_empty_summary()
        
        # Calculate statistics
        status_counts = {}
        severity_counts = {}
        analyst_assignments = {}
        open_cases = 0
        closed_cases = 0
        
        for case in cases:
            # Handle different field name possibilities
            status = case.get('status', case.get('case_status', case.get('state', 'Unknown')))
            severity = case.get('severity', case.get('case_severity', 'Unknown'))
            analyst = case.get('user_name', case.get('assigned_to', case.get('owner', 'Unassigned')))
            
            status_counts[status] = status_counts.get(status, 0) + 1
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
            analyst_assignments[analyst] = analyst_assignments.get(analyst, 0) + 1
            
            if str(status).lower() in ['open', 'investigating', 'active']:
                open_cases += 1
            elif str(status).lower() in ['closed', 'resolved', 'completed']:
                closed_cases += 1
        
        return {
            'summary': {
                'total_cases': total_cases,
                'open_cases': open_cases,
                'closed_cases': closed_cases,
                'active_investigations': open_cases,
                'average_resolution_time': '24h',
                'cases_this_week': total_cases,
                'escalated_cases': sum(1 for case in cases if CaseManagementProcessor.get_severity_level(case) >= 3)
            },
            'charts': {
                'status_distribution': status_counts,
                'severity_distribution': severity_counts,
                'analyst_workload': dict(sorted(analyst_assignments.items(), 
                                              key=lambda x: x[1], reverse=True)[:10])
            },
            'recent_cases': sorted(cases, 
                                 key=lambda x: x.get('created_at', x.get('case_open_date', x.get('date_created', ''))), 
                                 reverse=True)[:10],
            'last_updated': datetime.now().isoformat()
        }
    
    @staticmethod
    def get_severity_level(case: Dict[str, Any]) -> int:
        """Get severity level as integer"""
        severity = case.get('severity', case.get('case_severity', 'low'))
        severity_str = str(severity).lower()
        
        if 'critical' in severity_str or severity == 4:
            return 4
        elif 'high' in severity_str or severity == 3:
            return 3
        elif 'medium' in severity_str or severity == 2:
            return 2
        else:
            return 1
    
    @staticmethod
    def extract_cases_from_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract cases from IRIS API response"""
        if not response:
            return []
        
        # Direct list response
        if isinstance(response, list):
            return response
        
        # Data object with cases
        if 'data' in response and isinstance(response['data'], list):
            return response['data']
        
        # Cases key in response
        if 'cases' in response and isinstance(response['cases'], list):
            return response['cases']
        
        # Try to find any list in the response
        for key, value in response.items():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                if any(field in value[0] for field in ['case_id', 'id', 'name', 'title']):
                    return value
        
        logging.warning(f"⚠️ Could not extract cases from response. Keys: {list(response.keys())}")
        return []
    
    @staticmethod
    def get_empty_summary():
        return {
            'summary': {
                'total_cases': 0,
                'open_cases': 0,
                'closed_cases': 0,
                'active_investigations': 0,
                'average_resolution_time': '0h',
                'cases_this_week': 0,
                'escalated_cases': 0
            },
            'charts': {
                'status_distribution': {},
                'severity_distribution': {},
                'analyst_workload': {}
            },
            'recent_cases': [],
            'last_updated': datetime.now().isoformat()
        }

# API Routes
@case_management_bp.route('/api/case-management/summary')
def get_case_summary():
    """Get case management summary"""
    try:
        logging.info("📊 Fetching case management summary from IRIS")
        
        # Get cases data to build summary
        cases_data = iris_client.get_cases(per_page=100)
        
        logging.info(f"🔍 Cases response type: {type(cases_data)}")
        if cases_data and not isinstance(cases_data, dict):
            logging.info(f"🔍 Cases response length: {len(cases_data) if hasattr(cases_data, '__len__') else 'N/A'}")
        
        processed_data = CaseManagementProcessor.process_cases_summary(cases_data)
        return jsonify(processed_data)
        
    except Exception as e:
        logging.error(f"❌ Case management summary error: {e}")
        return jsonify(CaseManagementProcessor.get_empty_summary())

@case_management_bp.route('/api/case-management/cases')
def get_cases():
    """Get cases with pagination and filtering"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        status = request.args.get('status', '')
        severity = request.args.get('severity', '')

        logging.info(f"📊 Fetching cases from IRIS")
        
        cases_data = iris_client.get_cases(page=page, per_page=per_page)
        
        if 'error' in cases_data:
            logging.error(f"❌ IRIS API error: {cases_data['error']}")
            return jsonify({'error': cases_data['error']}), 500
        
        # Extract cases from response
        all_cases = CaseManagementProcessor.extract_cases_from_response(cases_data)
        logging.info(f"📋 Extracted {len(all_cases)} cases from IRIS response")
        
        # Apply filters if provided
        filtered_cases = all_cases
        
        if status:
            filtered_cases = [c for c in filtered_cases if 
                             str(c.get('status', c.get('case_status', ''))).lower() == status.lower()]
        
        if severity:
            filtered_cases = [c for c in filtered_cases if 
                             str(c.get('severity', c.get('case_severity', ''))).lower() == severity.lower()]
        
        # Calculate pagination
        total_cases = len(filtered_cases)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_cases = filtered_cases[start_idx:end_idx]
        
        return jsonify({
            'cases': paginated_cases,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_cases,
                'pages': (total_cases + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logging.error(f"❌ Get cases error: {e}")
        return jsonify({'error': str(e)}), 500

@case_management_bp.route('/api/case-management/health')
def health_check():
    """Check IRIS connection health"""
    try:
        is_healthy = iris_client.test_connection()
        
        return jsonify({
            "status": "healthy" if is_healthy else "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "iris_connection": is_healthy,
            "iris_url": iris_client.base_url
        })
        
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@case_management_bp.route('/api/case-management/debug')
def debug_iris():
    """Debug endpoint to check IRIS connection and data"""
    try:
        # Test connection
        connection_test = iris_client.test_connection()
        
        # Get cases data
        cases_data = iris_client.get_cases(per_page=5)
        
        # Get users and groups
        users_data = iris_client.get_users()
        groups_data = iris_client.get_groups()
        
        return jsonify({
            "connection_test": connection_test,
            "cases_data_sample": cases_data[:3] if isinstance(cases_data, list) and len(cases_data) > 3 else cases_data,
            "users_count": len(users_data) if isinstance(users_data, list) else 0,
            "groups_count": len(groups_data) if isinstance(groups_data, list) else 0,
            "iris_url": iris_client.base_url,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
