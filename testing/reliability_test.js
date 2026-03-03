const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:8080/api';
const INVALID_DATA_DIR = 'd:/Antigravity/AntiGravity_Kit/magellen-responce/test-data/invalid-files';

async function testInvalidFile(fileName) {
    const filePath = path.join(INVALID_DATA_DIR, fileName);
    const results = { fileName, tests: [] };

    console.log(`\n--- Testing Invalid File: ${fileName} ---`);

    // 1. Test Multipart Parse
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        const response = await axios.post(`${BASE_URL}/parse`, form, {
            headers: form.getHeaders()
        });
        
        const summary = response.data.summary;
        const isInvalid = response.data.detectedSchema === 'INVALID' || (summary && summary.invalid > 0);
        
        results.tests.push({
            name: 'Multipart Parse',
            status: response.status,
            detectedSchema: response.data.detectedSchema,
            invalidLines: summary ? summary.invalid : 'N/A',
            wasCaughtAsInvalid: isInvalid
        });
        console.log(`[Multipart Parse] Received ${response.status}. Detected Schema: ${response.data.detectedSchema}. Invalid Lines: ${summary ? summary.invalid : 0}`);
    } catch (err) {
        results.tests.push({
            name: 'Multipart Parse',
            error: err.response ? err.response.status : err.message,
            wasCaughtAsInvalid: true
        });
        console.log(`[Multipart Parse] Caught error: ${err.response ? err.response.status : err.message}`);
    }

    // 2. Test Conversion (Assuming MRX for MRX files, else skip)
    if (fileName.toUpperCase().includes('MRX')) {
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));
            const response = await axios.post(`${BASE_URL}/convert/mrx-to-ack`, form, {
                headers: form.getHeaders()
            });
            results.tests.push({
                name: 'MRX to ACK Conversion',
                status: response.status,
                wasCaughtAsInvalid: false
            });
            console.log(`[Conversion] Warning: MRX -> ACK succeeded with 200 on an invalid file.`);
        } catch (err) {
            results.tests.push({
                name: 'MRX to ACK Conversion',
                error: err.response ? err.response.status : err.message,
                wasCaughtAsInvalid: true
            });
            console.log(`[Conversion] Correctly caught error: ${err.response ? err.response.status : err.message}`);
        }
    }

    return results;
}

async function main() {
    const files = fs.readdirSync(INVALID_DATA_DIR);
    const allResults = [];

    for (const file of files) {
        if (fs.statSync(path.join(INVALID_DATA_DIR, file)).isFile()) {
            const res = await testInvalidFile(file);
            allResults.push(res);
        }
    }

    fs.writeFileSync('reliability_report.json', JSON.stringify(allResults, null, 2));
    console.log('\nReliability report saved to reliability_report.json');

    // Generate MD Summary
    let md = `# Reliability Test Report (Negative Testing)\n\n`;
    allResults.forEach(res => {
        md += `## File: ${res.fileName}\n`;
        res.tests.forEach(t => {
            md += `- **${t.name}**: ${t.wasCaughtAsInvalid ? '✅ Correctly Rejected/Flagged' : '❌ Failed to Flag'}\n`;
            if (t.error) md += `  - Error: ${t.error}\n`;
            if (t.detectedSchema) md += `  - Schema: ${t.detectedSchema}\n`;
            if (t.invalidLines !== undefined) md += `  - Invalid Lines: ${t.invalidLines}\n`;
        });
        md += `\n`;
    });
    fs.writeFileSync('reliability_report.md', md);
}

main().catch(console.error);
