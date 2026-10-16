// Konfigurasi aplikasi dari Environment Variables
module.exports = {
  tcp: {
    host: process.env.TCP_HOST || '0.0.0.0',
    port: parseInt(process.env.TCP_PORT || '20005', 10),
  },
  http: {
    port: parseInt(process.env.HTTP_PORT || '8080', 10),
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'nav_user',
    password: process.env.DB_PASSWORD || 'nav_password123',
    database: process.env.DB_NAME || 'navigation_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  logIntervalSec: parseFloat(process.env.LOG_INTERVAL_SEC || '1.0'),
  jwt: {
    secret: process.env.JWT_SECRET || 'box_navigasi_super_secret_jwt_key_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'box_navigasi_super_refresh_jwt_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
};
