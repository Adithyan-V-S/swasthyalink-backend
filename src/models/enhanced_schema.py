"""
Enhanced Database Schema for SwasthyaLink
Comprehensive schema supporting advanced health monitoring, ML integration, and security features
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, JSON, ForeignKey, Index, CheckConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import json

Base = declarative_base()

class UserRole(Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    FAMILY_MEMBER = "family_member"
    ADMIN = "admin"
    RESEARCHER = "researcher"

class HealthStatus(Enum):
    NORMAL = "normal"
    AT_RISK = "at_risk"
    CRITICAL = "critical"
    RECOVERING = "recovering"

class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class NotificationType(Enum):
    HEALTH_ALERT = "health_alert"
    MEDICATION_REMINDER = "medication_reminder"
    APPOINTMENT_REMINDER = "appointment_reminder"
    FAMILY_ACCESS = "family_access"
    SYSTEM_UPDATE = "system_update"
    SECURITY_ALERT = "security_alert"

class AuditAction(Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    ACCESS_GRANT = "access_grant"
    ACCESS_REVOKE = "access_revoke"

# User Management Tables
class User(Base):
    """Core user table"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(DateTime)
    gender = Column(String)
    role = Column(String, nullable=False, default=UserRole.PATIENT.value)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False)
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False)
    health_records = relationship("HealthRecord", back_populates="patient")
    notifications = relationship("Notification", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    security_events = relationship("SecurityEvent", back_populates="user")

    __table_args__ = (
        Index('idx_user_email_active', 'email', 'is_active'),
        Index('idx_user_role_active', 'role', 'is_active'),
    )

class PatientProfile(Base):
    """Extended patient profile"""
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'), unique=True, nullable=False)
    emergency_contact_name = Column(String)
    emergency_contact_phone = Column(String)
    emergency_contact_relationship = Column(String)
    blood_type = Column(String)
    allergies = Column(JSON)  # List of allergies
    current_medications = Column(JSON)  # List of current medications
    medical_history = Column(JSON)  # Medical history summary
    insurance_info = Column(JSON)  # Insurance information
    preferred_hospital = Column(String)
    health_status = Column(String, default=HealthStatus.NORMAL.value)
    baseline_metrics = Column(JSONB)  # Patient baseline health metrics
    risk_factors = Column(JSONB)  # Identified risk factors
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="patient_profile")
    family_members = relationship("FamilyMember", back_populates="patient")
    health_records = relationship("HealthRecord", back_populates="patient_profile")

    __table_args__ = (
        Index('idx_patient_health_status', 'health_status'),
        Index('idx_patient_risk_factors', 'risk_factors', postgresql_using='gin'),
    )

class DoctorProfile(Base):
    """Doctor profile information"""
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'), unique=True, nullable=False)
    license_number = Column(String, unique=True)
    specialization = Column(String)
    hospital_affiliation = Column(String)
    years_experience = Column(Integer)
    qualifications = Column(JSON)  # List of qualifications
    is_verified = Column(Boolean, default=False)
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    consultation_fee = Column(Float)
    available_slots = Column(JSON)  # Available time slots
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    appointments = relationship("Appointment", back_populates="doctor")

