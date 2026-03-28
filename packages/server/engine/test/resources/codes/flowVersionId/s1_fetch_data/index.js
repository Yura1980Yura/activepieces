module.exports = {
    code: async (params) => {
        // Имитация HTTP GET — возврат CSV данных
        return {
            body: 'name,email,age\nAlice,alice@test.com,30\nBob,bob@test.com,25\nCharlie,charlie@test.com,35',
            statusCode: 200,
        };
    },
};
