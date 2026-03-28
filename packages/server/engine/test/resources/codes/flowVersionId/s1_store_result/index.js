module.exports = {
    code: async (params) => {
        // Имитация Store Put
        const records = params.records;
        let count = 0;
        if (records && records.records) {
            count = records.records.length;
        } else if (Array.isArray(records)) {
            count = records.length;
        }
        return { key: 'etl_result', count };
    },
};
