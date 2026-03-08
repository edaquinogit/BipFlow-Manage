import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api', // Verifique se esta é a sua URL do Django
});

// INTERCEPTOR: Adiciona o token em cada requisição automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // O nome deve ser o mesmo que você usa no Login
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// INTERCEPTOR DE RESPOSTA: Se der 401 (token expirado), desloga o usuário
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login'; // Redireciona se o token falhar
    }
    return Promise.reject(error);
  }
);

export default api;