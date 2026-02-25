import { Utils } from '../utils.js';

/**
 * Serviço responsável por buscar e renderizar produtos.
 * Mantém a lógica de comunicação com API isolada da manipulação do DOM.
 */
export class ProdutoService {
  constructor(state, dom, apiUrl) {
    this.state = state;
    this.dom = dom;
    this.apiUrl = apiUrl;
  }

  /**
   * Busca produtos na API e atualiza o estado.
   */
  async carregarProdutos(filtros = {}) {
    try {
      const url = this._montarUrl(filtros);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Falha na resposta da rede: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Formato de dados inválido recebido da API');
      }

      this.state.produtos = data;
      this.renderizarProdutos();

    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      this._renderizarErro();
    }
  }

  /**
   * Renderiza os produtos no container do DOM.
   */
  renderizarProdutos() {
    if (!this.dom?.container) return;

    if (!this.state.produtos.length) {
      this.dom.container.innerHTML = `
        <div class="empty-state">
          <p>Nenhum produto disponível no momento.</p>
        </div>`;
      return;
    }

    this.dom.container.innerHTML = this.state.produtos.map(prod => `
      <article class="product-card">
        <div class="product-card__image-container">
          <img src="${prod.image}" class="product-card__image" alt="${prod.name}">
        </div>
        <div class="product-card__content">
          <h3 class="product-card__title">${prod.name}</h3>
          <p class="product-card__description">${prod.description || ''}</p>
          <div class="product-card__footer">
            <span class="product-card__price">${Utils.formatarMoeda(Number(prod.price))}</span>
            <button class="product-card__add-btn" 
                    data-id="${prod.id}" 
                    data-nome="${prod.name}" 
                    data-preco="${prod.price}">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
      </article>
    `).join('');
  }

  /**
   * Monta a URL da API com filtros aplicados.
   */
  _montarUrl(filtros) {
    const params = new URLSearchParams(filtros).toString();
    return params ? `${this.apiUrl}?${params}` : this.apiUrl;
  }

  /**
   * Renderiza mensagem de erro no container.
   */
  _renderizarErro() {
    if (this.dom?.container) {
      this.dom.container.innerHTML = `
        <div class="error-state">
          <p>O cardápio está em manutenção. Tente novamente em instantes.</p>
        </div>`;
    }
  }
}
