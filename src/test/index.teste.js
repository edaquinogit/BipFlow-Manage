const request = require('supertest');
const app = require('../index'); // importa o app do index.js

describe("BIPFLOW ENGINE API", () => {
  
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
    const res = await request(app)
      .post('/api/v1/orders')
      .send({
        numeroPedido: "123-01",
        valorTotal: 250.0,
        dataCriacao: "2026-03-08T18:00:00Z",
        items: [
          { idItem: "A1", quantidadeItem: 2, valorItem: 50.0 },
          { idItem: "B2", quantidadeItem: 1, valorItem: 150.0 }
        ]
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("status", "Success");
    expect(res.body).toHaveProperty("orderId", "123");
  });
});