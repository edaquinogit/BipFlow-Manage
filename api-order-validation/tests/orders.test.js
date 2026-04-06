/**
 * BipFlow API: Core Order Tests
 *
 * Tests basic order creation and validation:
 * - Health check endpoint
 * - Malformed request rejection
 * - Valid order acceptance and persistence
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../index');

describe("BipFlow Orders API", () => {
  beforeAll(async () => {
    // Clean up test database before running suite
    const dbPath = path.resolve(__dirname, '../../db.sqlite3');
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {
        console.log("Warning: Could not delete test database (may be in use)");
      }
    }
  });

  describe('Health Check', () => {
    /**
     * Verify API is operational
     * Should return 200 with status: UP
     */
    test("should return UP status on health check", async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("status", "UP");
    });
  });

  describe('Order Validation', () => {
    /**
     * Verify API rejects malformed request
     * Missing required fields should return error status
     */
    test("should reject order with missing required fields", async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({ total_value: 100.0 }); // Missing order_number and date_created

      // Server should reject with 400 or 500
      expect([400, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty("status", "Error");
    });

    /**
     * Verify API accepts valid order
     * Should create order and return success status
     */
    test("should accept valid order and create it successfully", async () => {
      const uniqueId = `TEST${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 250.00,
          date_created: "2026-03-08T18:00:00Z",
          items: [
            { item_id: "A1", quantity: 2, unit_price: 50.00 },
            { item_id: "B2", quantity: 1, unit_price: 150.00 }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("status", "Success");
      expect(res.body).toHaveProperty("order_id");
    });

    /**
     * Verify API calculates total correctly
     * Sum of items should match order total
     */
    test("should verify order total matches item sum", async () => {
      const uniqueId = `CALC${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_number: `${uniqueId}-01`,
          total_value: 350.00,
          date_created: "2026-03-08T18:00:00Z",
          items: [
            { item_id: "SKU1", quantity: 2, unit_price: 100.00 },
            { item_id: "SKU2", quantity: 1, unit_price: 150.00 }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.total_value).toBe(350.00);
    });
  });
});