# Health Data Tables
class HealthRecord(Base):
    """Comprehensive health records"""
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey('users.id'), nullable=False)
    recorded_by = Column(String, ForeignKey('users.id'))  # Doctor or system
    record_type = Column(String, nullable=False)  # 'vitals', 'lab', 'imaging', 'consultation'
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    source = Column(String)  # 'manual', 'device', 'api', 'ml_prediction'

    # Vital signs
    heart_rate = Column(Float)
    blood_pressure_systolic = Column(Float)
    blood_pressure_diastolic = Column(Float)
    temperature = Column(Float)
    oxygen_saturation = Column(Float)
    respiratory_rate = Column(Float)
    weight = Column(Float)
    height = Column(Float)

    # Lab results
    glucose = Column(Float)
    cholesterol_total = Column(Float)
    cholesterol_ldl = Column(Float)
    cholesterol_hdl = Column(Float)
    triglycerides = Column(Float)
    hemoglobin = Column(Float)
    white_blood_cell_count = Column(Float)
    platelet_count = Column(Float)

    # Additional data
    symptoms = Column(JSON)  # List of reported symptoms
    diagnosis = Column(JSON)  # Diagnosis information
    treatment_plan = Column(JSON)  # Treatment plan
    medications_prescribed = Column(JSON)  # Prescribed medications
    notes = Column(Text)
    attachments = Column(JSON)  # File attachments (URLs or references)

    # ML/AI insights
    anomaly_detected = Column(Boolean, default=False)
    anomaly_details = Column(JSONB)  # Details of detected anomalies
    risk_score = Column(Float)  # Calculated risk score
    predictions = Column(JSONB)  # ML predictions
    confidence_score = Column(Float)  # Confidence in the data

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("User", back_populates="health_records")
    patient_profile = relationship("PatientProfile", back_populates="health_records")
    anomalies = relationship("AnomalyDetection", back_populates="health_record")

    __table_args__ = (
        Index('idx_health_record_patient_timestamp', 'patient_id', 'timestamp'),
        Index('idx_health_record_type_timestamp', 'record_type', 'timestamp'),
        Index('idx_health_record_anomaly', 'anomaly_detected'),
        Index('idx_health_record_risk_score', 'risk_score'),
    )

class AnomalyDetection(Base):
    """Detected health anomalies"""
    __tablename__ = "anomaly_detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    health_record_id = Column(Integer, ForeignKey('health_records.id'), nullable=False)
    patient_id = Column(String, ForeignKey('users.id'), nullable=False)

    anomaly_type = Column(String, nullable=False)  # 'heart_rate', 'blood_pressure', etc.
    severity = Column(String, nullable=False)  # 'low', 'medium', 'high', 'critical'
    confidence = Column(Float, nullable=False)
    value = Column(Float, nullable=False)  # Actual measured value
    normal_range_min = Column(Float)
    normal_range_max = Column(Float)

    description = Column(Text)
    recommendations = Column(JSON)  # List of recommendations
    risk_factors = Column(JSON)  # List of identified risk factors
    triggered_alerts = Column(JSON)  # List of triggered alerts

    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_by = Column(String, ForeignKey('users.id'))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    health_record = relationship("HealthRecord", back_populates="anomalies")

    __table_args__ = (
        Index('idx_anomaly_patient_timestamp', 'patient_id', 'created_at'),
        Index('idx_anomaly_severity_type', 'severity', 'anomaly_type'),
        Index('idx_anomaly_resolved', 'is_resolved'),
    )

# Family and Access Management
class FamilyMember(Base):
    """Family member relationships"""
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey('users.id'), nullable=False)
    family_member_id = Column(String, ForeignKey('users.id'), nullable=False)
    relationship = Column(String, nullable=False)  # 'spouse', 'child', 'parent', etc.

    access_level = Column(String, default='limited')  # 'limited', 'full', 'emergency'
    is_emergency_contact = Column(Boolean, default=False)
    granted_by = Column(String, ForeignKey('users.id'), nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow)

    # Access permissions
    can_view_records = Column(Boolean, default=True)
    can_view_vitals = Column(Boolean, default=True)
    can_view_medications = Column(Boolean, default=False)
    can_view_diagnosis = Column(Boolean, default=False)
    can_contact_doctors = Column(Boolean, default=False)
    can_make_appointments = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    last_access = Column(DateTime)
    access_notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("PatientProfile", back_populates="family_members",
                         foreign_keys=[patient_id])
    family_member = relationship("User", foreign_keys=[family_member_id])

    __table_args__ = (
        Index('idx_family_patient_active', 'patient_id', 'is_active'),
        Index('idx_family_member_active', 'family_member_id', 'is_active'),
        CheckConstraint('patient_id != family_member_id', name='no_self_reference'),
    )

# Appointment System
class Appointment(Base):
    """Medical appointments"""
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey('users.id'), nullable=False)
    doctor_id = Column(String, ForeignKey('users.id'), nullable=False)

    appointment_datetime = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30)
    appointment_type = Column(String, default='consultation')  # 'consultation', 'follow_up', 'emergency'

    status = Column(String, default='scheduled')  # 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'
    priority = Column(String, default='normal')  # 'low', 'normal', 'high', 'urgent'

    # Appointment details
    chief_complaint = Column(Text)
    symptoms = Column(JSON)
    vitals_taken = Column(JSON)  # Vitals recorded during appointment
    diagnosis = Column(JSON)
    treatment_plan = Column(JSON)
    prescriptions = Column(JSON)
    follow_up_instructions = Column(Text)

    # Administrative
    appointment_fee = Column(Float)
    payment_status = Column(String, default='pending')  # 'pending', 'paid', 'refunded'
    insurance_claimed = Column(Boolean, default=False)

    # Cancellation/Rescheduling
    is_cancelled = Column(Boolean, default=False)
    cancelled_at = Column(DateTime)
    cancelled_by = Column(String, ForeignKey('users.id'))
    cancellation_reason = Column(Text)

    # Metadata
    created_by = Column(String, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    notifications = relationship("Notification", back_populates="appointment")

    __table_args__ = (
        Index('idx_appointment_patient_datetime', 'patient_id', 'appointment_datetime'),
        Index('idx_appointment_doctor_datetime', 'doctor_id', 'appointment_datetime'),
        Index('idx_appointment_status', 'status'),
    )

# Notification System
class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    notification_type = Column(String, nullable=False)

    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSONB)  # Additional notification data

    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)

    # Scheduling
    scheduled_for = Column(DateTime)
    expires_at = Column(DateTime)

    # Delivery channels
    email_sent = Column(Boolean, default=False)
    sms_sent = Column(Boolean, default=False)
    push_sent = Column(Boolean, default=False)

    # Priority and importance
    priority = Column(String, default='normal')  # 'low', 'normal', 'high', 'urgent'
    requires_acknowledgment = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")
    appointment = relationship("Appointment", back_populates="notifications")

    __table_args__ = (
        Index('idx_notification_user_unread', 'user_id', 'is_read'),
        Index('idx_notification_type_scheduled', 'notification_type', 'scheduled_for'),
        Index('idx_notification_priority', 'priority'),
    )

# ML and Analytics Tables
class MLModel(Base):
    """ML model metadata"""
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String, unique=True, nullable=False)
    model_version = Column(String, nullable=False)
    model_type = Column(String, nullable=False)  # 'anomaly_detection', 'risk_prediction', 'diagnosis_assistance'

    # Model files and metadata
    model_path = Column(String)
    model_config = Column(JSONB)
    feature_columns = Column(JSON)
    target_column = Column(String)

    # Performance metrics
    accuracy = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)
    auc_roc = Column(Float)

    # Training data
    training_date = Column(DateTime)
    training_samples = Column(Integer)
    validation_samples = Column(Integer)
    test_samples = Column(Integer)

    # Status
    is_active = Column(Boolean, default=True)
    is_deprecated = Column(Boolean, default=False)
    deprecated_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_ml_model_active_type', 'is_active', 'model_type'),
        Index('idx_ml_model_version', 'model_name', 'model_version'),
    )

class Prediction(Base):
    """ML predictions and results"""
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey('users.id'), nullable=False)
    model_id = Column(Integer, ForeignKey('ml_models.id'), nullable=False)

    prediction_type = Column(String, nullable=False)  # 'anomaly', 'risk', 'diagnosis'
    input_data = Column(JSONB)  # Input features used for prediction
    prediction_result = Column(JSONB)  # Prediction output
    confidence_score = Column(Float)

    # Ground truth (if available)
    actual_result = Column(JSONB)
    is_correct = Column(Boolean)
    evaluated_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("User")

    __table_args__ = (
        Index('idx_prediction_patient_type', 'patient_id', 'prediction_type'),
        Index('idx_prediction_model_timestamp', 'model_id', 'created_at'),
    )

