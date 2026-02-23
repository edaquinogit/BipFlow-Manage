// 1. Estado da aplicação
let carrinho = [];

// 2. Buscar produtos (Refatorado para o seu padrão de cards quadrados)
async function carregarProdutos() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/produtos/');
        if (!response.ok) throw new Error('Erro na rede');
        
        const produtos = await response.json();
        const container = document.getElementById('produtos-container');
        if (!container) return;
        
        container.innerHTML = ''; 

        produtos.forEach(prod => {
            const imagemValida = prod.image && prod.image !== "null" && prod.image !== "";
            let imgHTML = imagemValida 
                ? `<img src="${prod.image}" alt="${prod.name}">`
                : `<div class="sem-foto">🖼️ Sem Foto</div>`;

            const card = `
                <div class="card">
                    ${imgHTML}
                    <div class="card-content">
                        <h3>${prod.name || 'Produto'}</h3>
                        <p>${prod.description || ''}</p>
                        <p class="price">R$ ${prod.price || '0.00'}</p>
                    </div>
                    <button class="btn-adicionar" onclick="adicionarAoCarrinho('${prod.name}', ${prod.price})">
                        Adicionar
                    </button>
                </div>
            `;
            container.innerHTML += card;
        });
    } catch (error) {
        console.error('Erro crítico:', error);
    }
}

// 3. Funções do Carrinho (CORRIGIDAS)
function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ nome, preco });
    atualizarVisualCarrinho();
}

// ESTA FUNÇÃO É ESSENCIAL PARA O BOTÃO DE LIXEIRA FUNCIONAR
function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarVisualCarrinho();
}

function atualizarVisualCarrinho() {
    const listaItens = document.getElementById('itens-carrinho');
    const totalElemento = document.getElementById('total-valor');
    const contador = document.getElementById('cart-count');
    
    if (!listaItens || !totalElemento) return;

    listaItens.innerHTML = '';
    let totalCusto = 0;

    carrinho.forEach((item, index) => {
        const itemHTML = `
            <div class="item-no-carrinho">
                <div>
                    <strong>${item.nome}</strong><br>
                    <small>R$ ${item.preco}</small>
                </div>
                <button class="btn-remover" onclick="removerDoCarrinho(${index})">🗑️</button>
            </div>
        `;
        listaItens.innerHTML += itemHTML;
        totalCusto += parseFloat(item.preco);
    });

    totalElemento.innerText = totalCusto.toFixed(2);
    if (contador) contador.innerText = carrinho.length;
} // <--- CHAVE DE FECHAMENTO QUE FALTAVA

function toggleCarrinho() {
    const modal = document.getElementById('carrinho-modal');
    const overlay = document.getElementById('overlay');
    if(modal) modal.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
}

function finalizarPedido() {
    if (carrinho.length === 0) {
        alert("O seu carrinho está vazio!");
        return;
    }

    let mensagem = "🍔 *Novo Pedido - BipDelivery*\n\n";
    carrinho.forEach(item => {
        mensagem += `• ${item.nome} (R$ ${item.preco})\n`;
    });

    const total = document.getElementById('total-valor').innerText;
    mensagem += `\n*Total: R$ ${total}*`;

    const numeroTelefone = "5511999999999"; 
    const url = `https://wa.me/${numeroTelefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// 4. Inicialização
window.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    const btnFinalizar = document.getElementById('finalizar-pedido');
    if (btnFinalizar) btnFinalizar.onclick = finalizarPedido;
});