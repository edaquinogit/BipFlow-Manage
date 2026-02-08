/**
 * BipFlow - Core Auth Module
 * Arquitetura preparada para escala industrial.
 */

const BASE_URL = "http://127.0.0.1:8000";

// --- Utilitários de Interface ---
const UI = {
    setLoading: (btnSelector, isLoading, originalText = "Autenticar") => {
        const btn = document.querySelector(btnSelector);
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerText = isLoading ? "Processando..." : originalText;
    },
    clearInputs: (ids) => ids.forEach(id => document.getElementById(id).value = "")
};

// ============================================================================
// 1. AUTENTICAÇÃO (LOGIN)
// ============================================================================
async function realizarLogin() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value.trim();

    if (!email || !senha) {
        toast("Preencha todos os campos!", "bg-amber-500 text-white");
        return;
    }

    UI.setLoading('button[onclick="realizarLogin()"]', true, "Autenticar Operador");

    try {
        // Padrão OAuth2: Envio como Form-Data
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', senha);

        const response = await fetch(`${BASE_URL}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!response.ok) throw new Error("Acesso Negado");

        const data = await response.json();

        // Persistência de Sessão
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('usuario_email', email);

        toast("Acesso Autorizado! 🚀", "bg-emerald-500 text-white");
        
        // Se houver função de atualizar UI no app.js, chamamos aqui
        if (typeof atualizarInterfaceUsuario === 'function') atualizarInterfaceUsuario();
        
        showView('tela-menu');

    } catch (error) {
        console.error("Login Error:", error);
        toast("Credenciais inválidas ou Erro de conexão", "bg-red-500 text-white");
    } finally {
        UI.setLoading('button[onclick="realizarLogin()"]', false, "Autenticar Operador");
    }
}

// ============================================================================
// 2. PROVISIONAMENTO (CADASTRO)
// ============================================================================
async function acaoCadastro() {
    const campos = {
        nome: document.getElementById('cad-nome-novo').value.trim(),
        email: document.getElementById('cad-email-novo').value.trim(),
        senha: document.getElementById('cad-senha-novo').value.trim()
    };

    if (!campos.nome || !campos.email || !campos.senha) {
        toast("Todos os campos são obrigatórios!", "bg-amber-500 text-white");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/usuarios/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campos)
        });

        if (response.ok) {
            toast("Conta provisionada com sucesso!", "bg-blue-500 text-white");
            UI.clearInputs(['cad-nome-novo', 'cad-email-novo', 'cad-senha-novo']);
            showView('view-login');
        } else {
            const errData = await response.json();
            toast(`Erro: ${errData.detail || "Falha no registro"}`, "bg-red-500 text-white");
        }
    } catch (error) {
        toast("Servidor offline. Verifique o nó Linux.", "bg-red-600 text-white");
    }
}

// ============================================================================
// 3. GESTÃO DE SESSÃO
// ============================================================================
function efetuarLogout() {
    localStorage.clear();
    toast("Sessão encerrada.", "bg-slate-700 text-white");
    showView('view-login');
}

async function verificarStatusServidor() {
    try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.ok) console.log("📡 Conectado ao Backend BipFlow");
    } catch {
        console.warn("⚠️ Backend inacessível.");
    }
}

document.addEventListener('DOMContentLoaded', verificarStatusServidor);