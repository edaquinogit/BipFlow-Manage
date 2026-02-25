// static/js/state.js

export class State { // Certifique-se de que tem o 'export' antes de 'class'
    constructor() {
        this.produtos = [];
        this.carrinho = [];
        this.filtros = {
            categoria: 'todos'
        };
        console.log("✅ State inicializado com sucesso!");
    }
}