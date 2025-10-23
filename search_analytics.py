from flask import Blueprint, request, jsonify
import logging
from datetime import datetime, timedelta
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import requests
import urllib3
from config import Config

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

search_analytics_bp = Blueprint('search_analytics', __name__)

logger = logging.getLogger(__name__)

@dataclass
class SearchQuery:
    """Represents a search query with filters"""
    query_string: str = ""
    time_range: str = "24h"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    filters: Dict[str, Any] = None
    size: int = 100
    from_: int = 0
    sort_field: str = "@timestamp"
    sort_order: str = "desc"

    def __post_init__(self):
        if self.filters is None:
            self.filters = {}

class OpenSearchClient:
    """Direct OpenSearch/Wazuh Indexer client"""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 9200, 
                 username: str = "admin", password: str = "admin", 
                 verify_ssl: bool = False):
        self.base_url = f"https://{host}:{port}"
        self.auth = (username, password)
        self.verify_ssl = verify_ssl
        self.session = requests.Session()
        self.session.auth = self.auth
        self.session.verify = self.verify_ssl
        self.logger = logging.getLogger(__name__)
    
    def search(self, index: str, query: Dict, size: int = 100, from_: int = 0) -> Dict[str, Any]:
        """Execute search query against OpenSearch"""
        try:
            url = f"{self.base_url}/{index}/_search"
            
            search_body = {
                "query": query,
                "size": size,
                "from": from_,
                "sort": [{"@timestamp": {"order": "desc"}}]
            }
            
            self.logger.info(f"🔍 Executing OpenSearch query on {index}")
            
            response = self.session.post(url, json=search_body, timeout=30)
            response.raise_for_status()
            result = response.json()
            
            return result
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ OpenSearch request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                self.logger.error(f"❌ Response content: {e.response.text}")
            return {"error": str(e), "hits": {"hits": [], "total": {"value": 0}}}

