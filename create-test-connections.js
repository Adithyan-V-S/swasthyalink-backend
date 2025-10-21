const admin = require('firebase-admin');
const serviceAccount = require('./credentialss.json');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
} catch (e) {
  console.error('❌ Firebase Admin init failed:', e.message);
  process.exit(1);
}

const db = admin.firestore();

const createTestConnections = async () => {
  const patientId = 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293'; // The user from the logs
  const patientEmail = 'vsadithyan215@gmail.com';
  
  try {
    console.log('🔍 Creating test connections for patient:', patientId);
    
    // 1. Create a pending connection request
    const requestRef = db.collection('patient_doctor_requests').doc();
    const requestData = {
      id: requestRef.id,
      doctorId: 'test-doctor-sachus',
      patientId: patientId,
      patientEmail: patientEmail,
      doctor: {
        id: 'test-doctor-sachus',
        name: 'Dr. sachus',
        email: 'sachus@example.com',
        specialization: 'General Medicine'
      },
      patient: {
        id: patientId,
        name: 'Adithyan V.s',
        email: patientEmail
      },
      connectionMethod: 'direct',
      message: 'Dr. sachus wants to connect with you',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await requestRef.set(requestData);
    console.log('✅ Created pending request:', requestRef.id);
    
    // 2. Create a connected doctor relationship
    const relationshipRef = db.collection('patient_doctor_relationships').doc();
    const relationshipData = {
      id: relationshipRef.id,
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
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await relationshipRef.set(relationshipData);
    console.log('✅ Created connected doctor relationship:', relationshipRef.id);
    
    // 3. Create a notification for the patient
    const notificationRef = db.collection('notifications').doc();
    const notificationData = {
      id: notificationRef.id,
      recipientId: patientId,
      senderId: 'test-doctor-sachus',
      type: 'doctor_connection_request',
      title: 'New Doctor Connection Request',
      message: 'Dr. sachus wants to connect with you',
      data: {
        requestId: requestRef.id,
        doctorName: 'Dr. sachus',
        doctorEmail: 'sachus@example.com'
      },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await notificationRef.set(notificationData);
    console.log('✅ Created notification:', notificationRef.id);
    
    console.log('\n🎉 Test data created successfully!');
    console.log('📋 Summary:');
    console.log('- 1 pending connection request (Dr. sachus)');
    console.log('- 1 connected doctor (Dr. ann mary)');
    console.log('- 1 notification for the patient');
    
  } catch (error) {
    console.error('❌ Error creating test connections:', error);
  }
};

createTestConnections().then(() => {
  console.log('\n✅ Test data creation completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


