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

  // Test the connection with better error handling
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      console.error('Error code:', err.code);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        hint: err.hint
      });
      if (err.code === 'ECONNREFUSED') {
        console.error('💡 PostgreSQL might not be running. Start it with: brew services start postgresql@14 (or your version)');
      } else if (err.code === '3D000') {
        console.error('💡 Database "build_profit_solutions" does not exist. Create it with: createdb build_profit_solutions');
      } else if (err.code === '28P01') {
        console.error('💡 Authentication failed. Check database credentials in database.js');
      }
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