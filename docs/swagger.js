const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'BipFlow Manage - Integration Engine',
            version: '1.0.2',
            description: 'API de Integração profissional focada em transformação de dados (Mapping) e persistência em SQLite.',
            contact: {
                name: 'Ednaldo Aquino',
                url: 'https://github.com/edaquinogit/BipFlow-Manage'
            }
        },
        servers: [
            { 
                url: 'http://localhost:3000',
                description: 'Local Production Server'
            }
        ],
        components: {
            schemas: {
                Item: {
                    type: 'object',
                    properties: {
                        idItem: { type: 'string', example: 'SKU-990' },
                        quantidadeItem: { type: 'integer', example: 2 },
                        valorItem: { type: 'number', example: 100.00 }
                    }
                },
                OrderRequest: {
                    type: 'object',
                    required: ['numeroPedido', 'valorTotal', 'dataCriacao'],
                    properties: {
                        numeroPedido: { 
                            type: 'string', 
                            example: 'v10089015vdb-01',
                            description: 'ID original do pedido que será sanitizado pelo motor.'
                        },
                        valorTotal: { 
                            type: 'number', 
                            example: 285.90 
                        },
                        dataCriacao: { 
                            type: 'string', 
                            format: 'date-time',
                            example: '2026-03-08T12:00:00Z' 
                        },
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Item' }
                        }
                    }
                },
                OrderResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'Success' },
                        orderId: { type: 'string', example: 'v10089015vdb' }
                    }
                }
            }
        },
        paths: {
            '/api/v1/orders': {
                post: {
                    tags: ['Orders'],
                    summary: 'Integra um novo pedido (Jitterbit Flow)',
                    description: 'Recebe o payload bruto, sanitiza o numeroPedido (remove sufixos) e persiste os dados e itens no banco SQLite.',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/OrderRequest' }
                            }
                        }
                    },
                    responses: {
                        201: { 
                            description: 'Pedido processado e persistido com sucesso.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/OrderResponse' }
                                }
                            }
                        },
                        400: { 
                            description: 'Erro de validação ou duplicidade de dados.' 
                        }
                    }
                }
            },
            '/health': {
                get: {
                    tags: ['Monitoring'],
                    summary: 'Verifica o status da API',
                    responses: {
                        200: { 
                            description: 'API está online',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'UP' },
                                            timestamp: { type: 'string', example: '2026-03-08T12:00:00Z' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    apis: [] 
};

module.exports = swaggerJsDoc(swaggerOptions);