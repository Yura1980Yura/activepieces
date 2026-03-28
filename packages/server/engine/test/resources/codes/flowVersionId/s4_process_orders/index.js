module.exports = {
    code: async (params) => {
        // Имитация HTTP GET /api/orders + суммирование
        const orders = [{ amount: 100 }, { amount: 200 }];
        const total = orders.reduce((sum, o) => sum + o.amount, 0);
        return { orders, total };
    },
};
