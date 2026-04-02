Cypress.Commands.add('loginViaApi', () => {
  cy.request({
    method: 'POST',
    url: 'http://127.0.0.1:8000/api/auth/token/', // URL que vimos no seu log anterior
    body: {
      username: 'admbipflow@gmail.com', // Ajuste conforme seu usuário de teste
      password: 'adm123'
    }
  }).then((response) => {
    // Injetamos em múltiplas chaves comuns para garantir compatibilidade
    const token = response.body.access || response.body.token;
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('access_token', token);
    
    // Log para confirmar no console do Cypress
    cy.log('Token injetado com sucesso');
  });
});
