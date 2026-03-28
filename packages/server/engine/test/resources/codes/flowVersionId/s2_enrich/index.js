module.exports = {
    code: async (params) => {
        // Имитация обогащения данных из внешнего API
        return {
            type: params.type,
            orderId: params.orderId,
            amount: params.amount,
            customerId: 'CUST-456',
            customerName: 'Test User',
        };
    },
};
