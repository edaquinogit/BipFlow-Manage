// --- src/config/database.js ---
// Usando o padrão Singleton para garantir uma única conexão
import 'dotenv/config';

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bipflow_db',
};

// --- src/services/mapper.js ---
// O Mapper é crucial para transformar dados da DB em objetos de domínio (Domain Objects)
// Isso evita que seu front-end fique acoplado à estrutura da sua tabela SQL.
export class DataMapper {
  static toDomain(raw) {
    return {
      id: raw.id,
      flowName: raw.flow_name, // Exemplo de conversão de snake_case para camelCase
      createdAt: new Date(raw.created_at),
    };
  }

  static toPersistence(domain) {
    return {
      flow_name: domain.flowName,
    };
  }
}

// --- src/routes/index.js ---
import { Router } from 'express';
const routes = Router();

routes.get('/health', (req, res) => res.json({ status: 'BipFlow Operational 🚀' }));

export default routes;

// --- src/app.js ---
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[BipFlow-Manage] Server running on port ${PORT}`);
});