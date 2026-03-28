module.exports = {
    code: async (params) => {
        // Парсинг CSV текста в массив объектов
        const csvText = params.csvText;
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const record = {};
            for (let j = 0; j < headers.length; j++) {
                record[headers[j]] = values[j];
            }
            records.push(record);
        }
        return { records, count: records.length };
    },
};
