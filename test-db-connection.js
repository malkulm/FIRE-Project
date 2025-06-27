require('dotenv').config();
const { Pool } = require('pg');

console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]');

// First test connection to postgres database
const defaultPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default database first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// Then test connection to fire_planning database
const appPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fire_planning',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function testConnections() {
  console.log('\n--- Testing connection to postgres database ---');
  try {
    const client = await defaultPool.connect();
    const result = await client.query('SELECT current_user, current_database()');
    console.log('✅ Connection to postgres database successful!');
    console.log('User:', result.rows[0].current_user);
    console.log('Database:', result.rows[0].current_database);
    
    // Check if fire_planning database exists
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'fire_planning'");
    if (dbCheck.rows.length > 0) {
      console.log('✅ fire_planning database exists');
    } else {
      console.log('❌ fire_planning database does not exist');
      console.log('Creating fire_planning database...');
      await client.query('CREATE DATABASE fire_planning');
      console.log('✅ fire_planning database created');
    }
    
    client.release();
    await defaultPool.end();
  } catch (error) {
    console.error('❌ Connection to postgres database failed:', error.message);
    await defaultPool.end();
    return;
  }

  console.log('\n--- Testing connection to fire_planning database ---');
  try {
    const client = await appPool.connect();
    const result = await client.query('SELECT current_user, current_database()');
    console.log('✅ Connection to fire_planning database successful!');
    console.log('User:', result.rows[0].current_user);
    console.log('Database:', result.rows[0].current_database);
    client.release();
    await appPool.end();
  } catch (error) {
    console.error('❌ Connection to fire_planning database failed:', error.message);
    await appPool.end();
  }
}

testConnections();
