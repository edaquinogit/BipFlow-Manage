/**
 * BipDelivery - Core Script v2.0
 * Refatorado para UX Moderna e Performance
 */

// 1. CONFIGURAÇÕES GERAIS
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000/api/produtos/',
    TELEFONE_WHATSAPP: '5511999999999',
    MOEDA: 'BRL',
    MENSAGEM_BOAS_VINDAS: "🍔 *BipDelivery - Novo Pedido*\n"
};

// 2. ESTADO DA APLICAÇÃO
let state = {
    carrinho: [],
    produtos: []
};

// 3. SELETORES DOM
const DOM = {
    container: document.getElementById('produtos-container'),
    listaCarrinho: document.getElementById('itens-carrinho'),
    total: document.getElementById('total-valor'),
    subtotal: document.getElementById('subtotal-valor'),
    contador: document.getElementById('cart-count'),
    modal: document.getElementById('carrinho-modal'),
    overlay: document.getElementById('overlay')
};

// 4. FORMATADORES (Padrão Internacional)
const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: CONFIG.MOEDA });
};

// 5. LÓGICA DE PRODUTOS
async function carregarProdutos() {
    try {
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error('Falha na API');
        
        state.produtos = await response.json();
        renderizarProdutos();
    } catch (error) {
        console.error('❌ Erro:', error);
        DOM.container.innerHTML = `
            <div class="error-state">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>O cardápio está sendo atualizado. Volte em instantes!</p>
            </div>`;
    }
}

function renderizarProdutos() {
    if (!DOM.container) return;
    
    DOM.container.innerHTML = state.produtos.map(prod => `
        <article class="card">
            <div class="card-img-wrapper">
                ${renderImagem(prod)}
            </div>
            <div class="card-content">
                <h3>${prod.name}</h3>
                <p>${prod.description || 'Sabor exclusivo BipDelivery.'}</p>
                <div class="card-footer">
                    <span class="price">${formatarMoeda(parseFloat(prod.price))}</span>
                    <button class="btn-adicionar" onclick="adicionarAoCarrinho('${prod.name}', ${prod.price})">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        </article>
    `).join('');
}

function renderImagem(prod) {
    return prod.image && prod.image !== "null" 
        ? `<img src="${prod.image}" alt="${prod.name}" loading="lazy">`
        : `<div class="sem-foto"><i class="fa-solid fa-burger"></i></div>`;
}

// 6. LÓGICA DO CARRINHO (Business Logic)

function adicionarAoCarrinho(nome, preco) {
    const itemExistente = state.carrinho.find(item => item.nome === nome);

    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        state.carrinho.push({ 
            nome, 
            preco: parseFloat(preco), 
            quantidade: 1 
        });
    }

    // Feedback Visual
    const cartBtn = document.getElementById('cart-icon');
    cartBtn.classList.add('cart-pop');
    setTimeout(() => cartBtn.classList.remove('cart-pop'), 300);

    atualizarInterface();
}

function alterarQuantidade(index, delta) {
    state.carrinho[index].quantidade += delta;
    
    if (state.carrinho[index].quantidade <= 0) {
        state.carrinho.splice(index, 1);
    }
    
    atualizarInterface();
}

function atualizarInterface() {
    renderizarCarrinho();
    calcularTotais();
}

function renderizarCarrinho() {
    if (!DOM.listaCarrinho) return;

    if (state.carrinho.length === 0) {
        DOM.listaCarrinho.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Seu carrinho está vazio</p>
            </div>`;
        return;
    }

    DOM.listaCarrinho.innerHTML = state.carrinho.map((item, index) => `
        <div class="item-no-carrinho anim-slide-in">
            <div class="item-info">
                <strong>${item.quantidade}x ${item.nome}</strong>
                <small>${formatarMoeda(item.preco * item.quantidade)}</small>
            </div>
            <div class="item-controls">
                <button onclick="alterarQuantidade(${index}, -1)" class="btn-qty"><i class="fa-solid fa-minus"></i></button>
                <button onclick="alterarQuantidade(${index}, 1)" class="btn-qty"><i class="fa-solid fa-plus"></i></button>
            </div>
        </div>
    `).join('');
}

function calcularTotais() {
    const total = state.carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = state.carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    
    if (DOM.total) DOM.total.innerText = total.toFixed(2);
    if (DOM.subtotal) DOM.subtotal.innerText = total.toFixed(2);
    if (DOM.contador) DOM.contador.innerText = totalItens;
}

// 7. FINALIZAÇÃO & UI (UX Refinada)
function toggleCarrinho() {
    const isOpening = !DOM.modal.classList.contains('active');
    
    DOM.modal.classList.toggle('active');
    DOM.overlay.classList.toggle('active');

    // Bloqueia o scroll do body ao abrir o carrinho (Padrão Apps Premium)
    document.body.style.overflow = isOpening ? 'hidden' : 'auto';
}

async function finalizarPedido() {
    const btnFinalizar = document.getElementById('finalizar-pedido');
    
    // 1. Validação de Segurança
    if (state.carrinho.length === 0) {
        alert("Seu carrinho está vazio! Adicione algo gostoso antes de fechar o pedido. 🍔");
        return;
    }

    // 2. Feedback Visual de "Processando"
    const originalText = btnFinalizar.innerHTML;
    btnFinalizar.disabled = true;
    btnFinalizar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparando Pedido...`;

    try {
        // 3. Construção da Mensagem Profissional
        let mensagem = `${CONFIG.MENSAGEM_BOAS_VINDAS}`;
        mensagem += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        
        state.carrinho.forEach(item => {
            const subtotalItem = (item.preco * item.quantidade).toFixed(2);
            mensagem += `*${item.quantidade}x* ${item.nome.padEnd(15)} → R$ ${subtotalItem}\n`;
        });

        const totalPedido = state.carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2);
        
        mensagem += `\n━━━━━━━━━━━━━━━━━━━━`;
        mensagem += `\n💰 *Total: R$ ${totalPedido}*`;
        mensagem += `\n\n📍 *Por favor, informe abaixo:*`;
        mensagem += `\n• Nome:`;
        mensagem += `\n• Endereço de Entrega:`;
        mensagem += `\n• Forma de Pagamento:`;

        // 4. Pequeno delay para simular processamento (Melhora a percepção de valor do usuário)
        await new Promise(resolve => setTimeout(resolve, 800));

        // 5. Disparo do WhatsApp
        const url = `https://wa.me/${CONFIG.TELEFONE_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');

    } catch (error) {
        console.error("Erro ao finalizar:", error);
        alert("Ops! Houve um problema ao gerar seu pedido. Tente novamente.");
    } finally {
        // Restaura o botão
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = originalText;
    }
}

// 8. BOOTSTRAP (Inicialização Segura)
window.addEventListener('DOMContentLoaded', () => {
    // Inicializa produtos
    carregarProdutos();
    
    // Configura Listeners de forma limpa (Sem onclick no HTML)
    const btnFinalizar = document.getElementById('finalizar-pedido');
    if (btnFinalizar) {
        btnFinalizar.addEventListener('click', finalizarPedido);
    }

    // Fecha carrinho ao clicar no overlay
    if (DOM.overlay) {
        DOM.overlay.addEventListener('click', toggleCarrinho);
    }
});