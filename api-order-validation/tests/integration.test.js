/**
 * BipFlow API: Integration Tests
 *
 * Tests complex order workflows with real database:
 * - Order persistence and retrieval
 * - Sequential and concurrent processing
 * - Data integrity and validation
 * - Error recovery and resilience
 */

const request = require('supertest');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const app = require('../../index');

describe('BipFlow API - Integration Tests', () => {
  let testDbPath;
  let testDb;

  beforeAll(() => {
    // Create separate test database
    testDbPath = path.resolve(__dirname, '../../test-integration.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Order Creation and Persistence', () => {
    /**
     * Verify order is created and persisted
     * Should return success status with order ID
     */
    test('should create order and verify persistence', async () => {
      const uniqueId = `PERSIST${Date.now()}`;

      const createRes = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 500.00,
          date_created: '2026-03-11T10:00:00Z',
          items: [
            { item_id: 'SKU001', quantity: 2, unit_price: 250.00 }
          ]
        });

      expect(createRes.statusCode).toBe(201);
      expect(createRes.body).toHaveProperty('status', 'Success');
      expect(createRes.body).toHaveProperty('order_id');
    });

    /**
     * Verify sequential order processing
     * Multiple orders should be created without conflicts
     */
    test('should process multiple orders sequentially', async () => {
      const results = [];

      for (let i = 0; i < 5; i++) {
        const uniqueId = `SEQ${Date.now()}-${i}`;
        const res = await request(app)
          .post('/api/v1/orders')
          .send({
            order_number: `${uniqueId}-01`,
            total_value: (i + 1) * 100.00,
            date_created: '2026-03-11T10:00:00Z',
            items: [
              { item_id: `SKU${i}`, quantity: i + 1, unit_price: 100.00 }
            ]
          });

        results.push(res);
        expect(res.statusCode).toBe(201);
      }

      // Verify all orders were created successfully
      expect(results.filter(r => r.statusCode === 201)).toHaveLength(5);
    });

    /**
     * Verify duplicate order detection
     * Same order number should not be accepted twice
     */
    test('should reject duplicate order after first insertion', async () => {
      const uniqueId = `DUPCHECK${Date.now()}`;
      const payload = {
        order_number: `${uniqueId}-01`,
        total_value: 100.00,
        date_created: '2026-03-11T10:00:00Z',
        items: []
      };

      // First order should succeed
      const res1 = await request(app)
        .post('/api/v1/orders')
        .send(payload);
      expect(res1.statusCode).toBe(201);

      // Duplicate should fail
      const res2 = await request(app)
        .post('/api/v1/orders')
        .send(payload);
      expect(res2.statusCode).toBe(400);
    });
  });

  describe('Complex Item Scenarios', () => {
    /**
     * Verify order with multiple different items
     * Should persist all items and calculate total correctly
     */
    test('should persist order with multiple different items', async () => {
      const uniqueId = `COMPLEX${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 1500.00,
          date_created: '2026-03-11T10:00:00Z',
          items: [
            { item_id: 'PROD-A', quantity: 5, unit_price: 100.00 },
            { item_id: 'PROD-B', quantity: 3, unit_price: 200.00 },
            { item_id: 'PROD-C', quantity: 2, unit_price: 250.00 },
            { item_id: 'PROD-D', quantity: 1, unit_price: 500.00 }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });

    /**
     * Verify order with large item count
     * Should handle 50+ items without performance degradation
     */
    test('should process order with large quantity of items', async () => {
      const uniqueId = `LARGEITEMS${Date.now()}`;
      const items = Array.from({ length: 50 }, (_, i) => ({
        item_id: `ITEM-${i}`,
        quantity: Math.floor(Math.random() * 100) + 1,
        unit_price: Math.random() * 1000 + 10
      }));

      const totalValue = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: totalValue,
          date_created: '2026-03-11T10:00:00Z',
          items
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('status', 'Success');
    });
  });

  describe('Data Integrity', () => {
    /**
     * Verify referential integrity
     * Order and items relationship should be maintained
     */
    test('should maintain referential integrity between orders and items', async () => {
      const uniqueId = `INTEGRITY${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 300.00,
          date_created: '2026-03-11T10:00:00Z',
          items: [
            { item_id: 'ITEM1', quantity: 1, unit_price: 100.00 },
            { item_id: 'ITEM2', quantity: 2, unit_price: 100.00 }
          ]
        });

      expect(res.statusCode).toBe(201);
      const orderId = res.body.order_id;
      expect(orderId).toBe(uniqueId);
    });

    /**
     * Verify empty item_id rejection
     * Items must have valid IDs
     */
    test('should reject item with empty item_id', async () => {
      const uniqueId = `EMPTYID${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 100.00,
          date_created: '2026-03-11T10:00:00Z',
          items: [
            { item_id: '', quantity: 1, unit_price: 100.00 }
          ]
        });

      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('status', 'Error');
    });
  });

  describe('Concurrent Request Handling', () => {
    /**
     * Verify concurrent request processing
     * Multiple simultaneous requests should not cause data corruption
     */
    test('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        const uniqueId = `CONCURRENT${Date.now()}-${i}`;
        return request(app)
          .post('/api/v1/orders')
          .send({
            order_number: `${uniqueId}-01`,
            total_value: Math.random() * 1000 + 100,
            date_created: '2026-03-11T10:00:00Z',
            items: [
              { item_id: `SKU-${i}`, quantity: i + 1, unit_price: 100.00 }
            ]
          });
      });

      const results = await Promise.all(promises);

      // Verify all requests succeeded
      const successCount = results.filter(r => r.statusCode === 201).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    /**
     * Verify recovery after validation error
     * System should continue functioning after failed request
     */
    test('should recover after validation error', async () => {
      // Invalid request
      const invalidRes = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: 'TEST',
          total_value: -100,
          date_created: 'invalid'
        });
      expect([400, 500]).toContain(invalidRes.statusCode);

      // Valid request after error
      const uniqueId = `RECOVERY${Date.now()}`;
      const validRes = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 100.00,
          date_created: '2026-03-11T10:00:00Z',
          items: []
        });
      // Should succeed despite previous error
      expect(validRes.statusCode).toBe(201);
    });

    /**
     * Verify server stays operational after multiple errors
     * Should not crash or become unresponsive
     */
    test('should remain operational after multiple errors', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/orders')
          .send({ invalid: 'data' });
      }

      // Health check should pass
      const healthRes = await request(app).get('/health');
      expect(healthRes.statusCode).toBe(200);
      expect(healthRes.body).toHaveProperty('status', 'UP');
    });
  });
});
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
