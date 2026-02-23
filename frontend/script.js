// 1. Estado da aplicação (Variáveis globais)
let carrinho = [];

// 2. Função principal para buscar produtos do Django
async function carregarProdutos() {
    try {
        console.log("Iniciando busca de produtos...");
        const response = await fetch('http://127.0.0.1:8000/api/produtos/');
        
        if (!response.ok) throw new Error('Erro na rede ao buscar produtos');
        
        const produtos = await response.json();
        const container = document.getElementById('produtos-container');
        container.innerHTML = ''; // Limpa o conteúdo antes de adicionar os produtos
        
        if (!container) return; // Segurança caso o ID mude
        container.innerHTML = ''; 

        produtos.forEach(prod => {
            // Verificação de imagem para evitar o erro 404
            const imagemValida = prod.image && prod.image !== null && prod.image !== "null" && prod.image !== "";
            
            let imgHTML = imagemValida 
                ? `<img src="${prod.image}" alt="${prod.name}">`
                : `<div style="width:100%; height:180px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#888;">🖼️ Sem Foto</div>`;

            const card = `
                <div class="card">
                    ${imgHTML}
                    <div class="card-content">
                        <h3>${prod.name || 'Produto'}</h3>
                        <p>${prod.description || ''}</p>
                        <p class="price">R$ ${prod.price || '0.00'}</p>
                    </div>
                    <button class="btn-add" onclick="adicionarAoCarrinho('${prod.name}', ${prod.price})">
                        Adicionar ao Carrinho
                    </button>
                </div>
            `;
            container.innerHTML += card;
        });

        console.log("Produtos carregados com sucesso!");
    } catch (error) {
        console.error('Erro crítico:', error);
        const container = document.getElementById('produtos-container');
        if (container) {
            container.innerHTML = '<p>Erro ao carregar o menu. Verifique se o Django está rodando!</p>';
        }
    }
}

// 3. Funções do Carrinho
function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ nome, preco });
    console.log("Carrinho atual:", carrinho);
    atualizarVisualCarrinho();
}

function atualizarVisualCarrinho() {
    const listaItens = document.getElementById('itens-carrinho');
    const totalElemento = document.getElementById('total-valor');
    
    if (!listaItens || !totalElemento) return;

    listaItens.innerHTML = '';
    let totalCusto = 0;

    carrinho.forEach((item) => {
        listaItens.innerHTML += `<p>✅ ${item.nome} - R$ ${item.preco}</p>`;
        totalCusto += parseFloat(item.preco);
    });

    totalElemento.innerText = totalCusto.toFixed(2);
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

    const numeroTelefone = "5511999999999"; // Coloque seu número aqui
    const url = `https://wa.me/${numeroTelefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// 4. Inicialização Segura
window.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    
    // Conecta o botão de finalizar APENAS quando o HTML estiver pronto
    const btnFinalizar = document.getElementById('finalizar-pedido');
    if (btnFinalizar) {
        btnFinalizar.onclick = finalizarPedido;
    }
});