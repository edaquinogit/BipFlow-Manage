/**
 * BIPFLOW INTEGRATION ENGINE - PROFESSIONAL VERSION
 * Stack: Node.js, Express, Better-SQLite3, Swagger
 * Focus: Jitterbit Assessment & NYC Engineering Standards
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('./docs/swagger.js');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuração do Banco de Dados ---
const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : path.resolve(__dirname, 'db.sqlite3');
const db = new Database(dbPath);

// Criação das tabelas (Migration mínima)
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

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
 *     responses:
 *       201:
 *         description: Pedido integrado com sucesso.
 *       400:
 *         description: Erro de validação ou persistência.
 */
app.post('/api/v1/orders', (req, res) => {
    const { numeroPedido, valorTotal, dataCriacao, items } = req.body;

    // --- Guard Clause ---
    if (!numeroPedido || !valorTotal) {
        return res.status(400).json({
            status: "Error",
            message: "Payload malformado: Campos obrigatórios ausentes."
        });
    }

    // Sanitização
    const orderIdClean = numeroPedido.split('-')[0];

    try {
        // Inserção do Pedido
        const stmtOrder = db.prepare(
            "INSERT INTO Orders (orderId, value, creationDate) VALUES (?, ?, ?)"
        );
        stmtOrder.run(orderIdClean, parseFloat(valorTotal), dataCriacao);

        // Inserção dos Itens
        if (items && Array.isArray(items)) {
            const stmtItem = db.prepare(
                "INSERT INTO Items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)"
            );
            const insertMany = db.transaction((items) => {
                for (const item of items) {
                    stmtItem.run(orderIdClean, item.idItem, item.quantidadeItem, item.valorItem);
                }
            });
            insertMany(items);
        }

        console.log(`✅ [INTEGRATION] Pedido ${orderIdClean} processado com sucesso.`);

        return res.status(201).json({
            status: "Success",
            orderId: orderIdClean
        });

    } catch (err) {
        return res.status(400).json({
            status: "Error",
            message: "Erro de persistência (Pedido possivelmente duplicado)."
        });
    }
});

// --- Health Check ---
app.get('/health', (req, res) => {
    res.json({ status: "UP", timestamp: new Date().toISOString() });
});

// --- Inicialização ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("------------------------------------------------");
    console.log(`🚀 BIPFLOW ENGINE: http://localhost:${PORT}`);
    console.log(`📖 DOCUMENTAÇÃO: http://localhost:${PORT}/api-docs`);
    console.log("------------------------------------------------");
  });
}

module.exports = app;