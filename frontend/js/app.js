/**
 * BipFlow - Core Application Module
 * Focado em performance e User Experience (UX)
 */

const API_URL = "http://127.0.0.1:8000";

// --- ENGINE DE NAVEGAÇÃO ---

/**
 * Gerencia a troca de telas com suporte a transições suaves
 * @param {string} viewId - ID da seção no HTML
 */
function showView(viewId) {
    const views = document.querySelectorAll('.view');
    const target = document.getElementById(viewId);

    if (!target) {
        console.error(`[Navigation Error] View "${viewId}" not found.`);
        return;
    }

    // 1. Reset de todas as views
    views.forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('flex', 'block', 'active');
        v.style.display = 'none'; 
    });

    // 2. Ativação da view alvo com lógica de layout
    target.classList.remove('hidden');
    
    // Telas de autenticação usam Flexbox para centralização perfeita
    if (viewId === 'view-login' || viewId === 'view-cadastro') {
        target.style.display = 'flex';
        target.classList.add('flex');
    } else {
        target.style.display = 'block';
        target.classList.add('active');
    }

    // 3. Log de auditoria (Padrão de desenvolvimento profissional)
    console.log(`[Router] Switched to: ${viewId}`);
}

// --- SISTEMA DE FEEDBACK (UI/UX) ---

/**
 * Toast Notification Engine
 * @param {string} msg - Mensagem a ser exibida
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
function toast(msg, type = "info") {
    const el = document.getElementById('toast');
    if (!el) return;

    // Mapeamento de estilos profissionais
    const themes = {
        success: "bg-emerald-600 text-white border-emerald-400",
        error: "bg-red-600 text-white border-red-400",
        warning: "bg-amber-500 text-white border-amber-300",
        info: "bg-slate-900 text-white border-slate-700"
    };

    el.innerText = msg;
    el.className = `fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold border transition-all duration-300 fade-in ${themes[type] || themes.info}`;
    
    el.classList.remove('hidden');

    setTimeout(() => {
        el.classList.add('hidden');
    }, 3500);
}

// --- GESTÃO DE SESSÃO E USUÁRIO ---

function atualizarDadosUsuario(nome) {
    const display = document.getElementById('user-display-name');
    if (display) {
        display.innerText = nome || 'Operador';
    }
}

/**
 * Logout limpo com destruição de cache local
 */
function efetuarLogout() {
    localStorage.removeItem('bipflow_user');
    showView('view-login');
    toast("Sessão encerrada com segurança", "info");
}

// --- OPERAÇÕES DE NEGÓCIO ---

/**
 * Orquestrador de fluxo de estoque
 */
function abrirOperacao(tipo) {
    const label = document.getElementById('scan-tipo-label');
    if (label) label.innerText = `Scanner: ${tipo}`;
    
    showView('view-scanner');
    toast(`Iniciando ${tipo}...`, "info");
    
    // Aqui entrará a inicialização do html5-qrcode no futuro
}

// --- BOOTSTRAP (INICIALIZAÇÃO) ---

/**
 * Garante que o sistema valide o estado do usuário antes de renderizar
 */
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('bipflow_user');
    
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            // Verificação básica de integridade do objeto
            if (user && user.nome) {
                atualizarDadosUsuario(user.nome);
                showView('tela-menu');
                toast(`Bem-vindo de volta, ${user.nome}`, "success");
            } else {
                throw new Error("Invalid User Object");
            }
        } catch (e) {
            console.error("[Session Error] LocalStorage corrupted.");
            localStorage.removeItem('bipflow_user');
            showView('view-login');
        }
    } else {
        // Se não houver sessão, inicia no login
        showView('view-login');
    }
});