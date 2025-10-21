/**
 * Prescription Model for SwasthyaLink
 * Handles prescription creation, management, and delivery
 */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
let serverTimestamp = null;

if (admin.apps.length > 0) {
  db = admin.firestore();
  serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
} else {
  console.log('⚠️ Firebase Firestore not available in PrescriptionModel - using in-memory storage');
}

class PrescriptionModel {
  /**
   * Create a new prescription
   */
  static async createPrescription(prescriptionData) {
    try {
      const prescriptionId = uuidv4();
      const prescription = {
        id: prescriptionId,
        doctorId: prescriptionData.doctorId,
        patientId: prescriptionData.patientId,
        medications: prescriptionData.medications, // Array of medication objects
        diagnosis: prescriptionData.diagnosis || '',
        instructions: prescriptionData.instructions || '',
        notes: prescriptionData.notes || '',
        status: 'pending', // 'pending', 'sent', 'received', 'filled', 'cancelled'
        priority: prescriptionData.priority || 'normal', // 'low', 'normal', 'high', 'urgent'
        validUntil: prescriptionData.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Validate medications
      if (!prescription.medications || !Array.isArray(prescription.medications) || prescription.medications.length === 0) {
        throw new Error('At least one medication is required');
      }

      // Validate each medication
      for (const medication of prescription.medications) {
        if (!medication.name || !medication.dosage || !medication.frequency) {
          throw new Error('Each medication must have name, dosage, and frequency');
        }
      }

      // Store prescription
      await db.collection('prescriptions').doc(prescriptionId).set(prescription);

      return {
        success: true,
        prescriptionId,
        prescription
      };
    } catch (error) {
      console.error('Error creating prescription:', error);
      throw new Error(error.message || 'Failed to create prescription');
    }
  }

  /**
   * Get prescriptions for a doctor
   */
  static async getDoctorPrescriptions(doctorId, limit = 50) {
    try {
      // Check if Firebase is available
      if (!db) {
        console.log('⚠️ Firebase not available, using fallback for doctor prescriptions');
        
        // Return empty array for now - in a real app, you might want to use in-memory storage
        return {
          success: true,
          prescriptions: []
        };
      }

      const prescriptionsSnap = await db.collection('prescriptions')
        .where('doctorId', '==', doctorId)
        .limit(limit)
        .get();

      const prescriptions = [];
      for (const doc of prescriptionsSnap.docs) {
        const prescriptionData = doc.data();
        
        // Get patient details
        const patientSnap = await db.collection('users').doc(prescriptionData.patientId).get();
        const patientData = patientSnap.exists() ? patientSnap.data() : {};

        prescriptions.push({
          id: doc.id,
          ...prescriptionData,
          patientName: patientData.name || 'Unknown Patient',
          patientEmail: patientData.email || ''
        });
      }

      return {
        success: true,
        prescriptions
      };
    } catch (error) {
      console.error('Error fetching doctor prescriptions:', error);
      throw new Error('Failed to fetch prescriptions');
    }
  }

  /**
   * Get prescriptions for a patient
   */
  static async getPatientPrescriptions(patientId, limit = 50) {
    try {
      // Check if Firebase is available
      if (!db) {
        console.log('⚠️ Firebase not available, using fallback for patient prescriptions');
        
        // Return empty array for now - in a real app, you might want to use in-memory storage
        return {
          success: true,
          prescriptions: []
        };
      }

      const prescriptionsSnap = await db.collection('prescriptions')
        .where('patientId', '==', patientId)
        .limit(limit)
        .get();

      const prescriptions = [];
      for (const doc of prescriptionsSnap.docs) {
        const prescriptionData = doc.data();
        
        // Get doctor details
        const doctorSnap = await db.collection('users').doc(prescriptionData.doctorId).get();
        const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};

        prescriptions.push({
          id: doc.id,
          ...prescriptionData,
          doctorName: doctorData.name || 'Unknown Doctor',
          doctorSpecialization: doctorData.specialization || ''
        });
      }

      return {
        success: true,
        prescriptions
      };
    } catch (error) {
      console.error('Error fetching patient prescriptions:', error);
      throw new Error('Failed to fetch prescriptions');
    }
  }

