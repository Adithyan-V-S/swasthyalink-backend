/**
 * Patient-Doctor Connection Routes for SwasthyaLink
 * Handles patient-doctor relationship management
 */

const express = require('express');
const router = express.Router();
const PatientDoctorModel = require('../src/models/patientDoctorModel');
const patientDoctorService = require('../src/services/patientDoctorService');
const { requireAuth, requireDoctor, requirePatient } = require('../src/middleware/auth');

// Create connection request (Doctor only)
router.post('/connection-request', requireDoctor, async (req, res) => {
  try {
    const { patientId, patientEmail, patientPhone, connectionMethod, message } = req.body;
    const doctorId = req.user.uid; // From auth middleware

    if (!patientId && !patientEmail && !patientPhone) {
      return res.status(400).json({
        success: false,
        error: 'Patient identifier (ID, email, or phone) is required'
      });
    }

    if (!connectionMethod || !['qr', 'email', 'otp', 'direct'].includes(connectionMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Valid connection method is required (qr, email, otp, or direct)'
      });
    }

    const result = await patientDoctorService.sendConnectionRequest(
      doctorId,
      patientId,
      patientEmail,
      patientPhone,
      connectionMethod,
      message
    );

    res.json(result);
  } catch (error) {
    console.error('Error creating connection request:', error);
    // Map known error messages to appropriate HTTP status codes
    const message = (error && error.message) ? error.message : 'Failed to create connection request';
    let status = 500;

    if (message === 'Connection already exists') {
      status = 409; // Conflict
    } else if (message === 'Patient not found' || message === 'Doctor not found' || message === 'Request not found') {
      status = 404; // Not Found
    } else if (message === 'Unauthorized') {
      status = 403; // Forbidden
    } else if (message === 'Only pending requests can be resent') {
      status = 400; // Bad Request
    }

    res.status(status).json({
      success: false,
      error: message
    });
  }
});

// Accept connection request (Patient only)
router.post('/connection-request/:requestId/accept', requirePatient, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { otp } = req.body; // OTP for verification if required
    const patientId = req.user.uid; // From auth middleware

    const result = await PatientDoctorModel.acceptConnectionRequest(requestId, patientId, otp);
    res.json(result);
  } catch (error) {
    console.error('Error accepting connection request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to accept connection request'
    });
  }
});

// Reject connection request (Patient only)
router.post('/connection-request/:requestId/reject', requirePatient, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const patientId = req.user.uid; // From auth middleware

    const result = await PatientDoctorModel.rejectConnectionRequest(requestId, patientId, reason);
    res.json(result);
  } catch (error) {
    console.error('Error rejecting connection request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject connection request'
    });
  }
});

// Get connection requests for patient (Patient only)
router.get('/patient/connection-requests', requirePatient, async (req, res) => {
  try {
    const patientId = req.user.uid;
    const result = await PatientDoctorModel.getPatientConnectionRequests(patientId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching patient connection requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch connection requests'
    });
  }
});

// Get pending requests for patient (Patient only) - New simplified endpoint
router.get('/requests', requirePatient, async (req, res) => {
  try {
    const patientId = req.user.uid;
    // Use query parameter if provided, otherwise use user email
    const patientEmail = (req.query.patientEmail || req.user.email || '').toLowerCase();
    console.log('🔍 Getting pending requests for:', { patientId, patientEmail });
    const result = await patientDoctorService.getPendingRequests(patientId, patientEmail);
    console.log('📊 Pending requests result:', result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch pending requests'
    });
  }
});

// Accept connection request with OTP (Patient only) - New simplified endpoint
router.post('/accept/:requestId', requirePatient, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { otp } = req.body;
    const patientId = req.user.uid;
    const patientEmail = req.user.email;

    const result = await patientDoctorService.acceptRequest(requestId, patientId, patientEmail, otp);
    res.json(result);
  } catch (error) {
    console.error('Error accepting request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to accept request'
    });
  }
});

// Resend OTP for a pending request (Patient or Doctor)
router.post('/resend/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.uid;
    const result = await patientDoctorService.resendRequest(requestId, userId);
    res.json(result);
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to resend OTP' });
  }
});

// Get connection requests sent by doctor (Doctor only)
router.get('/doctor/connection-requests', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.user.uid;
    const result = await PatientDoctorModel.getDoctorConnectionRequests(doctorId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor connection requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch connection requests'
    });
  }
});

