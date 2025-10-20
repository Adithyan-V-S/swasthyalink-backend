"""
Configuration Management System for SwasthyaLink
Centralized configuration management with validation, encryption, and environment support
"""

import os
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, asdict
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import logging
from datetime import datetime, timedelta
import threading
import hashlib
import re

@dataclass
class ConfigValue:
    """Configuration value with metadata"""
    value: Any
    config_type: str = "string"  # string, int, float, bool, json, encrypted
    is_sensitive: bool = False
    description: str = ""
    validation_rules: Optional[Dict[str, Any]] = None
    default_value: Any = None
    allowed_values: Optional[List[Any]] = None
    min_value: Optional[Union[int, float]] = None
    max_value: Optional[Union[int, float]] = None
    pattern: Optional[str] = None  # Regex pattern for string validation
    required: bool = False
    last_modified: Optional[datetime] = None
    modified_by: Optional[str] = None

class ConfigurationManager:
    """Centralized configuration management system"""

    def __init__(self, config_dir: Optional[str] = None, encryption_key: Optional[str] = None):
        self.config_dir = Path(config_dir) if config_dir else Path("config")
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # Setup encryption
        self.encryption_key = encryption_key or self._generate_or_load_key()
        self.cipher = Fernet(self.encryption_key)

        # Configuration storage
        self._config: Dict[str, ConfigValue] = {}
        self._config_file = self.config_dir / "app_config.json"
        self._schema_file = self.config_dir / "config_schema.yaml"
        self._lock = threading.RLock()

        # Setup logging
        self.logger = logging.getLogger(__name__)

        # Load configuration
        self._load_configuration()

        # Setup validation
        self._setup_validation_rules()

    def _generate_or_load_key(self) -> bytes:
        """Generate or load encryption key"""
        key_file = self.config_dir / ".encryption_key"

        if key_file.exists():
            with open(key_file, 'rb') as f:
                return f.read()

        # Generate new key
        key = Fernet.generate_key()
        with open(key_file, 'wb') as f:
            f.write(key)

        # Set restrictive permissions
        key_file.chmod(0o600)

        return key

    def _load_configuration(self):
        """Load configuration from files and environment"""
        with self._lock:
            # Load from file
            if self._config_file.exists():
                try:
                    with open(self._config_file, 'r') as f:
                        data = json.load(f)
                        for key, value_data in data.items():
                            self._config[key] = ConfigValue(**value_data)
                except Exception as e:
                    self.logger.error(f"Failed to load config file: {e}")

            # Override with environment variables
            self._load_from_environment()

            # Load schema if available
            if self._schema_file.exists():
                self._load_schema()

    def _load_from_environment(self):
        """Load configuration from environment variables"""
        env_prefix = "SWASTHYALINK_"

        for key, value in os.environ.items():
            if key.startswith(env_prefix):
                config_key = key[len(env_prefix):].lower()
                self.set_config(config_key, value, source="environment")

    def _load_schema(self):
        """Load configuration schema for validation"""
        try:
            with open(self._schema_file, 'r') as f:
                schema = yaml.safe_load(f)

            for key, schema_data in schema.get('properties', {}).items():
                if key in self._config:
                    config_value = self._config[key]
                    config_value.validation_rules = schema_data
                    config_value.description = schema_data.get('description', '')
                    config_value.required = schema_data.get('required', False)
                    config_value.config_type = schema_data.get('type', 'string')

                    if 'enum' in schema_data:
                        config_value.allowed_values = schema_data['enum']

                    if 'minimum' in schema_data:
                        config_value.min_value = schema_data['minimum']

                    if 'maximum' in schema_data:
                        config_value.max_value = schema_data['maximum']

                    if 'pattern' in schema_data:
                        config_value.pattern = schema_data['pattern']

        except Exception as e:
            self.logger.error(f"Failed to load schema: {e}")

    def _setup_validation_rules(self):
        """Setup default validation rules"""
        default_rules = {
            # Database configuration
            "database_url": ConfigValue(
                value="",
                config_type="string",
                is_sensitive=True,
                description="Database connection URL",
                required=True,
                pattern=r"^(postgresql|mysql|sqlite):\/\/.*"
            ),

            # Security settings
            "jwt_secret_key": ConfigValue(
                value="",
                config_type="encrypted",
                is_sensitive=True,
                description="JWT secret key for token signing",
                required=True
            ),

            "encryption_key": ConfigValue(
                value="",
                config_type="encrypted",
                is_sensitive=True,
                description="Data encryption key",
                required=True
            ),

            # API settings
            "api_host": ConfigValue(
                value="0.0.0.0",
                config_type="string",
                description="API server host",
                default_value="0.0.0.0"
            ),

            "api_port": ConfigValue(
                value=8000,
                config_type="int",
                description="API server port",
                min_value=1,
                max_value=65535,
                default_value=8000
            ),

            # ML settings
            "enable_ml_features": ConfigValue(
                value=True,
                config_type="bool",
                description="Enable machine learning features",
                default_value=True
            ),

            "ml_model_path": ConfigValue(
                value="models/",
                config_type="string",
                description="Path to ML models directory",
                default_value="models/"
            ),

            # Logging settings
            "log_level": ConfigValue(
                value="INFO",
                config_type="string",
                description="Logging level",
                allowed_values=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                default_value="INFO"
            ),

            # Notification settings
            "enable_email_notifications": ConfigValue(
                value=True,
                config_type="bool",
                description="Enable email notifications",
                default_value=True
            ),

            "enable_sms_notifications": ConfigValue(
                value=False,
                config_type="bool",
                description="Enable SMS notifications",
                default_value=False
            ),

            # Performance settings
            "max_connections": ConfigValue(
                value=100,
                config_type="int",
                description="Maximum database connections",
                min_value=1,
                max_value=1000,
                default_value=100
            ),

            "request_timeout": ConfigValue(
                value=30,
                config_type="int",
                description="Request timeout in seconds",
                min_value=1,
                max_value=300,
                default_value=30
            ),

            # Security thresholds
            "max_login_attempts": ConfigValue(
                value=5,
                config_type="int",
                description="Maximum login attempts before lockout",
                min_value=1,
                max_value=20,
                default_value=5
            ),

            "session_timeout_minutes": ConfigValue(
                value=60,
                config_type="int",
                description="Session timeout in minutes",
                min_value=5,
                max_value=1440,  # 24 hours
                default_value=60
            ),

            # Data retention
            "health_data_retention_days": ConfigValue(
                value=2555,  # 7 years
                config_type="int",
                description="Health data retention period in days",
                min_value=30,
                max_value=3650,  # 10 years
                default_value=2555
            ),

            "audit_log_retention_days": ConfigValue(
                value=3650,  # 10 years
                config_type="int",
                description="Audit log retention period in days",
                min_value=365,
                max_value=7300,  # 20 years
                default_value=3650
            ),

            # Feature flags
            "enable_family_sharing": ConfigValue(
                value=True,
                config_type="bool",
                description="Enable family health data sharing",
                default_value=True
            ),

            "enable_anomaly_detection": ConfigValue(
                value=True,
                config_type="bool",
                description="Enable real-time anomaly detection",
                default_value=True
            ),

            "enable_predictive_analytics": ConfigValue(
                value=True,
                config_type="bool",
                description="Enable predictive health analytics",
                default_value=True
            ),

            # External services
            "firebase_config": ConfigValue(
                value={},
                config_type="json",
                is_sensitive=True,
                description="Firebase configuration",
                default_value={}
            ),

            "smtp_config": ConfigValue(
                value={},
                config_type="json",
                is_sensitive=True,
                description="SMTP configuration for email notifications",
                default_value={}
            ),

            "twilio_config": ConfigValue(
                value={},
                config_type="json",
                is_sensitive=True,
                description="Twilio configuration for SMS notifications",
                default_value={}
            ),

            # UI Configuration
            "ui_theme": ConfigValue(
                value="light",
                config_type="string",
                description="Default UI theme",
                allowed_values=["light", "dark", "auto"],
                default_value="light"
            ),

            "language": ConfigValue(
                value="en",
                config_type="string",
                description="Default language",
                allowed_values=["en", "hi", "mr", "gu", "ta", "te", "kn", "ml"],
                default_value="en"
            ),

            "timezone": ConfigValue(
                value="Asia/Kolkata",
                config_type="string",
                description="Default timezone",
                default_value="Asia/Kolkata"
            )
        }

        # Add default rules to config
        for key, config_value in default_rules.items():
            if key not in self._config:
                self._config[key] = config_value

    def get_config(self, key: str, default: Any = None) -> Any:
        """Get configuration value"""
        with self._lock:
            if key in self._config:
                config_value = self._config[key]
                if config_value.config_type == "encrypted":
                    try:
                        decrypted = self.cipher.decrypt(config_value.value.encode()).decode()
                        return json.loads(decrypted) if config_value.value else default
                    except Exception:
                        return default
                return config_value.value
            return default

    def set_config(self, key: str, value: Any, source: str = "manual",
                   modified_by: Optional[str] = None) -> bool:
        """Set configuration value with validation"""
        with self._lock:
            if key not in self._config:
                self.logger.warning(f"Configuration key '{key}' not found in schema")
                return False

            config_value = self._config[key]

            # Validate the value
            if not self._validate_config_value(key, value):
                return False

            # Encrypt sensitive values
            if config_value.config_type == "encrypted":
                encrypted_value = self.cipher.encrypt(json.dumps(value).encode()).decode()
                config_value.value = encrypted_value
            else:
                config_value.value = value

            # Update metadata
            config_value.last_modified = datetime.now()
            config_value.modified_by = modified_by

            # Save to file
            self._save_configuration()

            self.logger.info(f"Configuration '{key}' updated from {source}")
            return True

    def _validate_config_value(self, key: str, value: Any) -> bool:
        """Validate configuration value"""
        config_value = self._config[key]

        # Check required values
        if config_value.required and value is None:
            self.logger.error(f"Required configuration '{key}' cannot be None")
            return False

        # Type validation
        if config_value.config_type == "int":
            try:
                value = int(value)
            except (ValueError, TypeError):
                self.logger.error(f"Configuration '{key}' must be an integer")
                return False
        elif config_value.config_type == "float":
            try:
                value = float(value)
            except (ValueError, TypeError):
                self.logger.error(f"Configuration '{key}' must be a float")
                return False
        elif config_value.config_type == "bool":
            if isinstance(value, str):
                if value.lower() in ['true', '1', 'yes', 'on']:
                    value = True
                elif value.lower() in ['false', '0', 'no', 'off']:
                    value = False
                else:
                    self.logger.error(f"Configuration '{key}' must be a boolean")
                    return False
        elif config_value.config_type == "json":
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    self.logger.error(f"Configuration '{key}' must be valid JSON")
                    return False

        # Range validation
        if config_value.min_value is not None and value < config_value.min_value:
            self.logger.error(f"Configuration '{key}' must be >= {config_value.min_value}")
            return False

        if config_value.max_value is not None and value > config_value.max_value:
            self.logger.error(f"Configuration '{key}' must be <= {config_value.max_value}")
            return False

        # Allowed values validation
        if config_value.allowed_values and value not in config_value.allowed_values:
            self.logger.error(f"Configuration '{key}' must be one of {config_value.allowed_values}")
            return False

        # Pattern validation
        if config_value.pattern and isinstance(value, str):
            if not re.match(config_value.pattern, value):
                self.logger.error(f"Configuration '{key}' does not match required pattern")
                return False

        return True

    def _save_configuration(self):
        """Save configuration to file"""
        try:
            # Create backup
            if self._config_file.exists():
                backup_file = self._config_file.with_suffix('.json.backup')
                self._config_file.replace(backup_file)

            # Save current config
            config_data = {}
            for key, config_value in self._config.items():
                config_data[key] = asdict(config_value)

            with open(self._config_file, 'w') as f:
                json.dump(config_data, f, indent=2, default=str)

            # Set restrictive permissions
            self._config_file.chmod(0o600)

        except Exception as e:
            self.logger.error(f"Failed to save configuration: {e}")

    def get_all_config(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """Get all configuration values"""
        with self._lock:
            result = {}
            for key, config_value in self._config.items():
                if config_value.is_sensitive and not include_sensitive:
                    result[key] = "***"
                else:
                    result[key] = config_value.value
            return result

    def get_config_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get configuration metadata"""
        with self._lock:
            if key in self._config:
                config_value = self._config[key]
                metadata = asdict(config_value)
                # Remove the actual value for security
                metadata.pop('value', None)
                return metadata
            return None

    def validate_all_config(self) -> List[str]:
        """Validate all configuration values"""
        errors = []

        with self._lock:
            for key, config_value in self._config.items():
                if config_value.required and config_value.value is None:
                    errors.append(f"Required configuration '{key}' is not set")

                if config_value.value is not None:
                    if not self._validate_config_value(key, config_value.value):
                        errors.append(f"Configuration '{key}' has invalid value")

        return errors

    def reload_config(self):
        """Reload configuration from files"""
        with self._lock:
            old_config = self._config.copy()
            self._config.clear()
            self._load_configuration()

            # Log changes
            for key in self._config:
                if key in old_config:
                    old_value = old_config[key].value
                    new_value = self._config[key].value
                    if old_value != new_value:
                        self.logger.info(f"Configuration '{key}' changed during reload")

    def export_config(self, file_path: Optional[str] = None, include_sensitive: bool = False) -> str:
        """Export configuration to file"""
        if file_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = self.config_dir / f"config_export_{timestamp}.json"

        config_data = self.get_all_config(include_sensitive)

        with open(file_path, 'w') as f:
            json.dump(config_data, f, indent=2, default=str)

        self.logger.info(f"Configuration exported to {file_path}")
        return str(file_path)

    def import_config(self, file_path: str, merge: bool = True) -> bool:
        """Import configuration from file"""
        try:
            with open(file_path, 'r') as f:
                import_data = json.load(f)

            with self._lock:
                for key, value in import_data.items():
                    if key in self._config or not merge:
                        if self._validate_config_value(key, value):
                            self.set_config(key, value, source="import")

            self.logger.info(f"Configuration imported from {file_path}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to import configuration: {e}")
            return False

    def get_config_hash(self) -> str:
        """Get hash of current configuration for change detection"""
        config_str = json.dumps(self.get_all_config(), sort_keys=True)
        return hashlib.sha256(config_str.encode()).hexdigest()

    def create_config_schema(self, file_path: Optional[str] = None) -> str:
        """Create configuration schema file"""
        if file_path is None:
            file_path = self._schema_file

        schema = {
            "type": "object",
            "properties": {},
            "required": []
        }

        with self._lock:
            for key, config_value in self._config.items():
                schema["properties"][key] = {
                    "type": config_value.config_type,
                    "description": config_value.description,
                    "default": config_value.default_value
                }

                if config_value.allowed_values:
                    schema["properties"][key]["enum"] = config_value.allowed_values

                if config_value.min_value is not None:
                    schema["properties"][key]["minimum"] = config_value.min_value

                if config_value.max_value is not None:
                    schema["properties"][key]["maximum"] = config_value.max_value

                if config_value.pattern:
                    schema["properties"][key]["pattern"] = config_value.pattern

                if config_value.required:
                    schema["required"].append(key)

        with open(file_path, 'w') as f:
            yaml.dump(schema, f, default_flow_style=False)

        self.logger.info(f"Configuration schema created at {file_path}")
        return str(file_path)

# Global configuration manager instance
_config_manager: Optional[ConfigurationManager] = None
_config_lock = threading.Lock()

def get_config_manager() -> ConfigurationManager:
    """Get global configuration manager instance"""
    global _config_manager

    if _config_manager is None:
        with _config_lock:
            if _config_manager is None:
                _config_manager = ConfigurationManager()

    return _config_manager

def get_config(key: str, default: Any = None) -> Any:
    """Convenience function to get configuration value"""
    return get_config_manager().get_config(key, default)

def set_config(key: str, value: Any, **kwargs) -> bool:
    """Convenience function to set configuration value"""
    return get_config_manager().set_config(key, value, **kwargs)

# Configuration validation functions
def validate_database_config() -> List[str]:
    """Validate database configuration"""
    errors = []

    db_url = get_config("database_url")
    if not db_url:
        errors.append("Database URL is not configured")

    # Add more database-specific validations as needed

    return errors

def validate_security_config() -> List[str]:
    """Validate security configuration"""
    errors = []

    jwt_secret = get_config("jwt_secret_key")
    if not jwt_secret:
        errors.append("JWT secret key is not configured")

    max_attempts = get_config("max_login_attempts", 5)
    if max_attempts < 1 or max_attempts > 20:
        errors.append("max_login_attempts must be between 1 and 20")

    session_timeout = get_config("session_timeout_minutes", 60)
    if session_timeout < 5 or session_timeout > 1440:
        errors.append("session_timeout_minutes must be between 5 and 1440")

    return errors

def validate_ml_config() -> List[str]:
    """Validate ML configuration"""
    errors = []

    if get_config("enable_ml_features", True):
        model_path = get_config("ml_model_path", "models/")
        model_path_obj = Path(model_path)
        if not model_path_obj.exists():
            errors.append(f"ML model path does not exist: {model_path}")

    return errors

def validate_all_config() -> Dict[str, List[str]]:
    """Validate all configuration sections"""
    return {
        "database": validate_database_config(),
        "security": validate_security_config(),
        "ml": validate_ml_config(),
        "general": get_config_manager().validate_all_config()
    }
