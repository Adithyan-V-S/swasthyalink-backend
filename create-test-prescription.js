/**
 * Script to create a test prescription for patient "04_ADITHYAN V S INT MCA"
 * This will help test the prescription display in patient dashboard
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('✅ Firebase Admin initialized (production, env-based)');
  } else {
    // dev fallback with credentials file if present
    const serviceAccount = require('./credentialss.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized (development file)');
  }
} catch (e) {
  console.error('❌ Firebase Admin init failed:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function createTestPrescription() {
  try {
    console.log('💊 Creating test prescription for patient "04_ADITHYAN V S INT MCA"...');

    // First, let's find the patient by name
    const patientsQuery = await db.collection('users')
      .where('name', '==', '04_ADITHYAN V S INT MCA')
      .get();

    if (patientsQuery.empty) {
      console.log('❌ Patient "04_ADITHYAN V S INT MCA" not found in users collection');
      console.log('🔍 Let me check what patients exist...');
      
      const allPatients = await db.collection('users')
        .where('role', '==', 'patient')
        .get();
      
      console.log('📋 Available patients:');
      allPatients.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.name} (${data.email}) - ID: ${doc.id}`);
      });
      
      process.exit(1);
    }

    const patientDoc = patientsQuery.docs[0];
    const patientData = patientDoc.data();
    const patientId = patientDoc.id;

    console.log(`✅ Found patient: ${patientData.name} (${patientData.email}) - ID: ${patientId}`);

    // Find a doctor to assign the prescription to
    const doctorsQuery = await db.collection('users')
      .where('role', '==', 'doctor')
      .limit(1)
      .get();

    if (doctorsQuery.empty) {
      console.log('❌ No doctors found in users collection');
      process.exit(1);
    }

    const doctorDoc = doctorsQuery.docs[0];
    const doctorData = doctorDoc.data();
    const doctorId = doctorDoc.id;

    console.log(`✅ Found doctor: ${doctorData.name} (${doctorData.email}) - ID: ${doctorId}`);

    // Create the prescription
    const prescriptionData = {
      id: `pres_${Date.now()}`,
      doctorId: doctorId,
      patientId: patientId,
      medications: [
        {
          name: 'paracetamol',
          dosage: '500gm',
          frequency: '3 times daily',
          duration: '7 days',
          instructions: 'nothing'
        }
      ],
      diagnosis: 'Fever and headache',
      instructions: 'Take with food, avoid alcohol',
      notes: 'Patient should rest and drink plenty of fluids',
      status: 'sent', // Make it active so it shows up
      priority: 'normal',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sentAt: new Date().toISOString()
    };

    // Save to Firestore
    await db.collection('prescriptions').doc(prescriptionData.id).set(prescriptionData);

    console.log('✅ Test prescription created successfully!');
    console.log('📋 Prescription details:');
    console.log(`   - ID: ${prescriptionData.id}`);
    console.log(`   - Patient: ${patientData.name}`);
    console.log(`   - Doctor: ${doctorData.name}`);
    console.log(`   - Medication: ${prescriptionData.medications[0].name}`);
    console.log(`   - Dosage: ${prescriptionData.medications[0].dosage}`);
    console.log(`   - Status: ${prescriptionData.status}`);

    // Also create a relationship if it doesn't exist
    const relationshipQuery = await db.collection('patient_doctor_relationships')
      .where('patientId', '==', patientId)
      .where('doctorId', '==', doctorId)
      .get();

    if (relationshipQuery.empty) {
      console.log('🔗 Creating patient-doctor relationship...');
      
      const relationshipData = {
        id: `rel_${Date.now()}`,
        patientId: patientId,
        doctorId: doctorId,
        patient: {
          id: patientId,
          name: patientData.name,
          email: patientData.email
        },
        doctor: {
          id: doctorId,
          name: doctorData.name,
          email: doctorData.email,
          specialization: doctorData.specialization || 'General Medicine'
        },
        status: 'active',
        permissions: {
          prescriptions: true,
          records: false,
          emergency: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('patient_doctor_relationships').doc(relationshipData.id).set(relationshipData);
      console.log('✅ Patient-doctor relationship created!');
    } else {
      console.log('✅ Patient-doctor relationship already exists');
    }

    console.log('🎉 Test setup complete! The prescription should now appear in the patient dashboard.');

  } catch (error) {
    console.error('❌ Error creating test prescription:', error);
  } finally {
    process.exit(0);
  }
}

createTestPrescription();
