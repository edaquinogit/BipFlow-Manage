const transformOrderPayload = (rawData) => {
    if (!rawData || typeof rawData !== 'object') {
        throw new Error("Invalid Payload");
    }
    const rawOrderId = String(rawData.numeroPedido || "").trim();
    const orderId = rawOrderId.includes('-') ? rawOrderId.split('-')[0] : rawOrderId;

    return {
        externalReference: orderId,
        totalAmount: parseFloat(rawData.valorTotal) || 0,
        integrationDate: rawData.dataCriacao ? new Date(rawData.dataCriacao).toISOString() : new Date().toISOString(),
        payloadItems: (rawData.items || []).map(item => ({
            id: String(item.idItem),
            qty: Number(item.quantidadeItem) || 0,
            unitPrice: Number(item.valorItem) || 0
        }))
    };
};
module.exports = { transformOrderPayload };
