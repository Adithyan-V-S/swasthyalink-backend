"""
Advanced Logging System for SwasthyaLink
Provides comprehensive logging with structured data, performance monitoring, and security features
"""

import logging
import logging.handlers
import json
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import threading
import time
import psutil
import socket
from dataclasses import dataclass, asdict
from enum import Enum
import gzip
import shutil
from contextlib import contextmanager
import traceback

class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
    SECURITY = "SECURITY"

class LogCategory(Enum):
    AUTHENTICATION = "auth"
    AUTHORIZATION = "authz"
    API = "api"
    DATABASE = "db"
    ML = "ml"
    ANOMALY_DETECTION = "anomaly"
    PERFORMANCE = "perf"
    SECURITY = "security"
    AUDIT = "audit"
    SYSTEM = "system"

@dataclass
class LogContext:
    """Context information for structured logging"""
    user_id: Optional[str] = None
    patient_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    correlation_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class PerformanceMetrics:
    """Performance metrics for logging"""
    response_time: Optional[float] = None
    memory_usage: Optional[float] = None
    cpu_usage: Optional[float] = None
    db_query_count: Optional[int] = None
    db_query_time: Optional[float] = None
    cache_hits: Optional[int] = None
    cache_misses: Optional[int] = None

@dataclass
class SecurityEvent:
    """Security event data"""
    event_type: str
    severity: str
    source_ip: Optional[str] = None
    user_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

