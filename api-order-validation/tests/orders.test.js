const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../index');

describe("BIPFLOW ENGINE API", () => {
  beforeAll(async () => {
    const dbPath = path.resolve(__dirname, '../../db.sqlite3');
    // Forçar fechamento de conexões se necessário (em ambientes de teste persistentes)
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {
        console.log("Aviso: Não foi possível deletar o DB, pode estar em uso.");
      }
    }
  });

  test("Health check deve retornar UP", async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "UP");
  });

  test("Deve rejeitar pedido malformado", async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send({ valorTotal: 100.0 }); // faltando numeroPedido
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("status", "Error");
  });

  test("Deve aceitar pedido válido", async () => {
    const uniqueId = `TEST${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/orders')
      .send({
        numeroPedido: `${uniqueId}-01`,
        valorTotal: 250.0,
        dataCriacao: "2026-03-08T18:00:00Z",
        items: [
          { idItem: "A1", quantidadeItem: 2, valorItem: 50.0 },
          { idItem: "B2", quantidadeItem: 1, valorItem: 150.0 }
        ]
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("status", "Success");
    expect(res.body).toHaveProperty("orderId", uniqueId);
  });
});