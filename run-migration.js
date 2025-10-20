const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function runMigration() {
  try {
    console.log('🔄 Running family connections migration...');
    
    const response = await fetch('http://localhost:3001/api/family/migrate-connections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`📊 ${result.updatesCount} connections updated`);
      console.log(`💬 Message: ${result.message}`);
    } else {
      console.error('❌ Migration failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error running migration:', error.message);
  }
}

runMigration();
