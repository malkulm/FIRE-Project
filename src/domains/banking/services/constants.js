// Powens API Constants and Configuration

// Domain for Powens API - using the correct sandbox domain
const POWENS_DOMAIN = process.env.POWENS_DOMAIN || 'luxsy-sandbox';

// API and WebView URLs - FIXED: using /connect endpoint like working dashboard
const POWENS_API_URL = `https://${POWENS_DOMAIN}.biapi.pro/2.0`;
const POWENS_WEBVIEW_URL = 'https://webview.powens.com/connect';

// Access token fallback for when OAuth flow fails
const PERMANENT_ACCESS_TOKEN = process.env.PERMANENT_ACCESS_TOKEN || '';

// Development mode detection
const isDevelopment = process.env.NODE_ENV === 'development';

// Mock data for development without API keys
const MOCK_DATA = {
  accounts: [
    {
      id: 'acc-001',
      name: 'Compte Courant',
      number: 'LU123456789012345678',
      iban: 'LU123456789012345678',
      bic: 'SPKELULL',
      balance: 3257.42,
      currency: 'EUR',
      bank_name: 'Spuerkeess',
      type: 'CHECKING',
      last_update: new Date().toISOString()
    },
    {
      id: 'acc-002',
      name: 'Compte Épargne',
      number: 'LU987654321098765432',
      iban: 'LU987654321098765432',
      bic: 'SPKELULL',
      balance: 15742.81,
      currency: 'EUR',
      bank_name: 'Spuerkeess',
      type: 'SAVINGS',
      last_update: new Date().toISOString()
    },
    {
      id: 'acc-003',
      name: 'Compte Investissement',
      number: 'LU456789123456789123',
      iban: 'LU456789123456789123',
      bic: 'SPKELULL',
      balance: 8732.65,
      currency: 'EUR',
      bank_name: 'Spuerkeess',
      type: 'INVESTMENT',
      last_update: new Date().toISOString()
    }
  ],
  transactions: {
    'acc-001': [
      // Recent transactions
      { 
        id: 'tx-001', 
        account_id: 'acc-001', 
        date: '2025-06-08T09:24:00Z', 
        description: 'Salaire Juin 2025', 
        amount: 3850.00, 
        currency: 'EUR', 
        category: 'Revenus',
        type: 'CREDIT'
      },
      { 
        id: 'tx-002', 
        account_id: 'acc-001', 
        date: '2025-06-07T14:30:00Z', 
        description: 'Supermarché Cactus', 
        amount: -45.67, 
        currency: 'EUR', 
        category: 'Alimentation',
        type: 'DEBIT'
      },
      { 
        id: 'tx-003', 
        account_id: 'acc-001', 
        date: '2025-06-06T08:15:00Z', 
        description: 'Esso Station', 
        amount: -67.34, 
        currency: 'EUR', 
        category: 'Transport',
        type: 'DEBIT'
      },
      { 
        id: 'tx-004', 
        account_id: 'acc-001', 
        date: '2025-05-15T10:15:00Z', 
        description: 'Salaire Mai 2025', 
        amount: 3850.00, 
        currency: 'EUR', 
        category: 'Revenus',
        type: 'CREDIT'
      }
    ],
    'acc-002': [
      {
        id: 'tx-005',
        account_id: 'acc-002',
        date: '2025-06-01T12:00:00Z',
        description: 'Virement depuis compte courant',
        amount: 500.00,
        currency: 'EUR',
        category: 'Transfert',
        type: 'CREDIT'
      }
    ],
    'acc-003': [
      {
        id: 'tx-006',
        account_id: 'acc-003',
        date: '2025-06-01T16:30:00Z',
        description: 'Dividendes ETF',
        amount: 42.18,
        currency: 'EUR',
        category: 'Investissement',
        type: 'CREDIT'
      }
    ]
  }
};

// Export constants and configuration
module.exports = {
  POWENS_DOMAIN,
  POWENS_API_URL,
  POWENS_WEBVIEW_URL,
  PERMANENT_ACCESS_TOKEN,
  isDevelopment,
  MOCK_DATA
};
