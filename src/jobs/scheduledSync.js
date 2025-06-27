const cron = require('node-cron');
const { logger } = require('../utils/logger');
const syncService = require('../services/syncService');
const BankConnectionModel = require('../models/BankConnection');

class ScheduledSyncJobs {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize all scheduled sync jobs
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('Scheduled sync jobs already initialized');
      return;
    }

    try {
      this.setupPeriodicSync();
      this.setupHealthCheck();
      this.setupTokenRefresh();
      this.setupDailyCleanup();

      this.isInitialized = true;
      logger.info('Scheduled sync jobs initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduled sync jobs', { error: error.message });
      throw error;
    }
  }

  /**
   * Periodic sync job - runs every 2 hours
   * Open Banking Best Practice: Regular data refresh
   */
  setupPeriodicSync() {
    const job = cron.schedule('0 */2 * * *', async () => {
      logger.info('Starting periodic sync job');
      
      try {
        const startTime = Date.now();
        const connections = await BankConnectionModel.findByUserId(null); // Get all connections
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const connection of connections) {
          try {
            const result = await syncService.syncConnection(connection.id, {
              type: 'scheduled',
              includeTransactions: true
            });

            if (result.status === 'success' || result.status === 'partial') {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
            errors.push(`Connection ${connection.id}: ${error.message}`);
            logger.error('Periodic sync failed for connection', {
              connectionId: connection.id,
              error: error.message
            });
          }
        }

        const duration = Date.now() - startTime;
        logger.info('Periodic sync job completed', {
          duration: `${duration}ms`,
          totalConnections: connections.length,
          successful: successCount,
          failed: errorCount,
          errors: errors.length > 0 ? errors.slice(0, 5) : [] // Log first 5 errors
        });

      } catch (error) {
        logger.error('Periodic sync job failed', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    this.jobs.set('periodicSync', job);
    job.start();
    logger.info('Periodic sync job scheduled (every 2 hours)');
  }

  /**
   * Health check job - runs every 15 minutes
   * Monitors connection health and triggers recovery
   */
  setupHealthCheck() {
    const job = cron.schedule('*/15 * * * *', async () => {
      logger.debug('Running connection health check');

      try {
        const connections = await BankConnectionModel.findByUserId(null);
        const unhealthyConnections = [];

        for (const connection of connections) {
          const status = await syncService.getSyncStatus(connection.id);
          
          // Check for stale data (older than 6 hours)
          const sixHoursAgo = new Date(Date.now() - (6 * 60 * 60 * 1000));
          const lastSync = connection.last_sync_at ? new Date(connection.last_sync_at) : null;

          if (!lastSync || lastSync < sixHoursAgo) {
            unhealthyConnections.push({
              id: connection.id,
              bankName: connection.bank_name,
              issue: 'stale_data',
              lastSync: lastSync
            });

            // Trigger sync for stale connections
            try {
              await syncService.syncConnection(connection.id, {
                type: 'scheduled',
                force: false
              });
              logger.info('Triggered sync for stale connection', { connectionId: connection.id });
            } catch (syncError) {
              logger.error('Failed to sync stale connection', {
                connectionId: connection.id,
                error: syncError.message
              });
            }
          }

          // Check for repeated failures
          if (connection.last_sync_status === 'failed') {
            unhealthyConnections.push({
              id: connection.id,
              bankName: connection.bank_name,
              issue: 'sync_failed',
              error: connection.last_sync_error
            });
          }
        }

        if (unhealthyConnections.length > 0) {
          logger.warn('Found unhealthy connections', {
            count: unhealthyConnections.length,
            connections: unhealthyConnections
          });
        }

      } catch (error) {
        logger.error('Health check job failed', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    this.jobs.set('healthCheck', job);
    job.start();
    logger.info('Health check job scheduled (every 15 minutes)');
  }

  /**
   * Token refresh job - runs every hour
   * Proactively refreshes tokens before they expire
   */
  setupTokenRefresh() {
    const job = cron.schedule('0 * * * *', async () => {
      logger.debug('Running token refresh check');

      try {
        const connections = await BankConnectionModel.findAll(); // Get all connections with tokens
        let refreshedCount = 0;
        let errorCount = 0;

        for (const connection of connections) {
          try {
            const expiresAt = new Date(connection.token_expires_at);
            const now = new Date();
            const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

            // Refresh tokens that expire within 2 hours
            if (hoursUntilExpiry < 2 && hoursUntilExpiry > 0) {
              logger.info('Proactively refreshing token', {
                connectionId: connection.id,
                hoursUntilExpiry: hoursUntilExpiry.toFixed(2)
              });

              // This will be handled by the sync service's ensureValidToken method
              await syncService.syncConnection(connection.id, {
                type: 'scheduled',
                force: false,
                includeTransactions: false // Just refresh token, don't sync data
              });

              refreshedCount++;
            }
          } catch (error) {
            errorCount++;
            logger.error('Token refresh failed for connection', {
              connectionId: connection.id,
              error: error.message
            });
          }
        }

        if (refreshedCount > 0 || errorCount > 0) {
          logger.info('Token refresh check completed', {
            refreshed: refreshedCount,
            errors: errorCount
          });
        }

      } catch (error) {
        logger.error('Token refresh job failed', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    this.jobs.set('tokenRefresh', job);
    job.start();
    logger.info('Token refresh job scheduled (every hour)');
  }

  /**
   * Daily cleanup job - runs at 2 AM
   * Cleans up old data and maintains database health
   */
  setupDailyCleanup() {
    const job = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting daily cleanup job');

      try {
        const startTime = Date.now();
        let cleanedRecords = 0;

        // Example cleanup tasks (implement based on your needs):
        
        // 1. Clean up old sync logs (if you add them)
        // 2. Remove stale webhook data
        // 3. Compress old transaction data
        // 4. Update connection statistics

        // For now, just log system stats
        const stats = syncService.getStats();
        logger.info('Daily system statistics', stats);

        const duration = Date.now() - startTime;
        logger.info('Daily cleanup completed', {
          duration: `${duration}ms`,
          recordsCleaned: cleanedRecords
        });

      } catch (error) {
        logger.error('Daily cleanup job failed', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    this.jobs.set('dailyCleanup', job);
    job.start();
    logger.info('Daily cleanup job scheduled (2 AM daily)');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    logger.info('Stopping all scheduled sync jobs');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.isInitialized = false;
  }

  /**
   * Get status of all jobs
   */
  getJobStatus() {
    const status = {};
    
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    }

    return {
      initialized: this.isInitialized,
      totalJobs: this.jobs.size,
      jobs: status
    };
  }

  /**
   * Manually trigger a specific job (for testing)
   */
  async triggerJob(jobName) {
    if (!this.jobs.has(jobName)) {
      throw new Error(`Job '${jobName}' not found`);
    }

    logger.info(`Manually triggering job: ${jobName}`);
    
    // Get the job's task function and execute it
    switch (jobName) {
      case 'periodicSync':
        return this.setupPeriodicSync();
      case 'healthCheck':
        return this.setupHealthCheck();
      case 'tokenRefresh':
        return this.setupTokenRefresh();
      case 'dailyCleanup':
        return this.setupDailyCleanup();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }
}

module.exports = new ScheduledSyncJobs();
