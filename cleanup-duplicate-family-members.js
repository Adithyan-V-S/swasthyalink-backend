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

const cleanupDuplicateFamilyMembers = async () => {
  const uid = 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293'; // The user from the logs
  
  try {
    console.log('🔍 Checking family network for user:', uid);
    
    const networkRef = db.collection('familyNetworks').doc(uid);
    const networkSnap = await networkRef.get();
    
    if (!networkSnap.exists) {
      console.log('👥 No family network found for user:', uid);
      return;
    }
    
    const data = networkSnap.data();
    const members = data.members || [];
    
    console.log('👥 Found family members:', members.length);
    
    // Check for duplicates by email
    const uniqueMembers = [];
    const seenEmails = new Set();
    
    for (const member of members) {
      const email = member.email?.toLowerCase();
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueMembers.push(member);
        console.log('✅ Keeping member:', member.name, member.email);
      } else {
        console.log('❌ Removing duplicate:', member.name, member.email);
      }
    }
    
    if (uniqueMembers.length !== members.length) {
      console.log(`\n🧹 Cleaning up duplicates: ${members.length} → ${uniqueMembers.length}`);
      
      // Update the document with unique members
      await networkRef.update({
        members: uniqueMembers
      });
      
      console.log('✅ Duplicates removed successfully');
    } else {
      console.log('✅ No duplicates found');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up family data:', error);
  }
};

cleanupDuplicateFamilyMembers().then(() => {
  console.log('\n✅ Cleanup completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});