# Security and Audit Tables
class AuditLog(Base):
    """Audit log for all system activities"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'))
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String)

    # Context information
    ip_address = Column(String)
    user_agent = Column(String)
    session_id = Column(String)
    request_id = Column(String)

    # Changes made
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    changes_summary = Column(Text)

    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    processing_time_ms = Column(Integer)
    success = Column(Boolean, default=True)
    error_message = Column(Text)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index('idx_audit_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_audit_action_resource', 'action', 'resource_type'),
        Index('idx_audit_timestamp', 'timestamp'),
    )

class SecurityEvent(Base):
    """Security events and incidents"""
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'))

    event_type = Column(String, nullable=False)  # 'login_failed', 'suspicious_activity', 'data_breach'
    severity = Column(String, nullable=False)  # 'low', 'medium', 'high', 'critical'

    # Event details
    source_ip = Column(String)
    user_agent = Column(String)
    location = Column(String)  # Geolocation if available
    details = Column(JSONB)

    # Impact assessment
    affected_resources = Column(JSON)
    potential_impact = Column(Text)
    recommended_actions = Column(JSON)

    # Resolution
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_by = Column(String, ForeignKey('users.id'))
    resolution_notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="security_events")

    __table_args__ = (
        Index('idx_security_event_type_severity', 'event_type', 'severity'),
        Index('idx_security_event_timestamp', 'created_at'),
        Index('idx_security_event_resolved', 'is_resolved'),
    )

# System Configuration and Monitoring
class SystemConfig(Base):
    """System configuration settings"""
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String, unique=True, nullable=False)
    config_value = Column(JSONB)
    config_type = Column(String, default='system')  # 'system', 'ml', 'security', 'ui'
    is_sensitive = Column(Boolean, default=False)  # Hide in UI if sensitive

    description = Column(Text)
    last_modified_by = Column(String, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_config_type_key', 'config_type', 'config_key'),
    )

class SystemMetrics(Base):
    """System performance metrics"""
    __tablename__ = "system_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # System metrics
    cpu_usage_percent = Column(Float)
    memory_usage_percent = Column(Float)
    disk_usage_percent = Column(Float)
    network_io_bytes = Column(Float)

    # Application metrics
    active_users = Column(Integer)
    total_requests = Column(Integer)
    average_response_time = Column(Float)
    error_rate = Column(Float)

    # Database metrics
    db_connections = Column(Integer)
    db_query_time = Column(Float)
    db_error_rate = Column(Float)

    # ML metrics
    ml_predictions_count = Column(Integer)
    ml_accuracy = Column(Float)

    # Additional metadata
    metadata = Column(JSONB)

    __table_args__ = (
        Index('idx_system_metrics_timestamp', 'timestamp'),
    )

# Data Export and Integration
class DataExport(Base):
    """Data export requests and history"""
    __tablename__ = "data_exports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    export_type = Column(String, nullable=False)  # 'health_records', 'anomaly_history', 'full_profile'

    # Export parameters
    date_from = Column(DateTime)
    date_to = Column(DateTime)
    data_format = Column(String, default='json')  # 'json', 'csv', 'pdf'
    include_attachments = Column(Boolean, default=False)

    # Export status
    status = Column(String, default='pending')  # 'pending', 'processing', 'completed', 'failed'
    download_url = Column(String)
    expires_at = Column(DateTime)

    # Results
    record_count = Column(Integer)
    file_size_bytes = Column(Integer)
    processing_time_seconds = Column(Float)

    # Security
    access_token = Column(String, unique=True)
    download_count = Column(Integer, default=0)
    last_downloaded_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")

    __table_args__ = (
        Index('idx_data_export_user_status', 'user_id', 'status'),
        Index('idx_data_export_token', 'access_token'),
    )

# Create all tables function
def create_all_tables(engine):
    """Create all database tables"""
    Base.metadata.create_all(engine)

# Database initialization data
def get_initial_config_data():
    """Get initial system configuration data"""
    return [
        {
            "config_key": "system_name",
            "config_value": {"value": "SwasthyaLink"},
            "config_type": "system",
            "description": "System name displayed in UI"
        },
        {
            "config_key": "max_family_members",
            "config_value": {"value": 10},
            "config_type": "system",
            "description": "Maximum number of family members per patient"
        },
        {
            "config_key": "anomaly_detection_enabled",
            "config_value": {"value": True},
            "config_type": "ml",
            "description": "Enable ML-based anomaly detection"
        },
        {
            "config_key": "notification_retention_days",
            "config_value": {"value": 90},
            "config_type": "system",
            "description": "Days to retain notifications"
        },
        {
            "config_key": "audit_log_retention_days",
            "config_value": {"value": 365},
            "config_type": "security",
            "description": "Days to retain audit logs"
        }
    ]
