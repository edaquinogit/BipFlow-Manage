/**
 * Serviço responsável por controlar o menu lateral (sidebar).
 */
export class MenuSidebar {
    constructor(state, dom, produtoService) {
        this.state = state;
        this.dom = dom; // Aqui recebemos o objeto 'ui.elements'
        this.produtoService = produtoService;
    }

    init() {
        this._configurarToggle();
        this._configurarOverlay();
        this._configurarAcessibilidade();
    }

    _configurarToggle() {
    // Usamos um intervalo curto para garantir que o DOM está pronto
    const interval = setInterval(() => {
        const trigger = document.querySelector('.menu-toggle');
        
        if (trigger) {
            console.log("✅ Botão encontrado!");
            trigger.onclick = (e) => {
                e.preventDefault();
                this.toggleSidebar();
            };
            clearInterval(interval); // Para de procurar quando achar
        }
    }, 100); // Procura a cada 100ms
}

    _configurarOverlay() {
        const overlay = this.dom.overlay();
        if (overlay) {
            overlay.addEventListener('click', () => this.closeSidebar());
        }
    }

    _configurarAcessibilidade() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.closeSidebar();
        });
    }

    toggleSidebar() {
        const sidebar = this.dom.sidebar();
        const overlay = this.dom.overlay();
        
        if (sidebar && overlay) {
            const isActive = sidebar.classList.toggle('active');
            overlay.classList.toggle('active', isActive);
            document.body.style.overflow = isActive ? 'hidden' : '';
        }
    }

    closeSidebar() {
        const sidebar = this.dom.sidebar();
        const overlay = this.dom.overlay();
        
        if (sidebar && overlay) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
}