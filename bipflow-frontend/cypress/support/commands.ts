type DashboardAuthTokens = {
  access: string;
  refresh: string;
};

const normalizeApiBaseUrl = (): string => {
  const configuredUrl = Cypress.env('apiBaseUrl') || 'http://127.0.0.1:8000/api';
  return String(configuredUrl).replace(/\/$/, '');
};

const getAdminCredentials = () => ({
  username: Cypress.env('adminUsername') || 'admin@example.com',
  password: Cypress.env('adminPassword') || 'admin123',
});

const persistTokens = (win: Window, tokens: DashboardAuthTokens): void => {
  win.localStorage.setItem('access_token', tokens.access);
  win.localStorage.setItem('refresh_token', tokens.refresh);
};

Cypress.Commands.add('loginViaApi', () => {
  const apiBaseUrl = normalizeApiBaseUrl();
  const credentials = getAdminCredentials();

  return cy
    .request<DashboardAuthTokens>({
      method: 'POST',
      url: `${apiBaseUrl}/auth/token/`,
      body: {
        username: credentials.username,
        password: credentials.password,
      },
    })
    .then((response) => {
      const { access, refresh } = response.body;
      expect(access, 'access token').to.be.a('string').and.not.be.empty;
      expect(refresh, 'refresh token').to.be.a('string').and.not.be.empty;
      const tokens = { access, refresh };
      Cypress.env('authTokens', tokens);
      return tokens;
    });
});

Cypress.Commands.add('visitWithAuth', (path = '/') => {
  const tokens = Cypress.env('authTokens') as DashboardAuthTokens | undefined;

  if (!tokens?.access || !tokens?.refresh) {
    throw new Error('Missing auth tokens. Call cy.loginViaApi() before cy.visitWithAuth().');
  }

  return cy.visit(path, {
    onBeforeLoad(win) {
      persistTokens(win, tokens);
    },
  });
});
