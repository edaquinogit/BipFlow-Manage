/**
 * BipDelivery - Core Script
 * Padrão: Clean Code & Modular JS
 */

// 1. CONFIGURAÇÕES GERAIS (Fácil de editar posteriormente)
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000/api/produtos/',
    TELEFONE_WHATSAPP: '5511999999999',
    MOEDA: 'R$',
    MENSAGEM_BOAS_VINDAS: "🍔 *Novo Pedido - BipDelivery*\n\n"
};

// 2. ESTADO DA APLICAÇÃO (Single Source of Truth)
let state = {
    carrinho: [],
    produtos: []
};

// 3. SELETORES DOM (Cache de elementos para performance)
const DOM = {
    container: document.getElementById('produtos-container'),
    listaCarrinho: document.getElementById('itens-carrinho'),
    total: document.getElementById('total-valor'),
    subtotal: document.getElementById('subtotal-valor'),
    contador: document.getElementById('cart-count'),
    modal: document.getElementById('carrinho-modal'),
    overlay: document.getElementById('overlay')
};

// 4. LÓGICA DE PRODUTOS (Fetching & Rendering)
async function carregarProdutos() {
    try {
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error('Falha ao conectar com o servidor');
        
        state.produtos = await response.json();
        renderizarProdutos();
    } catch (error) {
        console.error('Erro crítico no carregamento:', error);
        DOM.container.innerHTML = `<p class="error-msg">Ops! Ocorreu um erro ao carregar o menu. Tente novamente.</p>`;
    }
}

function renderizarProdutos() {
    if (!DOM.container) return;
    
    DOM.container.innerHTML = state.produtos.map(prod => `
        <article class="card">
            ${renderImagem(prod)}
            <div class="card-content">
                <h3>${prod.name || 'Produto'}</h3>
                <p>${prod.description || 'Sabor inigualável BipDelivery'}</p>
                <p class="price">${CONFIG.MOEDA} ${parseFloat(prod.price).toFixed(2)}</p>
            </div>
            <button class="btn-adicionar" onclick="adicionarAoCarrinho('${prod.name}', ${prod.price})">
                Adicionar ao Pedido
            </button>
        </article>
    `).join('');
}

function renderImagem(prod) {
    return prod.image && prod.image !== "null" 
        ? `<img src="${prod.image}" alt="${prod.name}" loading="lazy">`
        : `<div class="sem-foto"><i class="fa-solid fa-utensils"></i></div>`;
}

// 5. LÓGICA DO CARRINHO (Business Logic)

function adicionarAoCarrinho(nome, preco) {
    // 1. Tenta encontrar se o item já está no carrinho
    const itemExistente = state.carrinho.find(item => item.nome === nome);

    if (itemExistente) {
        // Se existe, apenas aumenta a quantidade
        itemExistente.quantidade += 1;
    } else {
        // Se é novo, adiciona o objeto completo com quantidade inicial 1
        state.carrinho.push({ 
            nome, 
            preco: parseFloat(preco), 
            quantidade: 1 
        });
    }

    // 2. Feedback Visual e UI (O que você já fez, que está ótimo!)
    atualizarInterface();
    
    const cartBtn = document.getElementById('cart-icon');
    if (cartBtn) {
        cartBtn.classList.add('cart-pop');
        setTimeout(() => cartBtn.classList.remove('cart-pop'), 300);
    }

    console.log(`✅ ${itemExistente ? 'Incrementado' : 'Adicionado'}: ${nome}`);
}

function removerDoCarrinho(index) {
    state.carrinho.splice(index, 1);
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
                <i class="fa-solid fa-cart-flatbed"></i>
                <p>Seu carrinho está vazio.<br><small>Que tal um pastelzinho?</small></p>
            </div>`;
        return;
    }

    DOM.listaCarrinho.innerHTML = state.carrinho.map((item, index) => `
        <div class="item-no-carrinho">
            <div class="item-info">
                <strong>${item.nome}</strong>
                <small>${CONFIG.MOEDA} ${item.preco.toFixed(2)}</small>
            </div>
            <button class="btn-remover" onclick="removerDoCarrinho(${index})">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');
}

function calcularTotais() {
    const total = state.carrinho.reduce((acc, item) => acc + item.preco, 0);
    
    if (DOM.total) DOM.total.innerText = total.toFixed(2);
    if (DOM.subtotal) DOM.subtotal.innerText = total.toFixed(2);
    if (DOM.contador) DOM.contador.innerText = state.carrinho.length;
}

// 6. INTERAÇÕES DE UI
function toggleCarrinho() {
    const isActive = DOM.modal.classList.toggle('active');
    DOM.overlay.classList.toggle('active');
    
    // Melhora acessibilidade ao abrir
    DOM.modal.setAttribute('aria-hidden', !isActive);
}

function finalizarPedido() {
    if (state.carrinho.length === 0) {
        alert("Adicione pelo menos um item para finalizar!");
        return;
    }

    let mensagem = CONFIG.MENSAGEM_BOAS_VINDAS;
    state.carrinho.forEach(item => {
        mensagem += `• ${item.nome} (${CONFIG.MOEDA} ${item.preco.toFixed(2)})\n`;
    });

    const total = DOM.total.innerText;
    mensagem += `\n*Total: ${CONFIG.MOEDA} ${total}*`;

    const url = `https://wa.me/${CONFIG.TELEFONE_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// 7. INICIALIZAÇÃO (Bootstrap)
window.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    
    // Event Listeners
    const btnFinalizar = document.getElementById('finalizar-pedido');
    if (btnFinalizar) btnFinalizar.addEventListener('click', finalizarPedido);
});