import { Utils } from '../utils.js';

export class CarrinhoService {
  constructor(state, dom) {
    this.state = state;
    this.dom = dom;
  }

  adicionarAoCarrinho(nome, preco) {
    const itemExistente = this.state.carrinho.find(item => item.nome === nome);
    if (itemExistente) {
      itemExistente.quantidade += 1;
    } else {
      this.state.carrinho.push({ nome, preco: parseFloat(preco), quantidade: 1 });
    }
    this.atualizarInterface();
  }

  alterarQuantidade(index, delta) {
    if (!this.state.carrinho[index]) return;
    this.state.carrinho[index].quantidade += delta;
    if (this.state.carrinho[index].quantidade <= 0) {
      this.state.carrinho.splice(index, 1);
    }
    this.atualizarInterface();
  }

  atualizarInterface() {
    this.renderizarCarrinho();
    this.calcularTotais();
  }

  renderizarCarrinho() {
    if (!this.dom.listaCarrinho) return;
    if (this.state.carrinho.length === 0) {
      this.dom.listaCarrinho.innerHTML = `
        <div class="empty-cart-state">
          <i class="fa-solid fa-basket-shopping"></i>
          <p>Seu carrinho está vazio</p>
        </div>`;
      return;
    }
    this.dom.listaCarrinho.innerHTML = this.state.carrinho.map((item, index) => `
      <div class="cart-item">
        <div class="item-info">
          <span class="cart-item__title">${item.quantidade}x ${item.nome}</span>
          <span class="cart-item__price">${Utils.formatarMoeda(item.preco * item.quantidade)}</span>
        </div>
        <div class="quantity-control">
          <button data-index="${index}" data-delta="-1" class="quantity-control__btn">-</button>
          <button data-index="${index}" data-delta="1" class="quantity-control__btn">+</button>
        </div>
      </div>
    `).join('');
  }

  calcularTotais() {
    const total = this.state.carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = this.state.carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    if (this.dom.total) this.dom.total.innerText = total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (this.dom.contador) this.dom.contador.innerText = totalItens;
  }

  toggleCarrinho() {
    if (this.dom.modal && this.dom.overlay) {
      this.dom.modal.classList.toggle('active');
      this.dom.overlay.classList.toggle('active');
      document.body.style.overflow = this.dom.modal.classList.contains('active') ? 'hidden' : 'auto';
    }
  }
}
