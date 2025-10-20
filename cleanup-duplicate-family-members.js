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
  console.log('⚠️ Firebase Firestore not available in cleanup script - skipping');
  process.exit(0);
}

/**
 * Cleanup script to remove duplicate family members
 * This script will:
 * 1. Read all familyNetworks documents
 * 2. Remove duplicate members based on email and UID
 * 3. Keep the most complete member data
 */
async function cleanupDuplicateFamilyMembers() {
  console.log('🧹 Starting duplicate family members cleanup...');
  
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
      
      // Deduplicate members by email and UID
      const uniqueMembers = members.reduce((acc, member) => {
        const existingMember = acc.find(m => 
          (m.email && member.email && m.email === member.email) || 
          (m.uid && member.uid && m.uid === member.uid)
        );
        
        if (!existingMember) {
          acc.push(member);
        } else {
          // If duplicate found, keep the one with more complete data
          const mergedMember = {
            ...existingMember,
            ...member,
            // Prefer non-null values
            name: member.name || existingMember.name,
            email: member.email || existingMember.email,
            uid: member.uid || existingMember.uid,
            relationship: member.relationship || existingMember.relationship,
            accessLevel: member.accessLevel || existingMember.accessLevel || 'limited',
            isEmergencyContact: member.isEmergencyContact !== undefined ? member.isEmergencyContact : existingMember.isEmergencyContact,
            status: member.status || existingMember.status || 'accepted'
          };
          const index = acc.findIndex(m => m === existingMember);
          acc[index] = mergedMember;
        }
        return acc;
      }, []);
      
      // Only update if there were duplicates
      if (uniqueMembers.length !== members.length) {
        console.log(`🔄 Removing ${members.length - uniqueMembers.length} duplicates for user ${userUid}`);
        
        const networkRef = db.collection('familyNetworks').doc(userUid);
        batch.update(networkRef, {
          members: uniqueMembers,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updatesCount++;
      }
    }
    
    // Commit all updates
    if (updatesCount > 0) {
      console.log(`💾 Committing ${updatesCount} updates...`);
      await batch.commit();
      console.log('✅ Cleanup completed successfully!');
    } else {
      console.log('✨ No duplicates found - all family networks are clean');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupDuplicateFamilyMembers()
    .then(() => {
      console.log('🎉 Cleanup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupDuplicateFamilyMembers };


