import { Dom } from './dom.js';

const ui = new Dom();

const BipApp = {
    async init() {
        console.log('🚀 BipFlow App Running!');
        ui.showLoading();
        
        await this.fetchProducts();
        this.setupEventListeners();
        this.atualizarInterfaceCarrinho();
    },

    setupEventListeners() {
        // 1. Ouvinte para o botão de Aplicar Filtros
        const filterBtn = document.querySelector('.filters-sidebar__apply');
        if (filterBtn) {
            filterBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const selectedCategories = ui.getActiveFilters();
                
                await this.fetchProducts(selectedCategories);
                
                // Fecha a sidebar e remove o overlay/trava de scroll corretamente
                ui.toggleSidebar(); 
            });
        }

        // 2. Ouvinte Global para Adicionar ao Carrinho (Event Delegation)
        // Isso evita duplicar ouvintes e garante que funcione em produtos novos
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-add');
            if (btn) {
                const { id, nome, preco } = btn.dataset;
                this.adicionarAoCarrinho(id, nome, parseFloat(preco));
                console.log(`✅ Adicionado ao carrinho: ${nome}`);
            }
        });
    },

    async fetchProducts(filters = []) {
        try {
            ui.showLoading();
            const response = await fetch('/api/products/');
            if (!response.ok) throw new Error('Falha na API');
            
            let data = await response.json();

            if (filters.length > 0) {
                data = data.filter(product => {
                    const category = product.category_name ? product.category_name.toLowerCase().trim() : '';
                    return filters.includes(category);
                });
            }

            data.length === 0 ? ui.renderEmptyState() : ui.renderProducts(data);

        } catch (error) {
            console.error('❌ Erro no Fetch:', error);
            ui.produtosContainer.innerHTML = '<p>Erro ao conectar com o servidor.</p>';
        }
    },

    adicionarAoCarrinho(id, nome, preco) {
        let carrinho = JSON.parse(localStorage.getItem('bipflow_cart')) || [];
        const itemExistente = carrinho.find(item => item.id === id);

        if (itemExistente) {
            itemExistente.quantidade += 1;
        } else {
            carrinho.push({ id, nome, preco, quantidade: 1 });
        }

        localStorage.setItem('bipflow_cart', JSON.stringify(carrinho));
        this.atualizarInterfaceCarrinho();
    },

    atualizarInterfaceCarrinho() {
        const carrinho = JSON.parse(localStorage.getItem('bipflow_cart')) || [];
        const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
        
        console.log(`📊 Total de itens no carrinho: ${totalItens}`);
        
        // Chamada para renderizar visualmente (verifique se renderCart existe no dom.js)
        if (typeof ui.renderCart === 'function') {
            ui.renderCart(carrinho);
        }
    }
};

BipApp.init();
window.app = BipApp;