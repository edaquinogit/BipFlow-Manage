import { ui } from './ui.js';          
import { MenuSidebar } from './services/menuSidebar.js'; 
import state from './state.js';

// Removemos o import de Utils aqui se não formos usar Utils.formatarMoeda direto no app.js

const BipApp = {
    async init() {
        console.log('🚀 BipFlow App Running!');
        
        // 1. Inicializa o Menu Sidebar (Passando ui.elements como dom)
        this.menu = new MenuSidebar(state, ui.elements, null); 
        this.menu.init();

        // 2. Carregamento Inicial
        await this.fetchProducts();
        this.setupEventListeners();
        this.atualizarInterfaceCarrinho();
    },

    setupEventListeners() {
        // 🔧 Corrigido para bater com a classe do seu botão no HTML
        const filterBtn = document.querySelector('.filters-sidebar__apply');
        if (filterBtn) {
            filterBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const selectedCategories = this.getActiveFilters();
                await this.fetchProducts(selectedCategories);
                this.menu.closeSidebar(); 
            });
        }

        // Event Delegation para Adicionar ao Carrinho
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-add');
            if (btn) {
                const { id, nome, preco } = btn.dataset;
                this.adicionarAoCarrinho(id, nome, parseFloat(preco));
            }
        });
    },

    async fetchProducts(filters = []) {
        try {
            ui.toggleLoading(true);
            const response = await fetch('/api/products/');
            if (!response.ok) throw new Error('Falha na API');
            
            let data = await response.json();

            // Lógica de Filtro Front-end
            if (filters.length > 0) {
                data = data.filter(product => {
                    const category = product.category_name?.toLowerCase().trim() || '';
                    return filters.includes(category);
                });
            }

            data.length === 0 ? ui.renderEmptyState() : ui.renderProducts(data);

        } catch (error) {
            console.error('❌ Erro no Fetch:', error);
            const container = ui.elements.productGrid();
            if (container) container.innerHTML = '<p>Erro ao conectar com o servidor.</p>';
        } finally {
            ui.toggleLoading(false);
        }
    },

    getActiveFilters() {
        // 🔧 Ajustado para o nome comum de classes de checkbox
        const checkboxes = document.querySelectorAll('.filters-sidebar__option input:checked');
        return Array.from(checkboxes).map(cb => cb.name.toLowerCase().trim());
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
        
        ui.updateCartBadge(totalItens);
        
        if (typeof ui.renderCart === 'function') {
            ui.renderCart(carrinho);
        }
    }
};

// 🗽 O Pulo do Gato para NYC: Só inicia quando o HTML estiver pronto!
document.addEventListener('DOMContentLoaded', () => {
    BipApp.init();
});