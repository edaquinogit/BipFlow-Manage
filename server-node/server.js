const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Configura o caminho do banco de dados (subindo um nível até a pasta data)
const dbPath = path.resolve(__dirname, '../data/bipflow.db');

// Conecta ao banco de dados que o Python também usa
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
    } else {
        console.log('✅ Conectado ao banco SQLite do BipFlow!');
    }
});

app.get('/', (req, res) => {
    res.json({ status: "online", database: "connected" });
});

// NOVA ROTA: Testar se o Node consegue ler os produtos que o Python cadastrou
app.get('/produtos', (req, res) => {
    db.all("SELECT * FROM produtos LIMIT 5", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            source: "Node.js Backend",
            data: rows
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor voando em http://localhost:${PORT}`);
});