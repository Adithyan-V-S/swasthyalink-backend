/**
 * Patient-Doctor Relationship Model for SwasthyaLink
 * Handles patient-doctor connections, permissions, and relationship management
 */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const otpService = require('../services/otpService');

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
if (admin.apps.length > 0) {
  db = admin.firestore();
} else {
  console.log('⚠️ Firebase Firestore not available in PatientDoctorModel - using in-memory storage');
}

// Nodemailer transporter setup (use environment variables for production)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or 'outlook', etc.
  auth: {
    user: process.env.EMAIL_USER, // Set in .env: your Gmail address
    pass: process.env.EMAIL_PASS  // Set in .env: your Gmail app password
  }
});

class PatientDoctorModel {
  /**
   * Create a connection request from doctor to patient
   */
  static async createConnectionRequest(requestData) {
    try {
      const requestId = uuidv4();
      let connectionRequest = {
        id: requestId,
        doctorId: requestData.doctorId,
        patientId: requestData.patientId,
        patientEmail: requestData.patientEmail,
        patientPhone: requestData.patientPhone,
        connectionMethod: requestData.connectionMethod, // 'qr', 'email', 'otp'
        status: 'pending', // 'pending', 'accepted', 'rejected', 'expired'
        requestMessage: requestData.message || '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        updatedAt: new Date().toISOString()
      };

      // Store in connection_requests collection
      await db.collection('connection_requests').doc(requestId).set(connectionRequest);

      // Send OTP invitation if method is 'email' or 'otp'
      if ((requestData.connectionMethod === 'email' || requestData.connectionMethod === 'otp') && (requestData.patientEmail || requestData.patientPhone)) {
        try {
          // Fetch doctor details
          const doctorSnap = await db.collection('users').doc(requestData.doctorId).get();
          if (doctorSnap.exists) {
            const doctorData = doctorSnap.data();
            const doctorName = doctorData.name || doctorData.displayName || 'Doctor';

            // Prefer email if provided; otherwise use phone SMS
            let otpResult = null;
            if (requestData.patientEmail) {
              otpResult = await otpService.sendEmailOTP(requestData.patientEmail, doctorName, 'prescription_connection');
            } else if (requestData.patientPhone) {
              otpResult = await otpService.sendSMSOTP(requestData.patientPhone, doctorName, 'prescription_connection');
            }

            if (otpResult && otpResult.success) {
              // Update request with otpId
              connectionRequest.otpId = otpResult.otpId;
              await db.collection('connection_requests').doc(requestId).update({
                otpId: otpResult.otpId,
                emailSent: Boolean(requestData.patientEmail),
                smsSent: Boolean(requestData.patientPhone)
              });
              console.log(`OTP sent for request ${requestId}`);
            } else if (otpResult && !otpResult.success) {
              console.error('Failed to send OTP:', otpResult.error);
              await db.collection('connection_requests').doc(requestId).update({
                emailSent: false,
                smsSent: false
              });
            }
          } else {
            console.warn(`Doctor not found for ID: ${requestData.doctorId}`);
          }
        } catch (emailError) {
          console.error('Error sending OTP invitation:', emailError);
          await db.collection('connection_requests').doc(requestId).update({ 
            emailSent: false,
            smsSent: false
          });
        }
      } else if (requestData.connectionMethod === 'qr') {
        // For QR, no email/OTP needed; direct accept possible
        await db.collection('connection_requests').doc(requestId).update({ 
          otpRequired: false,
          emailSent: false,
          smsSent: false
        });
      }

      return {
        success: true,
        requestId,
        connectionRequest
      };
    } catch (error) {
      console.error('Error creating connection request:', error);
      throw new Error('Failed to create connection request');
    }
  }

