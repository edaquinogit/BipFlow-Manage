export class Dom {
    constructor() {
        // 1. Mapear os elementos do HTML
        this.produtosContainer = document.getElementById('produtos-container');
        this.filterForm = document.getElementById('filters-form');
        this.menuToggle = document.getElementById('menu-toggle');
        this.closeSidebar = document.getElementById('close-sidebar');
        this.sidebar = document.getElementById('filters-sidebar');
        this.overlay = document.getElementById('sidebar-overlay');
        
        console.log('🏙️ BipFlow: DOM Initialized!');
        
        // 2. Inicializar os ouvintes de clique
        this.initEvents(); 
    }

    // Gerencia a abertura e fechamento da Sidebar
    initEvents() {
        if (this.menuToggle && this.sidebar) {
            this.menuToggle.onclick = () => {
                this.sidebar.classList.add('active');
                if (this.overlay) this.overlay.classList.add('active');
                console.log("🏙️ NY Style: Sidebar aberta!");
            };
        }

        if (this.closeSidebar) {
            this.closeSidebar.onclick = () => {
                this.sidebar.classList.remove('active');
                if (this.overlay) this.overlay.classList.remove('active');
                console.log("🏙️ BipFlow: Sidebar fechada!");
            };
        }

        // Fecha ao clicar no fundo escuro
        if (this.overlay) {
            this.overlay.onclick = () => {
                this.sidebar.classList.remove('active');
                this.overlay.classList.remove('active');
            };
        }
    }

    getActiveFilters() {
        if (!this.filterForm) return [];
        const checkboxes = this.filterForm.querySelectorAll('input[name="category"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    showLoading() {
        if (this.produtosContainer) {
            this.produtosContainer.innerHTML = '<div>Buscando delícias...</div>';
        }
    }

    renderProducts(products) {
        if (!this.produtosContainer) return;
        this.produtosContainer.innerHTML = products.map(p => `
            <div class="product-card">
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <div class="product-footer">
                    <span>R$ ${parseFloat(p.price).toFixed(2)}</span>
                    <button class="add-btn">+</button>
                </div>
            </div>
        `).join('');
    }
}