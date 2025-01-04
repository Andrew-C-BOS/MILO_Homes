const sql = require('mssql');

// Database configuration using environment variables
const dbConfig = {
    server: process.env.DB_Server || "localhost", // Correct property for SQL Server
    user: process.env.DB_User || "your_default_user",
    password: process.env.DB_Password || "your_default_password",
    database: process.env.DB_Database || "your_default_database",
    options: {
        encrypt: true, // Required for secure connections, especially with Azure
        trustServerCertificate: true, // Use this for local development or self-signed certs
    },
    port: parseInt(process.env.DB_Port, 10) || 1433, // Default SQL Server port
};

// Create a connection pool
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
        console.log("Connected to SQL Database");
        return pool;
    })
    .catch((err) => {
        console.error("Database Connection Failed!", err.message);
        throw err;
    });

module.exports = { poolPromise };
