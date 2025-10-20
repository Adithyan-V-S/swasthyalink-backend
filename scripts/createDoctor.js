/**
 * Create a doctor account and set up login
 * This will create the doctor in Firestore and Firebase Auth
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (use the same config as server.js)
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
  console.log('⚠️ Firebase Firestore not available in createDoctor script - skipping');
  process.exit(0);
}

async function createDoctorAccount() {
  try {
    const doctorEmail = 'doctor1758810279159@swasthyalink.com';
    const doctorPassword = 'Doc279159!';
    const doctorName = 'Dr. Test Doctor';
    const doctorSpecialization = 'General Medicine';

    console.log('🔧 Creating doctor account...');
    console.log(`Email: ${doctorEmail}`);
    console.log(`Password: ${doctorPassword}`);

    // 1. Create Firebase Auth user
    console.log('\n1️⃣ Creating Firebase Auth user...');
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email: doctorEmail,
        password: doctorPassword,
        displayName: doctorName,
        emailVerified: true
      });
      console.log(`✅ Firebase Auth user created: ${firebaseUser.uid}`);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log('⚠️ Firebase Auth user already exists, fetching...');
        firebaseUser = await admin.auth().getUserByEmail(doctorEmail);
        console.log(`✅ Found existing Firebase Auth user: ${firebaseUser.uid}`);
      } else {
        throw authError;
      }
    }

    // 2. Create Firestore user document
    console.log('\n2️⃣ Creating Firestore user document...');
    const userData = {
      uid: firebaseUser.uid,
      name: doctorName,
      email: doctorEmail,
      role: 'doctor',
      specialization: doctorSpecialization,
      license: 'LIC123456',
      experience: '5 years',
      description: 'Experienced general medicine doctor',
      phone: '+1234567890',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('users').doc(firebaseUser.uid).set(userData);
    console.log(`✅ Firestore user document created for UID: ${firebaseUser.uid}`);

    // 3. Verify the account
    console.log('\n3️⃣ Verifying account...');
    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log('✅ Account verification successful:');
      console.log(`   UID: ${firebaseUser.uid}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Specialization: ${data.specialization}`);
    }

    console.log('\n🎉 Doctor account setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${doctorEmail}`);
    console.log(`   Password: ${doctorPassword}`);
    console.log('\n🔗 You can now log in to the doctor dashboard with these credentials.');

  } catch (error) {
    console.error('❌ Error creating doctor account:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createDoctorAccount();




























