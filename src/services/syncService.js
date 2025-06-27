const { logger } = require('../utils/logger');
const powensService = require('./powens/powensService');
const BankConnectionModel = require('../models/BankConnection');
const BankAccountModel = require('../models/BankAccount');
const TransactionModel = require('../models/Transaction');

// Sync status constants
const SYNC_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

// Sync types
const SYNC_TYPE = {
  WEBHOOK: 'webhook',
  SCHEDULED: 'scheduled',
  MANUAL: 'manual',
  INITIAL: 'initial'
};

class SyncService {
  constructor() {
    this.activeJobs = new Map(); // Track running sync jobs
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null
    };
  }

  /**
   * Main sync orchestrator - intelligently decides what to sync
   */
  async syncConnection(connectionId, options = {}) {
    const {
      type = SYNC_TYPE.MANUAL,
      force = false,
      includeTransactions = true,
      userId = null
    } = options;

    const syncId = `${connectionId}-${Date.now()}`;
    
    try {
      // Prevent duplicate sync jobs
      if (this.activeJobs.has(connectionId) && !force) {
        logger.warn('Sync already in progress for connection', { connectionId });
        return { status: 'already_running', syncId: this.activeJobs.get(connectionId) };
      }

      this.activeJobs.set(connectionId, syncId);
      logger.info('Starting sync job', { syncId, connectionId, type });

      // Get connection details
      const connection = await BankConnectionModel.findByIdWithTokens(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Check if sync is needed
      const shouldSync = await this.shouldSyncConnection(connection, force);
      if (!shouldSync.sync) {
        logger.info('Skipping sync - not needed', { 
          connectionId, 
          reason: shouldSync.reason 
        });
        return { status: 'skipped', reason: shouldSync.reason };
      }

      // Update sync status
      await BankConnectionModel.updateSyncStatus(connectionId, SYNC_STATUS.IN_PROGRESS);

      // Refresh token if needed
      const validToken = await this.ensureValidToken(connection);

      // Execute sync steps
      const syncResult = await this.executeSyncSteps(validToken, connection, {
        includeTransactions,
        type
      });

      // Update final status
      const finalStatus = syncResult.errors.length > 0 ? SYNC_STATUS.PARTIAL : SYNC_STATUS.SUCCESS;
      await BankConnectionModel.updateSyncStatus(connectionId, finalStatus, 
        syncResult.errors.length > 0 ? syncResult.errors.join(', ') : null
      );

      // Update statistics
      this.updateSyncStats(finalStatus);

      logger.info('Sync completed', {
        syncId,
        connectionId,
        status: finalStatus,
        accountsSynced: syncResult.accountsSynced,
        transactionsSynced: syncResult.transactionsSynced,
        errors: syncResult.errors.length
      });

      return {
        status: finalStatus,
        syncId,
        ...syncResult
      };

    } catch (error) {
      logger.error('Sync failed', { syncId, connectionId, error: error.message });
      
      // Update error status
      await BankConnectionModel.updateSyncStatus(connectionId, SYNC_STATUS.FAILED, error.message);
      this.updateSyncStats(SYNC_STATUS.FAILED);

      throw error;
    } finally {
      this.activeJobs.delete(connectionId);
    }
  }

  /**
   * Intelligent sync decision - follows open banking best practices
   */
  async shouldSyncConnection(connection, force = false) {
    if (force) {
      return { sync: true, reason: 'forced' };
    }

    const now = new Date();
    const lastSync = connection.last_sync_at ? new Date(connection.last_sync_at) : null;

    // Never synced before
    if (!lastSync) {
      return { sync: true, reason: 'initial_sync' };
    }

    // Check if connection is active
    if (connection.status !== 'active') {
      return { sync: false, reason: 'connection_inactive' };
    }

    // Check sync frequency limits (open banking best practice: max every 5 minutes)
    const timeSinceLastSync = now - lastSync;
    const minSyncInterval = 5 * 60 * 1000; // 5 minutes

    if (timeSinceLastSync < minSyncInterval) {
      return { 
        sync: false, 
        reason: 'rate_limited',
        nextAllowedSync: new Date(lastSync.getTime() + minSyncInterval)
      };
    }

    // Check data staleness (open banking recommendation: max 4 hours)
    const maxDataAge = 4 * 60 * 60 * 1000; // 4 hours
    if (timeSinceLastSync > maxDataAge) {
      return { sync: true, reason: 'data_stale' };
    }

    // Check for failed previous sync
    if (connection.last_sync_status === SYNC_STATUS.FAILED) {
      return { sync: true, reason: 'retry_failed' };
    }

    // Default to periodic sync
    const periodicInterval = 2 * 60 * 60 * 1000; // 2 hours
    if (timeSinceLastSync > periodicInterval) {
      return { sync: true, reason: 'periodic' };
    }

    return { sync: false, reason: 'not_needed' };
  }

  /**
   * Ensure we have a valid token for API calls
   */
  async ensureValidToken(connection) {
    const now = new Date();
    const expiresAt = new Date(connection.token_expires_at);

    // Check if token is expired or expires soon (buffer of 10 minutes)
    const expiryBuffer = 10 * 60 * 1000; // 10 minutes
    if (now >= new Date(expiresAt.getTime() - expiryBuffer)) {
      logger.info('Refreshing token', { connectionId: connection.id });

      try {
        const tokenData = await powensService.refreshAccessToken(connection.refresh_token);
        
        // Update tokens in database
        await BankConnectionModel.updateTokens(
          connection.id,
          tokenData.accessToken,
          tokenData.refreshToken,
          tokenData.expiresAt
        );

        return tokenData.accessToken;
      } catch (error) {
        logger.error('Token refresh failed', { 
          connectionId: connection.id, 
          error: error.message 
        });
        throw new Error('Token refresh failed: ' + error.message);
      }
    }

    return connection.access_token;
  }

  /**
   * Execute the actual sync steps
   */
  async executeSyncSteps(accessToken, connection, options) {
    const { includeTransactions, type } = options;
    const errors = [];
    let accountsSynced = 0;
    let transactionsSynced = 0;

    try {
      // Step 1: Sync accounts
      logger.info('Syncing accounts', { connectionId: connection.id });
      const accounts = await powensService.getUserAccounts(accessToken);
      
      for (const powensAccount of accounts) {
        try {
          const accountData = powensService.mapPowensAccountToLocal(
            powensAccount, 
            connection.user_id, 
            connection.id
          );
          
          await BankAccountModel.findOrCreateByPowensId(accountData);
          accountsSynced++;
        } catch (accountError) {
          logger.error('Account sync failed', { 
            accountId: powensAccount.id, 
            error: accountError.message 
          });
          errors.push(`Account ${powensAccount.id}: ${accountError.message}`);
        }
      }

      // Step 2: Sync transactions (if requested)
      if (includeTransactions) {
        logger.info('Syncing transactions', { connectionId: connection.id });
        
        // Determine transaction sync period based on sync type
        const syncPeriod = this.getTransactionSyncPeriod(type, connection.last_sync_at);
        
        const transactions = await powensService.getUserTransactions(accessToken, {
          limit: 1000,
          minDate: syncPeriod.startDate,
          maxDate: syncPeriod.endDate
        });

        for (const powensTransaction of transactions) {
          try {
            // Find the corresponding account
            const account = await BankAccountModel.findByPowensId(powensTransaction.id_account);
            if (account) {
              const transactionData = powensService.mapPowensTransactionToLocal(
                powensTransaction,
                connection.user_id,
                account.id
              );
              
              await TransactionModel.findOrCreateByPowensId(transactionData);
              transactionsSynced++;
            } else {
              logger.warn('Account not found for transaction', { 
                transactionId: powensTransaction.id,
                accountId: powensTransaction.id_account 
              });
            }
          } catch (transactionError) {
            logger.error('Transaction sync failed', { 
              transactionId: powensTransaction.id, 
              error: transactionError.message 
            });
            errors.push(`Transaction ${powensTransaction.id}: ${transactionError.message}`);
          }
        }
      }

      return {
        accountsSynced,
        transactionsSynced,
        errors,
        syncPeriod: includeTransactions ? this.getTransactionSyncPeriod(type, connection.last_sync_at) : null
      };

    } catch (error) {
      logger.error('Sync step execution failed', { 
        connectionId: connection.id, 
        error: error.message 
      });
      errors.push(`Execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determine the appropriate transaction sync period
   */
  getTransactionSyncPeriod(type, lastSyncAt) {
    const now = new Date();
    
    switch (type) {
      case SYNC_TYPE.INITIAL:
        // Initial sync: get last 90 days
        return {
          startDate: new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      
      case SYNC_TYPE.WEBHOOK:
        // Webhook sync: get last 7 days to catch recent changes
        return {
          startDate: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      
      case SYNC_TYPE.SCHEDULED:
      case SYNC_TYPE.MANUAL:
      default:
        // Incremental sync: from last sync or last 30 days
        const startDate = lastSyncAt 
          ? new Date(Math.max(new Date(lastSyncAt).getTime(), now.getTime() - (30 * 24 * 60 * 60 * 1000)))
          : new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
    }
  }

  /**
   * Sync all connections for a user
   */
  async syncAllUserConnections(userId, options = {}) {
    logger.info('Starting sync for all user connections', { userId });

    const connections = await BankConnectionModel.findByUserId(userId);
    const results = [];

    for (const connection of connections) {
      try {
        const result = await this.syncConnection(connection.id, {
          ...options,
          userId,
          type: SYNC_TYPE.MANUAL
        });
        results.push({ connectionId: connection.id, ...result });
      } catch (error) {
        results.push({ 
          connectionId: connection.id, 
          status: SYNC_STATUS.FAILED, 
          error: error.message 
        });
      }
    }

    logger.info('Completed sync for all user connections', { 
      userId, 
      total: connections.length,
      successful: results.filter(r => r.status === SYNC_STATUS.SUCCESS).length
    });

    return results;
  }

  /**
   * Get sync status for a connection
   */
  async getSyncStatus(connectionId) {
    const connection = await BankConnectionModel.findById(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const isRunning = this.activeJobs.has(connectionId);
    const shouldSync = await this.shouldSyncConnection(connection);

    return {
      connectionId,
      status: connection.last_sync_status,
      lastSyncAt: connection.last_sync_at,
      lastSyncError: connection.last_sync_error,
      isRunning,
      activeSyncId: isRunning ? this.activeJobs.get(connectionId) : null,
      shouldSync: shouldSync.sync,
      shouldSyncReason: shouldSync.reason,
      nextAllowedSync: shouldSync.nextAllowedSync || null
    };
  }

  /**
   * Update internal sync statistics
   */
  updateSyncStats(status) {
    this.syncStats.totalSyncs++;
    this.syncStats.lastSyncTime = new Date();
    
    if (status === SYNC_STATUS.SUCCESS || status === SYNC_STATUS.PARTIAL) {
      this.syncStats.successfulSyncs++;
    } else if (status === SYNC_STATUS.FAILED) {
      this.syncStats.failedSyncs++;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.syncStats,
      activeJobs: this.activeJobs.size,
      activeSyncIds: Array.from(this.activeJobs.values()),
      successRate: this.syncStats.totalSyncs > 0 
        ? (this.syncStats.successfulSyncs / this.syncStats.totalSyncs * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

module.exports = new SyncService();
