module.exports = {
    code: async (params) => {
        // Имитация HTTP GET — возврат списка items
        return {
            items: [
                { id: 'item-1', value: 10 },
                { id: 'item-2', value: 20 },
                { id: 'item-3', value: 30 },
            ],
            count: 3,
        };
    },
};
