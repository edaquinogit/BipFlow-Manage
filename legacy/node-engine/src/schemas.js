/**
 * Validation Schemas - Zod
 * Type-safe validation for API payloads
 */

const { z } = require('zod');

// Schema para item de pedido
const OrderItemSchema = z.object({
  idItem: z.string().min(1, 'idItem é obrigatório'),
  quantidadeItem: z.number().positive('quantidadeItem deve ser positivo'),
  valorItem: z.number().positive('valorItem deve ser positivo')
});

// Schema para criar pedido
const CreateOrderSchema = z.object({
  numeroPedido: z.string()
    .min(1, 'numeroPedido é obrigatório')
    .regex(/^[a-zA-Z0-9\-]+$/, 'numeroPedido contém caracteres inválidos'),
  valorTotal: z.number()
    .positive('valorTotal deve ser positivo')
    .finite('valorTotal deve ser um número finito'),
  dataCriacao: z.string()
    .datetime('dataCriacao deve ser uma data ISO válida'),
  items: z.array(OrderItemSchema)
    .optional()
    .default([])
});

// Schema para resposta de sucesso
const SuccessResponseSchema = z.object({
  status: z.literal('Success'),
  orderId: z.string()
});

// Schema para resposta de erro
const ErrorResponseSchema = z.object({
  status: z.literal('Error'),
  message: z.string()
});

module.exports = {
  CreateOrderSchema,
  OrderItemSchema,
  SuccessResponseSchema,
  ErrorResponseSchema
};
