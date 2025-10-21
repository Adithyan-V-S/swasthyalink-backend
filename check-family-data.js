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

const checkFamilyData = async () => {
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
    console.log('📋 Family members data:');
    
    members.forEach((member, index) => {
      console.log(`\n--- Member ${index + 1} ---`);
      console.log('ID:', member.id || member.uid);
      console.log('Name:', member.name);
      console.log('Email:', member.email);
      console.log('Relationship:', member.relationship);
      console.log('Access Level:', member.accessLevel);
      console.log('Emergency Contact:', member.isEmergencyContact);
    });
    
    // Check for duplicates
    const emails = members.map(m => m.email);
    const uniqueEmails = [...new Set(emails)];
    
    if (emails.length !== uniqueEmails.length) {
      console.log('\n⚠️ DUPLICATE EMAILS FOUND!');
      console.log('All emails:', emails);
      console.log('Unique emails:', uniqueEmails);
      
      // Find duplicates
      const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
      console.log('Duplicate emails:', [...new Set(duplicates)]);
    } else {
      console.log('\n✅ No duplicate emails found');
    }
    
  } catch (error) {
    console.error('❌ Error checking family data:', error);
  }
};

checkFamilyData().then(() => {
  console.log('\n✅ Check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


