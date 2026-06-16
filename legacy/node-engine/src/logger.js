/**
 * Logger Configuration - Pino
 * Structured logging for production-grade observability
 */

const pino = require('pino');

// Configurar transporte baseado no ambiente
const transport = process.env.NODE_ENV === 'production'
  ? pino.transport({
      target: 'pino/file',
      options: { destination: './logs/app.log' }
    })
  : pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false
      }
    });

// Criar logger com configuração apropriada
const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      }
    }
  },
  transport
);

module.exports = logger;
