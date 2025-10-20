const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
if (admin.apps.length > 0) {
  db = admin.firestore();
} else {
  console.log('⚠️ Firebase Firestore not available in migrate script - skipping');
  process.exit(0);
}

/**
 * Migration script to ensure all family connections are bidirectional
 * This script will:
 * 1. Read all familyNetworks documents
 * 2. For each member in a user's network, ensure the reverse connection exists
 * 3. Create missing reverse connections
 */
async function migrateFamilyConnections() {
  console.log('🚀 Starting family connections migration...');
  
  try {
    // Get all family network documents
    const familyNetworksSnapshot = await db.collection('familyNetworks').get();
    
    if (familyNetworksSnapshot.empty) {
      console.log('📭 No family networks found');
      return;
    }
    
    console.log(`📊 Found ${familyNetworksSnapshot.size} family network documents`);
    
    const batch = db.batch();
    let updatesCount = 0;
    
    // Process each family network
    for (const docSnapshot of familyNetworksSnapshot.docs) {
      const userUid = docSnapshot.id;
      const networkData = docSnapshot.data();
      const members = networkData.members || [];
      
      console.log(`👤 Processing user ${userUid} with ${members.length} members`);
      
      // For each member in this user's network
      for (const member of members) {
        if (!member.uid) {
          console.warn(`⚠️ Member without UID found for user ${userUid}:`, member);
          continue;
        }
        
        // Check if the reverse connection exists
        const reverseNetworkRef = db.collection('familyNetworks').doc(member.uid);
        const reverseNetworkDoc = await reverseNetworkRef.get();
        
        if (!reverseNetworkDoc.exists()) {
          // Create the reverse network document
          console.log(`➕ Creating reverse network for ${member.uid}`);
          
          const reverseMember = {
            uid: userUid,
            email: networkData.userEmail || 'unknown@example.com', // You might need to fetch this
            name: networkData.userName || 'Unknown User', // You might need to fetch this
            relationship: getInverseRelationship(member.relationship),
            accessLevel: member.accessLevel || 'limited',
            isEmergencyContact: member.isEmergencyContact || false,
            addedAt: member.addedAt || new Date().toISOString(),
            status: 'accepted'
          };
          
          batch.set(reverseNetworkRef, {
            userUid: member.uid,
            members: [reverseMember],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          updatesCount++;
        } else {
          // Check if the reverse member exists in the reverse network
          const reverseNetworkData = reverseNetworkDoc.data();
          const reverseMembers = reverseNetworkData.members || [];
          
          const reverseMemberExists = reverseMembers.some(m => m.uid === userUid);
          
          if (!reverseMemberExists) {
            console.log(`🔄 Adding missing reverse member for ${member.uid}`);
            
            const reverseMember = {
              uid: userUid,
              email: networkData.userEmail || 'unknown@example.com',
              name: networkData.userName || 'Unknown User',
              relationship: getInverseRelationship(member.relationship),
              accessLevel: member.accessLevel || 'limited',
              isEmergencyContact: member.isEmergencyContact || false,
              addedAt: member.addedAt || new Date().toISOString(),
              status: 'accepted'
            };
            
            batch.update(reverseNetworkRef, {
              members: admin.firestore.FieldValue.arrayUnion(reverseMember),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            updatesCount++;
          }
        }
      }
    }
    
    // Commit all updates
    if (updatesCount > 0) {
      console.log(`💾 Committing ${updatesCount} updates...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('✨ No updates needed - all connections are already bidirectional');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Helper function to get inverse relationship
 */
function getInverseRelationship(relationship) {
  const inverseMap = {
    'Parent': 'Child',
    'Child': 'Parent',
    'Spouse': 'Spouse',
    'Sibling': 'Sibling',
    'Grandparent': 'Grandchild',
    'Grandchild': 'Grandparent',
    'Uncle': 'Nephew/Niece',
    'Aunt': 'Nephew/Niece',
    'Cousin': 'Cousin',
    'Friend': 'Friend',
    'Caregiver': 'Patient',
    'Patient': 'Caregiver'
  };
  
  return inverseMap[relationship] || relationship;
}

// Run the migration
if (require.main === module) {
  migrateFamilyConnections()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateFamilyConnections };


