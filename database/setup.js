const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'bipflow.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🛠️ [SQL] Inicializando tabelas...");
    db.run(`CREATE TABLE IF NOT EXISTS Orders (
        orderId TEXT PRIMARY KEY,
        value REAL,
        creationDate TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        productId TEXT,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(orderId) REFERENCES Orders(orderId)
    )`);
    console.log("✅ [SQL] Tabelas criadas com sucesso em: " + dbPath);
});
db.close();