// Get all patients for a doctor (Doctor only)
router.get('/doctor/patients', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.user.uid;
    const result = await PatientDoctorModel.getDoctorPatients(doctorId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patients'
    });
  }
});

// Search for patients by email or phone (Doctor only)
router.get('/search/patients', requireDoctor, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 3 characters'
      });
    }

    // Search patients in Firestore - simplified to avoid index requirement
    const db = require('firebase-admin').firestore();
    const patientsQuery = await db.collection('users')
      .where('role', '==', 'patient')
      .limit(50) // Get more results to filter client-side
      .get();

    const patients = [];
    patientsQuery.forEach(doc => {
      const patientData = doc.data();
      // Filter by email containing the query string (case-insensitive)
      if (patientData.email && patientData.email.toLowerCase().includes(query.toLowerCase())) {
        patients.push({
          id: doc.id,
          name: patientData.name || 'Unknown',
          email: patientData.email,
          phone: patientData.phone || 'Not provided'
        });
      }
    });

    // Limit to 10 results after filtering
    const limitedPatients = patients.slice(0, 10);

    res.json({
      success: true,
      patients: limitedPatients
    });
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search patients'
    });
  }
});

// Get all doctors for a patient (Patient only)
router.get('/patient/doctors', requirePatient, async (req, res) => {
  try {
    const patientId = req.user.uid;
    const patientEmail = req.user.email;
    const result = await patientDoctorService.getConnectedDoctors(patientId, patientEmail);
    res.json(result);
  } catch (error) {
    console.error('Error fetching patient doctors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch doctors'
    });
  }
});

// Get all patients for a doctor (Doctor only)
router.get('/doctor/patients', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.user.uid;
    const result = await patientDoctorService.getConnectedPatients(doctorId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patients'
    });
  }
});

// Update relationship permissions (Patient only)
router.put('/relationship/:relationshipId/permissions', requirePatient, async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const { permissions } = req.body;
    const patientId = req.user.uid;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid permissions object is required'
      });
    }

    const result = await PatientDoctorModel.updateRelationshipPermissions(
      relationshipId, 
      patientId, 
      permissions
    );
    res.json(result);
  } catch (error) {
    console.error('Error updating relationship permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update permissions'
    });
  }
});

// Terminate relationship (Both patient and doctor can terminate)
router.delete('/relationship/:relationshipId', requireAuth, async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const userId = req.user.uid;

    const result = await PatientDoctorModel.terminateRelationship(relationshipId, userId);
    res.json(result);
  } catch (error) {
    console.error('Error terminating relationship:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to terminate relationship'
    });
  }
});

// Get relationship details (Both patient and doctor can view)
router.get('/relationship/:relationshipId', requireAuth, async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const userId = req.user.uid;

    const relationshipRef = require('firebase-admin').firestore()
      .collection('patient_doctor_relationships').doc(relationshipId);
    const relationshipSnap = await relationshipRef.get();

    if (!relationshipSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Relationship not found'
      });
    }

    const relationship = relationshipSnap.data();

    // Check if user is authorized to view this relationship
    if (relationship.patientId !== userId && relationship.doctorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view this relationship'
      });
    }

    res.json({
      success: true,
      relationship: { id: relationshipId, ...relationship }
    });
  } catch (error) {
    console.error('Error fetching relationship details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch relationship details'
    });
  }
});

// Search for patients by email or phone (Doctor only)
router.post('/search-patient', requireDoctor, async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Email or phone number is required'
      });
    }

    const db = require('firebase-admin').firestore();
    let query = db.collection('users').where('role', '==', 'patient');

    if (email) {
      query = query.where('email', '==', email);
    } else if (phone) {
      query = query.where('phone', '==', phone);
    }

    const patientsSnap = await query.get();
    const patients = [];

    patientsSnap.forEach(doc => {
      const patientData = doc.data();
      patients.push({
        id: doc.id,
        name: patientData.name,
        email: patientData.email,
        phone: patientData.phone
      });
    });

    res.json({
      success: true,
      patients
    });
  } catch (error) {
    console.error('Error searching for patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search for patients'
    });
  }
});

// Get notifications for doctor (Doctor only)
router.get('/doctor/notifications', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.user.uid;
    const result = await patientDoctorService.getDoctorNotifications(doctorId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notifications'
    });
  }
});

module.exports = router;
