const { logger } = require('../../utils/logger');

// Import the split services
const powensAuthService = require('./powensAuthService');
const powensDataService = require('./powensDataService');

// Models
const BankConnectionModel = require('../../models/BankConnection');
const BankAccountModel = require('../../models/BankAccount');
const TransactionModel = require('../../models/Transaction');
const UserModel = require('../../models/User');

/**
 * Powens Sync Service
 * Handles data synchronization, webhooks, and database operations
 */
class PowensSyncService {
  constructor() {
    this.authService = powensAuthService;
    this.dataService = powensDataService;
    
    logger.info('🔧 POWENS SYNC SERVICE INITIALIZED');
  }

  /**
   * Handle callback after Powens authentication
   * This method processes the callback and returns connection data
   */
  async handleCallback(connectionParam, state, userId) {
    try {
      logger.info('🔄 Processing Powens callback', { 
        connectionParam: connectionParam ? connectionParam.substring(0, 10) + '...' : 'none',
        state: state ? state.substring(0, 10) + '...' : 'none',
        userId 
      });

      // Get user's permanent token
      const userTokenData = await UserModel.getPowensToken(userId);
      if (!userTokenData || !userTokenData.powens_permanent_token) {
        throw new Error('No permanent token found for user');
      }

      const accessToken = userTokenData.powens_permanent_token;
      const powensUserId = userTokenData.powens_user_id;

      // Fetch user data from Powens API
      const [connections, accounts, transactions] = await Promise.all([
        this.dataService.getUserConnections(accessToken),
        this.dataService.getUserAccounts(accessToken, userId),
        this.dataService.getUserTransactions(accessToken, { limit: 100, userId })
      ]);

      logger.info('✅ Callback data retrieved successfully', {
        connections: connections.length,
        accounts: accounts.length,
        transactions: transactions.length,
        powensUserId
      });

      return {
        accessToken,
        powensUserId,
        connections,
        accounts,
        transactions
      };

    } catch (error) {
      logger.error('❌ Callback processing failed', { 
        error: error.message,
        connectionParam: connectionParam ? connectionParam.substring(0, 10) + '...' : 'none',
        userId 
      });
      throw error;
    }
  }

