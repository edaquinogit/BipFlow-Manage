const express = require('express');
const app = express();

app.use(express.json());

// Rota de Teste de Sanidade
app.get('/health', (req, res) => {
res.status(200).json({ status: 'UP', timestamp: new Date() });
});

module.exports = app;