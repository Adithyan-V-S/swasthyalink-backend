/**
 * Clean up duplicate doctor connections for a patient
 * This script will remove duplicate doctor relationships from Firestore
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./swasthyalink-468105-143623eabdaa.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'swasthyakink'
  });
}

const db = admin.firestore();

async function cleanupDuplicateDoctors() {
  try {
    console.log('🧹 Starting cleanup of duplicate doctor connections...');
    
    const patientId = 'x9DFt0G9ZJfkmm4lvPKSNlL9Q293';
    console.log(`🔍 Cleaning up duplicates for patient: ${patientId}`);
    
    // Get all relationships for this patient
    const relationshipsSnapshot = await db.collection('patient_doctor_relationships')
      .where('patientId', '==', patientId)
      .get();
    
    console.log(`📊 Found ${relationshipsSnapshot.size} total relationships`);
    
    if (relationshipsSnapshot.empty) {
      console.log('✅ No relationships found - nothing to clean up');
      return;
    }
    
    // Group by doctor ID to find duplicates
    const doctorGroups = {};
    const relationshipsToDelete = [];
    
    relationshipsSnapshot.forEach(doc => {
      const relationship = doc.data();
      const doctorId = relationship.doctorId;
      
      if (!doctorGroups[doctorId]) {
        doctorGroups[doctorId] = [];
      }
      doctorGroups[doctorId].push({
        docId: doc.id,
        data: relationship,
        createdAt: relationship.createdAt
      });
    });
    
    console.log(`📊 Found ${Object.keys(doctorGroups).length} unique doctors`);
    
    // Find duplicates and keep the most recent one
    for (const [doctorId, relationships] of Object.entries(doctorGroups)) {
      if (relationships.length > 1) {
        console.log(`🔄 Found ${relationships.length} duplicates for doctor: ${doctorId}`);
        
        // Sort by creation date (keep the most recent)
        relationships.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Keep the first (most recent) and mark others for deletion
        const toKeep = relationships[0];
        const toDelete = relationships.slice(1);
        
        console.log(`✅ Keeping relationship: ${toKeep.docId} (created: ${toKeep.createdAt})`);
        
        toDelete.forEach(rel => {
          console.log(`🗑️ Marking for deletion: ${rel.docId} (created: ${rel.createdAt})`);
          relationshipsToDelete.push(rel.docId);
        });
      }
    }
    
    // Delete duplicate relationships
    if (relationshipsToDelete.length > 0) {
      console.log(`🗑️ Deleting ${relationshipsToDelete.length} duplicate relationships...`);
      
      const batch = db.batch();
      relationshipsToDelete.forEach(docId => {
        const docRef = db.collection('patient_doctor_relationships').doc(docId);
        batch.delete(docRef);
      });
      
      await batch.commit();
      console.log(`✅ Successfully deleted ${relationshipsToDelete.length} duplicate relationships`);
    } else {
      console.log('✅ No duplicates found - all relationships are unique');
    }
    
    // Verify the cleanup
    const finalSnapshot = await db.collection('patient_doctor_relationships')
      .where('patientId', '==', patientId)
      .get();
    
    console.log(`📊 Final count: ${finalSnapshot.size} unique relationships remaining`);
    
    // Show remaining relationships
    console.log('\n📋 Remaining doctor relationships:');
    finalSnapshot.forEach(doc => {
      const rel = doc.data();
      console.log(`   - ${rel.doctor?.name || 'Unknown'} (${rel.doctor?.email || 'No email'}) - ${rel.status}`);
    });
    
    console.log('\n🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
cleanupDuplicateDoctors();
