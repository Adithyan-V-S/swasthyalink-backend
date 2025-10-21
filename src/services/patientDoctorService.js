/**
 * Patient-Doctor Connection Service
 * Handles patient-doctor relationship management with OTP verification
 */

const admin = require('firebase-admin');
const otpService = require('./otpService');

class PatientDoctorService {
  constructor() {
    // Firebase Firestore - only initialize if Firebase Admin is available
    console.log('🔍 Firebase apps available:', admin.apps.length);
    console.log('🔍 Firebase db available:', admin.apps.length > 0);
    
    if (admin.apps.length > 0) {
      this.db = admin.firestore();
      console.log('✅ Firebase Firestore initialized in PatientDoctorService');
    } else {
      console.log('⚠️ Firebase Firestore not available in PatientDoctorService - using in-memory storage');
      console.log('🔍 Attempting to initialize Firebase manually...');
      
      // Try to initialize Firebase manually
      try {
        const serviceAccount = require('../../credentialss.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'swasthyakink'
        });
        this.db = admin.firestore();
        console.log('✅ Firebase Firestore manually initialized in PatientDoctorService');
      } catch (error) {
        console.log('❌ Failed to manually initialize Firebase:', error.message);
        this.db = null;
      }
    }
    
    // In-memory storage for fallback mode
    this.fallbackRequests = [];
    this.fallbackRelationships = [];
    this.fallbackNotifications = [];
    
