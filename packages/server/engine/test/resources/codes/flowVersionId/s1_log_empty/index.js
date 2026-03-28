module.exports = {
    code: async (params) => {
        return { message: params.message || 'No records found' };
    },
};
