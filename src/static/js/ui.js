import { Utils } from './utils.js';

export const ui = {
    elements: {
        productGrid: () => document.getElementById('produtos-container'), 
        sidebar: () => document.querySelector('.filters-sidebar'),
        overlay: () => document.querySelector('.overlay-blur') || document.getElementById('overlay'),
        cartBadge: () => document.querySelector('.cart-count')
    },

    /**
     * Renderiza os cards de produtos com o design da imagem de referência.
     */
    renderProducts(produtos) {
        const container = this.elements.productGrid();
        if (!container) return;

        // Limpamos o container antes de renderizar
        container.innerHTML = produtos.map(p => {
            // Tratamento de dados para evitar 'undefined'
            const precoFormatado = Utils.formatarMoeda ? Utils.formatarMoeda(p.price) : `$ ${p.price}`;
            const imagemUrl = p.image || '/static/images/default-food.png';
            const categoria = p.category_name || 'Lanche';

            return `
                <div class="product-card">
                    <div class="product-card__image-wrapper">
                        <img src="${imagemUrl}" alt="${p.name}" loading="lazy">
                    </div>
                    
                    <div class="product-card__info">
                        <h3 class="product-card__title">${p.name}</h3>
                        <p class="product-card__description">${categoria}</p>
                        
                        <div class="price-container">
                            <span class="price">${precoFormatado}</span>
                            <button class="btn-add" 
                                    data-id="${p.id}" 
                                    data-nome="${p.name}" 
                                    data-preco="${p.price}"
                                    aria-label="Adicionar ${p.name} ao carrinho">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Atualiza o contador de itens no ícone do carrinho.
     */
    updateCartBadge(count) {
        const badge = this.elements.cartBadge();
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
            
            // Pequena animação de "pulse" ao adicionar item (NYC Style)
            badge.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.2)' },
                { transform: 'scale(1)' }
            ], { duration: 200 });
        }
    },

    renderEmptyState() {
        const container = this.elements.productGrid();
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Ops! Não encontramos pratos com esses filtros.</p>
                </div>`;
        }
    },

    toggleLoading(isLoading) {
        const container = this.elements.productGrid();
        if (container) {
            container.classList.toggle('is-loading', isLoading);
            if (isLoading) {
                container.innerHTML = '<div class="skeleton-loader"></div>'.repeat(4);
            }
        }
    }
};

export default ui;