class AdvancedSearchEngine:
    """Advanced search engine for Wazuh events"""
    
    def __init__(self):
        self.client = OpenSearchClient(
            host=Config.WAZUH_HOST,
            username=Config.WAZUH_USERNAME, 
            password=Config.WAZUH_PASSWORD,
            verify_ssl=False
        )
        self.logger = logging.getLogger(__name__)
    
    def build_query(self, search_query: SearchQuery) -> Dict[str, Any]:
        """Build OpenSearch query with keyword matching"""
        
        # Build time range filter
        time_range = self._build_time_range(search_query)
        
        # Build main query
        if search_query.query_string.strip():
            # Check if it's a field-specific search (contains :)
            if ":" in search_query.query_string and not search_query.query_string.startswith(":"):
                try:
                    # Field-specific search
                    field, value = search_query.query_string.split(":", 1)
                    field = field.strip()
                    value = value.strip()
                    
                    # Remove quotes if present
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                        # Exact phrase search
                        main_query = {
                            "match_phrase": {
                                field: value
                            }
                        }
                    else:
                        # Keyword search for the specific field
                        main_query = {
                            "match": {
                                field: {
                                    "query": value,
                                    "operator": "and"
                                }
                            }
                        }
                except ValueError:
                    # Fallback to general search if parsing fails
                    main_query = {
                        "multi_match": {
                            "query": search_query.query_string,
                            "fields": [
                                "agent.name", "agent.ip", "rule.description", 
                                "rule.id", "location", "full_log",
                                "data.srcip", "data.srcuser", "rule.mitre.tactic",
                                "syscheck.path", "data.win.eventdata.image"
                            ],
                            "operator": "and",
                            "type": "best_fields"
                        }
                    }
            else:
                # General keyword search across all fields
                main_query = {
                    "multi_match": {
                        "query": search_query.query_string,
                        "fields": [
                            "agent.name", "agent.ip", "rule.description", 
                            "rule.id", "location", "full_log",
                            "data.srcip", "data.srcuser", "rule.mitre.tactic",
                            "syscheck.path", "data.win.eventdata.image"
                        ],
                        "operator": "and",
                        "type": "best_fields"
                    }
                }
        else:
            main_query = {"match_all": {}}
        
        # Build complete query with filters
        query = {
            "bool": {
                "must": [main_query],
                "filter": [{"range": {"@timestamp": time_range}}]
            }
        }
        
        # Add additional filters
        for field, value in search_query.filters.items():
            query["bool"]["filter"].append({"term": {field: value}})
        
        return query
    
    def execute_search(self, search_query: SearchQuery) -> Dict[str, Any]:
        """Execute search across Wazuh indices"""
        try:
            # Build query
            query = self.build_query(search_query)
            
            # Execute search
            result = self.client.search(
                index="wazuh-alerts-*",
                query=query,
                size=search_query.size,
                from_=search_query.from_
            )
            
            return self._process_search_results(result, search_query)
            
        except Exception as e:
            self.logger.error(f"❌ Search execution failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "hits": [],
                "total": 0,
                "took": 0
            }
    
    def _build_time_range(self, search_query: SearchQuery) -> Dict[str, str]:
        """Build time range filter"""
        if search_query.start_time and search_query.end_time:
            return {
                "gte": search_query.start_time,
                "lte": search_query.end_time,
                "format": "strict_date_optional_time"
            }
        
        # Relative time ranges
        now = datetime.now()
        if search_query.time_range == "15m":
            start_time = now - timedelta(minutes=15)
        elif search_query.time_range == "1h":
            start_time = now - timedelta(hours=1)
        elif search_query.time_range == "24h":
            start_time = now - timedelta(hours=24)
        elif search_query.time_range == "7d":
            start_time = now - timedelta(days=7)
        elif search_query.time_range == "30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(hours=24)
        
        return {
            "gte": start_time.isoformat(),
            "lte": now.isoformat(),
            "format": "strict_date_optional_time"
        }
    
    def _process_search_results(self, result: Dict[str, Any], search_query: SearchQuery) -> Dict[str, Any]:
        """Process search results"""
        if "error" in result:
            return {
                "success": False,
                "error": result["error"],
                "hits": [],
                "total": 0,
                "took": 0
            }
        
        hits = result.get("hits", {}).get("hits", [])
        total = result.get("hits", {}).get("total", {}).get("value", 0)
        took = result.get("took", 0)
        
        processed_hits = []
        for hit in hits:
            source = hit.get("_source", {})
            processed_hit = {
                "id": hit.get("_id"),
                "index": hit.get("_index"),
                "score": hit.get("_score"),
                "timestamp": source.get("@timestamp"),
                "data": source
            }
            processed_hits.append(processed_hit)
        
        return {
            "success": True,
            "hits": processed_hits,
            "total": total,
            "took": took
        }
    
    def get_search_fields(self) -> List[Dict[str, str]]:
        """Get comprehensive list of searchable fields"""
        return [
            # Basic Fields
            {"name": "agent.name", "type": "keyword", "description": "Agent Name (keyword search)", "category": "Basic"},
            {"name": "agent.id", "type": "keyword", "description": "Agent ID", "category": "Basic"},
            {"name": "agent.ip", "type": "ip", "description": "Agent IP Address", "category": "Basic"},
            {"name": "manager.name", "type": "keyword", "description": "Manager Name", "category": "Basic"},
            {"name": "rule.level", "type": "integer", "description": "Severity Level", "category": "Basic"},
            {"name": "rule.description", "type": "text", "description": "Rule Description (keyword search)", "category": "Basic"},
            {"name": "rule.id", "type": "keyword", "description": "Rule ID", "category": "Basic"},
            {"name": "location", "type": "keyword", "description": "Event Location", "category": "Basic"},
            
            # MITRE ATT&CK
            {"name": "rule.mitre.tactic", "type": "keyword", "description": "MITRE Tactic", "category": "MITRE"},
            {"name": "rule.mitre.technique", "type": "keyword", "description": "MITRE Technique", "category": "MITRE"},
            {"name": "rule.mitre.id", "type": "keyword", "description": "MITRE Technique ID", "category": "MITRE"},
            
            # File Integrity (FIM)
            {"name": "syscheck.event", "type": "keyword", "description": "FIM Event Type", "category": "FIM"},
            {"name": "syscheck.path", "type": "keyword", "description": "File/Registry Path (keyword search)", "category": "FIM"},
            {"name": "syscheck.value_name", "type": "keyword", "description": "Registry Value Name", "category": "FIM"},
            {"name": "syscheck.mode", "type": "keyword", "description": "FIM Check Mode", "category": "FIM"},
            
            # Windows Events
            {"name": "data.win.system.eventID", "type": "integer", "description": "Windows Event ID", "category": "Windows"},
            {"name": "data.win.eventdata.image", "type": "keyword", "description": "Process Image (keyword search)", "category": "Windows"},
            {"name": "data.win.eventdata.commandLine", "type": "text", "description": "Command Line (keyword search)", "category": "Windows"},
            {"name": "data.win.eventdata.parentImage", "type": "keyword", "description": "Parent Process", "category": "Windows"},
            
            # Network & Authentication
            {"name": "data.srcip", "type": "ip", "description": "Source IP Address", "category": "Network"},
            {"name": "data.srcport", "type": "integer", "description": "Source Port", "category": "Network"},
            {"name": "data.srcuser", "type": "keyword", "description": "Source User (keyword search)", "category": "Network"},
            {"name": "data.dstuser", "type": "keyword", "description": "Destination User", "category": "Network"},
            
            # Compliance
            {"name": "rule.pci_dss", "type": "keyword", "description": "PCI DSS", "category": "Compliance"},
            {"name": "rule.hipaa", "type": "keyword", "description": "HIPAA", "category": "Compliance"},
            {"name": "rule.gdpr", "type": "keyword", "description": "GDPR", "category": "Compliance"},
            
            # Other
            {"name": "decoder.name", "type": "keyword", "description": "Decoder Name", "category": "Other"},
            {"name": "full_log", "type": "text", "description": "Full Log Message (keyword search)", "category": "Other"},
            {"name": "@timestamp", "type": "date", "description": "Timestamp", "category": "Other"},
        ]

