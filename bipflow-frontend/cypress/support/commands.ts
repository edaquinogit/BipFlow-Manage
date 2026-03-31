Cypress.Commands.add('loginViaApi', () => {
  cy.request({
    method: 'POST',
    url: 'http://127.0.0.1:8000/api/auth/token/', // Ajuste para sua URL de login do Django
    body: {
      username: 'admbipflow1@gmail.com', // Certifique-se que este user existe no seu db.sqlite3
      password: 'adm123'
    }
  }).then((response) => {
    window.localStorage.setItem('access_token', response.body.access);
    window.localStorage.setItem('refresh_token', response.body.refresh);
  });
});