class AdvancedLogger:
    """Advanced logging system with structured logging and monitoring"""

    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self._setup_logging()
        self._performance_monitor = PerformanceMonitor()
        self._security_monitor = SecurityMonitor()
        self._context = threading.local()

        # Start background tasks
        self._start_background_tasks()

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load logging configuration"""
        default_config = {
            "log_level": "INFO",
            "log_file": "logs/swasthyalink.log",
            "max_file_size": 10 * 1024 * 1024,  # 10MB
            "backup_count": 5,
            "enable_json_format": True,
            "enable_performance_logging": True,
            "enable_security_logging": True,
            "enable_audit_logging": True,
            "log_performance_threshold": 1.0,  # seconds
            "log_security_events": True,
            "enable_compression": True,
            "compression_threshold": 1024,  # bytes
            "enable_cloud_logging": False,
            "cloud_logging_endpoint": None,
            "enable_metrics_collection": True,
            "metrics_interval": 60,  # seconds
            "enable_anomaly_detection": True,
            "anomaly_detection_threshold": 0.8
        }

        if config_path and Path(config_path).exists():
            try:
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"Warning: Failed to load logging config: {e}")

        return default_config

    def _setup_logging(self):
        """Setup logging configuration"""
        # Create logs directory
        log_dir = Path(self.config["log_file"]).parent
        log_dir.mkdir(parents=True, exist_ok=True)

        # Configure root logger
        self.logger = logging.getLogger("swasthyalink")
        self.logger.setLevel(getattr(logging, self.config["log_level"]))

        # Remove existing handlers
        self.logger.handlers.clear()

        # Create formatters
        json_formatter = StructuredFormatter()
        text_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        # File handler with rotation
        log_file = self.config["log_file"]
        max_bytes = self.config["max_file_size"]
        backup_count = self.config["backup_count"]

        file_handler = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=max_bytes, backupCount=backup_count
        )

        if self.config["enable_json_format"]:
            file_handler.setFormatter(json_formatter)
        else:
            file_handler.setFormatter(text_formatter)

        self.logger.addHandler(file_handler)

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(text_formatter)
        self.logger.addHandler(console_handler)

        # Security logger
        self.security_logger = logging.getLogger("swasthyalink.security")
        security_handler = logging.handlers.RotatingFileHandler(
            "logs/security.log", maxBytes=max_bytes, backupCount=backup_count
        )
        security_handler.setFormatter(json_formatter)
        self.security_logger.addHandler(security_handler)
        self.security_logger.setLevel(logging.INFO)

        # Performance logger
        self.performance_logger = logging.getLogger("swasthyalink.performance")
        performance_handler = logging.handlers.RotatingFileHandler(
            "logs/performance.log", maxBytes=max_bytes, backupCount=backup_count
        )
        performance_handler.setFormatter(json_formatter)
        self.performance_logger.addHandler(performance_handler)
        self.performance_logger.setLevel(logging.INFO)

        # Audit logger
        self.audit_logger = logging.getLogger("swasthyalink.audit")
        audit_handler = logging.handlers.RotatingFileHandler(
            "logs/audit.log", maxBytes=max_bytes, backupCount=backup_count
        )
        audit_handler.setFormatter(json_formatter)
        self.audit_logger.addHandler(audit_handler)
        self.audit_logger.setLevel(logging.INFO)

    def _start_background_tasks(self):
        """Start background monitoring tasks"""
        if self.config["enable_metrics_collection"]:
            self._metrics_thread = threading.Thread(
                target=self._collect_metrics, daemon=True
            )
            self._metrics_thread.start()

    def _collect_metrics(self):
        """Collect system metrics periodically"""
        while True:
            try:
                metrics = self._performance_monitor.get_system_metrics()
                self.performance_logger.info("System metrics", extra={
                    "metrics": asdict(metrics),
                    "category": LogCategory.PERFORMANCE.value
                })
                time.sleep(self.config["metrics_interval"])
            except Exception as e:
                self.logger.error(f"Error collecting metrics: {e}")

    def set_context(self, **kwargs):
        """Set logging context for current thread"""
        for key, value in kwargs.items():
            setattr(self._context, key, value)

    def get_context(self) -> LogContext:
        """Get current logging context"""
        return LogContext(
            user_id=getattr(self._context, 'user_id', None),
            patient_id=getattr(self._context, 'patient_id', None),
            session_id=getattr(self._context, 'session_id', None),
            request_id=getattr(self._context, 'request_id', None),
            ip_address=getattr(self._context, 'ip_address', None),
            user_agent=getattr(self._context, 'user_agent', None),
            correlation_id=getattr(self._context, 'correlation_id', None),
            metadata=getattr(self._context, 'metadata', None)
        )

    @contextmanager
    def log_context(self, **kwargs):
        """Context manager for temporary logging context"""
        old_context = {}
        for key, value in kwargs.items():
            old_context[key] = getattr(self._context, key, None)
            setattr(self._context, key, value)

        try:
            yield
        finally:
            for key, value in old_context.items():
                if value is None:
                    delattr(self._context, key)
                else:
                    setattr(self._context, key, value)

    def log(self, level: LogLevel, message: str, category: LogCategory = LogCategory.SYSTEM,
            **kwargs):
        """Log a structured message"""
        context = self.get_context()

        log_data = {
            "message": message,
            "level": level.value,
            "category": category.value,
            "timestamp": datetime.now().isoformat(),
            "context": asdict(context),
            **kwargs
        }

        # Add performance metrics if enabled
        if self.config["enable_performance_logging"]:
            perf_metrics = self._performance_monitor.get_current_metrics()
            if perf_metrics:
                log_data["performance"] = asdict(perf_metrics)

        # Log to appropriate logger
        logger = self._get_logger_for_category(category)
        logger.log(self._get_logging_level(level), message, extra=log_data)

    def debug(self, message: str, category: LogCategory = LogCategory.SYSTEM, **kwargs):
        """Log debug message"""
        self.log(LogLevel.DEBUG, message, category, **kwargs)

    def info(self, message: str, category: LogCategory = LogCategory.SYSTEM, **kwargs):
        """Log info message"""
        self.log(LogLevel.INFO, message, category, **kwargs)

    def warning(self, message: str, category: LogCategory = LogCategory.SYSTEM, **kwargs):
        """Log warning message"""
        self.log(LogLevel.WARNING, message, category, **kwargs)

    def error(self, message: str, category: LogCategory = LogCategory.SYSTEM, **kwargs):
        """Log error message"""
        self.log(LogLevel.ERROR, message, category, **kwargs)

    def critical(self, message: str, category: LogCategory = LogCategory.SYSTEM, **kwargs):
        """Log critical message"""
        self.log(LogLevel.CRITICAL, message, category, **kwargs)

    def security_event(self, event_type: str, severity: str, **kwargs):
        """Log security event"""
        if not self.config["enable_security_logging"]:
            return

        security_event = SecurityEvent(
            event_type=event_type,
            severity=severity,
            source_ip=getattr(self._context, 'ip_address', None),
            user_id=getattr(self._context, 'user_id', None),
            details=kwargs,
            timestamp=datetime.now()
        )

        self.security_logger.info(f"Security event: {event_type}", extra={
            "security_event": asdict(security_event),
            "category": LogCategory.SECURITY.value
        })

    def audit_log(self, action: str, resource: str, **kwargs):
        """Log audit event"""
        if not self.config["enable_audit_logging"]:
            return

        context = self.get_context()
        audit_data = {
            "action": action,
            "resource": resource,
            "user_id": context.user_id,
            "timestamp": datetime.now().isoformat(),
            "ip_address": context.ip_address,
            **kwargs
        }

        self.audit_logger.info(f"Audit: {action} on {resource}", extra={
            "audit_data": audit_data,
            "category": LogCategory.AUDIT.value
        })

    @contextmanager
    def performance_timer(self, operation: str):
        """Context manager to time operations"""
        start_time = time.time()
        start_metrics = self._performance_monitor.get_current_metrics()

        try:
            yield
        finally:
            end_time = time.time()
            execution_time = end_time - start_time

            if execution_time > self.config["log_performance_threshold"]:
                end_metrics = self._performance_monitor.get_current_metrics()

                self.performance_logger.info(f"Performance: {operation}", extra={
                    "operation": operation,
                    "execution_time": execution_time,
                    "start_metrics": asdict(start_metrics) if start_metrics else None,
                    "end_metrics": asdict(end_metrics) if end_metrics else None,
                    "category": LogCategory.PERFORMANCE.value
                })

    def _get_logger_for_category(self, category: LogCategory):
        """Get appropriate logger for category"""
        if category == LogCategory.SECURITY:
            return self.security_logger
        elif category == LogCategory.PERFORMANCE:
            return self.performance_logger
        elif category == LogCategory.AUDIT:
            return self.audit_logger
        else:
            return self.logger

    def _get_logging_level(self, level: LogLevel) -> int:
        """Convert LogLevel to logging level"""
        level_map = {
            LogLevel.DEBUG: logging.DEBUG,
            LogLevel.INFO: logging.INFO,
            LogLevel.WARNING: logging.WARNING,
            LogLevel.ERROR: logging.ERROR,
            LogLevel.CRITICAL: logging.CRITICAL,
            LogLevel.SECURITY: logging.INFO
        }
        return level_map.get(level, logging.INFO)

    def get_logs(self, start_time: Optional[datetime] = None,
                 end_time: Optional[datetime] = None,
                 level: Optional[LogLevel] = None,
                 category: Optional[LogCategory] = None,
                 limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve logs with filtering"""
        # This is a simplified implementation
        # In production, you would query actual log files or database
        return []

    def compress_old_logs(self):
        """Compress old log files"""
        if not self.config["enable_compression"]:
            return

        log_dir = Path("logs")
        if not log_dir.exists():
            return

        threshold_days = 7
        threshold_time = datetime.now() - timedelta(days=threshold_days)

        for log_file in log_dir.glob("*.log.*"):
            if log_file.stat().st_mtime < threshold_time.timestamp():
                try:
                    with open(log_file, 'rb') as f_in:
                        with gzip.open(f"{log_file}.gz", 'wb') as f_out:
                            shutil.copyfileobj(f_in, f_out)
                    log_file.unlink()
                    self.logger.info(f"Compressed log file: {log_file}")
                except Exception as e:
                    self.logger.error(f"Failed to compress log file {log_file}: {e}")

