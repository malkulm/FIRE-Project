const { Pool } = require('pg');
const { logger, logDBOperation } = require('../utils/logger');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fire_planning',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err.message, stack: err.stack });
});

// Database connection wrapper with error handling
class Database {
  constructor() {
    this.pool = pool;
  }

  // Test database connection
  async testConnection() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      
      logger.info('Database connection test successful', {
        database: dbConfig.database,
        host: dbConfig.host,
        currentTime: result.rows[0].current_time
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Database connection test failed', {
        error: error.message,
        code: error.code,
        host: dbConfig.host,
        database: dbConfig.database
      });
      throw error;
    }
  }

  // Execute a query with error handling and logging
  async query(text, params = []) {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logDBOperation('query', 'generic', { 
        rowCount: result.rowCount,
        duration: `${duration}ms`,
        queryPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logDBOperation('query', 'generic', { 
        duration: `${duration}ms`,
        queryPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      }, error);
      
      throw error;
    }
  }

  // Get a client from the pool (for transactions)
  async getClient() {
    try {
      const client = await this.pool.connect();
      
      // Add query method to client for consistency
      const originalQuery = client.query.bind(client);
      client.query = async (text, params = []) => {
        const start = Date.now();
        try {
          const result = await originalQuery(text, params);
          const duration = Date.now() - start;
          
          logDBOperation('client_query', 'generic', {
            rowCount: result.rowCount,
            duration: `${duration}ms`,
            queryPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          
          logDBOperation('client_query', 'generic', {
            duration: `${duration}ms`,
            queryPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
          }, error);
          
          throw error;
        }
      };
      
      return client;
    } catch (error) {
      logger.error('Failed to get database client', { error: error.message });
      throw error;
    }
  }

  // Execute multiple queries in a transaction
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('Transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.warn('Transaction rolled back', { error: error.message });
      throw error;
    } finally {
      client.release();
      logger.debug('Transaction client released');
    }
  }

  // Check if a table exists
  async tableExists(tableName) {
    try {
      const result = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      return result.rows[0].exists;
    } catch (error) {
      logDBOperation('tableExists', tableName, null, error);
      throw error;
    }
  }

  // Get table schema information
  async getTableSchema(tableName) {
    try {
      const result = await this.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);
      
      return result.rows;
    } catch (error) {
      logDBOperation('getTableSchema', tableName, null, error);
      throw error;
    }
  }

  // Close all connections (for graceful shutdown)
  async close() {
    try {
      await this.pool.end();
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection pool', { error: error.message });
      throw error;
    }
  }
}

// Create and export database instance
const database = new Database();

module.exports = database;
