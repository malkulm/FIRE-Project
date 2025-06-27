const axios = require('axios');
const { logger } = require('../../utils/logger');
const { POWENS_API_URL } = require('./constants');

// Models
const UserModel = require('../../models/User');

/**
 * Powens Data Collection Service
 * Handles fetching bank accounts, transactions, and connections from Powens API
 */
class PowensDataService {
  constructor() {
    this.apiUrl = POWENS_API_URL;
    
    logger.info('🔧 POWENS DATA SERVICE INITIALIZED', {
      apiUrl: this.apiUrl
    });
  }

  /**
   * Get user's bank connections (using correct API endpoint)
   */
  async getUserConnections(accessToken) {
    try {
      logger.info('🔍 DEBUGGING: Getting user connections', {
        apiUrl: this.apiUrl,
        endpoint: '/users/me/connections',
        tokenPreview: accessToken ? accessToken.substring(0, 15) + '...' : 'none'
      });

      const response = await axios.get(`${this.apiUrl}/users/me/connections`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Retrieved user connections', { 
        connectionCount: response.data.connections?.length || 0,
        fullResponse: response.data
      });

      return response.data.connections || [];
    } catch (error) {
      logger.error('❌ Failed to get user connections', { 
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        requestUrl: `${this.apiUrl}/users/me/connections`
      });
      throw new Error('Failed to retrieve bank connections');
    }
  }

  /**
   * Get accounts for a user (using correct API endpoint with stored powens_user_id)
   * UPDATED: Now handles disabled accounts according to Powens documentation
   */
  async getUserAccounts(accessToken, userId = null) {
    try {
      let powensUserId = 'me'; // Default fallback
      
      if (userId) {
        // Get the user's specific powens_user_id from database
        const userTokenData = await UserModel.getPowensToken(userId);
        if (userTokenData && userTokenData.powens_user_id) {
          powensUserId = userTokenData.powens_user_id;
          logger.info('✅ Using stored powens_user_id from database', { 
            userId,
            powensUserId: userTokenData.powens_user_id 
          });
        } else {
          logger.warn('⚠️ No powens_user_id found in database, using "me"', { userId });
        }
      }

      // CRITICAL FIX: Add ?all parameter to see disabled accounts
      const requestUrl = `${this.apiUrl}/users/${powensUserId}/accounts?all`;
      
      logger.info('🔍 DEBUGGING: Getting user accounts (including disabled)', {
        apiUrl: this.apiUrl,
        endpoint: `/users/${powensUserId}/accounts?all`,
        requestUrl,
        tokenPreview: accessToken ? accessToken.substring(0, 15) + '...' : 'none',
        powensUserId,
        userId
      });

      const response = await axios.get(requestUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const allAccounts = response.data.accounts || [];
      
      logger.info('✅ Retrieved user accounts (including disabled)', { 
        totalAccountCount: allAccounts.length,
        powensUserId,
        userId,
        fullResponse: response.data
      });

      // Enhanced logging for debugging
      if (allAccounts.length > 0) {
        const enabledAccounts = allAccounts.filter(acc => !acc.disabled);
        const disabledAccounts = allAccounts.filter(acc => acc.disabled);
        
        logger.info('📊 ACCOUNT STATUS BREAKDOWN:', {
          totalAccounts: allAccounts.length,
          enabledAccounts: enabledAccounts.length,
          disabledAccounts: disabledAccounts.length,
          accounts: allAccounts.map(acc => ({
            id: acc.id,
            name: acc.name || acc.original_name,
            balance: acc.balance,
            type: acc.type,
            bank: acc.bank?.name,
            disabled: acc.disabled,
            status: acc.disabled ? 'DISABLED' : 'ENABLED'
          }))
        });

        // AUTOMATIC ACCOUNT ENABLEMENT: Enable disabled accounts (user consent)
        if (disabledAccounts.length > 0) {
          logger.info('🔓 ENABLING DISABLED ACCOUNTS (User Consent)', {
            disabledCount: disabledAccounts.length,
            accountsToEnable: disabledAccounts.map(acc => ({ id: acc.id, name: acc.name }))
          });

          for (const account of disabledAccounts) {
            try {
              await this.enableAccount(accessToken, account.id, userId);
              logger.info('✅ Account enabled successfully', {
                accountId: account.id,
                accountName: account.name || account.original_name
              });
            } catch (enableError) {
              logger.error('❌ Failed to enable account', {
                accountId: account.id,
                accountName: account.name || account.original_name,
                error: enableError.message
              });
            }
          }

          // After enabling accounts, fetch them again to get updated status
          logger.info('🔄 Re-fetching accounts after enablement');
          const updatedResponse = await axios.get(requestUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          const updatedAccounts = updatedResponse.data.accounts || [];
          const finalEnabledAccounts = updatedAccounts.filter(acc => !acc.disabled);
          
          logger.info('🎯 FINAL ACCOUNT STATUS:', {
            totalAccounts: updatedAccounts.length,
            enabledAccounts: finalEnabledAccounts.length,
            enablementSuccess: finalEnabledAccounts.length > enabledAccounts.length
          });

          return finalEnabledAccounts; // Return only enabled accounts
        }

        return enabledAccounts; // Return only enabled accounts
      } else {
        logger.warn('⚠️ NO ACCOUNTS RETURNED FROM API (even with ?all parameter)', {
          responseStructure: Object.keys(response.data),
          rawResponse: response.data
        });
        return [];
      }

    } catch (error) {
      logger.error('❌ Failed to get user accounts', { 
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        requestUrl: `${this.apiUrl}/users/${powensUserId}/accounts?all`,
        powensUserId,
        userId
      });
      throw new Error('Failed to retrieve accounts');
    }
  }

  /**
   * Enable a disabled bank account (user consent)
   * Based on Powens API: POST /users/{userId}/accounts/{accountId}?all
   */
  async enableAccount(accessToken, accountId, userId = null) {
    try {
      let powensUserId = 'me';
      if (userId) {
        const userTokenData = await UserModel.getPowensToken(userId);
        if (userTokenData && userTokenData.powens_user_id) {
          powensUserId = userTokenData.powens_user_id;
        }
      }

      const requestUrl = `${this.apiUrl}/users/${powensUserId}/accounts/${accountId}?all`;
      
      logger.info('🔓 Enabling disabled account', {
        accountId,
        requestUrl,
        powensUserId
      });

      const response = await axios.post(requestUrl, 
        { "disabled": false }, // User consent to enable account
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('✅ Account enabled successfully', {
        accountId,
        powensUserId,
        responseStatus: response.status
      });

      return response.data;
    } catch (error) {
      logger.error('❌ Failed to enable account', {
        accountId,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      });
      throw new Error(`Failed to enable account ${accountId}: ${error.message}`);
    }
  }

  /**
   * Get transactions for a user (using correct API endpoint)
   * Based on Powens API documentation: GET /users/{userId}/transactions
   */
  async getUserTransactions(accessToken, options = {}) {
    try {
      const { 
        limit = 500,
        minDate = null,
        maxDate = null,
        userId = null
      } = options;

      // Build query parameters according to Powens API docs
      const params = new URLSearchParams({
        limit: limit.toString()
      });

      if (minDate) {
        params.append('min_date', minDate);
      }
      if (maxDate) {
        params.append('max_date', maxDate);
      }

      // Determine user endpoint
      let powensUserId = 'me';
      if (userId) {
        const userTokenData = await UserModel.getPowensToken(userId);
        if (userTokenData && userTokenData.powens_user_id) {
          powensUserId = userTokenData.powens_user_id;
          logger.info('✅ Using stored powens_user_id for transactions', { 
            userId,
            powensUserId: userTokenData.powens_user_id 
          });
        }
      }

      const requestUrl = `${this.apiUrl}/users/${powensUserId}/transactions?${params}`;
      
      logger.info('🔍 DEBUGGING: Getting user transactions', {
        apiUrl: this.apiUrl,
        endpoint: `/users/${powensUserId}/transactions`,
        requestUrl,
        tokenPreview: accessToken ? accessToken.substring(0, 15) + '...' : 'none',
        powensUserId,
        userId,
        options
      });

      const response = await axios.get(requestUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Retrieved user transactions', { 
        transactionCount: response.data.transactions?.length || 0,
        powensUserId,
        options,
        fullResponse: response.data
      });

      return response.data.transactions || [];
    } catch (error) {
      logger.error('❌ Failed to get user transactions', { 
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        requestUrl: `${this.apiUrl}/users/${powensUserId}/transactions`,
        powensUserId,
        options
      });
      throw new Error('Failed to retrieve transactions');
    }
  }

  /**
   * Get a specific bank transaction by ID
   * Based on Powens API: GET /users/{userId}/transactions/{transactionId}
   */
  async getTransaction(accessToken, transactionId, userId = null) {
    try {
      let powensUserId = 'me';
      if (userId) {
        const userTokenData = await UserModel.getPowensToken(userId);
        if (userTokenData && userTokenData.powens_user_id) {
          powensUserId = userTokenData.powens_user_id;
        }
      }

      const response = await axios.get(`${this.apiUrl}/users/${powensUserId}/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Retrieved specific transaction', { 
        transactionId,
        powensUserId
      });

      return response.data;
    } catch (error) {
      logger.error('❌ Failed to get specific transaction', { 
        transactionId,
        error: error.message,
        status: error.response?.status
      });
      throw new Error('Failed to retrieve transaction');
    }
  }

  /**
   * Update a bank transaction
   * Based on Powens API: POST /users/{userId}/transactions/{transactionId}
   */
  async updateTransaction(accessToken, transactionId, updateData, userId = null) {
    try {
      let powensUserId = 'me';
      if (userId) {
        const userTokenData = await UserModel.getPowensToken(userId);
        if (userTokenData && userTokenData.powens_user_id) {
          powensUserId = userTokenData.powens_user_id;
        }
      }

      const response = await axios.post(`${this.apiUrl}/users/${powensUserId}/transactions/${transactionId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Updated transaction', { 
        transactionId,
        powensUserId,
        updateData
      });

      return response.data;
    } catch (error) {
      logger.error('❌ Failed to update transaction', { 
        transactionId,
        updateData,
        error: error.message,
        status: error.response?.status
      });
      throw new Error('Failed to update transaction');
    }
  }

  /**
   * Map Powens account data to local format - FIXED CURRENCY MAPPING
   */
  mapPowensAccountToLocal(powensAccount, userId, connectionId) {
    // CRITICAL FIX: Extract currency code from currency object
    let currencyCode = 'EUR'; // Default fallback
    
    if (powensAccount.currency) {
      if (typeof powensAccount.currency === 'string') {
        // Currency is already a string
        currencyCode = powensAccount.currency;
      } else if (typeof powensAccount.currency === 'object' && powensAccount.currency.id) {
        // Currency is an object with id field
        currencyCode = powensAccount.currency.id;
      } else if (typeof powensAccount.currency === 'object' && powensAccount.currency.name) {
        // Currency object has name field, try to extract code
        const currencyName = powensAccount.currency.name.toLowerCase();
        if (currencyName.includes('euro')) currencyCode = 'EUR';
        else if (currencyName.includes('dollar')) currencyCode = 'USD';
        else if (currencyName.includes('singapore')) currencyCode = 'SGD';
        else currencyCode = 'EUR'; // fallback
      }
    }

    logger.info('💱 CURRENCY MAPPING DEBUG', {
      powensAccountId: powensAccount.id,
      originalCurrency: powensAccount.currency,
      mappedCurrencyCode: currencyCode,
      currencyType: typeof powensAccount.currency
    });

    return {
      user_id: userId,
      connection_id: connectionId,
      powens_account_id: powensAccount.id,
      account_number: powensAccount.number,
      iban: powensAccount.iban,
      bic: powensAccount.bic || null,
      account_name: powensAccount.name || powensAccount.original_name,
      account_type: this.mapAccountType(powensAccount.type),
      currency: currencyCode, // ← FIXED: Now stores just the 3-character code
      balance: parseFloat(powensAccount.balance || 0),
      available_balance: parseFloat(powensAccount.coming || 0),
      bank_name: powensAccount.bank?.name || 'Unknown Bank',
      account_metadata: powensAccount
    };
  }

  /**
   * Map Powens transaction data to local format (updated for correct API response)
   */
  mapPowensTransactionToLocal(powensTransaction, userId, accountId) {
    return {
      user_id: userId,
      account_id: accountId,
      powens_transaction_id: powensTransaction.id,
      transaction_date: powensTransaction.date,
      processed_date: powensTransaction.vdate || powensTransaction.date,
      amount: parseFloat(powensTransaction.value || 0),
      currency: powensTransaction.original_currency || 'EUR',
      description: powensTransaction.wording || powensTransaction.original_wording || powensTransaction.simplified_wording,
      transaction_type: parseFloat(powensTransaction.value || 0) >= 0 ? 'credit' : 'debit',
      category: this.categorizeTransaction(powensTransaction),
      merchant_name: powensTransaction.simplified_wording || powensTransaction.wording,
      reference_number: powensTransaction.id.toString(),
      is_pending: powensTransaction.coming || false,
      powens_metadata: powensTransaction
    };
  }

  /**
   * Map Powens account types to our types
   */
  mapAccountType(powensType) {
    const typeMap = {
      'checking': 'checking',
      'savings': 'savings',
      'card': 'checking',
      'loan': 'loan',
      'mortgage': 'loan',
      'investment': 'investment',
      'insurance': 'investment'
    };
    
    return typeMap[powensType] || 'checking';
  }

  /**
   * Basic transaction categorization based on Powens transaction types and descriptions
   */
  categorizeTransaction(transaction) {
    const description = (transaction.wording || transaction.original_wording || transaction.simplified_wording || '').toLowerCase();
    const transactionType = transaction.type;
    
    // Use Powens transaction type for primary categorization
    const typeMap = {
      'transfer': 'Transfer',
      'order': 'Payment',
      'check': 'Check',
      'deposit': 'Income',
      'payback': 'Refund',
      'withdrawal': 'Cash Withdrawal',
      'loan_repayment': 'Loan Payment',
      'bank': 'Bank Fees',
      'card': 'Card Payment',
      'deferred_card': 'Card Payment',
      'summary_card': 'Card Payment',
      'market_order': 'Investment',
      'market_fee': 'Investment Fees',
      'profit': 'Income',
      'refund': 'Refund',
      'payment': 'Payment',
      'fee': 'Fees'
    };
    
    if (typeMap[transactionType]) {
      return typeMap[transactionType];
    }
    
    // Fallback to keyword-based categorization
    if (description.includes('salary') || description.includes('salaire')) return 'Income';
    if (description.includes('supermarket') || description.includes('grocery')) return 'Food & Dining';
    if (description.includes('gas') || description.includes('fuel')) return 'Transportation';
    if (description.includes('restaurant') || description.includes('cafe')) return 'Food & Dining';
    if (description.includes('transfer') || description.includes('virement')) return 'Transfer';
    if (description.includes('fee') || description.includes('commission')) return 'Fees';
    
    return 'Other';
  }
}

module.exports = new PowensDataService();