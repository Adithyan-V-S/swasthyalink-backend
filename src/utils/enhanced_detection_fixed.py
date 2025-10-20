"""
Enhanced Detection Module for SwasthyaLink
Provides advanced health anomaly detection with ML integration
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
from dataclasses import dataclass
from enum import Enum
import json
from pathlib import Path

class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AnomalyType(Enum):
    HEART_RATE = "heart_rate"
    BLOOD_PRESSURE = "blood_pressure"
    GLUCOSE = "glucose"
    OXYGEN_SATURATION = "oxygen_saturation"
    TEMPERATURE = "temperature"
    RESPIRATORY_RATE = "respiratory_rate"
    ECG = "ecg"
    MULTI_PARAMETER = "multi_parameter"

@dataclass
class AnomalyDetectionResult:
    """Result container for anomaly detection"""
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    confidence: float
    value: float
    normal_range: Tuple[float, float]
    timestamp: datetime
    description: str
    recommendations: List[str]
    risk_factors: List[str]

@dataclass
class PatientBaseline:
    """Patient baseline health metrics"""
    patient_id: str
    heart_rate_baseline: Tuple[float, float]  # (min, max)
    blood_pressure_baseline: Tuple[float, float]  # (systolic_min, systolic_max)
    glucose_baseline: Tuple[float, float]  # (min, max)
    oxygen_saturation_baseline: Tuple[float, float]  # (min, max)
    temperature_baseline: Tuple[float, float]  # (min, max)
    respiratory_rate_baseline: Tuple[float, float]  # (min, max)
    last_updated: datetime
    sample_count: int

class EnhancedAnomalyDetector:
    """Advanced anomaly detection system with ML capabilities"""

    def __init__(self, config_path: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self.baselines: Dict[str, PatientBaseline] = {}
        self.anomaly_history: Dict[str, List[AnomalyDetectionResult]] = {}
        self.config = self._load_config(config_path)
        self.ml_models = {}

        # Initialize ML models if available
        self._initialize_ml_models()

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        default_config = {
            "normal_ranges": {
                "heart_rate": (60, 100),
                "blood_pressure_systolic": (90, 140),
                "blood_pressure_diastolic": (60, 90),
                "glucose": (70, 140),
                "oxygen_saturation": (95, 100),
                "temperature": (36.1, 37.2),
                "respiratory_rate": (12, 20)
            },
            "thresholds": {
                "mild_deviation": 1.5,  # Standard deviations
                "moderate_deviation": 2.0,
                "severe_deviation": 3.0,
                "critical_deviation": 4.0
            },
            "time_windows": {
                "baseline_update_hours": 24,
                "anomaly_cooldown_minutes": 30,
                "trend_analysis_hours": 48
            },
            "ml_settings": {
                "enable_auto_baseline": True,
                "enable_trend_analysis": True,
                "enable_multi_parameter": True,
                "confidence_threshold": 0.8
            }
        }

        if config_path and Path(config_path).exists():
            try:
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                self.logger.warning(f"Failed to load config from {config_path}: {e}")

        return default_config

    def _initialize_ml_models(self):
        """Initialize ML models for enhanced detection"""
        try:
            # Import ML libraries only if available
            import sklearn
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler

            # Initialize models for different parameter types
            self.ml_models = {
                'isolation_forest': IsolationForest(contamination=0.1, random_state=42),
                'scaler': StandardScaler()
            }

            self.logger.info("ML models initialized successfully")
        except ImportError:
            self.logger.warning("ML libraries not available, using rule-based detection only")
        except Exception as e:
            self.logger.error(f"Failed to initialize ML models: {e}")

    def update_patient_baseline(self, patient_id: str, health_data: Dict[str, float]) -> PatientBaseline:
        """Update or create patient baseline from health data"""
        current_time = datetime.now()

        # Get existing baseline or create new one
        if patient_id in self.baselines:
            baseline = self.baselines[patient_id]
            sample_count = baseline.sample_count + 1
        else:
            baseline = PatientBaseline(
                patient_id=patient_id,
                heart_rate_baseline=self.config["normal_ranges"]["heart_rate"],
                blood_pressure_baseline=(self.config["normal_ranges"]["blood_pressure_systolic"][0],
                                       self.config["normal_ranges"]["blood_pressure_systolic"][1]),
                glucose_baseline=self.config["normal_ranges"]["glucose"],
                oxygen_saturation_baseline=self.config["normal_ranges"]["oxygen_saturation"],
                temperature_baseline=self.config["normal_ranges"]["temperature"],
                respiratory_rate_baseline=self.config["normal_ranges"]["respiratory_rate"],
                last_updated=current_time,
                sample_count=1
            )
            sample_count = 1

        # Update baselines using weighted average
        weight_new = 1.0 / sample_count
        weight_old = 1.0 - weight_new

        # Update heart rate baseline
        if 'heart_rate' in health_data:
            hr = health_data['heart_rate']
            baseline.heart_rate_baseline = (
                baseline.heart_rate_baseline[0] * weight_old + hr * weight_new,
                baseline.heart_rate_baseline[1] * weight_old + hr * weight_new
            )

        # Update blood pressure baseline
        if 'blood_pressure_systolic' in health_data:
            bp_sys = health_data['blood_pressure_systolic']
            baseline.blood_pressure_baseline = (
                baseline.blood_pressure_baseline[0] * weight_old + bp_sys * weight_new,
                baseline.blood_pressure_baseline[1] * weight_old + bp_sys * weight_new
            )

        # Update glucose baseline
        if 'glucose' in health_data:
            glucose = health_data['glucose']
            baseline.glucose_baseline = (
                baseline.glucose_baseline[0] * weight_old + glucose * weight_new,
                baseline.glucose_baseline[1] * weight_old + glucose * weight_new
            )

        # Update other parameters similarly...
        if 'oxygen_saturation' in health_data:
            o2 = health_data['oxygen_saturation']
            baseline.oxygen_saturation_baseline = (
                baseline.oxygen_saturation_baseline[0] * weight_old + o2 * weight_new,
                baseline.oxygen_saturation_baseline[1] * weight_old + o2 * weight_new
            )

        if 'temperature' in health_data:
            temp = health_data['temperature']
            baseline.temperature_baseline = (
                baseline.temperature_baseline[0] * weight_old + temp * weight_new,
                baseline.temperature_baseline[1] * weight_old + temp * weight_new
            )

        if 'respiratory_rate' in health_data:
            rr = health_data['respiratory_rate']
            baseline.respiratory_rate_baseline = (
                baseline.respiratory_rate_baseline[0] * weight_old + rr * weight_new,
                baseline.respiratory_rate_baseline[1] * weight_old + rr * weight_new
            )

        baseline.last_updated = current_time
        baseline.sample_count = sample_count

        self.baselines[patient_id] = baseline
        self.logger.info(f"Updated baseline for patient {patient_id}")

        return baseline

    def detect_anomalies(self, patient_id: str, health_data: Dict[str, float]) -> List[AnomalyDetectionResult]:
        """Detect anomalies in health data"""
        results = []

        # Get or create patient baseline
        if patient_id not in self.baselines:
            self.update_patient_baseline(patient_id, health_data)

        baseline = self.baselines[patient_id]

        # Detect anomalies for each parameter
        for param, value in health_data.items():
            anomaly_result = self._detect_single_parameter_anomaly(
                patient_id, param, value, baseline
            )
            if anomaly_result:
                results.append(anomaly_result)

        # Detect multi-parameter anomalies
        if len(results) > 1:
            multi_result = self._detect_multi_parameter_anomaly(patient_id, health_data, results)
            if multi_result:
                results.append(multi_result)

        # Store results in history
        if patient_id not in self.anomaly_history:
            self.anomaly_history[patient_id] = []

        self.anomaly_history[patient_id].extend(results)

        # Keep only recent history (last 100 anomalies)
        if len(self.anomaly_history[patient_id]) > 100:
            self.anomaly_history[patient_id] = self.anomaly_history[patient_id][-100:]

        return results

    def _detect_single_parameter_anomaly(
        self,
        patient_id: str,
        param: str,
        value: float,
        baseline: PatientBaseline
    ) -> Optional[AnomalyDetectionResult]:
        """Detect anomaly for a single parameter"""

        # Map parameter to baseline ranges
        param_mapping = {
            'heart_rate': baseline.heart_rate_baseline,
            'blood_pressure_systolic': baseline.blood_pressure_baseline,
            'glucose': baseline.glucose_baseline,
            'oxygen_saturation': baseline.oxygen_saturation_baseline,
            'temperature': baseline.temperature_baseline,
            'respiratory_rate': baseline.respiratory_rate_baseline
        }

        if param not in param_mapping:
            return None

        normal_min, normal_max = param_mapping[param]

        # Calculate deviation
        if normal_min <= value <= normal_max:
            return None  # Within normal range

        # Calculate severity based on deviation
        deviation = max(abs(value - normal_min), abs(value - normal_max))
        max_range = max(normal_max - normal_min, 1)  # Avoid division by zero
        relative_deviation = deviation / max_range

        # Determine severity
        if relative_deviation < 0.1:
            severity = AnomalySeverity.LOW
        elif relative_deviation < 0.25:
            severity = AnomalySeverity.MEDIUM
        elif relative_deviation < 0.5:
            severity = AnomalySeverity.HIGH
        else:
            severity = AnomalySeverity.CRITICAL

        # Calculate confidence
        confidence = min(0.95, 0.5 + relative_deviation)

        # Map parameter to anomaly type
        type_mapping = {
            'heart_rate': AnomalyType.HEART_RATE,
            'blood_pressure_systolic': AnomalyType.BLOOD_PRESSURE,
            'glucose': AnomalyType.GLUCOSE,
            'oxygen_saturation': AnomalyType.OXYGEN_SATURATION,
            'temperature': AnomalyType.TEMPERATURE,
            'respiratory_rate': AnomalyType.RESPIRATORY_RATE
        }

        anomaly_type = type_mapping.get(param, AnomalyType.MULTI_PARAMETER)

        # Generate description and recommendations
        description = self._generate_anomaly_description(anomaly_type, value, (normal_min, normal_max))
        recommendations = self._generate_recommendations(anomaly_type, severity, value)
        risk_factors = self._identify_risk_factors(anomaly_type, severity, value)

        return AnomalyDetectionResult(
            anomaly_type=anomaly_type,
            severity=severity,
            confidence=confidence,
            value=value,
            normal_range=(normal_min, normal_max),
            timestamp=datetime.now(),
            description=description,
            recommendations=recommendations,
            risk_factors=risk_factors
        )

    def _detect_multi_parameter_anomaly(
        self,
        patient_id: str,
        health_data: Dict[str, float],
        single_results: List[AnomalyDetectionResult]
    ) -> Optional[AnomalyDetectionResult]:
        """Detect anomalies involving multiple parameters"""

        if len(single_results) < 2:
            return None

        # Calculate overall severity
        severities = [r.severity for r in single_results]
        severity_scores = {
            AnomalySeverity.LOW: 1,
            AnomalySeverity.MEDIUM: 2,
            AnomalySeverity.HIGH: 3,
            AnomalySeverity.CRITICAL: 4
        }

        max_severity = max(severities, key=lambda x: severity_scores[x.severity])
        avg_confidence = sum(r.confidence for r in single_results) / len(single_results)

        # Generate combined description
        param_names = [r.anomaly_type.value.replace('_', ' ').title() for r in single_results]
        description = f"Multiple parameter anomalies detected: {', '.join(param_names)}"

        # Generate combined recommendations
        all_recommendations = []
        for result in single_results:
            all_recommendations.extend(result.recommendations)

        # Remove duplicates while preserving order
        seen = set()
        unique_recommendations = []
        for rec in all_recommendations:
            if rec not in seen:
                seen.add(rec)
                unique_recommendations.append(rec)

        return AnomalyDetectionResult(
            anomaly_type=AnomalyType.MULTI_PARAMETER,
            severity=max_severity,
            confidence=avg_confidence,
            value=len(single_results),  # Number of affected parameters
            normal_range=(0, 0),  # Not applicable for multi-parameter
            timestamp=datetime.now(),
            description=description,
            recommendations=unique_recommendations,
            risk_factors=["Multiple simultaneous anomalies"]
        )

    def _generate_anomaly_description(self, anomaly_type: AnomalyType, value: float, normal_range: Tuple[float, float]) -> str:
        """Generate human-readable anomaly description"""

        descriptions = {
            AnomalyType.HEART_RATE: f"Heart rate of {value".0f"} bpm is outside normal range ({normal_range[0]".0f"}-{normal_range[1]".0f"} bpm)",
            AnomalyType.BLOOD_PRESSURE: f"Blood pressure reading of {value".0f"} mmHg is outside normal range",
            AnomalyType.GLUCOSE: f"Glucose level of {value".0f"} mg/dL is outside normal range ({normal_range[0]".0f"}-{normal_range[1]".0f"} mg/dL)",
            AnomalyType.OXYGEN_SATURATION: f"Oxygen saturation of {value".0f"}% is below normal range ({normal_range[0]".0f"}-{normal_range[1]".0f"}%)",
            AnomalyType.TEMPERATURE: f"Temperature of {value".1f"}°C is outside normal range ({normal_range[0]".1f"}-{normal_range[1]".1f"}°C)",
            AnomalyType.RESPIRATORY_RATE: f"Respiratory rate of {value".0f"} breaths/min is outside normal range ({normal_range[0]".0f"}-{normal_range[1]".0f"} breaths/min)",
            AnomalyType.ECG: "ECG abnormalities detected",
            AnomalyType.MULTI_PARAMETER: "Multiple vital signs showing abnormal readings"
        }

        return descriptions.get(anomaly_type, f"{anomaly_type.value.replace('_', ' ').title()} anomaly detected")

    def _generate_recommendations(self, anomaly_type: AnomalyType, severity: AnomalySeverity, value: float) -> List[str]:
        """Generate recommendations based on anomaly type and severity"""

        base_recommendations = {
            AnomalyType.HEART_RATE: [
                "Monitor heart rate closely",
                "Rest and avoid strenuous activity",
                "Contact healthcare provider if symptoms persist"
            ],
            AnomalyType.BLOOD_PRESSURE: [
                "Monitor blood pressure regularly",
                "Follow prescribed medication schedule",
                "Reduce sodium intake and stress"
            ],
            AnomalyType.GLUCOSE: [
                "Monitor blood glucose levels",
                "Follow diabetic care plan",
                "Contact healthcare provider for significant changes"
            ],
            AnomalyType.OXYGEN_SATURATION: [
                "Ensure adequate rest",
                "Monitor breathing patterns",
                "Seek immediate medical attention if below 90%"
            ],
            AnomalyType.TEMPERATURE: [
                "Monitor temperature regularly",
                "Stay hydrated",
                "Rest and avoid temperature extremes"
            ],
            AnomalyType.RESPIRATORY_RATE: [
                "Monitor breathing rate",
                "Ensure adequate rest",
                "Contact healthcare provider if breathing difficulty persists"
            ]
        }

        recommendations = base_recommendations.get(anomaly_type, ["Monitor condition closely", "Contact healthcare provider"])

        # Add severity-specific recommendations
        if severity in [AnomalySeverity.HIGH, AnomalySeverity.CRITICAL]:
            recommendations.insert(0, "Seek immediate medical attention")
            recommendations.append("Prepare emergency contact information")

        return recommendations

    def _identify_risk_factors(self, anomaly_type: AnomalyType, severity: AnomalySeverity, value: float) -> List[str]:
        """Identify risk factors associated with the anomaly"""

        risk_factors = []

        if severity in [AnomalySeverity.HIGH, AnomalySeverity.CRITICAL]:
            risk_factors.append("High severity anomaly")

        if anomaly_type == AnomalyType.OXYGEN_SATURATION and value < 92:
            risk_factors.append("Potential respiratory distress")

        if anomaly_type == AnomalyType.HEART_RATE:
            if value > 120:
                risk_factors.append("Tachycardia")
            elif value < 50:
                risk_factors.append("Bradycardia")

        if anomaly_type == AnomalyType.BLOOD_PRESSURE:
            if value > 180:
                risk_factors.append("Hypertensive crisis")
            elif value < 90:
                risk_factors.append("Hypotension")

        return risk_factors

    def get_patient_history(self, patient_id: str, hours: int = 24) -> Dict[str, Any]:
        """Get patient's anomaly history for specified time period"""

        if patient_id not in self.anomaly_history:
            return {"patient_id": patient_id, "history": [], "summary": {}}

        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_anomalies = [
            anomaly for anomaly in self.anomaly_history[patient_id]
            if anomaly.timestamp >= cutoff_time
        ]

        # Generate summary
        summary = {
            "total_anomalies": len(recent_anomalies),
            "severity_breakdown": {},
            "type_breakdown": {},
            "average_confidence": 0.0
        }

        if recent_anomalies:
            confidences = [a.confidence for a in recent_anomalies]
            summary["average_confidence"] = sum(confidences) / len(confidences)

            for anomaly in recent_anomalies:
                severity_key = anomaly.severity.value
                type_key = anomaly.anomaly_type.value

                summary["severity_breakdown"][severity_key] = \
                    summary["severity_breakdown"].get(severity_key, 0) + 1
                summary["type_breakdown"][type_key] = \
                    summary["type_breakdown"].get(type_key, 0) + 1

        return {
            "patient_id": patient_id,
            "history": recent_anomalies,
            "summary": summary,
            "baseline": self.baselines.get(patient_id, None)
        }

    def export_patient_data(self, patient_id: str, format: str = "json") -> str:
        """Export patient data for analysis"""

        data = {
            "patient_id": patient_id,
            "baseline": self.baselines.get(patient_id),
            "anomaly_history": self.anomaly_history.get(patient_id, []),
            "export_timestamp": datetime.now().isoformat()
        }

        if format.lower() == "json":
            return json.dumps(data, indent=2, default=str)
        else:
            raise ValueError(f"Unsupported export format: {format}")

# Global detector instance
detector = EnhancedAnomalyDetector()

def detect_health_anomalies(patient_id: str, health_data: Dict[str, float]) -> List[AnomalyDetectionResult]:
    """Convenience function to detect anomalies"""
    return detector.detect_anomalies(patient_id, health_data)

def update_patient_health_baseline(patient_id: str, health_data: Dict[str, float]) -> PatientBaseline:
    """Convenience function to update patient baseline"""
    return detector.update_patient_baseline(patient_id, health_data)

def get_patient_health_summary(patient_id: str, hours: int = 24) -> Dict[str, Any]:
    """Convenience function to get patient health summary"""
    return detector.get_patient_history(patient_id, hours)
