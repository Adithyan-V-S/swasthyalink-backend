/**
 * Create mock doctor data in Firestore for test user
 * This ensures the backend has the doctor data it needs
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../swasthyalink-468105-143623eabdaa.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'swasthyakink'
  });
}

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
if (admin.apps.length > 0) {
  db = admin.firestore();
} else {
  console.log('⚠️ Firebase Firestore not available in createMockDoctor script - skipping');
  process.exit(0);
}

async function createMockDoctorData() {
  try {
    const testDoctorUid = 'test-doctor-uid-1758810279159';
    const doctorData = {
      uid: testDoctorUid,
      name: 'Dr. Test Doctor',
      email: 'doctor1758810279159@swasthyalink.com',
      role: 'doctor',
      specialization: 'General Medicine',
      license: 'LIC123456',
      experience: '5 years',
      description: 'Experienced general medicine doctor',
      phone: '+1234567890',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('🔧 Creating mock doctor data in Firestore...');
    await db.collection('users').doc(testDoctorUid).set(doctorData);
    console.log('✅ Mock doctor data created successfully');

    // Verify the data
    const doc = await db.collection('users').doc(testDoctorUid).get();
    if (doc.exists()) {
      const data = doc.data();
      console.log('\n📋 Doctor data verified:');
      console.log(`   UID: ${testDoctorUid}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Specialization: ${data.specialization}`);
    }

    console.log('\n🎉 Setup complete! The test doctor user should now work properly.');
    console.log('\n📝 Next steps:');
    console.log('1. Run the frontend setup script: node setupTestDoctor.js');
    console.log('2. Refresh your browser');
    console.log('3. Navigate to the doctor dashboard');

  } catch (error) {
    console.error('❌ Error creating mock doctor data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createMockDoctorData();




























