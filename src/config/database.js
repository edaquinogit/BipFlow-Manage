const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Criação da tabela
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    )
`).run();

console.log("Tabela 'users' criada com sucesso usando better-sqlite3!");

// Exemplo de inserção
const insertUser = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
insertUser.run("Alice", "alice@example.com");

// Exemplo de consulta
const getUsers = db.prepare("SELECT * FROM users").all();
console.log(getUsers);