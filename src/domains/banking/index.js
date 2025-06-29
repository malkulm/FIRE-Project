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
router.use('/accounts', accountsRoutes);
router.use('/sync', syncRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/webhooks', webhooksRoutes);

// Powens-specific routes (maintain legacy paths) - FIXED: Mount both at same path like original
// Mount both webauthRoutes and option2Routes at the same /auth/powens path (just like the original)
router.use('/auth/powens', webauthRoutes);  // /api/auth/powens/* (webauth routes)
router.use('/auth/powens', option2Routes);  // /api/auth/powens/* (option2 routes, same path!)

// Mount general auth routes last (fallback)
router.use('/auth', authRoutes);

module.exports = router;