/**
 * BipFlow API - Server Entry Point
 * Responsável por inicializar o serviço na porta configurada.
 */

const app = require('./app');

// Carrega a porta do arquivo .env ou assume 3000 como fallback
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    // ATENÇÃO: É obrigatório o uso de crases (backticks) ` ` para que a interpolação ${} funcione.
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});