export const ui = {
    elements: {
        productGrid: () => document.getElementById('product-grid'),
        sidebar: () => document.getElementById('sidebar'),
        overlay: () => document.getElementById('overlay')
    },
    renderEmptyState() {
        const container = this.elements.productGrid();
        if (container) {
            container.innerHTML = `<div class="empty-state"><p>Nenhum produto encontrado.</p></div>`;
        }
    },
    toggleLoading(isLoading) {
        const container = this.elements.productGrid();
        if (container) container.style.opacity = isLoading ? '0.5' : '1';
    }
};

export class Utils {
    static formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }
}