  /**
   * Accept a connection request
   */
  static async acceptConnectionRequest(requestId, patientId, otp = null) {
    try {
      const requestRef = db.collection('connection_requests').doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        throw new Error('Connection request not found');
      }

      const request = requestSnap.data();

      if (request.status !== 'pending') {
        throw new Error('Connection request already processed');
      }

      if (request.patientId !== patientId) {
        throw new Error('Unauthorized to accept this request');
      }

      // Check if request has expired
      if (new Date() > new Date(request.expiresAt)) {
        await requestRef.update({
          status: 'expired',
          updatedAt: new Date().toISOString()
        });
        throw new Error('Connection request has expired');
      }

      // If OTP required and provided, verify it
      if (request.otpId && otp) {
        const verifyResult = await otpService.verifyOTP(request.otpId, otp);
        if (!verifyResult.success) {
          throw new Error(verifyResult.error || 'Invalid OTP');
        }
        // Mark OTP as verified (handled in otpService)
      } else if (request.otpId && !otp) {
        throw new Error('OTP verification required for this request');
      }

      // Create the patient-doctor relationship
      const relationshipId = uuidv4();
      const relationship = {
        id: relationshipId,
        patientId: request.patientId,
        doctorId: request.doctorId,
        status: 'active',
        permissions: {
          viewMedicalHistory: true,
          prescribeMedications: true,
          scheduleAppointments: true,
          accessEmergencyInfo: false
        },
        connectionDate: new Date().toISOString(),
        lastInteraction: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store relationship
      await db.collection('patient_doctor_relationships').doc(relationshipId).set(relationship);

      // Update request status
      await requestRef.update({
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        relationshipId,
        relationship
      };
    } catch (error) {
      console.error('Error accepting connection request:', error);
      throw new Error(error.message || 'Failed to accept connection request');
    }
  }

  /**
   * Reject a connection request
   */
  static async rejectConnectionRequest(requestId, patientId, reason = '') {
    try {
      const requestRef = db.collection('connection_requests').doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        throw new Error('Connection request not found');
      }

      const request = requestSnap.data();

      if (request.patientId !== patientId) {
        throw new Error('Unauthorized to reject this request');
      }

      await requestRef.update({
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Connection request rejected'
      };
    } catch (error) {
      console.error('Error rejecting connection request:', error);
      throw new Error(error.message || 'Failed to reject connection request');
    }
  }

  /**
   * Get all connection requests for a patient
   */
  static async getPatientConnectionRequests(patientId) {
    try {
      const requestsSnap = await db.collection('connection_requests')
        .where('patientId', '==', patientId)
        .orderBy('createdAt', 'desc')
        .get();

      const requests = [];
      requestsSnap.forEach(doc => {
        requests.push({ id: doc.id, ...doc.data() });
      });

      return {
        success: true,
        requests
      };
    } catch (error) {
      console.error('Error fetching patient connection requests:', error);
      throw new Error('Failed to fetch connection requests');
    }
  }

  /**
   * Get all connection requests sent by a doctor
   */
  static async getDoctorConnectionRequests(doctorId) {
    try {
      const requestsSnap = await db.collection('connection_requests')
        .where('doctorId', '==', doctorId)
        .orderBy('createdAt', 'desc')
        .get();

      const requests = [];
      requestsSnap.forEach(doc => {
        requests.push({ id: doc.id, ...doc.data() });
      });

      return {
        success: true,
        requests
      };
    } catch (error) {
      console.error('Error fetching doctor connection requests:', error);
      throw new Error('Failed to fetch connection requests');
    }
  }

  /**
   * Get all patients connected to a doctor
   */
  static async getDoctorPatients(doctorId) {
    try {
      const relationshipsSnap = await db.collection('patient_doctor_relationships')
        .where('doctorId', '==', doctorId)
        .where('status', '==', 'active')
        .get();

      const patients = [];
      for (const doc of relationshipsSnap.docs) {
        const relationship = doc.data();

        // Get patient details
        const patientSnap = await db.collection('users').doc(relationship.patientId).get();
        if (patientSnap.exists) {
          const patientData = patientSnap.data();
          patients.push({
            relationshipId: doc.id,
            patientId: relationship.patientId,
            patientName: patientData.name || patientData.displayName,
            patientEmail: patientData.email,
            patientPhone: patientData.phone,
            patientAge: patientData.age,
            patientGender: patientData.gender,
            connectionDate: relationship.connectionDate,
            lastInteraction: relationship.lastInteraction,
            permissions: relationship.permissions,
            // Additional patient info
            bloodType: patientData.bloodType,
            allergies: patientData.allergies,
            medicalHistory: patientData.medicalHistory,
            emergencyContact: patientData.emergencyContact
          });
        }
      }

      return {
        success: true,
        patients
      };
    } catch (error) {
      console.error('Error fetching doctor patients:', error);
      throw new Error('Failed to fetch patients');
    }
  }

  /**
   * Search for patients by email or phone
   */
  static async searchPatients(searchQuery) {
    try {
      const patients = [];

      // Search by email
      const emailQuery = await db.collection('users')
        .where('role', '==', 'patient')
        .where('email', '>=', searchQuery.toLowerCase())
        .where('email', '<=', searchQuery.toLowerCase() + '\uf8ff')
        .limit(10)
        .get();

      emailQuery.forEach(doc => {
        const data = doc.data();
        patients.push({
          id: doc.id,
          name: data.name || data.displayName,
          email: data.email,
          phone: data.phone,
          age: data.age,
          gender: data.gender,
          role: data.role,
          createdAt: data.createdAt
        });
      });

      // Search by phone if query looks like a phone number
      if (/^\+?[\d\s\-\(\)]+$/.test(searchQuery)) {
        const phoneQuery = await db.collection('users')
          .where('role', '==', 'patient')
          .where('phone', '>=', searchQuery)
          .where('phone', '<=', searchQuery + '\uf8ff')
          .limit(10)
          .get();

        phoneQuery.forEach(doc => {
          const data = doc.data();
          // Avoid duplicates
          if (!patients.find(p => p.id === doc.id)) {
            patients.push({
              id: doc.id,
              name: data.name || data.displayName,
              email: data.email,
              phone: data.phone,
              age: data.age,
              gender: data.gender,
              role: data.role,
              createdAt: data.createdAt
            });
          }
        });
      }

      // Search by name
      const nameQuery = await db.collection('users')
        .where('role', '==', 'patient')
        .get();

      nameQuery.forEach(doc => {
        const data = doc.data();
        const name = (data.name || data.displayName || '').toLowerCase();
        if (name.includes(searchQuery.toLowerCase()) && !patients.find(p => p.id === doc.id)) {
          patients.push({
            id: doc.id,
            name: data.name || data.displayName,
            email: data.email,
            phone: data.phone,
            age: data.age,
            gender: data.gender,
            role: data.role,
            createdAt: data.createdAt
          });
        }
      });

      return {
        success: true,
        patients: patients.slice(0, 10) // Limit to 10 results
      };
    } catch (error) {
      console.error('Error searching patients:', error);
      throw new Error('Failed to search patients');
    }
  }

  /**
   * Get all doctors connected to a patient
   */
  static async getPatientDoctors(patientId) {
    try {
      const relationshipsSnap = await db.collection('patient_doctor_relationships')
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .get();

      const doctors = [];
      for (const doc of relationshipsSnap.docs) {
        const relationship = doc.data();
        
        // Get doctor details
        const doctorSnap = await db.collection('users').doc(relationship.doctorId).get();
        if (doctorSnap.exists) {
          const doctorData = doctorSnap.data();
          doctors.push({
            relationshipId: doc.id,
            doctorId: relationship.doctorId,
            doctorName: doctorData.name,
            doctorSpecialization: doctorData.specialization,
            connectionDate: relationship.connectionDate,
            lastInteraction: relationship.lastInteraction,
            permissions: relationship.permissions
          });
        }
      }

      return {
        success: true,
        doctors
      };
    } catch (error) {
      console.error('Error fetching patient doctors:', error);
      throw new Error('Failed to fetch doctors');
    }
  }

  /**
   * Update relationship permissions
   */
  static async updateRelationshipPermissions(relationshipId, patientId, permissions) {
    try {
      const relationshipRef = db.collection('patient_doctor_relationships').doc(relationshipId);
      const relationshipSnap = await relationshipRef.get();

      if (!relationshipSnap.exists) {
        throw new Error('Relationship not found');
      }

      const relationship = relationshipSnap.data();

      if (relationship.patientId !== patientId) {
        throw new Error('Unauthorized to update this relationship');
      }

      await relationshipRef.update({
        permissions,
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Permissions updated successfully'
      };
    } catch (error) {
      console.error('Error updating relationship permissions:', error);
      throw new Error(error.message || 'Failed to update permissions');
    }
  }

  /**
   * Terminate a patient-doctor relationship
   */
  static async terminateRelationship(relationshipId, userId) {
    try {
      const relationshipRef = db.collection('patient_doctor_relationships').doc(relationshipId);
      const relationshipSnap = await relationshipRef.get();

      if (!relationshipSnap.exists) {
        throw new Error('Relationship not found');
      }

      const relationship = relationshipSnap.data();

      // Check if user is authorized (either patient or doctor in the relationship)
      if (relationship.patientId !== userId && relationship.doctorId !== userId) {
        throw new Error('Unauthorized to terminate this relationship');
      }

      await relationshipRef.update({
        status: 'terminated',
        terminatedAt: new Date().toISOString(),
        terminatedBy: userId,
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Relationship terminated successfully'
      };
    } catch (error) {
      console.error('Error terminating relationship:', error);
      throw new Error(error.message || 'Failed to terminate relationship');
    }
  }
}

module.exports = PatientDoctorModel;
