/**
 * BIPFLOW INTEGRATION ENGINE - PROFESSIONAL VERSION
 * Stack: Node.js, Express, Better-SQLite3, Swagger, Pino, Zod
 * Focus: Production-grade robustness with structured logging and validation
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('./docs/swagger.js');
const Database = require('better-sqlite3');
const logger = require('./src/logger');
const { CreateOrderSchema } = require('./src/schemas');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuração do Banco de Dados ---
const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : path.resolve(__dirname, 'db.sqlite3');
let db;

try {
  db = new Database(dbPath);
  logger.info({ dbPath: isTest ? 'memory' : dbPath }, 'Banco de dados conectado');
} catch (err) {
  logger.error({ error: err.message }, 'Falha ao conectar ao banco de dados');
  process.exit(1);
}

// Criação das tabelas (Migration mínima)
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS Orders (
        orderId TEXT PRIMARY KEY,
        value REAL NOT NULL,
        creationDate TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT NOT NULL,
        productId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(orderId) REFERENCES Orders(orderId)
    )
  `).run();

  logger.debug('Tabelas criadas/verificadas com sucesso');
} catch (err) {
  logger.error({ error: err.message }, 'Falha ao criar tabelas');
  process.exit(1);
}

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Middleware de logging de requisições
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip
  }, 'Requisição recebida');
  next();
});

// --- Documentação Swagger ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsDoc));

// --- Rotas ---
/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Integra e persiste um novo pedido
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numeroPedido
 *               - valorTotal
 *               - dataCriacao
 *             properties:
 *               numeroPedido:
 *                 type: string
 *               valorTotal:
 *                 type: number
 *               dataCriacao:
 *                 type: string
 *               items:
 *                 type: array
 *     responses:
 *       201:
 *         description: Pedido integrado com sucesso.
 *       400:
 *         description: Erro de validação ou persistência.
 *       500:
 *         description: Erro interno do servidor.
 */
app.post('/api/v1/orders', (req, res) => {
  try {
    // Validar payload com Zod
    const validatedData = CreateOrderSchema.parse(req.body);
    const { numeroPedido, valorTotal, dataCriacao, items } = validatedData;

    logger.info(
      { numeroPedido, valorTotal, itemCount: items.length },
      'Processando novo pedido'
    );

    // Sanitização
    const orderIdClean = numeroPedido.split('-')[0];

    try {
      // Inserção do Pedido
      const stmtOrder = db.prepare(
        'INSERT INTO Orders (orderId, value, creationDate) VALUES (?, ?, ?)'
      );
      stmtOrder.run(orderIdClean, parseFloat(valorTotal), dataCriacao);

      // Inserção dos Itens
      if (items && Array.isArray(items) && items.length > 0) {
        const stmtItem = db.prepare(
          'INSERT INTO Items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)'
        );
        const insertMany = db.transaction((items) => {
          for (const item of items) {
            stmtItem.run(
              orderIdClean,
              item.idItem,
              item.quantidadeItem,
              item.valorItem
            );
          }
        });
        insertMany(items);
        logger.info(
          { orderId: orderIdClean, itemCount: items.length },
          'Itens inseridos com sucesso'
        );
      }

      logger.info({ orderId: orderIdClean }, 'Pedido processado com sucesso');

      return res.status(201).json({
        status: 'Success',
        orderId: orderIdClean
      });
    } catch (dbErr) {
      // Tratamento específico para erros de banco de dados
      if (dbErr.message.includes('UNIQUE constraint failed')) {
        logger.warn(
          { error: dbErr.message, orderId: orderIdClean },
          'Tentativa de inserir pedido duplicado'
        );
        return res.status(400).json({
          status: 'Error',
          message: 'Pedido com este ID já existe.'
        });
      }

      logger.error(
        { error: dbErr.message, orderId: orderIdClean, stack: dbErr.stack },
        'Erro ao persistir pedido'
      );
      return res.status(400).json({
        status: 'Error',
        message: 'Erro de persistência. Por favor, tente novamente.'
      });
    }
  } catch (validationErr) {
    // Zod validation error - check if it's a ZodError
    if (validationErr && validationErr.errors && Array.isArray(validationErr.errors)) {
      const errors = validationErr.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      logger.warn({ errors }, 'Validação de payload falhou');
      return res.status(400).json({
        status: 'Error',
        message: 'Payload malformado: ' + errors.join('; ')
      });
    }

    // Erro inesperado
    logger.error(
      { error: validationErr.message, stack: validationErr.stack },
      'Erro inesperado na validação'
    );
    return res.status(500).json({
      status: 'Error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check do servidor
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servidor está operacional.
 */
app.get('/health', (req, res) => {
  try {
    logger.debug('Health check requisitado');
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error({ error: err.message }, 'Erro no health check');
    res.status(500).json({ status: 'DOWN' });
  }
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  logger.error(
    { error: err.message, stack: err.stack, path: req.path },
    'Erro não tratado'
  );
  res.status(500).json({
    status: 'Error',
    message: 'Erro interno do servidor'
  });
});

// --- 404 Handler ---
app.use((req, res) => {
  logger.warn({ method: req.method, path: req.path }, 'Rota não encontrada');
  res.status(404).json({
    status: 'Error',
    message: 'Rota não encontrada'
  });
});

// --- Inicialização ---
if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, '🚀 BIPFLOW ENGINE iniciado');
    logger.info(
      { url: `http://localhost:${PORT}/api-docs` },
      '📖 Documentação Swagger disponível'
    );
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido, encerrando gracefully');
    server.close(() => {
      logger.info('Servidor encerrado');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT recebido, encerrando gracefully');
    server.close(() => {
      logger.info('Servidor encerrado');
      process.exit(0);
    });
  });
}

module.exports = app;
