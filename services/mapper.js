/**
 * @fileoverview BipFlow Data Transformation Engine
 * @author Ednaldo Aquino
 * @version 1.1.2
 * * DESIGN PRINCIPLES:
 * - Data Mapper Pattern: Decoupling inbound Jitterbit payloads from internal SQL schemas.
 * - Idempotency Prep: Sanitizing 'numeroPedido' to ensure unique constraints in SQLite.
 * - Precision Handling: Strict casting for currency (Float) and inventory (Integer).
 */

/**
 * Executes a deep transform on raw inbound data.
 * Designed to meet Jitterbit Professional Services standards (Assessment Page 16).
 * * @param {Object} rawData - The raw JSON body from the POST request.
 * @returns {Object} A structured object ready for 'Orders' and 'Items' table insertion.
 * @throws {Error} Detailed mapping or validation exceptions.
 */
const transform = (rawData) => {
    
    // GUARD CLAUSE: Strict object validation
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        throw new Error("MAPPING_ERR_INVALID_TYPE: Expected a non-null JSON object.");
    }

    // NORMALIZATION: Support both direct payloads and wrapped 'order' objects.
    // As per Page 11 of Jitterbit specs.
    const order = rawData.order || rawData;

    if (!order.numeroPedido) {
        throw new Error("MAPPING_ERR_MISSING_KEY: Mandatory field 'numeroPedido' is absent.");
    }

    /**
     * BUSINESS LOGIC: Reference Sanitization
     * Requirement: v10089015vdb-01 -> v10089015vdb
     * Why: Prevents duplicate orders if Jitterbit retries with different suffixes.
     */
    const rawId = String(order.numeroPedido).trim();
    const orderId = rawId.split('-')[0];

    try {
        // Mapped Object following the target schema (Page 16)
        const mapped = {
            // Table: Orders
            externalReference: orderId,
            totalAmount: Number(order.valorTotal) || 0.0,
            
            // ISO-8601 Normalization for UTC consistency
            integrationDate: order.dataCriacao 
                ? new Date(order.dataCriacao).toISOString() 
                : new Date().toISOString(),
            
            // Table: Items (Sub-resource transformation)
            payloadItems: (order.items || []).map((item, index) => {
                const itemRef = String(item.idItem || `TMP-${index}`).trim();
                return {
                    id: itemRef,
                    qty: Math.max(0, parseInt(item.quantidadeItem, 10) || 0),
                    unitPrice: Number(item.valorItem) || 0.0
                };
            })
        };

        // Senior Observability: Non-blocking log for audit trails
        console.info(`[SUCCESS] Mapper: Processed reference ${orderId} with ${mapped.payloadItems.length} items.`);
        
        return mapped;

    } catch (err) {
        // Critical failure logging for SRE teams
        console.error(`[CRITICAL] Transformation logic failed for Ref: ${orderId} | ${err.message}`);
        throw new Error(`INTERNAL_TRANSFORM_EXCEPTION: Check data types or item array integrity.`);
    }
};

/**
 * Standard Node.js export for the Integration Engine (index.js).
 */
module.exports = { transform };