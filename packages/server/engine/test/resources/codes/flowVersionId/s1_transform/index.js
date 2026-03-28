module.exports = {
    code: async (params) => {
        // Трансформация: добавить processed=true к каждой записи
        const records = params.records;
        let inputRecords = records;
        if (records && records.records) {
            inputRecords = records.records;
        }
        const transformed = (inputRecords || []).map((r) => ({
            ...r,
            processed: true,
        }));
        return { records: transformed, count: transformed.length };
    },
};
