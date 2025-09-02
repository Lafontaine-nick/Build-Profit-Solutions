const { Pool } = require('pg');

let pool;

const initializeDatabase = () => {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  } else {
    // Fallback to local development
    pool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'build_profit_solutions',
      password: 'password',
      port: 5432,
    });
  }

  // Test the connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log('✅ Database connected successfully');
    }
  });

  return pool;
};

const getPool = () => {
  if (!pool) {
    initializeDatabase();
  }
  return pool;
};

const closePool = async () => {
  if (pool) {
    await pool.end();
    console.log('Database connection pool closed');
  }
};

module.exports = {
  initializeDatabase,
  getPool,
  closePool
}; 