// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
    // --- START: CHANGES FOR RAILWAY DEPLOYMENT ---
    // Railway automatically provides these environment variables for its managed MySQL service.
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER, 
    password: process.env.MYSQLPASSWORD, 
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT, 
    // --- END: CHANGES FOR RAILWAY DEPLOYMENT ---
    
    // Standard connection options
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export the promise-based connection pool
module.exports = pool.promise();
