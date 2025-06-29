// Crypto Domain Entry Point
const express = require('express');
const router = express.Router();

// Import crypto routes
const nexoRoutes = require('./routes/nexo');

// Crypto domain routes
router.use('/nexo', nexoRoutes);

module.exports = router;