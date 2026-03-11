const request = require('supertest');
const app = require('../../index');

describe('BIPFLOW ENGINE API - Edge Cases & Error Handling', () => {
  describe('POST /api/v1/orders - Validation Edge Cases', () => {
    test('Deve rejeitar numeroPedido vazio', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: '',
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: []
        });
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });

    test('Deve rejeitar valorTotal negativo', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: 'TEST-01',
          valorTotal: -100.0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: []
        });
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });

    test('Deve rejeitar valorTotal zero', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: 'TEST-01',
          valorTotal: 0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: []
        });
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });

    test('Deve rejeitar dataCriacao inválida', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: 'TEST-01',
          valorTotal: 100.0,
          dataCriacao: 'data-invalida',
          items: []
        });
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });

    test('Deve rejeitar item com quantidadeItem negativa', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: 'TEST-01',
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: [
            { idItem: 'A1', quantidadeItem: -1, valorItem: 50.0 }
          ]
        });
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });

    test('Deve rejeitar item com valorItem zero', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: 'TEST-01',
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: [
            { idItem: 'A1', quantidadeItem: 1, valorItem: 0 }
          ]
        });
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });

    test('Deve aceitar numeroPedido com hífens e números', async () => {
      const uniqueId = `VALID${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: []
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });

    test('Deve aceitar payload com campos extras (Zod ignora)', async () => {
      const uniqueId = `EXTRA${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T00:00:00Z',
          items: [],
          campoExtra: 'valor'
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });
  });

  describe('GET /health - Edge Cases', () => {
    test('Deve retornar 200 com status UP', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'UP');
      expect(res.body).toHaveProperty('timestamp');
    });

    test('Deve retornar timestamp válido', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      const timestamp = new Date(res.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('404 Handler', () => {
    test('Deve retornar 404 para rota inexistente', async () => {
      const res = await request(app).get('/api/v1/inexistente');
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('status', 'Error');
      expect(res.body.message).toContain('não encontrada');
    });

    test('Deve retornar 404 para POST em rota inexistente', async () => {
      const res = await request(app)
        .post('/api/v2/orders')
        .send({ test: 'data' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Multiple Items Handling', () => {
    test('Deve aceitar múltiplos itens no pedido', async () => {
      const uniqueId = `MULTI${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 300.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: [
            { idItem: 'A1', quantidadeItem: 2, valorItem: 50.0 },
            { idItem: 'B2', quantidadeItem: 1, valorItem: 100.0 },
            { idItem: 'C3', quantidadeItem: 3, valorItem: 50.0 }
          ]
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
      expect(res.body).toHaveProperty('orderId', uniqueId);
    });

    test('Deve aceitar pedido sem itens', async () => {
      const uniqueId = `NOITEMS${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T10:00:00Z'
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });

    test('Deve aceitar array vazio de itens', async () => {
      const uniqueId = `EMPTYITEMS${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: []
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });
  });

  describe('Numeric Edge Cases', () => {
    test('Deve aceitar valorTotal com muitas casas decimais', async () => {
      const uniqueId = `DECIMAL${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 123.456789,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: []
        });
      expect(res.statusCode).toBe(201);
    });

    test('Deve aceitar valores monetários grandes', async () => {
      const uniqueId = `LARGE${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 999999.99,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: []
        });
      expect(res.statusCode).toBe(201);
    });
  });
});
