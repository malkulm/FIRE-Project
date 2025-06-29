// Banking Domain Entry Point
const express = require('express');
const router = express.Router();

// Import banking routes
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const syncRoutes = require('./routes/sync');
const transactionsRoutes = require('./routes/transactions');
const webauthRoutes = require('./routes/webauthRoutes');
const option2Routes = require('./routes/option2Routes');
const webhooksRoutes = require('./routes/webhooks');

// Banking domain routes
router.use('/auth', authRoutes);
router.use('/accounts', accountsRoutes);
router.use('/sync', syncRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/webhooks', webhooksRoutes);

// Powens-specific routes (maintain legacy paths)
// Mount webauth routes first (primary implementation)
router.use('/auth/powens', webauthRoutes);  // /api/auth/powens/*

// Mount option2 routes on separate path to avoid conflicts
router.use('/auth/powens/option2', option2Routes); // /api/auth/powens/option2/*

module.exports = router;