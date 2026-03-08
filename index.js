const express = require('express');
const { transformOrderPayload } = require('./services/mapper');
const app = express();
app.use(express.json());

app.post('/api/v1/orders', (req, res) => {
    try {
        const mappedData = transformOrderPayload(req.body);
        console.log(`[SUCCESS] Mapped: ${mappedData.externalReference}`);
        return res.status(201).json({ status: "Success", data: mappedData });
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        return res.status(400).json({ status: "Error", message: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Engine Online: http://localhost:${PORT}`);
});
