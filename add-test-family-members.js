const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  // Try environment variables first (production)
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
    // Fallback to local credentials (development)
    const serviceAccount = require('./credentialss.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'swasthyakink'
    });
    console.log('✅ Firebase Admin initialized (development, local file)');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

const addTestFamilyMembers = async () => {
  const userUid = 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293'; // Your user UID from the logs
  const userEmail = 'vsadithyan215@gmail.com'; // Your user email

  console.log(`👥 Adding test family members for user: ${userUid} (${userEmail})`);

  try {
    // Create family network document
    const familyNetworkData = {
      userUid: userUid,
      userEmail: userEmail,
      members: [
        {
          id: 'family-member-1',
          uid: 'family-member-1',
          name: 'Dr. Sarah Johnson',
          email: 'sarah.johnson@example.com',
          relationship: 'Spouse',
          accessLevel: 'full',
          isEmergencyContact: true,
          connectedAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
          permissions: {
            prescriptions: true,
            records: true,
            emergency: true
          }
        },
        {
          id: 'family-member-2',
          uid: 'family-member-2',
          name: 'John Smith',
          email: 'john.smith@example.com',
          relationship: 'Son',
          accessLevel: 'limited',
          isEmergencyContact: false,
          connectedAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
          permissions: {
            prescriptions: false,
            records: true,
            emergency: false
          }
        },
        {
          id: 'family-member-3',
          uid: 'family-member-3',
          name: 'Dr. Michael Brown',
          email: 'michael.brown@example.com',
          relationship: 'Brother',
          accessLevel: 'full',
          isEmergencyContact: true,
          connectedAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
          permissions: {
            prescriptions: true,
            records: true,
            emergency: true
          }
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to Firestore
    await db.collection('familyNetworks').doc(userUid).set(familyNetworkData);

    console.log('✅ Test family members added successfully!');
    console.log('📋 Family members added:');
    familyNetworkData.members.forEach((member, index) => {
      console.log(`   ${index + 1}. ${member.name} (${member.relationship}) - ${member.accessLevel} access`);
    });

    console.log('🎉 Family network document created in Firestore!');
    console.log('🔍 Document path: familyNetworks/' + userUid);

  } catch (error) {
    console.error('❌ Error adding test family members:', error);
  }
};

addTestFamilyMembers().then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});


