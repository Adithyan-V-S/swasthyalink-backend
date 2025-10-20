/**
 * Script to fetch doctor documents from Firestore
 * Run with: node scripts/fetchDoctor.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../swasthyalink-468105-143623eabdaa.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
if (admin.apps.length > 0) {
  db = admin.firestore();
} else {
  console.log('⚠️ Firebase Firestore not available in fetchDoctor script - skipping');
  process.exit(0);
}

async function fetchDoctors() {
  try {
    console.log('🔍 Fetching all doctor documents...\n');

    // Fetch all users with role 'doctor'
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'doctor')
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ No doctors found in users collection');
      
      // Check doctor_registrations collection
      console.log('\n🔍 Checking doctor_registrations collection...');
      const registrationsSnapshot = await db.collection('doctor_registrations').get();
      
      if (registrationsSnapshot.empty) {
        console.log('❌ No doctor registrations found');
        return;
      }
      
      console.log('\n📋 Doctor Registrations:');
      registrationsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Email: ${data.email}`);
        console.log(`  Specialization: ${data.specialization}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Created: ${data.createdAt}`);
        console.log('');
      });
      
      return;
    }

    console.log(`✅ Found ${usersSnapshot.size} doctor(s):\n`);

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`👨‍⚕️ Doctor ID: ${doc.id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Specialization: ${data.specialization}`);
      console.log(`   License: ${data.license}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Created: ${data.createdAt}`);
      console.log(`   Login ID: ${data.loginId || 'Not set'}`);
      console.log('');
    });

    // Check for specific doctor email
    const targetEmail = 'doctor1758810279159@swasthyalink.com';
    console.log(`🔍 Looking for specific doctor: ${targetEmail}`);
    
    const specificDoctor = usersSnapshot.docs.find(doc => 
      doc.data().email === targetEmail
    );

    if (specificDoctor) {
      const data = specificDoctor.data();
      console.log(`✅ Found target doctor:`);
      console.log(`   ID: ${specificDoctor.id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Status: ${data.status}`);
      
      // Check if this doctor has Firebase Auth account
      console.log(`\n🔍 Checking Firebase Auth for this email...`);
      try {
        const userRecord = await admin.auth().getUserByEmail(targetEmail);
        console.log(`✅ Firebase Auth user found:`);
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Email: ${userRecord.email}`);
        console.log(`   Email Verified: ${userRecord.emailVerified}`);
        console.log(`   Created: ${new Date(userRecord.metadata.creationTime).toISOString()}`);
      } catch (authError) {
        console.log(`❌ No Firebase Auth user found for ${targetEmail}`);
        console.log(`   Error: ${authError.message}`);
      }
    } else {
      console.log(`❌ Target doctor ${targetEmail} not found in users collection`);
    }

  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
fetchDoctors();




























