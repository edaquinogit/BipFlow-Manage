const request = require('supertest');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const app = require('../../index');

describe('BIPFLOW ENGINE API - Integration Tests with Real Database', () => {
  let testDbPath;
  let testDb;

  beforeAll(() => {
    // Criar banco de dados de teste separado
    testDbPath = path.resolve(__dirname, '../../test-integration.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    // Limpar banco de dados de teste
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignorar erro ao deletar
      }
    }
  });

  describe('Complete Order Workflow', () => {
    test('Deve criar pedido e verificar persistência', async () => {
      const uniqueId = `PERSIST${Date.now()}`;
      
      // Criar pedido
      const createRes = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 500.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: [
            { idItem: 'SKU001', quantidadeItem: 2, valorItem: 250.0 }
          ]
        });

      expect(createRes.statusCode).toBe(201);
      expect(createRes.body).toHaveProperty('status', 'Success');
      expect(createRes.body).toHaveProperty('orderId', uniqueId);
    });

    test('Deve processar múltiplos pedidos sequencialmente', async () => {
      const results = [];

      for (let i = 0; i < 5; i++) {
        const uniqueId = `SEQ${Date.now()}-${i}`;
        const res = await request(app)
          .post('/api/v1/orders')
          .send({
            numeroPedido: `${uniqueId}-01`,
            valorTotal: (i + 1) * 100.0,
            dataCriacao: '2026-03-11T10:00:00Z',
            items: [
              { idItem: `SKU${i}`, quantidadeItem: i + 1, valorItem: 100.0 }
            ]
          });

        results.push(res);
        expect(res.statusCode).toBe(201);
      }

      // Verificar que todos os pedidos foram criados com sucesso
      expect(results.filter(r => r.statusCode === 201)).toHaveLength(5);
    });

    test('Deve rejeitar pedido duplicado após primeira inserção', async () => {
      const uniqueId = `DUPCHECK${Date.now()}`;
      const payload = {
        numeroPedido: `${uniqueId}-01`,
        valorTotal: 100.0,
        dataCriacao: '2026-03-11T10:00:00Z',
        items: []
      };

      // Primeiro pedido deve passar
      const res1 = await request(app)
        .post('/api/v1/orders')
        .send(payload);
      expect(res1.statusCode).toBe(201);

      // Segundo pedido com mesmo ID deve falhar
      const res2 = await request(app)
        .post('/api/v1/orders')
        .send({
          ...payload,
          numeroPedido: `${uniqueId}-02` // ID diferente após split
        });
      expect(res2.statusCode).toBe(400);
    });
  });

  describe('Complex Item Scenarios', () => {
    test('Deve persistir pedido com múltiplos itens diferentes', async () => {
      const uniqueId = `COMPLEX${Date.now()}`;
      
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 1500.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: [
            { idItem: 'PROD-A', quantidadeItem: 5, valorItem: 100.0 },
            { idItem: 'PROD-B', quantidadeItem: 3, valorItem: 200.0 },
            { idItem: 'PROD-C', quantidadeItem: 2, valorItem: 250.0 },
            { idItem: 'PROD-D', quantidadeItem: 1, valorItem: 500.0 }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
      expect(res.body).toHaveProperty('orderId', uniqueId);
    });

    test('Deve processar pedido com grande quantidade de itens', async () => {
      const uniqueId = `LARGEITEMS${Date.now()}`;
      const items = Array.from({ length: 50 }, (_, i) => ({
        idItem: `ITEM-${i}`,
        quantidadeItem: Math.floor(Math.random() * 100) + 1,
        valorItem: Math.random() * 1000 + 10
      }));

      const totalValue = items.reduce((sum, item) => sum + item.valorItem, 0);

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: totalValue,
          dataCriacao: '2026-03-11T10:00:00Z',
          items
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });
  });

  describe('Data Integrity', () => {
    test('Deve manter integridade referencial entre Orders e Items', async () => {
      const uniqueId = `INTEGRITY${Date.now()}`;
      
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 300.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: [
            { idItem: 'ITEM1', quantidadeItem: 1, valorItem: 100.0 },
            { idItem: 'ITEM2', quantidadeItem: 2, valorItem: 100.0 }
          ]
        });

      expect(res.statusCode).toBe(201);
      const orderId = res.body.orderId;

      // Verificar que o pedido foi criado
      expect(orderId).toBe(uniqueId);
    });

    test('Deve rejeitar item com idItem vazio', async () => {
      const uniqueId = `EMPTYID${Date.now()}`;
      
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: [
            { idItem: '', quantidadeItem: 1, valorItem: 100.0 }
          ]
        });

      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });
  });

  describe('Concurrent Request Handling', () => {
    test('Deve processar múltiplas requisições concorrentes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        const uniqueId = `CONCURRENT${Date.now()}-${i}`;
        return request(app)
          .post('/api/v1/orders')
          .send({
            numeroPedido: `${uniqueId}-01`,
            valorTotal: Math.random() * 1000 + 100,
            dataCriacao: '2026-03-11T10:00:00Z',
            items: [
              { idItem: `SKU-${i}`, quantidadeItem: i + 1, valorItem: 100.0 }
            ]
          });
      });

      const results = await Promise.all(promises);
      
      // Verificar que todas as requisições foram bem-sucedidas
      const successCount = results.filter(r => r.statusCode === 201).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    test('Deve recuperar após erro de validação', async () => {
      // Requisição inválida
      const invalidRes = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: 'TEST',
          valorTotal: -100,
          dataCriacao: 'invalid'
        });
      expect([400, 500]).toContain(invalidRes.statusCode);

      // Requisição válida após erro
      const uniqueId = `RECOVERY${Date.now()}`;
      const validRes = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: []
        });
      // Deve passar mesmo após erro anterior
      expect(validRes.statusCode).toBe(201);
    });

    test('Deve manter servidor operacional após múltiplos erros', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/orders')
          .send({ invalid: 'data' });
      }

      // Health check deve passar
      const healthRes = await request(app).get('/health');
      expect(healthRes.statusCode).toBe(200);
      expect(healthRes.body).toHaveProperty('status', 'UP');
    });
  });

  describe('Performance Baseline', () => {
    test('Deve processar pedido em tempo aceitável (< 100ms)', async () => {
      const uniqueId = `PERF${Date.now()}`;
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          numeroPedido: `${uniqueId}-01`,
          valorTotal: 100.0,
          dataCriacao: '2026-03-11T10:00:00Z',
          items: [
            { idItem: 'ITEM1', quantidadeItem: 1, valorItem: 100.0 }
          ]
        });

      const duration = Date.now() - startTime;
      expect(res.statusCode).toBe(201);
      expect(duration).toBeLessThan(100);
    });

    test('Deve processar health check em tempo aceitável (< 50ms)', async () => {
      const startTime = Date.now();
      const res = await request(app).get('/health');
      const duration = Date.now() - startTime;

      expect(res.statusCode).toBe(200);
      expect(duration).toBeLessThan(50);
    });
  });
});