  /**
   * Update prescription status
   */
  static async updatePrescriptionStatus(prescriptionId, status, userId) {
    try {
      const prescriptionRef = db.collection('prescriptions').doc(prescriptionId);
      const prescriptionSnap = await prescriptionRef.get();

      if (!prescriptionSnap.exists()) {
        throw new Error('Prescription not found');
      }

      const prescription = prescriptionSnap.data();

      // Check if user is authorized to update this prescription
      if (prescription.doctorId !== userId && prescription.patientId !== userId) {
        throw new Error('Unauthorized to update this prescription');
      }

      const validStatuses = ['pending', 'sent', 'received', 'filled', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      await prescriptionRef.update({
        status,
        updatedAt: new Date().toISOString(),
        [`${status}At`]: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Prescription status updated successfully'
      };
    } catch (error) {
      console.error('Error updating prescription status:', error);
      throw new Error(error.message || 'Failed to update prescription status');
    }
  }

  /**
   * Send prescription to patient
   */
  static async sendPrescription(prescriptionId, doctorId) {
    try {
      const prescriptionRef = db.collection('prescriptions').doc(prescriptionId);
      const prescriptionSnap = await prescriptionRef.get();

      if (!prescriptionSnap.exists()) {
        throw new Error('Prescription not found');
      }

      const prescription = prescriptionSnap.data();

      if (prescription.doctorId !== doctorId) {
        throw new Error('Unauthorized to send this prescription');
      }

      if (prescription.status !== 'pending') {
        throw new Error('Prescription has already been sent');
      }

      // Update status to sent
      await prescriptionRef.update({
        status: 'sent',
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Create notification for patient
      const notificationData = {
        recipientId: prescription.patientId,
        senderId: doctorId,
        type: 'prescription',
        title: 'New Prescription',
        message: 'You have received a new prescription from your doctor',
        data: {
          prescriptionId,
          medications: prescription.medications.map(med => med.name).join(', ')
        },
        priority: prescription.priority,
        read: false,
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      await db.collection('notifications').add(notificationData);

      return {
        success: true,
        message: 'Prescription sent successfully'
      };
    } catch (error) {
      console.error('Error sending prescription:', error);
      throw new Error(error.message || 'Failed to send prescription');
    }
  }

  /**
   * Get prescription details
   */
  static async getPrescriptionDetails(prescriptionId, userId) {
    try {
      const prescriptionSnap = await db.collection('prescriptions').doc(prescriptionId).get();

      if (!prescriptionSnap.exists()) {
        throw new Error('Prescription not found');
      }

      const prescription = prescriptionSnap.data();

      // Check if user is authorized to view this prescription
      if (prescription.doctorId !== userId && prescription.patientId !== userId) {
        throw new Error('Unauthorized to view this prescription');
      }

      // Get additional details
      const doctorSnap = await db.collection('users').doc(prescription.doctorId).get();
      const patientSnap = await db.collection('users').doc(prescription.patientId).get();

      const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};
      const patientData = patientSnap.exists() ? patientSnap.data() : {};

      return {
        success: true,
        prescription: {
          id: prescriptionId,
          ...prescription,
          doctorName: doctorData.name || 'Unknown Doctor',
          doctorSpecialization: doctorData.specialization || '',
          patientName: patientData.name || 'Unknown Patient',
          patientEmail: patientData.email || ''
        }
      };
    } catch (error) {
      console.error('Error fetching prescription details:', error);
      throw new Error(error.message || 'Failed to fetch prescription details');
    }
  }

  /**
   * Cancel prescription
   */
  static async cancelPrescription(prescriptionId, userId, reason = '') {
    try {
      const prescriptionRef = db.collection('prescriptions').doc(prescriptionId);
      const prescriptionSnap = await prescriptionRef.get();

      if (!prescriptionSnap.exists()) {
        throw new Error('Prescription not found');
      }

      const prescription = prescriptionSnap.data();

      // Check if user is authorized to cancel this prescription
      if (prescription.doctorId !== userId && prescription.patientId !== userId) {
        throw new Error('Unauthorized to cancel this prescription');
      }

      if (prescription.status === 'cancelled') {
        throw new Error('Prescription is already cancelled');
      }

      if (prescription.status === 'filled') {
        throw new Error('Cannot cancel a filled prescription');
      }

      await prescriptionRef.update({
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy: userId,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Prescription cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling prescription:', error);
      throw new Error(error.message || 'Failed to cancel prescription');
    }
  }
}

module.exports = PrescriptionModel;
