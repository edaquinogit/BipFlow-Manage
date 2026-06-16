const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database', 'bipflow.db');
const db = new sqlite3.Database(dbPath);

console.log("🔍 [AUDIT] Verificando banco de dados...");
db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) return console.error(err.message);
        console.log("📋 Tabelas encontradas:", tables.map(t => t.name).join(', '));
        db.close();
    });
});
