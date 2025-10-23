# fim.py - File Integrity Monitoring Module
from flask import Blueprint, jsonify, request
import logging
from datetime import datetime, timedelta
import random
import os
from typing import Dict, List, Any
from config import Config

# Create Blueprint for FIM
fim_bp = Blueprint('fim', __name__)

logger = logging.getLogger(__name__)

class FIMDataProcessor:
    """Data processor for File Integrity Monitoring"""
    
    @staticmethod
    def process_fim_events(raw_fim_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process FIM events for the dashboard"""
        logging.debug("🔄 Processing FIM events")
        
        events = []
        
        # Check if we have real data from Wazuh
        if (raw_fim_data and 
            'hits' in raw_fim_data and 
            raw_fim_data['hits']['total']['value'] > 0 and
            len(raw_fim_data['hits']['hits']) > 0):
            
            logging.info(f"✅ Processing {raw_fim_data['hits']['total']['value']} real FIM events from Wazuh")
            events = FIMDataProcessor.extract_fim_events_from_wazuh(raw_fim_data)
        else:
            # Use sample data if no real data available
            logging.warning("❌ No real FIM data found, generating sample data")
            if raw_fim_data and 'error' in raw_fim_data:
                logging.error(f"❌ OpenSearch error: {raw_fim_data['error']}")
            
            events = FIMDataProcessor.generate_sample_fim_data()
            logging.info(f"📋 Generated {len(events)} sample FIM events")
        
        # Calculate summary metrics
        summary = FIMDataProcessor.calculate_fim_summary(events)
        
        logging.info(f"✅ FIM Processing Complete: {len(events)} events, summary: {summary}")
        
        return {
            'events': events,
            'summary': summary,
            'last_updated': datetime.now().isoformat(),
            'data_source': 'wazuh' if events and 'fim-' not in events[0]['id'] else 'sample'
        }
    
    @staticmethod
    def extract_fim_events_from_wazuh(raw_fim_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract FIM events from Wazuh response"""
        events = []
        
        for i, hit in enumerate(raw_fim_data['hits']['hits']):
            source = hit.get('_source', {})
            syscheck = source.get('syscheck', {})
            
            logging.debug(f"🔍 Processing FIM hit {i+1}: ID={hit.get('_id')}")
            logging.debug(f"🔍 Rule groups: {source.get('rule', {}).get('groups', [])}")
            logging.debug(f"🔍 Syscheck keys: {list(syscheck.keys())}")
            
            event = {
                'id': hit.get('_id', ''),
                'timestamp': source.get('@timestamp', ''),
                'agent_name': source.get('agent', {}).get('name', 'Unknown'),
                'filename': FIMDataProcessor.extract_filename(syscheck.get('path', '')),
                'file_path': syscheck.get('path', ''),
                'change_type': FIMDataProcessor.determine_change_type(syscheck, source.get('rule', {})),
                'user': syscheck.get('uname_after', 'Unknown'),
                'severity': FIMDataProcessor.calculate_fim_severity(syscheck.get('path', ''), source.get('rule', {}).get('level', 0)),
                'file_size': syscheck.get('size', 'N/A'),
                'file_hash': syscheck.get('sha256_after', syscheck.get('md5_after', 'N/A')),
                'process_name': 'syscheck',
                'agent_ip': source.get('agent', {}).get('ip', 'N/A'),
                'os_name': source.get('agent', {}).get('os', {}).get('name', 'N/A'),
                'rule_id': source.get('rule', {}).get('id', ''),
                'rule_description': source.get('rule', {}).get('description', ''),
                'changed_attributes': syscheck.get('changed_attributes', []),
                'registry_path': 'HKEY' in syscheck.get('path', '') if syscheck.get('path') else False
            }
            
            # Add Windows permissions if available
            if syscheck.get('win_perm_after'):
                event['windows_permissions'] = syscheck.get('win_perm_after', [])
            
            # Add old permissions if available
            if syscheck.get('perm_before'):
                event['old_permissions'] = syscheck.get('perm_before')
                event['new_permissions'] = syscheck.get('perm_after', 'N/A')
            
            events.append(event)
            
            # Log first event details for debugging
            if i == 0:
                logging.debug(f"🔍 First FIM event sample: {event}")
        
        logging.info(f"✅ Extracted {len(events)} FIM events from Wazuh")
        return events
    
    @staticmethod
    def extract_filename(path: str) -> str:
        """Extract filename from path"""
        if not path:
            return 'unknown'
        
        # Handle registry paths
        if path.startswith('HKEY_'):
            return path.split('\\')[-1] if '\\' in path else path
        
        # Handle file paths
        return os.path.basename(path)
    
    @staticmethod
    def determine_change_type(syscheck: Dict, rule: Dict) -> str:
        """Determine change type from syscheck data and rule description"""
        changed_attributes = syscheck.get('changed_attributes', [])
        rule_description = rule.get('description', '').lower()
        
        # Check for specific attribute changes first
        if 'perm' in changed_attributes:
            return 'permission'
        elif 'uid' in changed_attributes or 'gid' in changed_attributes:
            return 'ownership'
        elif 'mtime' in changed_attributes or 'ctime' in changed_attributes:
            return 'modified'
        elif 'size' in changed_attributes:
            return 'modified'
        
        # Fallback to rule description analysis
        if any(word in rule_description for word in ['added', 'created']):
            return 'created'
        elif any(word in rule_description for word in ['modified', 'changed']):
            return 'modified'
        elif any(word in rule_description for word in ['deleted', 'removed']):
            return 'deleted'
        
        # Default based on mode
        mode = syscheck.get('mode', '')
        if mode == 'realtime':
            return 'modified'
        elif mode == 'scheduled':
            return 'modified'
        
        return 'modified'  # Default fallback
    
    @staticmethod
    def calculate_fim_severity(file_path: str, rule_level: int) -> str:
        """Calculate severity based on file path and rule level"""
        path = (file_path or '').lower()
        
        # Critical files and registry keys
        critical_paths = [
            '/etc/passwd', '/etc/shadow', '/etc/sudoers', 
            'HKEY_LOCAL_MACHINE\\SAM', 'HKEY_LOCAL_MACHINE\\SECURITY',
            'HKEY_LOCAL_MACHINE\\SYSTEM', 'HKEY_LOCAL_MACHINE\\SOFTWARE'
        ]
        
        # Important system files
        system_paths = [
            '/etc/', '/bin/', '/sbin/', '/usr/bin/', '/usr/sbin/',
            'HKEY_LOCAL_MACHINE\\System', 'HKEY_LOCAL_MACHINE\\Windows'
        ]
        
        if any(critical in path for critical in critical_paths):
            return 'critical'
        elif any(system in path for system in system_paths):
            return 'high'
        elif rule_level >= 10:
            return 'high'
        elif rule_level >= 7:
            return 'medium'
        else:
            return 'low'
    
    @staticmethod
    def calculate_fim_summary(events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate FIM summary metrics"""
        total_files = len(set(event['file_path'] for event in events))
        total_changes = len(events)
        suspicious_changes = len([e for e in events if e['severity'] in ['high', 'critical']])
        monitored_agents = len(set(event['agent_name'] for event in events))
        
        # Calculate integrity score (higher is better)
        critical_changes = len([e for e in events if e['severity'] == 'critical'])
        integrity_score = max(0, 100 - (critical_changes * 2))
        
        return {
            'total_files': total_files,
            'total_changes': total_changes,
            'suspicious_changes': suspicious_changes,
            'monitored_agents': monitored_agents,
            'integrity_score': f"{integrity_score}%",
            'last_scan': f"{random.randint(1, 30)}m ago",
            'total_files_trend': f"+{random.randint(0, 5)}%",
            'changes_trend': f"+{random.randint(0, 15)}%",
            'suspicious_trend': f"+{random.randint(0, 25)}%",
            'agents_trend': "+0%",
            'integrity_trend': f"+{random.randint(0, 2)}%"
        }
    
    @staticmethod
    def generate_sample_fim_data():
        """Generate sample FIM data for demonstration"""
        agents = ['web-server-01', 'db-server-01', 'app-server-01', 'file-server-01', 'backup-server-01']
        users = ['root', 'admin', 'www-data', 'mysql', 'backup-user', 'system']
        file_paths = [
            '/etc/passwd', '/etc/shadow', '/etc/hosts', '/var/www/html/index.php',
            '/etc/nginx/nginx.conf', '/etc/mysql/my.cnf', '/home/admin/.ssh/authorized_keys',
            '/var/log/auth.log', '/etc/crontab', '/usr/bin/systemctl'
        ]
        change_types = ['created', 'modified', 'deleted', 'permission', 'ownership']
        severities = ['low', 'medium', 'high', 'critical']
        
        events = []
        base_time = datetime.now()
        
        for i in range(150):
            event_time = base_time - timedelta(minutes=random.randint(1, 1440))
            change_type = random.choice(change_types)
            
            event = {
                'id': f'fim-{i+1}',
                'timestamp': event_time.isoformat(),
                'agent_name': random.choice(agents),
                'filename': os.path.basename(random.choice(file_paths)),
                'file_path': random.choice(file_paths),
                'change_type': change_type,
                'user': random.choice(users),
                'severity': random.choice(severities),
                'file_size': f"{random.randint(1, 50000)} bytes",
                'file_hash': f"sha256:{''.join(random.choices('0123456789abcdef', k=64))}",
                'process_name': random.choice(['bash', 'systemd', 'nginx', 'mysql', 'sshd', 'cron']),
                'agent_ip': f"192.168.1.{random.randint(10, 250)}",
                'os_name': 'Ubuntu 20.04'
            }
            
            if change_type in ['permission', 'ownership']:
                event['old_permissions'] = 'rw-r--r--'
                event['new_permissions'] = 'rwxrwxrwx'
                
            events.append(event)
        
        return events

# Initialize FIM processor
fim_processor = FIMDataProcessor()

# FIM Routes
@fim_bp.route('/api/fim/events')
def get_fim_events():
    """Get FIM events data"""
    logging.info("🔍 FIM events API called")
    try:
        time_range = request.args.get('time_range', '24h')
        
        if time_range == '24h':
            start_time = (datetime.now() - timedelta(hours=24)).isoformat()
            end_time = datetime.now().isoformat()
        else:
            # Handle custom time ranges
            hours = int(request.args.get('hours', 24))
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=hours)
        
        logging.info(f"🔍 Fetching FIM events from {start_time} to {end_time}")
        
        # Import Wazuh client from main app
        from server import wazuh_client
        
        # Try to get real FIM data from Wazuh
        raw_fim_data = wazuh_client.get_fim_events(start_time, end_time)
        
        # Process the FIM data
        processed_data = fim_processor.process_fim_events(raw_fim_data)
        
        logging.info(f"✅ Returning FIM data: {len(processed_data['events'])} events")
        return jsonify(processed_data)
        
    except Exception as e:
        logging.error(f"❌ FIM data error: {e}", exc_info=True)
        # Return sample data on error
        events = FIMDataProcessor.generate_sample_fim_data()
        summary = FIMDataProcessor.calculate_fim_summary(events)
        return jsonify({
            'events': events,
            'summary': summary,
            'last_updated': datetime.now().isoformat(),
            'data_source': 'sample_fallback',
            'error': str(e)
        })
