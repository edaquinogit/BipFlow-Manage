// --- src/config/database.js ---
// Usando o padrão Singleton para garantir uma única conexão
import 'dotenv/config';

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bipflow_db',
};