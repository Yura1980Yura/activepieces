module.exports = {
    code: async (params) => {
        return {
            key: params.key,
            orderId: params.orderId,
            customerId: params.customerId,
            amount: params.amount,
        };
    },
};
