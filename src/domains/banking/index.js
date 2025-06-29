// Banking Domain Entry Point
const express = require('express');
const router = express.Router();

console.log('🔧 DEBUG: Loading banking domain routes...');

// Import banking routes
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const syncRoutes = require('./routes/sync');
const transactionsRoutes = require('./routes/transactions');

console.log('🔧 DEBUG: Loading webauthRoutes...');
const webauthRoutes = require('./routes/webauthRoutes');
console.log('🔧 DEBUG: webauthRoutes loaded successfully, type:', typeof webauthRoutes);

console.log('🔧 DEBUG: Loading option2Routes...');
const option2Routes = require('./routes/option2Routes');
console.log('🔧 DEBUG: option2Routes loaded successfully, type:', typeof option2Routes);

const webhooksRoutes = require('./routes/webhooks');

// Banking domain routes
router.use('/accounts', accountsRoutes);
router.use('/sync', syncRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/webhooks', webhooksRoutes);

// Powens-specific routes (maintain legacy paths)
// Mount specific routes first to avoid conflicts with general auth routes
console.log('🔧 DEBUG: Mounting webauthRoutes at /auth/powens');
router.use('/auth/powens', webauthRoutes);  // /api/auth/powens/* (primary)

console.log('🔧 DEBUG: Mounting option2Routes at /auth/powens/option2');
router.use('/auth/powens/option2', option2Routes); // /api/auth/powens/option2/*

// Mount general auth routes last (fallback)
console.log('🔧 DEBUG: Mounting authRoutes at /auth');
router.use('/auth', authRoutes);

module.exports = router;