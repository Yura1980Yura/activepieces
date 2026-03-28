module.exports = {
    code: async (params) => {
        return {
            userCount: params.userCount,
            orderTotal: params.orderTotal,
            productCount: params.productCount,
            summary: 'Users: ' + params.userCount + ', Orders: ' + params.orderTotal + ', Products: ' + params.productCount,
        };
    },
};