# Create search engine instance
search_engine = AdvancedSearchEngine()

@search_analytics_bp.route('/api/search/query', methods=['POST'])
def execute_advanced_search():
    """Execute search query"""
    try:
        data = request.get_json()
        
        search_query = SearchQuery(
            query_string=data.get('query', ''),
            time_range=data.get('time_range', '24h'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            size=data.get('size', 100),
            from_=data.get('from', 0)
        )
        
        result = search_engine.execute_search(search_query)
        return jsonify(result)
        
    except Exception as e:
        logging.error(f"❌ Search API error: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "hits": [],
            "total": 0,
            "took": 0
        }), 500

@search_analytics_bp.route('/api/search/fields', methods=['GET'])
def get_search_fields():
    """Get all searchable fields"""
    fields = search_engine.get_search_fields()
    
    return jsonify({
        "success": True,
        "fields": fields
    })

@search_analytics_bp.route('/api/search/test-connection', methods=['GET'])
def test_opensearch_connection():
    """Test OpenSearch connection"""
    try:
        client = OpenSearchClient()
        response = client.session.get(f"{client.base_url}/_cluster/health", timeout=10)
        response.raise_for_status()
        
        return jsonify({
            "success": True,
            "status": "connected",
            "cluster_status": response.json().get("status")
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "status": "disconnected",
            "error": str(e)
        }), 500

@search_analytics_bp.route('/api/search/saved', methods=['GET'])
def get_saved_searches():
    """Get saved search queries"""
    return jsonify({
        "saved_searches": [
            {
                "name": "High Severity Alerts",
                "query": "rule.level:>=10",
                "description": "Critical and high severity alerts"
            },
            {
                "name": "File Integrity Events", 
                "query": "syscheck.event:*",
                "description": "All file integrity monitoring events"
            },
            {
                "name": "Windows Process Creation",
                "query": "data.win.system.eventID:4688",
                "description": "Windows process creation events"
            },
            {
                "name": "Failed Logins",
                "query": "rule.description:failed login",
                "description": "Failed authentication attempts"
            },
            {
                "name": "MITRE Execution", 
                "query": "rule.mitre.tactic:Execution",
                "description": "MITRE Execution tactic events"
            }
        ]
    })
