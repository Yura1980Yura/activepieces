module.exports = {
    code: async (params) => {
        // Трансформация item — добавить processed=true
        const item = params.item || params;
        return { ...item, processed: true };
    },
};
