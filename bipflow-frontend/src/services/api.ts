import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * INTERCEPTADOR DE REQUISIÇÃO (O "Crachá" de Acesso)
 * Antes de cada chamada sair para o Django, verificamos se temos um token.
 */
api.interceptors.request.use(
  (config) => {
    // Buscamos o token que o seu auth.service salvou no login
    const token = localStorage.getItem('token'); 
    
    if (token) {
      // Adicionamos o padrão Bearer que o Django SimpleJWT exige
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * INTERCEPTADOR DE RESPOSTA
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 500) {
      console.error("🏙️ NY Dev Alert: O Django teve um erro interno (500).");
    }
    if (error.response?.status === 401) {
      console.warn("🚫 Acesso negado ou Token expirado.");
      // Opcional: Se quiser deslogar o usuário automaticamente:
      // localStorage.removeItem('token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;