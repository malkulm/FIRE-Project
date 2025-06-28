#!/usr/bin/env node

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

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      ['00000000-0000-0000-0000-000000000001']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Admin user already exists, skipping seed');
      return;
    }
    
    // Create default admin user
    await pool.query(`
      INSERT INTO users (
        id, 
        email, 
        first_name, 
        last_name, 
        is_active, 
        email_verified
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        'admin@fire-planning.com',
        'Admin',
        'User',
        true,
        true
      )
    `);
    
    // Create default user preferences
    await pool.query(`
      INSERT INTO user_preferences (
        user_id,
        currency,
        language,
        theme
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        'EUR',
        'en',
        'light'
      )
    `);
    
    console.log('✅ Successfully seeded database with admin user');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };