module.exports = {
    code: async (params) => {
        // Нормализация формата данных
        const data = params.data || params;
        return {
            type: data.type,
            orderId: data.orderId,
            amount: data.amount,
            customerId: data.customerId,
            customerName: data.customerName,
            normalizedAt: '2026-03-28T00:00:00Z',
        };
    },
};
