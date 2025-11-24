// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', 
    password: '', // <-- Set to empty string for default XAMPP configuration
    database: 'ieti_edutrack_db',
    // Standard connection options
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export the promise-based connection pool
module.exports = pool.promise();