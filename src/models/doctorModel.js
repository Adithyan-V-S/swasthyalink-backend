/**
 * Doctor Model for SwasthyaLink
 * Handles doctor registration, approval, and management
 */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
if (admin.apps.length > 0) {
  db = admin.firestore();
} else {
  console.log('⚠️ Firebase Firestore not available in DoctorModel - using in-memory storage');
}

class DoctorModel {
  /**
   * Submit doctor registration request
   */
  static async submitRegistration(registrationData) {
    try {
      console.log('Submitting registration with data:', registrationData);
      const registrationId = uuidv4();
      const registration = {
        id: registrationId,
        ...registrationData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Registration object:', registration);

      // Store in registrations collection
      console.log('Attempting to save to Firestore...');
      await db.collection('doctor_registrations').doc(registrationId).set(registration);
      console.log('Successfully saved to Firestore');

      return {
        success: true,
        registration: {
          id: registrationId,
          name: registrationData.name,
          email: registrationData.email,
          specialization: registrationData.specialization,
          status: 'pending'
        }
      };
    } catch (error) {
      console.error('Error submitting doctor registration:', error);
      throw new Error('Failed to submit registration');
    }
  }

  /**
   * Get pending doctor registrations
   */
  static async getPendingRegistrations() {
    try {
      const snapshot = await db.collection('doctor_registrations')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();

      const registrations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { success: true, registrations };
    } catch (error) {
      console.error('Error fetching pending registrations:', error);
      throw new Error('Failed to fetch registrations');
    }
  }

  /**
   * Approve doctor registration
   */
  static async approveRegistration(registrationId, adminData) {
    try {
      const registrationRef = db.collection('doctor_registrations').doc(registrationId);
      const registrationSnap = await registrationRef.get();

      if (!registrationSnap.exists()) {
        throw new Error('Registration not found');
      }

      const registration = registrationSnap.data();

      if (registration.status !== 'pending') {
        throw new Error('Registration already processed');
      }

      // Generate random doctor ID and password
      const doctorId = uuidv4();
      const randomPassword = crypto.randomBytes(8).toString('hex');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      // Create doctor account
      const doctorData = {
        id: doctorId,
        registrationId: registrationId,
        name: registration.name,
        email: registration.email,
        specialization: registration.specialization,
        license: registration.license,
        experience: registration.experience || '',
        description: registration.description || '',
        phone: registration.phone,
        loginId: doctorId, // Use doctor ID as login ID
        password: hashedPassword,
        status: 'active',
        approvedBy: adminData.adminId,
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store doctor in users collection with role 'doctor'
      await db.collection('users').doc(doctorId).set({
        ...doctorData,
        role: 'doctor'
      });

      // Update registration status
      await registrationRef.update({
        status: 'approved',
        approvedBy: adminData.adminId,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        doctor: {
          id: doctorId,
          name: doctorData.name,
          email: doctorData.email,
          specialization: doctorData.specialization,
          status: 'active'
        },
        credentials: {
          doctorId: doctorId,
          loginId: doctorId,
          password: randomPassword
        }
      };
    } catch (error) {
      console.error('Error approving registration:', error);
      throw new Error(error.message || 'Failed to approve registration');
    }
  }

  /**
   * Reject doctor registration
   */
  static async rejectRegistration(registrationId, adminId) {
    try {
      const registrationRef = db.collection('doctor_registrations').doc(registrationId);
      const registrationSnap = await registrationRef.get();

      if (!registrationSnap.exists()) {
        throw new Error('Registration not found');
      }

      const registration = registrationSnap.data();

      if (registration.status !== 'pending') {
        throw new Error('Registration already processed');
      }

      // Update registration status
      await registrationRef.update({
        status: 'rejected',
        rejectedBy: adminId,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('Error rejecting registration:', error);
      throw new Error(error.message || 'Failed to reject registration');
    }
  }

  /**
   * Get all approved doctors
   */
  static async getAllDoctors(limitCount = 50) {
    try {
      // First try to get doctors with ordering
      let snapshot;
      try {
        snapshot = await db.collection('users')
          .where('role', '==', 'doctor')
          .orderBy('createdAt', 'desc')
          .limit(limitCount)
          .get();
      } catch (orderError) {
        // If ordering fails, try without ordering
        console.warn('Ordering by createdAt failed, trying without ordering:', orderError.message);
        snapshot = await db.collection('users')
          .where('role', '==', 'doctor')
          .limit(limitCount)
          .get();
      }

      const doctors = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { success: true, doctors };
    } catch (error) {
      console.error('Error fetching doctors:', error);
      throw new Error('Failed to fetch doctors');
    }
  }

  /**
   * Get doctor by ID
   */
  static async getDoctorById(doctorId) {
    try {
      const doctorRef = db.collection('users').doc(doctorId);
      const doctorSnap = await doctorRef.get();

      if (!doctorSnap.exists()) {
        throw new Error('Doctor not found');
      }

      const doctor = doctorSnap.data();
      if (doctor.role !== 'doctor') {
        throw new Error('User is not a doctor');
      }

      return {
        success: true,
        doctor: {
          id: doctorSnap.id,
          ...doctor
        }
      };
    } catch (error) {
      console.error('Error fetching doctor:', error);
      throw new Error(error.message || 'Failed to fetch doctor');
    }
  }

  /**
   * Update doctor profile
   */
  static async updateDoctorProfile(doctorId, updateData) {
    try {
      const doctorRef = db.collection('users').doc(doctorId);
      const doctorSnap = await doctorRef.get();

      if (!doctorSnap.exists()) {
        throw new Error('Doctor not found');
      }

      const doctor = doctorSnap.data();
      if (doctor.role !== 'doctor') {
        throw new Error('User is not a doctor');
      }

      // Remove sensitive fields from updates
      delete updateData.password;
      delete updateData.loginId;
      delete updateData.role;

      await doctorRef.update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating doctor profile:', error);
      throw new Error(error.message || 'Failed to update doctor profile');
    }
  }

  /**
   * Update doctor status (active/suspended)
   */
  static async updateDoctorStatus(doctorId, status, adminId) {
    try {
      const doctorRef = db.collection('users').doc(doctorId);
      const doctorSnap = await doctorRef.get();

      if (!doctorSnap.exists()) {
        throw new Error('Doctor not found');
      }

      const doctor = doctorSnap.data();
      if (doctor.role !== 'doctor') {
        throw new Error('User is not a doctor');
      }

      await doctorRef.update({
        status: status,
        updatedBy: adminId,
        updatedAt: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating doctor status:', error);
      throw new Error(error.message || 'Failed to update doctor status');
    }
  }

  /**
   * Disable doctor account
   */
  static async disableDoctor(doctorId, adminId) {
    try {
      const doctorRef = db.collection('users').doc(doctorId);
      const doctorSnap = await doctorRef.get();

      if (!doctorSnap.exists()) {
        throw new Error('Doctor not found');
      }

      const doctor = doctorSnap.data();
      if (doctor.role !== 'doctor') {
        throw new Error('User is not a doctor');
      }

      // Update doctor status to disabled
      await doctorRef.update({
        status: 'disabled',
        disabledBy: adminId,
        disabledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Update associated registration if exists
      const registrationRef = db.collection('doctor_registrations').doc(doctor.registrationId);
      await registrationRef.update({
        status: 'disabled',
        disabledBy: adminId,
        disabledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch(() => {
        // Registration might not exist, ignore error
      });

      return { success: true };
    } catch (error) {
      console.error('Error disabling doctor:', error);
      throw new Error(error.message || 'Failed to disable doctor');
    }
  }

  /**
   * Authenticate doctor
   */
  static async authenticateDoctor(loginId, password) {
    try {
      const snapshot = await db.collection('users')
        .where('role', '==', 'doctor')
        .where('loginId', '==', loginId)
        .get();

      if (snapshot.empty) {
        throw new Error('Invalid credentials');
      }

      const doctorDoc = snapshot.docs[0];
      const doctor = doctorDoc.data();

      if (doctor.status !== 'active') {
        throw new Error('Account is not active');
      }

      const isValidPassword = await bcrypt.compare(password, doctor.password);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate session token
      const sessionToken = uuidv4();

      // Update last login
      await doctorDoc.ref.update({
        lastLogin: new Date().toISOString(),
        sessionToken: sessionToken,
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        doctor: {
          id: doctorDoc.id,
          name: doctor.name,
          email: doctor.email,
          specialization: doctor.specialization,
          sessionToken: sessionToken
        }
      };
    } catch (error) {
      console.error('Error authenticating doctor:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }

  /**
   * Get patients for admin dashboard
   */
  static async getAllPatients(limitCount = 100) {
    try {
      // First try to get patients with ordering
      let snapshot;
      try {
        snapshot = await db.collection('users')
          .where('role', '==', 'patient')
          .orderBy('createdAt', 'desc')
          .limit(limitCount)
          .get();
      } catch (orderError) {
        // If ordering fails, try without ordering
        console.warn('Ordering by createdAt failed for patients, trying without ordering:', orderError.message);
        snapshot = await db.collection('users')
          .where('role', '==', 'patient')
          .limit(limitCount)
          .get();
      }

      const patients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { success: true, patients };
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw new Error('Failed to fetch patients');
    }
  }

  /**
   * Get doctor statistics
   */
  static async getDoctorStatistics() {
    try {
      const snapshot = await db.collection('users')
        .where('role', '==', 'doctor')
        .get();

      const doctors = snapshot.docs.map(doc => doc.data());

      const stats = {
        total: doctors.length,
        active: doctors.filter(d => d.status === 'active').length,
        suspended: doctors.filter(d => d.status === 'suspended').length,
        disabled: doctors.filter(d => d.status === 'disabled').length,
        pendingRegistrations: 0
      };

      // Get pending registrations count
      const regSnapshot = await db.collection('doctor_registrations')
        .where('status', '==', 'pending')
        .get();
      stats.pendingRegistrations = regSnapshot.size;

      return { success: true, stats };
    } catch (error) {
      console.error('Error fetching doctor statistics:', error);
      throw new Error('Failed to fetch statistics');
    }
  }
}

module.exports = DoctorModel;
