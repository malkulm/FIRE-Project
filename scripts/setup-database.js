#!/usr/bin/env node

/**
 * FIRE Planning Database Setup Script
 * 
 * This script sets up the database for the FIRE Planning application.
 * It can be run standalone or as part of the server startup process.
 */

// Load environment variables first
require('dotenv').config();

const migrationRunner = require('../src/utils/migrationRunner');
const { logger } = require('../src/utils/logger');
const database = require('../src/config/database');

async function setupDatabase() {
  try {
    console.log('🔥 FIRE Planning Database Setup Starting...\n');

    // Step 1: Run migrations
    console.log('📊 Running database migrations...');
    await migrationRunner.runMigrations();
    console.log('✅ Migrations completed successfully\n');

    // Step 2: Validate schema
    console.log('🔍 Validating database schema...');
    const isValid = await migrationRunner.checkDatabaseSchema();
    
    if (!isValid) {
      throw new Error('Database schema validation failed');
    }
    console.log('✅ Database schema validation passed\n');

    // Step 3: Get database info
    console.log('📋 Database Information:');
    const dbInfo = await migrationRunner.getDatabaseInfo();
    console.log(`   • Tables: ${dbInfo.totalTables}`);
    console.log(`   • Migrations: ${dbInfo.totalMigrations}`);
    console.log(`   • Latest migration: ${dbInfo.migrations[0]?.migration_name || 'None'}\n`);

    console.log('🎉 Database setup completed successfully!');
    console.log('🚀 Your FIRE Planning database is ready to use.\n');

    // Display table list
    console.log('📚 Available tables:');
    dbInfo.tables.forEach(table => {
      console.log(`   • ${table}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    logger.error('Database setup failed', { error: error.message, stack: error.stack });
    
    if (error.message.includes('does not exist')) {
      console.log('\n💡 Make sure your PostgreSQL database exists and connection details are correct.');
      console.log('   Check your .env file settings:');
      console.log('   - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    }
    
    return false;
  } finally {
    // Always close database connections to allow script to exit
    try {
      await database.close();
      console.log('\n📤 Database connections closed.');
    } catch (closeError) {
      console.warn('Warning: Error closing database connections:', closeError.message);
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;
