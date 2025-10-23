from flask import Blueprint, jsonify, request
import requests
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import urllib3

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint
threat_intel_bp = Blueprint('threat_intel', __name__)

class ThreatIntelClient:
    """Threat Intelligence client for MISP and Wazuh integration"""
    
    def __init__(self, wazuh_client=None):
        self.wazuh_client = wazuh_client
        self.misp_url = "https://10.10.192.205:9443"
        self.misp_api_key = "lAkNiNnu2hfwRNqudDP0smZDJebVESbE4xTHnDLc"
        
        # Setup MISP session
        self.misp_session = requests.Session()
        self.misp_session.headers.update({
            'Authorization': self.misp_api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.misp_session.verify = False  # Disable SSL verification
        self.misp_timeout = 30
        
        # Cache for feeds
        self._feeds_cache = None
        self._feeds_cache_time = None
        self._cache_timeout = 300  # 5 minutes
        
        logger.info("✅ Threat Intelligence client initialized")

    def get_threat_alerts(self, start_time: str = None, end_time: str = None, size: int = 1000) -> Dict[str, Any]:
        """Get threat intelligence alerts from Wazuh (MISP IoC matches)"""
        if not self.wazuh_client:
            logger.error("❌ Wazuh client not available")
            return {"alerts": [], "total": 0, "summary": self._get_empty_alerts_summary()}
            
        try:
            # Query for actual MISP IoC matches - based on the real example
            query = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "terms": {
                                    "rule.groups": ["misp", "misp_alert"]
                                }
                            },
                            {
                                "exists": {
                                    "field": "data.misp"
                                }
                            }
                        ],
                        "must_not": [
                            {"wildcard": {"rule.description": "*Error*"}},
                            {"wildcard": {"rule.description": "*error*"}}
                        ]
                    }
                },
                "size": size,
                "sort": [{"timestamp": {"order": "desc"}}],
                "_source": [
                    "timestamp", "agent", "manager", "rule", 
                    "data.misp", "location", "decoder"
                ]
            }
            
            # Add time range filter if provided
            if start_time and end_time:
                if "query" in query and "bool" in query["query"]:
                    if "filter" not in query["query"]["bool"]:
                        query["query"]["bool"]["filter"] = []
                    query["query"]["bool"]["filter"].append({
                        "range": {
                            "timestamp": {
                                "gte": start_time,
                                "lte": end_time
                            }
                        }
                    })
            
            logger.info(f"🔍 Querying threat alerts from {start_time} to {end_time}")
            result = self.wazuh_client._make_request("wazuh-alerts-*/_search", query)
            
            # Process and enrich the alerts
            processed_alerts = self._process_threat_alerts(result)
            
            return processed_alerts
            
        except Exception as e:
            logger.error(f"❌ Failed to get threat alerts: {e}")
            return {"alerts": [], "total": 0, "summary": self._get_empty_alerts_summary()}

    def _process_threat_alerts(self, raw_alerts: Dict[str, Any]) -> Dict[str, Any]:
        """Process and enrich threat alerts"""
        if not raw_alerts or 'hits' not in raw_alerts:
            return {"alerts": [], "total": 0, "summary": self._get_empty_alerts_summary()}
        
        alerts = []
        severity_counts = {12: 0, 10: 0, 7: 0}
        ioc_types = {}
        categories = {}
        agents = set()
        
        for hit in raw_alerts['hits']['hits']:
            alert = self._process_single_alert(hit)
            if alert:
                alerts.append(alert)
                
                # Update statistics
                severity = alert['severity']
                if severity >= 12:
                    severity_counts[12] += 1
                elif severity >= 10:
                    severity_counts[10] += 1
                elif severity >= 7:
                    severity_counts[7] += 1
                
                ioc_type = alert['ioc_type']
                ioc_types[ioc_type] = ioc_types.get(ioc_type, 0) + 1
                
                category = alert['category']
                categories[category] = categories.get(category, 0) + 1
                
                agents.add(alert['agent_name'])
        
        summary = {
            'total_alerts': len(alerts),
            'critical_alerts': severity_counts[12],
            'high_alerts': severity_counts[10],
            'medium_alerts': severity_counts[7],
            'unique_iocs': len(set(alert['ioc_value'] for alert in alerts)),
            'affected_agents': len(agents),
            'ioc_types': ioc_types,
            'categories': categories,
            'time_range': f"Last update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        }
        
        return {
            "alerts": alerts,
            "total": len(alerts),
            "summary": summary,
            "raw_total": raw_alerts['hits']['total']['value'] if 'hits' in raw_alerts else 0
        }
    
    def _process_single_alert(self, hit: Dict) -> Optional[Dict[str, Any]]:
        """Process a single threat alert based on the real example"""
        try:
            source = hit.get('_source', {})
            rule = source.get('rule', {})
            agent = source.get('agent', {})
            misp_data = source.get('data', {}).get('misp', {})
            
            # Skip if no proper MISP data found
            if not misp_data or not isinstance(misp_data, dict):
                return None
            
            # Skip error alerts
            rule_description = rule.get('description', '').lower()
            if 'error' in rule_description:
                return None
            
            # Extract MISP data from the structure in your example
            event_id = misp_data.get('event_id')
            ioc_value = misp_data.get('value')
            ioc_type = misp_data.get('type')
            category = misp_data.get('category')
            
            # Skip if essential data is missing
            if not ioc_value or not ioc_type:
                return None
            
            timestamp = source.get('timestamp')
            if not timestamp:
                timestamp = datetime.now().isoformat()
            
            # Create alert object based on the real example structure
            alert_data = {
                'id': hit.get('_id', ''),
                'timestamp': timestamp,
                'severity': rule.get('level', 0),
                'agent_name': agent.get('name', 'Unknown'),
                'agent_ip': agent.get('ip', 'Unknown'),
                'agent_id': agent.get('id', ''),
                'rule_id': rule.get('id', ''),
                'rule_description': rule.get('description', 'MISP IoC Match'),
                'ioc_value': ioc_value,
                'ioc_type': ioc_type,
                'category': category or 'Network activity',
                'event_id': event_id or '',
                'source_description': misp_data.get('source', {}).get('description', 'MISP'),
                'location': source.get('location', ''),
                'manager': source.get('manager', {}).get('name', ''),
                'data': source
            }
            
            return alert_data
            
        except Exception as e:
            logger.error(f"❌ Error processing threat alert: {e}")
            return None

    def get_threat_feeds(self, limit: int = 12) -> Dict[str, Any]:
        """Get MISP threat intelligence feeds"""
        try:
            # Check cache first
            if (self._feeds_cache and self._feeds_cache_time and 
                (datetime.now() - self._feeds_cache_time).total_seconds() < self._cache_timeout):
                logger.info("🔄 Returning cached threat feeds")
                return self._feeds_cache
            
            # Test MISP connectivity first
            if not self._test_misp_connection():
                logger.error("❌ MISP connection test failed")
                return {"error": "Cannot connect to MISP server", "events": [], "summary": self._get_empty_feeds_summary()}
            
            # Get events from MISP - try multiple endpoints
            events_url = f"{self.misp_url}/events"
            params = {
                'limit': limit,
                'page': 1,
                'sort': 'timestamp',
                'direction': 'desc',
                'published': 1
            }
            
            logger.info(f"🔍 Fetching threat feeds from MISP: {events_url}")
            response = self.misp_session.get(events_url, params=params, timeout=self.misp_timeout)
            
            if response.status_code != 200:
                logger.error(f"❌ MISP /events returned status {response.status_code}: {response.text}")
                return {"error": f"MISP API error: {response.status_code}", "events": [], "summary": self._get_empty_feeds_summary()}
            
            events_data = response.json()
            
            # Process events based on MISP response format
            events_list = []
            if isinstance(events_data, list):
                events_list = events_data
            elif isinstance(events_data, dict):
                if 'response' in events_data:
                    events_list = events_data['response']
                elif 'Event' in events_data:
                    events_list = [events_data]
                else:
                    # Try to extract events from the root level
                    events_list = [v for k, v in events_data.items() if isinstance(v, dict) and 'id' in v]
            else:
                logger.warning(f"⚠️ Unexpected MISP response format: {type(events_data)}")
                events_list = []
            
            # Process events for display - get full event details
            processed_events = []
            for event in events_list[:limit]:
                processed_event = self._get_full_event_details(event)
                if processed_event:
                    processed_events.append(processed_event)
            
            # If we couldn't get events, return empty
            if not processed_events:
                logger.warning("⚠️ No events processed from MISP response")
                return {"events": [], "summary": self._get_empty_feeds_summary()}
            
            # Get summary statistics
            summary = self._get_feeds_summary(processed_events)
            
            result = {
                "events": processed_events,
                "total": len(processed_events),
                "summary": summary
            }
            
            # Cache the result
            self._feeds_cache = result
            self._feeds_cache_time = datetime.now()
            
            logger.info(f"✅ Retrieved {len(processed_events)} threat feeds from MISP")
            return result
                
        except requests.exceptions.Timeout:
            logger.error("❌ MISP request timed out")
            return {"error": "MISP server timeout", "events": [], "summary": self._get_empty_feeds_summary()}
        except requests.exceptions.ConnectionError:
            logger.error("❌ MISP connection error")
            return {"error": "Cannot connect to MISP server", "events": [], "summary": self._get_empty_feeds_summary()}
        except Exception as e:
            logger.error(f"❌ Failed to get threat feeds: {e}")
            return {"error": str(e), "events": [], "summary": self._get_empty_feeds_summary()}

    def _test_misp_connection(self) -> bool:
        """Test if MISP server is reachable"""
        try:
            test_url = f"{self.misp_url}/events"
            response = self.misp_session.get(test_url, params={'limit': 1}, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"❌ MISP connection test failed: {e}")
            return False

    def _get_full_event_details(self, event: Dict) -> Optional[Dict[str, Any]]:
        """Get full event details from MISP"""
        try:
            # Extract event ID
            if 'Event' in event:
                event_id = event['Event'].get('id')
            else:
                event_id = event.get('id')
            
            if not event_id:
                logger.warning("⚠️ No event ID found in MISP response")
                return None
            
            # Get full event details
            event_url = f"{self.misp_url}/events/{event_id}"
            response = self.misp_session.get(event_url, timeout=self.misp_timeout)
            
            if response.status_code != 200:
                logger.warning(f"⚠️ Failed to get details for event {event_id}: {response.status_code}")
                return self._process_misp_event(event)  # Fallback to basic processing
            
            event_details = response.json()
            return self._process_misp_event(event_details)
            
        except Exception as e:
            logger.error(f"❌ Error getting full event details: {e}")
            return self._process_misp_event(event)  # Fallback to basic processing

    def _process_misp_event(self, event: Dict) -> Optional[Dict[str, Any]]:
        """Process a single MISP event for display"""
        try:
            # Extract event data based on MISP API structure
            if 'Event' in event:
                event_data = event['Event']
            else:
                event_data = event
            
            event_id = event_data.get('id')
            if not event_id:
                return None
            
            # Get basic event info
            processed_event = {
                'id': event_id,
                'info': event_data.get('info', 'Untitled Event'),
                'date': event_data.get('date', ''),
                'timestamp': event_data.get('timestamp', ''),
                'threat_level_id': str(event_data.get('threat_level_id', '1')),
                'analysis': str(event_data.get('analysis', '0')),
                'description': event_data.get('description', 'No description available.'),
                'published': bool(event_data.get('published', False))
            }
            
            # Get tags
            tags = []
            if 'Tag' in event_data:
                tags = [tag.get('name', '') for tag in event_data.get('Tag', []) if tag.get('name')]
            elif 'tags' in event_data:
                tags = [tag for tag in event_data.get('tags', []) if tag]
            
            processed_event['tags'] = tags[:10]
            
            # Get attributes
            attributes = []
            if 'Attribute' in event_data:
                attributes = event_data.get('Attribute', [])
            elif 'attributes' in event_data:
                attributes = event_data.get('attributes', [])
            
            # Filter and limit attributes
            filtered_attributes = []
            for attr in attributes:
                if isinstance(attr, dict):
                    filtered_attributes.append({
                        'type': attr.get('type', 'unknown'),
                        'value': attr.get('value', ''),
                        'category': attr.get('category', '')
                    })
            
            processed_event['attributes'] = filtered_attributes[:8]
            processed_event['attribute_count'] = len(filtered_attributes)
            
            return processed_event
            
        except Exception as e:
            logger.error(f"❌ Error processing MISP event: {e}")
            return None

    def _get_feeds_summary(self, events: List[Dict]) -> Dict[str, Any]:
        """Get comprehensive summary from processed events"""
        try:
            total_events = len(events)
            total_attributes = sum(event.get('attribute_count', 0) for event in events)
            
            # Count unique tags
            all_tags = set()
            for event in events:
                all_tags.update(event.get('tags', []))
            
            # Count threat levels
            threat_levels = {'1': 0, '2': 0, '3': 0, '4': 0}
            for event in events:
                level = event.get('threat_level_id', '1')
                threat_levels[level] = threat_levels.get(level, 0) + 1
            
            # Count analysis status
            analysis_status = {'0': 0, '1': 0, '2': 0}
            for event in events:
                analysis = event.get('analysis', '0')
                analysis_status[analysis] = analysis_status.get(analysis, 0) + 1
            
            summary = {
                'total_events': total_events,
                'total_attributes': total_attributes,
                'unique_tags': len(all_tags),
                'last_7_days': total_events,  # Since we're showing recent events
                'threat_levels': threat_levels,
                'analysis_status': analysis_status,
                'last_updated': datetime.now().isoformat()
            }
            
            return summary
                
        except Exception as e:
            logger.error(f"❌ Failed to get feeds summary: {e}")
            return self._get_empty_feeds_summary()

    def _get_empty_alerts_summary(self) -> Dict[str, Any]:
        return {
            'total_alerts': 0,
            'critical_alerts': 0,
            'high_alerts': 0,
            'medium_alerts': 0,
            'unique_iocs': 0,
            'affected_agents': 0,
            'ioc_types': {},
            'categories': {},
            'time_range': 'No data available'
        }

    def _get_empty_feeds_summary(self) -> Dict[str, Any]:
        return {
            'total_events': 0,
            'total_attributes': 0,
            'unique_tags': 0,
            'last_7_days': 0,
            'threat_levels': {'1': 0, '2': 0, '3': 0, '4': 0},
            'analysis_status': {'0': 0, '1': 0, '2': 0},
            'last_updated': datetime.now().isoformat()
        }

# Initialize Threat Intelligence client
threat_intel_client = None

# API Routes
@threat_intel_bp.route('/api/threat-intel/alerts')
def get_threat_intel_alerts():
    """Get threat intelligence alerts from Wazuh (MISP IoC matches)"""
    try:
        if not threat_intel_client:
            return jsonify({"error": "Threat intelligence client not initialized"}), 500
            
        # Get query parameters
        time_range = request.args.get('time_range', '24h')
        
        # Calculate time range
        end_time = datetime.now()
        if time_range == '1h':
            start_time = end_time - timedelta(hours=1)
        elif time_range == '24h':
            start_time = end_time - timedelta(hours=24)
        elif time_range == '7d':
            start_time = end_time - timedelta(days=7)
        elif time_range == '30d':
            start_time = end_time - timedelta(days=30)
        else:
            start_time = end_time - timedelta(hours=24)
        
        # Get threat alerts
        result = threat_intel_client.get_threat_alerts(
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            size=1000
        )
        
        if 'error' in result:
            return jsonify({"error": result['error']}), 500
        
        alerts = result.get('alerts', [])
        summary = result.get('summary', {})
        
        # Apply simple filters
        severity_filter = request.args.get('severity')
        ioc_type_filter = request.args.get('ioc_type')
        category_filter = request.args.get('category')
        search_query = request.args.get('search', '').lower()
        
        if severity_filter:
            min_severity = int(severity_filter)
            alerts = [alert for alert in alerts if alert['severity'] >= min_severity]
        
        if ioc_type_filter:
            alerts = [alert for alert in alerts if alert['ioc_type'] == ioc_type_filter]
        
        if category_filter:
            alerts = [alert for alert in alerts if alert['category'] == category_filter]
        
        if search_query:
            alerts = [
                alert for alert in alerts 
                if (search_query in alert['ioc_value'].lower() or 
                    search_query in alert['agent_name'].lower() or
                    search_query in alert['rule_description'].lower() or
                    search_query in alert['category'].lower())
            ]
        
        # Pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_alerts = alerts[start_idx:end_idx]
        
        # Update summary with filtered results
        filtered_summary = {
            'total_alerts': len(alerts),
            'critical_alerts': len([a for a in alerts if a['severity'] >= 12]),
            'high_alerts': len([a for a in alerts if a['severity'] >= 10]),
            'medium_alerts': len([a for a in alerts if a['severity'] >= 7]),
            'unique_iocs': len(set(a['ioc_value'] for a in alerts)),
            'affected_agents': len(set(a['agent_name'] for a in alerts)),
            'time_range': f"Filtered: {len(alerts)} alerts"
        }
        
        return jsonify({
            'alerts': paginated_alerts,
            'summary': filtered_summary,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': len(alerts),
                'pages': (len(alerts) + per_page - 1) // per_page
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Threat intel alerts error: {e}")
        return jsonify({"error": str(e)}), 500

@threat_intel_bp.route('/api/threat-intel/feeds')
def get_threat_intel_feeds():
    """Get MISP threat intelligence feeds"""
    try:
        if not threat_intel_client:
            return jsonify({"error": "Threat intelligence client not initialized"}), 500
            
        # Get query parameters
        limit = int(request.args.get('limit', 12))
        
        # Get threat feeds
        result = threat_intel_client.get_threat_feeds(limit=limit)
        
        if 'error' in result:
            return jsonify({"error": result['error']}), 500
        
        events = result.get('events', [])
        summary = result.get('summary', {})
        
        # Apply simple filters
        threat_level = request.args.get('threat_level')
        analysis = request.args.get('analysis')
        search_query = request.args.get('search', '').lower()
        
        if threat_level:
            events = [event for event in events if event['threat_level_id'] == threat_level]
        
        if analysis:
            events = [event for event in events if event['analysis'] == analysis]
        
        if search_query:
            events = [
                event for event in events 
                if (search_query in event['info'].lower() or 
                    search_query in event['description'].lower() or
                    any(search_query in tag.lower() for tag in event.get('tags', [])))
            ]
        
        # Pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 12))
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_events = events[start_idx:end_idx]
        
        return jsonify({
            'events': paginated_events,
            'summary': summary,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': len(events),
                'pages': (len(events) + per_page - 1) // per_page
            },
            'timestamp': datetime.now().isoformat(),
            'auto_refresh': True,
            'refresh_interval': 60
        })
        
    except Exception as e:
        logger.error(f"❌ Threat intel feeds error: {e}")
        return jsonify({"error": str(e)}), 500

@threat_intel_bp.route('/api/threat-intel/stats')
def get_threat_intel_stats():
    """Get comprehensive threat intelligence statistics"""
    try:
        if not threat_intel_client:
            return jsonify({"error": "Threat intelligence client not initialized"}), 500
            
        # Get alerts stats
        alerts_result = threat_intel_client.get_threat_alerts(
            start_time=(datetime.now() - timedelta(days=7)).isoformat(),
            end_time=datetime.now().isoformat()
        )
        
        # Get feeds stats
        feeds_result = threat_intel_client.get_threat_feeds(limit=12)
        
        stats = {
            'alerts': alerts_result.get('summary', {}),
            'feeds': feeds_result.get('summary', {}),
            'timestamp': datetime.now().isoformat(),
            'time_range': 'Last 7 days',
            'feeds_auto_refresh': True,
            'feeds_refresh_interval': 60
        }
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"❌ Threat intel stats error: {e}")
        return jsonify({"error": str(e)}), 500

# Helper function to initialize the threat intelligence client
def init_threat_intel_client(wazuh_client=None):
    """Initialize the threat intelligence client"""
    global threat_intel_client
    threat_intel_client = ThreatIntelClient(wazuh_client)
    logger.info("✅ Threat Intelligence client initialized")
