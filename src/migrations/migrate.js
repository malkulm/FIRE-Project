#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database configuration from environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fire_planning',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applied_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Get list of migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    
    // Check which migrations have already been applied
    const appliedResult = await pool.query('SELECT filename FROM applied_migrations');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));
    
    let appliedCount = 0;
    
    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        continue;
      }
      
      console.log(`🔄 Applying migration: ${filename}`);
      
      try {
        // Read migration file
        const migrationPath = path.join(migrationsDir, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute migration in a transaction
        await pool.query('BEGIN');
        
        // Execute the migration SQL
        await pool.query(migrationSQL);
        
        // Record that this migration has been applied
        await pool.query(
          'INSERT INTO applied_migrations (filename) VALUES ($1)',
          [filename]
        );
        
        await pool.query('COMMIT');
        
        console.log(`✅ Successfully applied: ${filename}`);
        appliedCount++;
        
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error(`❌ Failed to apply migration ${filename}:`, error.message);
        process.exit(1);
      }
    }
    
    if (appliedCount === 0) {
      console.log('✅ All migrations are up to date');
    } else {
      console.log(`✅ Successfully applied ${appliedCount} new migrations`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };