import { Dom } from './dom.js';

const ui = new Dom();

const BipApp = {
    async init() {
        console.log('🚀 BipFlow App Running!');
        ui.showLoading();
        
        // 1. Carrega os produtos iniciais
        await this.fetchProducts();

        // 2. Configura os eventos de filtro
        this.setupEventListeners();
    },

    setupEventListeners() {
        const filterBtn = document.querySelector('.filters-sidebar__apply');
        if (filterBtn) {
            filterBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const selectedCategories = ui.getActiveFilters();
                console.log('🔍 Filtrando por:', selectedCategories);
                await this.fetchProducts(selectedCategories);
                
                // Fecha a sidebar após filtrar (opcional, melhora a UX)
                if(ui.sidebar) ui.sidebar.classList.remove('active');
            });
        }
    },

    async fetchProducts(filters = []) {
        try {
            ui.showLoading(); // Mostra o loader enquanto a API responde
            
            const response = await fetch('/api/products/');
            if (!response.ok) throw new Error('Falha na API');
            
            let data = await response.json();

            // Lógica de filtro inteligente
            if (filters.length > 0) {
                data = data.filter(product => {
                    // Verificação defensiva: garante que a categoria existe e remove espaços
                    const category = product.category_name ? product.category_name.toLowerCase().trim() : '';
                    return filters.includes(category);
                });
            }

            // Se após o filtro não sobrar nada, avisa o usuário
            if (data.length === 0) {
                ui.produtosContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Nenhum item encontrado nesta categoria. 🍕</p>
                        <button onclick="location.reload()">Ver tudo</button>
                    </div>`;
            } else {
                ui.renderProducts(data);
            }

        } catch (error) {
            console.error('❌ Erro no Fetch:', error);
            ui.produtosContainer.innerHTML = '<p>Erro ao conectar com o servidor. Tente novamente.</p>';
        }
    },

    addToCart(id) {
        console.log('🛒 Adicionado ao carrinho:', id);
        // Futura lógica de LocalStorage aqui
    }
};

// Inicialização
BipApp.init();
window.app = BipApp;