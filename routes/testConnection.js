const express = require('express');
const { poolPromise } = require('../server/db');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        res.status(200).json({
            message: 'Connection to the database was successful!',
            database: pool.config.database,
            server: pool.config.server,
        });
    } catch (err) {
        console.error('Database connection error:', err.message);
        res.status(500).json({
            message: 'Failed to connect to the database.',
            error: err.message,
        });
    }
});

module.exports = router;
