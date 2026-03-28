module.exports = {
    code: async (params) => {
        // Имитация Store Put — сохранить item
        const item = params.item || params;
        return { stored: true, id: item.id, value: item.value };
    },
};
