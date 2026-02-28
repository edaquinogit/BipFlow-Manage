const state = {
    produtos: [],
    filtros: [],
    carrinho: JSON.parse(localStorage.getItem('bipflow_cart')) || []
};
export default state;