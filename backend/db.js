// backend/db.js – MySQL connection pool
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host    : 'localhost',
    user    : 'root',
    password: '',           // default XAMPP = empty
    database: 'chat_db',
    waitForConnections: true,
    connectionLimit   : 10,
});

module.exports = pool;
