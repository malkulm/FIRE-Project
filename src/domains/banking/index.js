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
router.use('/webauth', webauthRoutes);
router.use('/option2', option2Routes);
router.use('/webhooks', webhooksRoutes);

module.exports = router;