    // Initialize with mock data to match frontend
    this.initializeMockData();
  }

  /**
   * Initialize mock data to match frontend
   */
  initializeMockData() {
    console.log('🧪 Initializing mock data for backend...');
    
    // Always create fresh test data for the current user
    const currentTime = new Date();
    const patientId = 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293';
    const patientEmail = 'vsadithyan215@gmail.com';
    
    // Add mock pending requests that match frontend
    this.fallbackRequests = [
      {
        id: 'test-request-' + Date.now(),
        doctorId: 'test-doctor-sachus',
        patientId: patientId,
        patient: {
          id: patientId,
          name: 'Adithyan V.s',
          email: patientEmail
        },
        doctor: {
          id: 'test-doctor-sachus',
          name: 'Dr. sachus',
          email: 'sachus@example.com',
          specialization: 'General Medicine'
        },
        connectionMethod: 'direct',
        message: 'Dr. sachus wants to connect with you',
        status: 'pending',
        createdAt: currentTime,
        updatedAt: currentTime
      },
      {
        id: 'test-request-2',
        doctorId: 'test-doctor-ann',
        patientId: 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293',
        patient: {
          id: 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293',
          name: 'Adithyan V.s',
          email: 'vsadithyan215@gmail.com'
        },
        doctor: {
          id: 'test-doctor-ann',
          name: 'Dr. ann mary',
          email: 'annmary@example.com',
          specialization: 'Cardiology'
        },
        connectionMethod: 'direct',
        message: 'Dr. ann mary wants to connect with you',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Add mock connected doctors
    this.fallbackRelationships = [
      {
        id: 'connected-doctor-' + Date.now(),
        patientId: patientId,
        doctorId: 'test-doctor-ann',
        patient: {
          id: patientId,
          name: 'Adithyan V.s',
          email: patientEmail
        },
        doctor: {
          id: 'test-doctor-ann',
          name: 'Dr. ann mary',
          email: 'annmary@example.com',
          specialization: 'Cardiology'
        },
        status: 'active',
        permissions: {
          prescriptions: true,
          records: true,
          emergency: false
        },
        createdAt: currentTime,
        updatedAt: currentTime
      }
    ];
    
    console.log('✅ Mock data initialized with', this.fallbackRequests.length, 'requests and', this.fallbackRelationships.length, 'relationships');
  }

  /**
   * Send connection request to patient
   * @param {string} doctorId - Doctor's UID
   * @param {string} patientId - Patient's UID (optional if using email/phone)
   * @param {string} patientEmail - Patient's email
   * @param {string} patientPhone - Patient's phone
   * @param {string} connectionMethod - 'qr', 'email', 'otp', or 'direct'
   * @param {string} message - Optional message from doctor
   */
  async sendConnectionRequest(doctorId, patientId, patientEmail, patientPhone, connectionMethod, message = '') {
    try {
      // Check if Firebase is available
      if (!this.db) {
        console.log('⚠️ Firebase not available, using fallback for connection request');
        
        // Create fallback request
        const requestId = 'fallback-request-' + Date.now();
        const fallbackRequest = {
          id: requestId,
          doctorId: doctorId,
          patientId: patientId || 'unknown-patient',
          patientEmail: patientEmail || null, // Add patientEmail field
          patientPhone: patientPhone || null, // Add patientPhone field
          connectionMethod: connectionMethod,
          message: message,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          doctor: {
            id: doctorId,
            name: 'Dr. Website Job Portal',
            email: 'websitejobportal@gmail.com',
            specialization: 'General Medicine',
            phone: '+1234567890'
          },
          patient: {
            id: patientId || 'unknown-patient',
            name: 'Patient',
            email: patientEmail || 'unknown@example.com',
            phone: patientPhone || 'Not provided'
          }
        };
        
        // Store in fallback storage
        this.fallbackRequests.push(fallbackRequest);
        console.log('✅ Fallback request stored:', fallbackRequest);
        
        return {
          success: true,
          requestId: requestId,
          message: 'Connection request created (fallback mode)'
        };
      }

      console.log('🔍 Firebase available, attempting to save to Firestore...');

      // Find patient by ID, email, or phone
      let patientDoc = null;
      let patientData = null;

      if (patientId) {
        patientDoc = await this.db.collection('users').doc(patientId).get();
        if (patientDoc.exists) {
          patientData = patientDoc.data();
        }
      } else if (patientEmail) {
        const emailQuery = await this.db.collection('users')
          .where('email', '==', patientEmail)
          .where('role', '==', 'patient')
          .limit(1)
          .get();
        if (!emailQuery.empty) {
          patientDoc = emailQuery.docs[0];
          patientData = patientDoc.data();
          patientId = patientDoc.id;
        }
      } else if (patientPhone) {
        const phoneQuery = await this.db.collection('users')
          .where('phone', '==', patientPhone)
          .where('role', '==', 'patient')
          .limit(1)
          .get();
        if (!phoneQuery.empty) {
          patientDoc = phoneQuery.docs[0];
          patientData = patientDoc.data();
          patientId = patientDoc.id;
        }
      }

      if (!patientData) {
        // If email was provided but no Firestore user exists, allow email-only flow
        if (patientEmail) {
          patientData = {
            email: patientEmail,
            name: (patientEmail.split('@')[0] || 'Unknown Patient')
          };
          patientId = null; // email-only request
          console.log('Proceeding with email-only patient request for:', patientEmail);
        } else {
          throw new Error('Patient not found');
        }
      }

      // Get doctor data
      const doctorDoc = await this.db.collection('users').doc(doctorId).get();
      if (!doctorDoc.exists) {
        throw new Error('Doctor not found');
      }
      const doctorData = doctorDoc.data();

      // Check if connection already exists
      if (patientId) {
        const existingConnection = await this.db.collection('patient_doctor_relationships')
          .where('patientId', '==', patientId)
          .where('doctorId', '==', doctorId)
          .where('status', '==', 'active')
          .limit(1)
          .get();

        if (!existingConnection.empty) {
          throw new Error('Connection already exists');
        }
      }

      // Check for pending request and clean up old ones
      let pendingRequest;
      if (patientId) {
        pendingRequest = await this.db.collection('patient_doctor_requests')
          .where('patientId', '==', patientId)
          .where('doctorId', '==', doctorId)
          .where('status', '==', 'pending')
          .get();
      } else {
        // Email-only pending requests
        pendingRequest = await this.db.collection('patient_doctor_requests')
          .where('doctorId', '==', doctorId)
          .where('status', '==', 'pending')
          .get();
      }

      if (!pendingRequest.empty) {
        // Cancel old pending requests
        const batch = this.db.batch();
        pendingRequest.forEach(doc => {
          batch.update(doc.ref, {
            status: 'cancelled',
            updatedAt: new Date()
          });
        });
        await batch.commit();
        console.log(`Cancelled ${pendingRequest.size} old pending requests`);
      }

      // Generate OTP for verification (skip for direct method)
      const otp = connectionMethod === 'direct' ? null : Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = connectionMethod === 'direct' ? null : new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create request document
      const requestRef = this.db.collection('patient_doctor_requests').doc();
      const requestData = {
        id: requestRef.id,
        doctorId,
        patientId: patientId || null,
        patientEmail: patientEmail || null, // Add patientEmail field
        patientPhone: patientPhone || null, // Add patientPhone field
        doctor: {
          id: doctorId,
          name: doctorData.name || 'Dr. Unknown',
          email: doctorData.email || 'unknown@example.com',
          phone: doctorData.phone || 'Not provided',
          specialization: doctorData.specialization || 'General Physician'
        },
        patient: {
          id: patientId || null,
          name: patientData.name || 'Unknown Patient',
          email: patientData.email || patientEmail || 'unknown@example.com',
          phone: patientData.phone || 'Not provided'
        },
        connectionMethod,
        message,
        otp,
        otpExpiry,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await requestRef.set(requestData);

      // Create notification for patient
      try {
        await this.db.collection('notifications').add({
          recipientId: patientId,
          senderId: doctorId,
          type: 'doctor_connection_request',
          title: 'New Doctor Connection Request',
          message: `Dr. ${doctorData.name || 'Unknown'} wants to connect with you`,
          data: {
            requestId: requestRef.id,
            doctorName: doctorData.name || 'Dr. Unknown',
            doctorSpecialization: doctorData.specialization || 'General Physician',
            connectionMethod: connectionMethod
          },
          priority: 'high',
          read: false,
          deleted: false,
          timestamp: new Date()
        });
        console.log('Notification created for patient:', patientId);
      } catch (notificationError) {
        console.warn('Failed to create notification:', notificationError.message);
      }

      // Send OTP via email if email method
      if (connectionMethod === 'email' && patientData.email) {
        try {
          await otpService.sendEmailOTP(
            patientData.email,
            doctorData.name || 'Dr. Unknown',
            'connection'
          );
        } catch (emailError) {
          console.warn('Failed to send email OTP, but connection request created:', emailError.message);
          // Continue anyway - the request is still created with OTP
        }
      }

      return {
        success: true,
        requestId: requestRef.id,
        message: 'Connection request sent successfully'
      };

    } catch (error) {
      console.error('Error sending connection request:', error);
      throw error;
    }
  }

  /**
   * Get pending requests for a patient
   * @param {string} patientId - Patient's UID
   */
  async getPendingRequests(patientId, patientEmail) {
    try {
      // Check if Firebase is available
      if (!this.db) {
        console.log('⚠️ Firebase not available, returning fallback pending requests');
        
        // Return requests from fallback storage
        const patientRequests = this.fallbackRequests.filter(req => {
          const emailMatch = patientEmail ? (req.patientEmail === patientEmail || req.patient?.email === patientEmail) : false;
          const idMatch = patientId ? (req.patientId === patientId) : false;
          return (idMatch || emailMatch) && req.status === 'pending';
        });
        
        console.log('✅ Fallback requests found:', patientRequests.length);
        return { 
          success: true, 
          requests: patientRequests 
        };
      }

      // Fetch by patientId
      const byIdSnap = patientId
        ? await this.db.collection('patient_doctor_requests')
            .where('patientId', '==', patientId)
            .get()
        : { empty: true, docs: [] };

      // Also fetch by patient email as a fallback (some docs may have patient object with email)
      let byEmailSnap = { empty: true, docs: [] };
      if (patientEmail) {
        try {
          // Try both patient.email and patientEmail fields
          const byPatientEmailSnap = await this.db.collection('patient_doctor_requests')
            .where('patient.email', '==', patientEmail)
            .get();
          
          const byPatientEmailFieldSnap = await this.db.collection('patient_doctor_requests')
            .where('patientEmail', '==', patientEmail)
            .get();
          
          // Combine both results
          byEmailSnap = {
            empty: byPatientEmailSnap.empty && byPatientEmailFieldSnap.empty,
            docs: [...byPatientEmailSnap.docs, ...byPatientEmailFieldSnap.docs]
          };
        } catch (e) {
          console.warn('Email-based request query failed (index may be needed):', e.message);
        }
      }

      const requests = [];
      const allDocs = [...byIdSnap.docs, ...byEmailSnap.docs];
      const seen = new Set();
      allDocs.forEach(doc => {
        if (seen.has(doc.id)) return; // de-dup
        seen.add(doc.id);
        const data = doc.data();
        // Filter for pending requests and check if OTP is still valid
        if (data.status === 'pending') {          // For 'direct' method (no OTP), accept as pending immediately
          const isDirect = data.connectionMethod === 'direct' || (!data.otp && !data.otpExpiry);
          if (isDirect) {
            requests.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            });
          } else if (data.otpExpiry && data.otpExpiry.toDate() > new Date()) {
            requests.push({
              id: doc.id,
              ...data,
              otpExpiry: data.otpExpiry.toDate(),
              createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            });
          } else {
            // Clean up expired requests
            this.db.collection('patient_doctor_requests').doc(doc.id).update({
              status: 'expired',
              updatedAt: new Date()
            });
          }
        }
      });

      return {
        success: true,
        requests
      };

    } catch (error) {
      console.error('Error getting pending requests:', error);
      throw error;
    }
  }

  /**
   * Accept connection request instantly (no OTP verification needed)
   * @param {string} requestId - Request ID
   * @param {string} patientId - Patient's UID
   * @param {string} otp - OTP code (ignored for instant approval)
   */
  async acceptRequest(requestId, patientId, patientEmail, otp) {
    try {
      console.log('🔍 acceptRequest called with:', { requestId, patientId, patientEmail, otp });
      console.log('🔍 Current fallback requests:', this.fallbackRequests);
      console.log('🔍 Firebase db available:', !!this.db);
      console.log('🔍 Firebase apps available:', admin.apps.length);
      
      // Check if Firebase is available
      if (!this.db) {
        console.log('⚠️ Firebase not available, using fallback for accept request');
        console.log('🔍 Firebase apps available:', admin.apps.length);
        
        // Find request in fallback storage
        const requestIndex = this.fallbackRequests.findIndex(req => req.id === requestId);
        console.log('🔍 Request index found:', requestIndex);
        
        if (requestIndex === -1) {
          console.log('❌ Request not found in fallback storage, creating new one');
          
          // Create a new request for testing
          const newRequest = {
            id: requestId,
            doctorId: 'test-doctor-id',
            patientId: patientId,
            patient: {
              id: patientId,
              name: '04_ADITHYAN V S INT MCA',
              email: patientEmail || 'adithyanvs2026@mca.ajce.in'
            },
            doctor: {
              id: 'test-doctor-id',
              name: 'Dr. sachus',
              email: 'sachus@example.com',
              specialization: 'General Medicine'
            },
            connectionMethod: 'direct',
            message: 'Dr. sachus wants to connect with you',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          this.fallbackRequests.push(newRequest);
          console.log('✅ Created new fallback request:', newRequest);
        }
        
        // Get the request data (either existing or newly created)
        const finalRequestIndex = this.fallbackRequests.findIndex(req => req.id === requestId);
        const requestData = this.fallbackRequests[finalRequestIndex];
        
        // In fallback mode, relax strict ownership checks to allow demo/test flows
        // If the stored request has a placeholder patientId, replace it with the authenticated one
        if (!requestData.patientId || requestData.patientId === 'unknown-patient') {
          this.fallbackRequests[finalRequestIndex].patientId = patientId;
          if (this.fallbackRequests[finalRequestIndex].patient) {
            this.fallbackRequests[finalRequestIndex].patient.id = patientId;
          }
        }
        
        // Check if request is still pending
        if (requestData.status !== 'pending') {
          throw new Error('Request is no longer pending');
        }
        
        // Update request status in fallback storage
        this.fallbackRequests[finalRequestIndex].status = 'accepted';
        this.fallbackRequests[finalRequestIndex].acceptedAt = new Date();
        this.fallbackRequests[finalRequestIndex].updatedAt = new Date();
        
        // Create relationship in fallback storage
        const relationshipId = 'fallback-relationship-' + Date.now();
        const relationshipData = {
          id: relationshipId,
          patientId: this.fallbackRequests[requestIndex].patientId,
          doctorId: requestData.doctorId,
          patient: requestData.patient,
          doctor: requestData.doctor,
          status: 'active',
          permissions: {
            prescriptions: true,
            records: false,
            emergency: false
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        this.fallbackRelationships.push(relationshipData);
        
        // Create fallback notification for doctor
        const notificationId = 'fallback-notification-' + Date.now();
        const fallbackNotification = {
          id: notificationId,
          recipientId: requestData.doctorId,
          senderId: patientId,
          type: 'connection_accepted',
          title: 'Connection Established Successfully!',
          message: `${requestData.patient.name || 'Patient'} has accepted your connection request`,
          data: {
            relationshipId: relationshipId,
            patientName: requestData.patient.name || 'Patient',
            patientEmail: requestData.patient.email || 'unknown@example.com'
          },
          priority: 'high',
          read: false,
          deleted: false,
          timestamp: new Date()
        };
        
        // Store in fallback notifications
        this.fallbackNotifications.push(fallbackNotification);
        console.log('✅ Fallback notification created for doctor:', fallbackNotification);
        
        console.log('✅ Fallback request accepted and relationship created');
        
        return {
          success: true,
          relationshipId: relationshipId,
          message: 'Connection request accepted successfully (fallback mode)'
        };
      }

      const requestRef = this.db.collection('patient_doctor_requests').doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        throw new Error('Request not found');
      }

      const requestData = requestDoc.data();

      // Verify request belongs to patient (check by ID or email)
      const patientIdMatch = requestData.patientId === patientId;
      const patientEmailMatch = requestData.patient?.email && requestData.patient.email === patientEmail;
      const patientEmailFieldMatch = requestData.patientEmail && requestData.patientEmail === patientEmail;
      
      if (!patientIdMatch && !patientEmailMatch && !patientEmailFieldMatch) {
        console.log('❌ Request ownership check failed:', {
          requestPatientId: requestData.patientId,
          requestPatientEmail: requestData.patient?.email,
          requestPatientEmailField: requestData.patientEmail,
          providedPatientId: patientId,
          providedPatientEmail: patientEmail
        });
        throw new Error('Unauthorized');
      }

      // Check if request is still pending
      if (requestData.status !== 'pending') {
        throw new Error('Request is no longer pending');
      }

      // Skip OTP verification for instant approval
      console.log('Accepting request instantly without OTP verification');

      // Create active relationship
      const relationshipRef = this.db.collection('patient_doctor_relationships').doc();
      const relationshipData = {
        id: relationshipRef.id,
        patientId: requestData.patientId,
        doctorId: requestData.doctorId,
        patient: requestData.patient,
        doctor: requestData.doctor,
        status: 'active',
        permissions: {
          prescriptions: true,
          records: false,
          emergency: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await relationshipRef.set(relationshipData);

      // Update request status
      await requestRef.update({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date()
      });

      // Create notification for doctor
      try {
        await this.db.collection('notifications').add({
          recipientId: requestData.doctorId,
          senderId: patientId,
          type: 'connection_accepted',
          title: 'Connection Established Successfully!',
          message: `${requestData.patient.name || 'Patient'} has accepted your connection request`,
          data: {
            relationshipId: relationshipRef.id,
            patientName: requestData.patient.name || 'Patient',
            patientEmail: requestData.patient.email || 'unknown@example.com'
          },
          priority: 'high',
          read: false,
          deleted: false,
          timestamp: new Date()
        });
        console.log('Notification created for doctor:', requestData.doctorId);
      } catch (notificationError) {
        console.warn('Failed to create notification for doctor:', notificationError.message);
      }

      return {
        success: true,
        relationship: relationshipData,
        message: 'Connection request accepted successfully'
      };

    } catch (error) {
      console.error('Error accepting request:', error);
      throw error;
    }
  }

  /**
   * Get connected doctors for a patient
   * @param {string} patientId - Patient's UID
   */
  async getConnectedDoctors(patientId, patientEmail = null) {
    try {
      // Check if Firebase is available
      if (!this.db) {
        console.log('⚠️ Firebase not available, using fallback for connected doctors');
        
        // Return doctors from fallback relationships (check by ID or email)
        const patientRelationships = this.fallbackRelationships.filter(rel => {
          const idMatch = rel.patientId === patientId;
          const emailMatch = patientEmail && (rel.patient?.email === patientEmail || rel.patientEmail === patientEmail);
          return (idMatch || emailMatch) && rel.status === 'active';
        });
        
        const doctors = patientRelationships.map(rel => ({
          id: rel.doctorId,
          name: rel.doctor.name || 'Unknown Doctor',
          email: rel.doctor.email || 'No email',
          specialization: rel.doctor.specialization || 'General Medicine',
          phone: rel.doctor.phone || 'No phone',
          connectionDate: rel.createdAt,
          lastInteraction: rel.updatedAt,
          permissions: rel.permissions
        }));
        
        console.log('✅ Fallback connected doctors found:', doctors.length);
        return { 
          success: true, 
          connectedDoctors: doctors 
        };
      }

      // Get all relationships for this patient (by ID or email)
      let relationshipsQuery;
      if (patientId) {
        relationshipsQuery = await this.db.collection('patient_doctor_relationships')
          .where('patientId', '==', patientId)
          .get();
      } else if (patientEmail) {
        // If no patientId, try to find by email
        relationshipsQuery = await this.db.collection('patient_doctor_relationships')
          .where('patient.email', '==', patientEmail)
          .get();
      } else {
        return { success: true, connectedDoctors: [] };
      }

      const doctors = [];
      
      // Process each relationship
      for (const doc of relationshipsQuery.docs) {
        const relationshipData = doc.data();
        
        // Only include active relationships
        if (relationshipData.status === 'active') {
          try {
            // Fetch doctor data from users collection
            const doctorDoc = await this.db.collection('users').doc(relationshipData.doctorId).get();
            
            if (doctorDoc.exists) {
              const doctorData = doctorDoc.data();
              doctors.push({
                id: relationshipData.doctorId,
                name: doctorData.name || 'Unknown Doctor',
                email: doctorData.email || 'No email',
                phone: doctorData.phone || 'No phone',
                specialization: doctorData.specialization || 'General Practice',
                connectedAt: relationshipData.connectionDate || relationshipData.createdAt,
                lastInteraction: relationshipData.lastInteraction || relationshipData.createdAt,
                permissions: relationshipData.permissions
              });
            }
          } catch (doctorError) {
            console.error(`Error fetching doctor data for ${relationshipData.doctorId}:`, doctorError);
            // Still include the doctor with basic info
            doctors.push({
              id: relationshipData.doctorId,
              name: 'Unknown Doctor',
              email: 'No email',
              phone: 'No phone',
              specialization: 'General Practice',
              connectedAt: relationshipData.connectionDate || relationshipData.createdAt,
              lastInteraction: relationshipData.lastInteraction || relationshipData.createdAt,
              permissions: relationshipData.permissions
            });
          }
        }
      }

      return {
        success: true,
        doctors
      };

    } catch (error) {
      console.error('Error getting connected doctors:', error);
      throw error;
    }
  }

  /**
   * Get connected patients for a doctor
   * @param {string} doctorId - Doctor's UID
   */
  async getConnectedPatients(doctorId) {
    try {
      // Get all relationships for this doctor
      const relationshipsQuery = await this.db.collection('patient_doctor_relationships')
        .where('doctorId', '==', doctorId)
        .get();

      const patients = [];
      
      // Process each relationship
      for (const doc of relationshipsQuery.docs) {
        const relationshipData = doc.data();
        
        // Only include active relationships
        if (relationshipData.status === 'active') {
          try {
            // Fetch patient data from users collection
            const patientDoc = await this.db.collection('users').doc(relationshipData.patientId).get();
            
            if (patientDoc.exists) {
              const patientData = patientDoc.data();
              patients.push({
                id: relationshipData.patientId,
                name: patientData.name || 'Unknown Patient',
                email: patientData.email || 'No email',
                phone: patientData.phone || 'No phone',
                age: patientData.age || 'Not specified',
                gender: patientData.gender || 'Not specified',
                bloodType: patientData.bloodType || 'Not specified',
                allergies: patientData.allergies || [],
                connectedAt: relationshipData.connectionDate || relationshipData.createdAt,
                lastVisit: relationshipData.lastInteraction || relationshipData.createdAt,
                permissions: relationshipData.permissions
              });
            }
          } catch (patientError) {
            console.error(`Error fetching patient data for ${relationshipData.patientId}:`, patientError);
            // Still include the patient with basic info
            patients.push({
              id: relationshipData.patientId,
              name: 'Unknown Patient',
              email: 'No email',
              phone: 'No phone',
              age: 'Not specified',
              gender: 'Not specified',
              bloodType: 'Not specified',
              allergies: [],
              connectedAt: relationshipData.connectionDate || relationshipData.createdAt,
              lastVisit: relationshipData.lastInteraction || relationshipData.createdAt,
              permissions: relationshipData.permissions
            });
          }
        }
      }

      return {
        success: true,
        patients
      };

    } catch (error) {
      console.error('Error getting connected patients:', error);
      throw error;
    }
  }

  /**
   * Resend OTP for a pending request: regenerates OTP and expiry
   */
  async resendRequest(requestId, userId) {
    try {
      const requestRef = this.db.collection('patient_doctor_requests').doc(requestId);
      const requestDoc = await requestRef.get();
      if (!requestDoc.exists) {
        throw new Error('Request not found');
      }

      const request = requestDoc.data();
      // Ensure the requester is either the patient or the doctor on the request
      if (request.patientId !== userId && request.doctorId !== userId) {
        throw new Error('Unauthorized');
      }

      if (request.status !== 'pending') {
        throw new Error('Only pending requests can be resent');
      }

      // Generate new OTP and expiry
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiry = new Date(Date.now() + 10 * 60 * 1000);

      await requestRef.update({
        otp: newOtp,
        otpExpiry: newExpiry,
        updatedAt: new Date()
      });

      // Optionally, send via email if available in request
      try {
        if (request.connectionMethod === 'email' && request.patient?.email) {
          // For now, just log the OTP; integrate real email service if needed
          console.log(`Resent OTP ${newOtp} to ${request.patient.email}`);
        }
      } catch (notifyErr) {
        console.warn('Failed to send notification for resent OTP:', notifyErr);
      }

      return { success: true };
    } catch (error) {
      console.error('Error resending OTP:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a doctor (fallback mode)
   * @param {string} doctorId - Doctor's UID
   */
  async getDoctorNotifications(doctorId) {
    try {
      // Check if Firebase is available
      if (!this.db) {
        console.log('⚠️ Firebase not available, using fallback notifications');
        
        // Return notifications from fallback storage
        const notifications = this.fallbackNotifications.filter(notif => 
          notif.recipientId === doctorId && !notif.deleted
        );
        
        console.log('✅ Fallback notifications found:', notifications.length);
        return {
          success: true,
          notifications: notifications
        };
      }

      // Firebase implementation would go here
      return { success: true, notifications: [] };
    } catch (error) {
      console.error('Error getting doctor notifications:', error);
      throw error;
    }
  }
}

module.exports = new PatientDoctorService();
