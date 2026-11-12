const mysql = require('mysql2/promise');
const config = require('../env/mysqlConfig');

const pool = mysql.createPool(config);

module.exports = pool;