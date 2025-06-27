// Main Powens Service - Simplified facade that delegates to specialized services
const powensAuthService = require('./powensAuthService');
const powensDataService = require('./powensDataService');
const powensSyncService = require('./powensSyncService');

/**
 * Main Powens Service
 * Simplified facade that delegates to specialized services
 * This maintains backward compatibility while using the new modular architecture
 */
class PowensService {
  constructor() {
    this.auth = powensAuthService;
    this.data = powensDataService;
    this.sync = powensSyncService;
  }

  // === AUTHENTICATION METHODS ===
  async createPermanentUserToken(userId) {
    return this.auth.createPermanentUserToken(userId);
  }

  async generateTemporaryCode(permanentToken) {
    return this.auth.generateTemporaryCode(permanentToken);
  }

  async generateAuthUrl(userId, options = {}) {
    return this.auth.generateAuthUrl(userId, options);
  }

  async exchangeCodeForToken(code, state) {
    return this.auth.exchangeCodeForToken(code, state);
  }

  async initializeUser(userId = null) {
    return this.auth.initializeUser(userId);
  }

  async refreshAccessToken(refreshToken, userId) {
    return this.auth.refreshAccessToken(refreshToken, userId);
  }

  // === 🆕 OPTION 2 - MANUAL CONNECTION METHODS ===
  async createManualConnection(accessToken, connectorId, connectionFields = {}) {
    return this.auth.createManualConnection(accessToken, connectorId, connectionFields);
  }

  async enableAccounts(accessToken, accountIds) {
    return this.auth.enableAccounts(accessToken, accountIds);
  }

  async getConnectorWithFields(connectorId) {
    return this.auth.getConnectorWithFields(connectorId);
  }

  async getConnectorsWithFields() {
    return this.auth.getConnectorsWithFields();
  }

  async getAvailableConnectors() {
    return this.auth.getAvailableConnectors();
  }

  // === DATA COLLECTION METHODS ===
  async getUserConnections(accessToken) {
    return this.data.getUserConnections(accessToken);
  }

  async getUserAccounts(accessToken, userId = null) {
    return this.data.getUserAccounts(accessToken, userId);
  }

  async getUserTransactions(accessToken, options = {}) {
    return this.data.getUserTransactions(accessToken, options);
  }

  async getTransaction(accessToken, transactionId, userId = null) {
    return this.data.getTransaction(accessToken, transactionId, userId);
  }

  async updateTransaction(accessToken, transactionId, updateData, userId = null) {
    return this.data.updateTransaction(accessToken, transactionId, updateData, userId);
  }

  // === DATA MAPPING METHODS ===
  mapPowensAccountToLocal(powensAccount, userId, connectionId) {
    return this.data.mapPowensAccountToLocal(powensAccount, userId, connectionId);
  }

  mapPowensTransactionToLocal(powensTransaction, userId, accountId) {
    return this.data.mapPowensTransactionToLocal(powensTransaction, userId, accountId);
  }

  mapAccountType(powensType) {
    return this.data.mapAccountType(powensType);
  }

  categorizeTransaction(transaction) {
    return this.data.categorizeTransaction(transaction);
  }

  // === SYNC METHODS ===
  async handleCallback(connectionId, state, userId) {
    return this.sync.handleCallback(connectionId, state, userId);
  }

  async syncConnectionData(userId, connectionId) {
    return this.sync.syncConnectionData(userId, connectionId);
  }

  async handleWebhook(webhookData) {
    return this.sync.handleWebhook(webhookData);
  }

  async syncUserAccounts(userId) {
    return this.sync.syncUserAccounts(userId);
  }
}

module.exports = new PowensService();