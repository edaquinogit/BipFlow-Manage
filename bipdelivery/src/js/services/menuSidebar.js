/**
 * Serviço responsável por controlar o menu lateral (sidebar) e aplicar filtros de comida.
 * Garante acessibilidade, animações suaves e integração com o estado global.
 */
export class MenuSidebar {
  constructor(state, dom, produtoService) {
    this.state = state;
    this.dom = dom;
    this.produtoService = produtoService;
  }

  /**
   * Inicializa os eventos do menu e filtros.
   */
  init() {
    this._configurarToggle();
    this._configurarOverlay();
    this._configurarAcessibilidade();
    this._configurarFiltros();
  }

  /**
   * Configura o botão de abrir/fechar menu.
   */
  _configurarToggle() {
    if (this.dom?.toggleBtn && this.dom?.sidebar && this.dom?.overlay) {
      this.dom.toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }
  }

  /**
   * Configura o clique no overlay para fechar menu.
   */
  _configurarOverlay() {
    if (this.dom?.overlay) {
      this.dom.overlay.addEventListener('click', () => this.closeSidebar());
    }
  }

  /**
   * Configura acessibilidade (tecla ESC fecha menu).
   */
  _configurarAcessibilidade() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeSidebar();
      }
    });
  }

  /**
   * Configura os filtros de comida (checkboxes).
   */
  _configurarFiltros() {
    if (!this.dom?.filtros) return;

    this.dom.filtros.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this._atualizarFiltros();
      });
    });
  }

  /**
   * Atualiza o estado dos filtros e recarrega produtos.
   */
  _atualizarFiltros() {
    this.state.filtros = {};

    this.dom.filtros.forEach(checkbox => {
      if (checkbox.checked) {
        this.state.filtros[checkbox.value] = true;
      }
    });

    // Recarrega produtos aplicando filtros
    this.produtoService.carregarProdutos(this.state.filtros);
  }

  /**
 * Alterna visibilidade do sidebar.
 */
toggleSidebar() {
    // 1. Proteção: Se os elementos não existirem, para aqui.
    if (!this.dom?.sidebar || !this.dom?.overlay) {
        console.warn("⚠️ BipFlow: Elementos da sidebar não encontrados.");
        return;
    }

    // 2. Alterna a classe 'active' (O CSS novo cuidará do resto)
    const isActive = this.dom.sidebar.classList.toggle('active');
    
    // 3. Sincroniza o overlay com o estado da sidebar
    this.dom.overlay.classList.toggle('active', isActive);

    // 4. Trava o scroll da página quando o menu está aberto (UX Premium)
    document.body.style.overflow = isActive ? 'hidden' : '';
}

  /**
   * Fecha o sidebar.
   */
  closeSidebar() {
    if (!this.dom?.sidebar || !this.dom?.overlay) return;

    this.dom.sidebar.classList.remove('active');
    this.dom.overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
}
