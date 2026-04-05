import pino from "pino";

/**
 * Browser-oriented Pino instance for the SPA (see .cursorrules).
 */
export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: { asObject: true },
});

export const productsLogger = logger.child({ module: "useProducts" });

export const productFormLogger = logger.child({ module: "useProductState" });

export const productServiceLogger = logger.child({ module: "product.service" });
