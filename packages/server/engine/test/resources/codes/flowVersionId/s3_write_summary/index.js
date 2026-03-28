module.exports = {
    code: async (params) => {
        // Запись итогового summary
        const totalItems = params.totalItems || 0;
        return {
            summary: 'Processed ' + totalItems + ' items',
            totalItems: totalItems,
        };
    },
};
