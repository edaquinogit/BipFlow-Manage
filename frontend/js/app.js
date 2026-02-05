// Configuração da conexão com o servidor Python (O terminal que está aberto)
const API_URL = "http://127.0.0.1:8000";

// Função para exibir alertas bonitos (Toast)
function toast(mensagem, cores) {
    const toastBox = document.createElement('div');
    toastBox.className = `fixed bottom-5 right-5 p-4 rounded-lg shadow-lg z-50 transition-all ${cores}`;
    toastBox.innerText = mensagem;
    document.body.appendChild(toastBox);
    setTimeout(() => toastBox.remove(), 3000);
}

// Função para trocar de telas (Login <-> Cadastro <-> Dashboard)
function showView(viewId) {
    // Esconde todas as views
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    // Mostra a view desejada
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
    }
}

// Verifica se o usuário já está logado ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        // Se tiver token, tenta mostrar a tela principal (ou mantém no login para teste)
        console.log("Usuário já possui token de acesso.");
    }
});