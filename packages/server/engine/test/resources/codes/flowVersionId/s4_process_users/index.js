module.exports = {
    code: async (params) => {
        // Имитация HTTP GET /api/users + подсчёт
        const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
        return { users, count: users.length };
    },
};
