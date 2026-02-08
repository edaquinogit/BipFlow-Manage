/**
 * BipFlow Enterprise - Core Application Logic
 * Autor: Ednaldo Aquino
 * Versão: 1.2.0 (Stable/Camera Integration)
 */

// ============================================================================
// 1. CONFIGURAÇÕES GLOBAIS
// ============================================================================
const API_URL = "http://127.0.0.1:8000";
let scannerInstancia = null; // Variável global para controlar o hardware da câmera
let operacaoAtual = "";      // 'entrada' ou 'saida'

// ============================================================================
// 2. UTILITÁRIOS DE UI (Interface)
// ============================================================================

// Sistema de Notificações Toast (Feedback Visual)
function toast(mensagem, estilo = "bg-slate-800 text-white") {
    const toastBox = document.createElement('div');
    toastBox.className = `fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-2xl font-bold border transition-all duration-300 transform translate-y-[-20px] opacity-0 z-[100] ${estilo}`;
    toastBox.innerText = mensagem;
    
    document.body.appendChild(toastBox);
    
    // Animação de entrada
    setTimeout(() => {
        toastBox.classList.remove('translate-y-[-20px]', 'opacity-0');
    }, 10);

    // Auto-destruição após 3 segundos
    setTimeout(() => {
        toastBox.classList.add('opacity-0', 'translate-y-[-20px]');
        setTimeout(() => toastBox.remove(), 300);
    }, 3000);
}

// Gerenciador de Navegação (SPA - Single Page Application)
function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in'); // Garante animação suave
    }
}

// ============================================================================
// 3. MÓDULO DE HARDWARE (SCANNER / CÂMERA)
// ============================================================================

async function abrirScanner(tipo) {
    operacaoAtual = tipo;
    
    // Manipulação do DOM: Mostra área da câmera e esconde botões
    const container = document.getElementById('container-scanner');
    const botoes = document.getElementById('botoes-estoque');
    
    if(!container || !botoes) {
        console.error("Erro Crítico: Elementos do DOM não encontrados.");
        return;
    }

    botoes.classList.add('hidden');
    container.classList.remove('hidden');

    // Configuração Profissional do Scanner
    scannerInstancia = new Html5Qrcode("reader");
    
    const configScanner = { 
        fps: 15, // Frames por segundo (equilíbrio entre performance e bateria)
        qrbox: { width: 250, height: 150 }, // Foco retangular para código de barras
        aspectRatio: 1.0 
    };

    try {
        // Tenta ativar a câmera traseira (environment)
        await scannerInstancia.start(
            { facingMode: "environment" }, 
            configScanner, 
            onScanSuccess, 
            onScanFailure // Opcional: callback de erro contínuo (geralmente ignorado para não poluir log)
        );
        toast(`Scanner Ativo: Modo ${tipo.toUpperCase()}`, "bg-blue-600 text-white");
    } catch (err) {
        console.error("Erro de Hardware:", err);
        toast("Erro ao acessar câmera. Verifique as permissões.", "bg-red-500 text-white");
        fecharScanner();
    }
}

// Callback de Sucesso (Quando o Bip acontece)
function onScanSuccess(decodedText, decodedResult) {
    console.log(`Hardware detectou: ${decodedText}`);
    
    // Feedback Tátil (Vibração) - Essencial para operadores em ambientes barulhentos
    if (navigator.vibrate) navigator.vibrate(200); 

    // Pausa o scanner imediatamente para evitar leituras duplas
    fecharScanner();
    
    // Envia para o processamento de negócio
    processarLeitura(decodedText);
}

function onScanFailure(error) {
    // Apenas log de debug, não incomodar o usuário
    // console.warn(`Tentativa de leitura falhou: ${error}`);
}

function fecharScanner() {
    if (scannerInstancia) {
        scannerInstancia.stop().then(() => {
            // Limpa o DOM e reseta variáveis
            document.getElementById('container-scanner').classList.add('hidden');
            document.getElementById('botoes-estoque').classList.remove('hidden');
            scannerInstancia.clear();
            scannerInstancia = null;
        }).catch(err => {
            console.error("Erro ao desligar câmera:", err);
        });
    } else {
        // Fallback caso a instância já tenha morrido
        document.getElementById('container-scanner').classList.add('hidden');
        document.getElementById('botoes-estoque').classList.remove('hidden');
    }
}

// ============================================================================
// 4. LÓGICA DE NEGÓCIO (INTEGRAÇÃO COM BACKEND)
// ============================================================================

async function processarLeitura(codigo) {
    // 1. Definição Visual baseada na operação
    const cor = operacaoAtual === 'entrada' ? 'text-emerald-600' : 'text-amber-600';
    const acaoTexto = operacaoAtual === 'entrada' ? 'Adicionar ao Estoque' : 'Baixar do Estoque';

    // 2. Simulação de Confirmação (Substituiremos por modal customizado depois)
    // Usamos setTimeout para garantir que a UI da câmera já sumiu
    setTimeout(async () => {
        const quantidade = prompt(`PRODUTO DETECTADO: ${codigo}\n\nOperação: ${acaoTexto}\nInforme a quantidade:`, "1");

        if (quantidade && !isNaN(quantidade)) {
            // AQUI CONECTAREMOS COM O PYTHON NA PRÓXIMA AULA
            // O código abaixo prepara o payload JSON
            const payload = {
                id_produto: codigo,
                quantidade: parseInt(quantidade),
                tipo: operacaoAtual
            };

            console.log("Enviando para API:", payload);
            
            // Simulação de sucesso para teste de hoje
            toast(`Sucesso! ${operacaoAtual.toUpperCase()} de ${quantidade} unid. registrada.`, "bg-green-500 text-white border-green-400");
            
            // Tocar som de sucesso (Opcional futuro)
        } else {
            toast("Operação cancelada pelo usuário.", "bg-slate-500 text-white");
        }
    }, 300);
}

// ============================================================================
// 5. AUTENTICAÇÃO E INICIALIZAÇÃO
// ============================================================================

function realizarLogin() {
    // Simulação de login para acesso rápido ao teste
    const email = document.getElementById('login-email').value;
    if(email) {
        localStorage.setItem('token', 'demo-token-123');
        localStorage.setItem('usuario', email);
        atualizarInterfaceUsuario();
        showView('tela-menu');
        toast("Login realizado com sucesso", "bg-emerald-500 text-white");
    } else {
        toast("Por favor, insira suas credenciais", "bg-amber-500 text-white");
    }
}

function efetuarLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    showView('view-login');
    toast("Sessão finalizada", "bg-blue-500 text-white");
}

function atualizarInterfaceUsuario() {
    const user = localStorage.getItem('usuario');
    const display = document.getElementById('user-display');
    if(user && display) {
        display.innerText = `Logado como: ${user} | Nó: Ubuntu-WSL`;
    }
}

// Inicialização Automática
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        atualizarInterfaceUsuario();
        showView('tela-menu'); // Vai direto para o painel se já logado
    } else {
        showView('view-login');
    }
});