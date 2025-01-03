const sql = require('mssql');
const config = require('../config/dbConfig.json');

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then((pool) => {
        console.log('Connected to SQL Database');
        return pool;
    })
    .catch((err) => {
        console.error('Database Connection Failed!', err.message);
        throw err;
    });

module.exports = { poolPromise };
