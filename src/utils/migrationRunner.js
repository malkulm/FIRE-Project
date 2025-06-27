const fs = require('fs');
const path = require('path');
const database = require('../config/database');
const { logger } = require('../utils/logger');

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  // Run all pending migrations
  async runMigrations() {
    try {
      logger.info('Starting database migrations...');

      // Create migrations tracking table if it doesn't exist
      await this.createMigrationsTable();

      // Get list of migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Get already run migrations
      const completedMigrations = await this.getCompletedMigrations();
      
      // Filter out already completed migrations
      const pendingMigrations = migrationFiles.filter(file => 
        !completedMigrations.includes(file)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return;
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations...`);

      // Run each pending migration
      for (const migrationFile of pendingMigrations) {
        await this.runSingleMigration(migrationFile);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  // Create migrations tracking table
  async createMigrationsTable() {
    try {
      await database.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      logger.debug('Migrations tracking table ready');
    } catch (error) {
      logger.error('Failed to create migrations table:', { error: error.message });
      throw error;
    }
  }

  // Get list of migration files
  async getMigrationFiles() {
    try {
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure proper order

      logger.debug(`Found ${files.length} migration files`);
      return files;
    } catch (error) {
      logger.error('Failed to read migration files:', { error: error.message });
      throw error;
    }
  }

  // Get list of completed migrations
  async getCompletedMigrations() {
    try {
      const result = await database.query(`
        SELECT migration_name FROM schema_migrations ORDER BY id
      `);
      
      const completed = result.rows.map(row => row.migration_name);
      logger.debug(`Found ${completed.length} completed migrations`);
      return completed;
    } catch (error) {
      logger.error('Failed to get completed migrations:', { error: error.message });
      throw error;
    }
  }

  // Run a single migration file
  async runSingleMigration(migrationFile) {
    try {
      logger.info(`Running migration: ${migrationFile}`);
      
      // Read migration file
      const migrationPath = path.join(this.migrationsPath, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute migration in a transaction
      await database.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migrationSQL);
        
        // Record that this migration was completed
        await client.query(`
          INSERT INTO schema_migrations (migration_name) VALUES ($1)
        `, [migrationFile]);
      });
      
      logger.info(`Migration completed: ${migrationFile}`);
    } catch (error) {
      logger.error(`Migration failed: ${migrationFile}`, { error: error.message });
      throw error;
    }
  }

  // Check if database is properly initialized
  async checkDatabaseSchema() {
    try {
      // Check if essential tables exist
      const essentialTables = [
        'users',
        'user_preferences', 
        'bank_connections',
        'bank_accounts',
        'transactions',
        'user_sessions',
        'sync_logs',
        'transaction_categories'
      ];

      const results = await Promise.all(
        essentialTables.map(async (tableName) => {
          const exists = await database.tableExists(tableName);
          return { table: tableName, exists };
        })
      );

      const missingTables = results.filter(r => !r.exists);
      
      if (missingTables.length > 0) {
        logger.warn('Missing database tables:', { 
          missing: missingTables.map(t => t.table) 
        });
        return false;
      }

      logger.info('Database schema validation passed');
      return true;
    } catch (error) {
      logger.error('Database schema check failed:', { error: error.message });
      return false;
    }
  }

  // Get database schema information
  async getDatabaseInfo() {
    try {
      const tablesResult = await database.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);

      const migrationsResult = await database.query(`
        SELECT migration_name, executed_at 
        FROM schema_migrations 
        ORDER BY executed_at DESC
      `);

      return {
        tables: tablesResult.rows.map(r => r.table_name),
        migrations: migrationsResult.rows,
        totalTables: tablesResult.rows.length,
        totalMigrations: migrationsResult.rows.length
      };
    } catch (error) {
      logger.error('Failed to get database info:', { error: error.message });
      throw error;
    }
  }

  // Reset database (DANGER: Only for development)
  async resetDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production');
    }

    try {
      logger.warn('RESETTING DATABASE - All data will be lost!');

      // Drop all tables
      await database.query(`
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
      `);

      logger.warn('Database reset completed');
      
      // Run migrations again
      await this.runMigrations();
    } catch (error) {
      logger.error('Database reset failed:', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
const migrationRunner = new MigrationRunner();

module.exports = migrationRunner;
