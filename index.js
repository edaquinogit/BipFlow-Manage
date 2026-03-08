/**
 * BIPFLOW INTEGRATION ENGINE - PROFESSIONAL VERSION
 * Stack: Node.js, Express, SQLite3, Swagger
 * Focus: Jitterbit Assessment & NYC Engineering Standards
 */

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('./docs/swagger.js');

const app = express();
const PORT = 3000;

// Configuração do Banco de Dados
const dbPath = path.resolve(__dirname, 'database', 'bipflow.db');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// 1. Rota de Documentação (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsDoc));

/**
 * @swagger
 * /api/v1/orders:
 * post:
 * summary: Integra e persiste um novo pedido
 * tags: [Orders]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * responses:
 * 201:
 * description: Pedido integrado com sucesso.
 * 400:
 * description: Erro de validação ou persistência.
 */
app.post('/api/v1/orders', (req, res) => {
    const { numeroPedido, valorTotal, dataCriacao, items } = req.body;
    
    // --- Guard Clause (Resiliência Sênior) ---
    if (!numeroPedido || !valorTotal) {
        return res.status(400).json({ 
            status: "Error", 
            message: "Payload malformado: Campos obrigatórios ausentes." 
        });
    }

    // Sanitização (v123-01 -> v123)
    const orderIdClean = numeroPedido.split('-')[0];

    db.serialize(() => {
        // Transação de Inserção do Pedido
        const stmtOrder = db.prepare("INSERT INTO Orders (orderId, value, creationDate) VALUES (?, ?, ?)");
        
        stmtOrder.run(orderIdClean, parseFloat(valorTotal), dataCriacao, function(err) {
            if (err) {
                return res.status(400).json({ 
                    status: "Error", 
                    message: "Erro de persistência (Pedido possivelmente duplicado)." 
                });
            }

            // Inserção dos Itens associados
            const stmtItem = db.prepare("INSERT INTO Items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)");
            
            if (items && Array.isArray(items)) {
                items.forEach(item => {
                    stmtItem.run(orderIdClean, item.idItem, item.quantidadeItem, item.valorItem);
                });
            }
            stmtItem.finalize();
            
            console.log(`✅ [INTEGRATION] Pedido ${orderIdClean} processado com sucesso.`);
            
            res.status(201).json({ 
                status: "Success", 
                orderId: orderIdClean 
            });
        });
        stmtOrder.finalize();
    });
});

/**
 * Endpoint de Monitoramento (Health Check)
 */
app.get('/health', (req, res) => {
    res.json({ status: "UP", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log("------------------------------------------------");
    console.log(`🚀 BIPFLOW ENGINE: http://localhost:${PORT}`);
    console.log(`📖 DOCUMENTAÇÃO: http://localhost:${PORT}/api-docs`);
    console.log("------------------------------------------------");
});