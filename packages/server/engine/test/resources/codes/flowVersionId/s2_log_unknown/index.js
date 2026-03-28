module.exports = {
    code: async (params) => {
        return { message: params.message, data: params.data };
    },
};
