require('dotenv').config();
const powensService = require('./src/services/powens/powensService');
const BankConnectionModel = require('./src/models/BankConnection');

async function manualSync() {
  try {
    console.log('🔄 Starting manual sync...');
    
    // Get the latest bank connection
    const connections = await BankConnectionModel.findByUserId('00000000-0000-0000-0000-000000000001');
    
    if (connections.length === 0) {
      console.log('❌ No bank connections found');
      return;
    }
    
    console.log(`📋 Found ${connections.length} connection(s)`);
    
    for (const connection of connections) {
      console.log(`🏦 Syncing connection: ${connection.bank_name} (ID: ${connection.id})`);
      
      try {
        const result = await powensService.syncConnectionData(
          '00000000-0000-0000-0000-000000000001',
          connection.id
        );
        
        console.log(`✅ Sync completed for ${connection.bank_name}:`);
        console.log(`   - Accounts: ${result.syncedAccounts}`);
        console.log(`   - Transactions: ${result.syncedTransactions}`);
      } catch (syncError) {
        console.error(`❌ Sync failed for ${connection.bank_name}:`, syncError.message);
      }
    }
    
    console.log('🎉 Manual sync completed!');
  } catch (error) {
    console.error('❌ Manual sync failed:', error.message);
  } finally {
    process.exit(0);
  }
}

manualSync();