  /**
   * Sync all data for a user's connection using correct API endpoints
   */
  async syncConnectionData(userId, connectionId) {
    try {
      logger.info('🔄 Starting connection data sync', { userId, connectionId });

      // Get connection with tokens
      const connection = await BankConnectionModel.findByIdWithTokens(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Get user's current token from database
      const userTokenData = await UserModel.getPowensToken(userId);
      if (!userTokenData || !userTokenData.powens_permanent_token) {
        throw new Error('No permanent token found for user');
      }

      let accessToken = userTokenData.powens_permanent_token;

      // Check if token needs refresh
      if (userTokenData.isExpired) {
        logger.info('🔄 Refreshing expired token', { connectionId, userId });
        const tokenData = await this.authService.refreshAccessToken(accessToken, userId);
        accessToken = tokenData.accessToken;
        
        // Update connection tokens in database
        await BankConnectionModel.updateTokens(
          connectionId,
          tokenData.accessToken,
          tokenData.refreshToken,
          tokenData.expiresAt
        );
      }

      // Get accounts from Powens API using data service
      const powensAccounts = await this.dataService.getUserAccounts(accessToken, userId);

      let syncedAccounts = 0;
      let syncedTransactions = 0;

      // Process each account with enhanced logging
      for (const powensAccount of powensAccounts) {
        try {
          logger.info('🔄 PROCESSING ACCOUNT', {
            powensAccountId: powensAccount.id,
            accountName: powensAccount.name || powensAccount.original_name,
            accountType: powensAccount.type,
            accountBalance: powensAccount.balance,
            connectionId: connectionId,
            userId: userId,
            allAccountFields: Object.keys(powensAccount)
          });

          // Create or update account in database
          const accountData = this.dataService.mapPowensAccountToLocal(powensAccount, userId, connectionId);
          
          logger.info('📊 MAPPED ACCOUNT DATA', {
            powensAccountId: powensAccount.id,
            mappedData: accountData,
            mappedFields: Object.keys(accountData)
          });

          const account = await BankAccountModel.findOrCreateByPowensId(accountData);
          
          logger.info('✅ ACCOUNT SAVED SUCCESSFULLY', {
            powensAccountId: powensAccount.id,
            savedAccountId: account.id,
            accountName: account.account_name
          });
          
          syncedAccounts++;
        } catch (accountError) {
          logger.error('❌ ACCOUNT SYNC FAILED - DETAILED ERROR', {
            powensAccountId: powensAccount.id,
            accountName: powensAccount.name || powensAccount.original_name,
            error: accountError.message,
            stack: accountError.stack,
            errorName: accountError.name,
            sqlState: accountError.code,
            constraint: accountError.constraint,
            detail: accountError.detail,
            rawPowensData: powensAccount,
            mappedData: accountData || 'MAPPING_FAILED'
          });
          // Continue with other accounts
        }
      }

      // Get transactions from Powens API (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const powensTransactions = await this.dataService.getUserTransactions(
        accessToken,
        { 
          limit: 1000,
          minDate: ninetyDaysAgo.toISOString().split('T')[0],
          userId
        }
      );

      // Process each transaction with enhanced logging
      for (const powensTransaction of powensTransactions) {
        try {
          logger.info('🔄 PROCESSING TRANSACTION', {
            powensTransactionId: powensTransaction.id,
            transactionValue: powensTransaction.value,
            transactionDate: powensTransaction.date,
            transactionWording: powensTransaction.wording,
            accountId: powensTransaction.id_account,
            allTransactionFields: Object.keys(powensTransaction)
          });

          // Find the corresponding account
          const account = await BankAccountModel.findByPowensId(powensTransaction.id_account);
          
          if (!account) {
            logger.error('❌ ACCOUNT NOT FOUND FOR TRANSACTION', {
              powensTransactionId: powensTransaction.id,
              powensAccountId: powensTransaction.id_account,
              transactionValue: powensTransaction.value
            });
            continue;
          }

          logger.info('✅ FOUND ACCOUNT FOR TRANSACTION', {
            powensTransactionId: powensTransaction.id,
            powensAccountId: powensTransaction.id_account,
            foundAccountId: account.id,
            foundAccountName: account.account_name
          });

          const transactionData = this.dataService.mapPowensTransactionToLocal(
            powensTransaction, 
            userId, 
            account.id
          );
          
          logger.info('📊 MAPPED TRANSACTION DATA', {
            powensTransactionId: powensTransaction.id,
            mappedData: transactionData,
            mappedFields: Object.keys(transactionData)
          });
          
          await TransactionModel.findOrCreateByPowensId(transactionData);
          
          logger.info('✅ TRANSACTION SAVED SUCCESSFULLY', {
            powensTransactionId: powensTransaction.id,
            transactionValue: powensTransaction.value,
            accountId: account.id
          });
          
          syncedTransactions++;
        } catch (transactionError) {
          logger.error('❌ TRANSACTION SYNC FAILED - DETAILED ERROR', {
            powensTransactionId: powensTransaction.id,
            accountId: powensTransaction.id_account,
            error: transactionError.message,
            stack: transactionError.stack,
            errorName: transactionError.name,
            sqlState: transactionError.code,
            constraint: transactionError.constraint,
            detail: transactionError.detail,
            rawPowensData: powensTransaction,
            mappedData: transactionData || 'MAPPING_FAILED'
          });
          // Continue with other transactions
        }
      }

      // Update sync status
      await BankConnectionModel.updateSyncStatus(connectionId, 'success');

      logger.info('✅ Connection sync completed', { 
        userId, 
        connectionId, 
        syncedAccounts, 
        syncedTransactions 
      });

      return { syncedAccounts, syncedTransactions };
    } catch (error) {
      // Update sync status with error
      await BankConnectionModel.updateSyncStatus(connectionId, 'failed', error.message);
      
      logger.error('❌ Connection sync failed', { 
        userId, 
        connectionId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Handle webhook from Powens after connection is established
   */
  async handleWebhook(webhookData) {
    try {
      logger.info('🔄 Processing Powens webhook', { 
        type: webhookData.type || 'unknown',
        userId: webhookData.user?.id,
        hasConnection: !!webhookData.connection,
        webhookId: webhookData.id,
        platform: webhookData.platform
      });

      // For any successful signin, try to sync data
      if (webhookData.signin || webhookData.platform === 'sharedAccess') {
        logger.info('✅ Detected successful signin, triggering data sync');
        
        const userId = '00000000-0000-0000-0000-000000000001'; // Default user
        
        // Get user's token from database
        const userTokenData = await UserModel.getPowensToken(userId);
        if (userTokenData && userTokenData.powens_permanent_token) {
          const token = userTokenData.powens_permanent_token;
          
          // 🔧 FIX: Define powensUserId in proper scope for error handling
          let powensUserId = userTokenData.powens_user_id || 'me';
          
          try {
            // Try to fetch and sync data using the token
            const [connections, accounts, transactions] = await Promise.all([
              this.dataService.getUserConnections(token),
              this.dataService.getUserAccounts(token, userId),
              this.dataService.getUserTransactions(token, { limit: 100, userId })
            ]);
            
            logger.info('✅ Webhook data fetch successful', {
              connections: connections.length,
              accounts: accounts.length,
              transactions: transactions.length,
              powensUserId // Now properly defined in scope
            });
            
            // Store the data if we got any
            if (accounts.length > 0) {
              // Create connection record
              const firstAccount = accounts[0];
              const connectionData = {
                user_id: userId,
                powens_user_id: powensUserId,
                powens_connection_id: webhookData.id || 'webhook_conn',
                bank_name: firstAccount.bank?.name || 'Unknown Bank',
                bank_logo_url: firstAccount.bank?.logo_url,
                access_token: token,
                refresh_token: token,
                token_expires_at: userTokenData.powens_token_expires_at || new Date(Date.now() + (3600 * 24 * 365 * 1000)),
                token_source: 'webhook'
              };
              
              const savedConnection = await BankConnectionModel.create(connectionData);
              logger.info('✅ Connection created from webhook', { 
                connectionId: savedConnection.id,
                powensUserId
              });
              
              // Sync accounts
              for (const account of accounts) {
                const accountData = this.dataService.mapPowensAccountToLocal(account, userId, savedConnection.id);
                await BankAccountModel.findOrCreateByPowensId(accountData);
              }
              
              // Sync transactions
              for (const transaction of transactions) {
                const account = await BankAccountModel.findByPowensId(transaction.id_account);
                if (account) {
                  const transactionData = this.dataService.mapPowensTransactionToLocal(transaction, userId, account.id);
                  await TransactionModel.findOrCreateByPowensId(transactionData);
                }
              }
              
              await BankConnectionModel.updateSyncStatus(savedConnection.id, 'success');
              
              return { 
                success: true, 
                connection: savedConnection,
                syncedAccounts: accounts.length,
                syncedTransactions: transactions.length,
                powensUserId
              };
            }
            
          } catch (syncError) {
            logger.error('❌ Webhook data sync failed', { 
              error: syncError.message,
              powensUserId // Now properly defined in scope
            });
          }
        }
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      logger.error('❌ Webhook processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Sync accounts for a user (used by the simplified interface)
   */
  async syncUserAccounts(userId) {
    try {
      logger.info('🏦 Starting user accounts sync', { userId });

      // Get user's permanent token from database
      const userTokenData = await UserModel.getPowensToken(userId);
      if (!userTokenData || !userTokenData.powens_permanent_token) {
        throw new Error('No Powens token found for user');
      }

      const accessToken = userTokenData.powens_permanent_token;

      // Call getUserAccounts with the user ID to get powens_user_id from DB
      const accounts = await this.dataService.getUserAccounts(accessToken, userId);
      
      logger.info('📊 ACCOUNTS RETRIEVED FROM POWENS API', {
        userId,
        accountCount: accounts.length,
        powensUserId: userTokenData.powens_user_id
      });

      // Sync accounts to database
      let syncedAccounts = 0;
      let syncErrors = [];
      
      for (const powensAccount of accounts) {
        try {
          // Find or get connection for this account
          let connection = null;
          const connections = await BankConnectionModel.findByUserId(userId);
          
          if (connections.length > 0) {
            // Use first connection or find matching one
            connection = connections[0];
          } else {
            // Create a default connection if none exists
            const connectionData = {
              user_id: userId,
              powens_user_id: userTokenData.powens_user_id,
              powens_connection_id: 'sync_accounts_default',
              bank_name: powensAccount.bank?.name || 'Unknown Bank',
              bank_logo_url: powensAccount.bank?.logo_url,
              access_token: accessToken,
              refresh_token: accessToken,
              token_expires_at: userTokenData.powens_token_expires_at || new Date(Date.now() + (3600 * 24 * 365 * 1000)),
              token_source: 'sync_accounts'
            };
            connection = await BankConnectionModel.create(connectionData);
          }

          // Map and store account
          const accountData = this.dataService.mapPowensAccountToLocal(powensAccount, userId, connection.id);
          await BankAccountModel.findOrCreateByPowensId(accountData);
          syncedAccounts++;
          
        } catch (accountError) {
          logger.error('❌ Failed to sync individual account', {
            powensAccountId: powensAccount.id,
            error: accountError.message
          });
          syncErrors.push({
            powensAccountId: powensAccount.id,
            error: accountError.message
          });
        }
      }

      const successRate = accounts.length > 0 ? ((syncedAccounts / accounts.length) * 100).toFixed(1) + '%' : '100%';

      logger.info('✅ ACCOUNTS SYNC COMPLETED', {
        userId,
        totalAccounts: accounts.length,
        syncedAccounts,
        errors: syncErrors.length,
        successRate
      });

      return {
        success: true,
        message: `Retrieved ${accounts.length} accounts from Powens API and synced ${syncedAccounts} to database`,
        data: {
          userId,
          powensUserId: userTokenData.powens_user_id,
          apiResponse: {
            accountCount: accounts.length,
            accounts: accounts.map(acc => ({
              id: acc.id,
              name: acc.name || acc.original_name,
              balance: acc.balance,
              currency: acc.currency?.name || acc.currency,
              type: acc.type?.name || acc.type,
              iban: acc.iban,
              bank: acc.bank?.name
            }))
          },
          syncResults: {
            totalAccounts: accounts.length,
            syncedAccounts,
            failedAccounts: syncErrors.length,
            successRate,
            errors: syncErrors
          },
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('❌ SYNC ACCOUNTS FAILED', { 
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
}

module.exports = new PowensSyncService();