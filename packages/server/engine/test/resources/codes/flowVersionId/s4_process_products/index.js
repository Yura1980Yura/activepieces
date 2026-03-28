module.exports = {
    code: async (params) => {
        // Имитация HTTP GET /api/products + подсчёт
        const products = [{ sku: 'A' }, { sku: 'B' }, { sku: 'C' }, { sku: 'D' }];
        return { products, count: products.length };
    },
};