class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""

    def format(self, record):
        """Format log record as JSON"""
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add extra fields if present
        if hasattr(record, 'category'):
            log_entry["category"] = record.category

        if hasattr(record, 'context'):
            log_entry["context"] = record.context

        if hasattr(record, 'performance'):
            log_entry["performance"] = record.performance

        if hasattr(record, 'security_event'):
            log_entry["security_event"] = record.security_event

        if hasattr(record, 'audit_data'):
            log_entry["audit_data"] = record.audit_data

        if hasattr(record, 'metrics'):
            log_entry["metrics"] = record.metrics

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)

class PerformanceMonitor:
    """Monitor system performance"""

    def __init__(self):
        self.process = psutil.Process()

    def get_current_metrics(self) -> Optional[PerformanceMetrics]:
        """Get current performance metrics"""
        try:
            return PerformanceMetrics(
                response_time=None,  # Set by caller
                memory_usage=self.process.memory_percent(),
                cpu_usage=self.process.cpu_percent(),
                db_query_count=None,  # Set by caller
                db_query_time=None,   # Set by caller
                cache_hits=None,      # Set by caller
                cache_misses=None     # Set by caller
            )
        except Exception:
            return None

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get system-wide metrics"""
        try:
            return {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage": psutil.disk_usage('/').percent,
                "network_io": dict(psutil.net_io_counters()._asdict()),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}

class SecurityMonitor:
    """Monitor security events"""

    def __init__(self):
        self.suspicious_activities = []

    def log_suspicious_activity(self, activity_type: str, details: Dict[str, Any]):
        """Log suspicious activity"""
        self.suspicious_activities.append({
            "type": activity_type,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

        # Keep only recent activities
        if len(self.suspicious_activities) > 1000:
            self.suspicious_activities = self.suspicious_activities[-1000:]

    def get_suspicious_activities(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get suspicious activities in the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [
            activity for activity in self.suspicious_activities
            if datetime.fromisoformat(activity["timestamp"]) >= cutoff_time
        ]

# Global logger instance
logger = AdvancedLogger()

def get_logger() -> AdvancedLogger:
    """Get global logger instance"""
    return logger

def log_function_call(func_name: str, **kwargs):
    """Decorator to log function calls"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger.info(f"Function called: {func_name}", category=LogCategory.SYSTEM,
                       function=func_name, args_count=len(args), kwargs_count=len(kwargs))
            return func(*args, **kwargs)
        return wrapper
    return decorator

def performance_timer(operation: str):
    """Decorator to time function execution"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            with logger.performance_timer(operation):
                return func(*args, **kwargs)
        return wrapper
    return decorator
