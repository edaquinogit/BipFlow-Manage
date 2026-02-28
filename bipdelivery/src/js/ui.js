/**
 * Objeto UI: Responsável exclusivo por alterações no DOM e gerenciamento visual.
 * Centralizar aqui facilita o debug via DevTools e a manutenção.
 */
export const ui = {
    // 1. Cache de Elementos: Evita buscas repetitivas no DOM
    elements: {
        productGrid: () => document.getElementById('product-grid'),
        sidebar: () => document.getElementById('sidebar'),
        overlay: () => document.getElementById('overlay'),
        countBadge: () => document.getElementById('cart-count')
    },

    // 2. Renderização de Estados
    renderEmptyState() {
        const container = this.elements.productGrid();
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-search" style="font-size: 2rem; color: #ccc;"></i>
                    <p>Nenhum produto encontrado para estes filtros.</p>
                </div>`;
        }
    },

    // 3. Feedback Visual (UX Premium)
    toggleLoading(isLoading) {
        const container = this.elements.productGrid();
        if (container) {
            container.style.opacity = isLoading ? '0.5' : '1';
            container.style.pointerEvents = isLoading ? 'none' : 'auto';
        }
    },

    // 4. Utilitários de Interface
    updateCartBadge(count) {
        const badge = this.elements.countBadge();
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    }
};

// Exportação padrão para facilitar o import no app.js
export default ui;