"""
Professional SOC Dashboard Configuration
Environment-specific settings and constants
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv


load_dotenv()

class Config:
    """Base configuration class"""
    
    # Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY', 'soc-dashboard-secret-key-2024')
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    TESTING = os.environ.get('TESTING', 'False').lower() == 'true'
    FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    FLASK_PORT = int(os.getenv('FLASK_PORT', '9000'))
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    # CORS Configuration
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
    
    """Configuration from environment variables"""
    WAZUH_HOST = os.getenv('WAZUH_HOST', '127.0.0.1')
    WAZUH_USERNAME = os.getenv('WAZUH_USERNAME', 'admin')
    WAZUH_PASSWORD = os.getenv('WAZUH_PASSWORD', '')
    WAZUH_VERIFY_SSL = os.getenv('WAZUH_VERIFY_SSL', 'false').lower() == 'true'
    
    # Dashboard Configuration
    DASHBOARD_REFRESH_INTERVAL = int(os.environ.get('REFRESH_INTERVAL', '30'))  # seconds
    DASHBOARD_MAX_ALERTS = int(os.environ.get('MAX_ALERTS', '5000'))
    DASHBOARD_TIMEZONE = os.environ.get('TIMEZONE', 'UTC')
    DASHBOARD_ENABLE_REALTIME = os.environ.get('ENABLE_REALTIME', 'True').lower() == 'true'
    
    # Cache Configuration
    CACHE_TYPE = 'simple'
    CACHE_DEFAULT_TIMEOUT = 300  # 5 minutes
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Security Configuration
    SESSION_COOKIE_SECURE = not DEBUG
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # API Configuration
    API_RATE_LIMIT = os.environ.get('API_RATE_LIMIT', '100 per minute')
    
    @classmethod
    def get_wazuh_config(cls) -> Dict[str, Any]:
        """Get Wazuh configuration as dictionary"""
        return {
            'host': cls.WAZUH_HOST,
            'port': cls.WAZUH_PORT,
            'username': cls.WAZUH_USERNAME,
            'password': cls.WAZUH_PASSWORD,
            'verify_ssl': cls.WAZUH_VERIFY_SSL
        }
    
    @classmethod
    def get_dashboard_config(cls) -> Dict[str, Any]:
        """Get dashboard configuration as dictionary"""
        return {
            'refresh_interval': cls.DASHBOARD_REFRESH_INTERVAL,
            'max_alerts': cls.DASHBOARD_MAX_ALERTS,
            'timezone': cls.DASHBOARD_TIMEZONE,
            'enable_realtime': cls.DASHBOARD_ENABLE_REALTIME
        }


class DevelopmentConfig(Config):
    """Development environment configuration"""
    
    DEBUG = True
    TESTING = False
    
    # Development-specific settings
    WAZUH_VERIFY_SSL = False
    DASHBOARD_REFRESH_INTERVAL = 30  # More frequent updates in development


class ProductionConfig(Config):
    """Production environment configuration"""
    
    DEBUG = False
    TESTING = False
    
    # Production-specific settings
    SECRET_KEY = os.environ.get('SECRET_KEY')  # Must be set in production
    WAZUH_VERIFY_SSL = True
    DASHBOARD_REFRESH_INTERVAL = 60  # Less frequent updates in production
    
    # Security enhancements for production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True


class TestingConfig(Config):
    """Testing environment configuration"""
    
    DEBUG = False
    TESTING = True
    
    # Testing-specific settings
    WAZUH_VERIFY_SSL = False
    DASHBOARD_ENABLE_REALTIME = False


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(config_name: str = None) -> Config:
    """
    Get configuration class based on environment
    
    Args:
        config_name: Configuration name (development, production, testing)
    
    Returns:
        Config: Configuration class
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    return config.get(config_name, config['default'])
