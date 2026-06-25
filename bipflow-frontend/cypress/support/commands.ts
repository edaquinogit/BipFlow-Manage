type DashboardAuthTokens = {
  access: string;
};

const normalizeApiBaseUrl = (): string => {
  // Fallback must match the page's hostname (localhost): the refresh_token
  // cookie is SameSite=Strict, and 127.0.0.1 is a different site to browsers.
  const configuredUrl = Cypress.env('apiBaseUrl') || 'http://localhost:8000/api';
  return String(configuredUrl).replace(/\/$/, '');
};

const getAdminCredentials = () => ({
  username: Cypress.env('adminUsername') || 'admin@example.com',
  password: Cypress.env('adminPassword') || 'admin123',
});

Cypress.Commands.add('loginViaApi', () => {
  const apiBaseUrl = normalizeApiBaseUrl();
  const credentials = getAdminCredentials();

  // cy.request() shares Cypress's cookie jar with the browser, so the
  // Set-Cookie response here (the httpOnly refresh_token cookie) is what
  // lets visitWithAuth()/the app's own boot-time refresh authenticate later
  // -- no token injection into page storage needed or possible anymore.
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
      const { access } = response.body;
      expect(access, 'access token').to.be.a('string').and.not.be.empty;
      const tokens = { access };
      Cypress.env('authTokens', tokens);
      return tokens;
    });
});

Cypress.Commands.add('visitWithAuth', (path = '/') => {
  const tokens = Cypress.env('authTokens') as DashboardAuthTokens | undefined;

  if (!tokens?.access) {
    throw new Error('Missing auth tokens. Call cy.loginViaApi() before cy.visitWithAuth().');
  }

  // The app restores its in-memory access token from the refresh_token
  // cookie (set by loginViaApi's request) on boot, so a plain visit suffices.
  return cy.visit(path);
});
