const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:8080/api';
const DATA_DIR = 'd:/Antigravity/AntiGravity_Kit/magellen-responce/test-data/valid-files';

const MRX_PATH = path.join(DATA_DIR, 'MRX_TEST.BCBSMN_PRIME_CLAIMS_1772386187002.txt');
const ACK_PATH = path.join(DATA_DIR, 'TEST.MCMSMN_CLAIMS_ACK_20260209202425.txt');
const RESP_PATH = path.join(DATA_DIR, 'TEST.PRIME_BCBSMN_GEN_CLAIMS_RESP_20260204163146.txt');

// Helper to pre-calculate multipart body for autocannon
function getMultipartBuffer(filePath, fieldName = 'file') {
    const form = new FormData();
    form.append(fieldName, fs.createReadStream(filePath));
    return new Promise((resolve, reject) => {
        form.getLength((err, length) => {
            if (err) return reject(err);
            const buffer = Buffer.alloc(length);
            let offset = 0;
            form.on('data', chunk => {
                const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                b.copy(buffer, offset);
                offset += b.length;
            });
            form.on('end', () => resolve({
                body: buffer,
                contentType: `multipart/form-data; boundary=${form.getBoundary()}`
            }));
            form.resume();
        });
    });
}

async function runTest(name, config) {
    console.log(`\n>>> Testing: ${name}`);
    const result = await autocannon(config);
    console.log(`DONE: ${name} (${result.requests.average} req/s)`);
    return result;
}

async function main() {
    const mrxContent = fs.readFileSync(MRX_PATH, 'utf8');
    const ackContent = fs.readFileSync(ACK_PATH, 'utf8');
    const respContent = fs.readFileSync(RESP_PATH, 'utf8');

    const multiMrx = await getMultipartBuffer(MRX_PATH);
    const multiAck = await getMultipartBuffer(ACK_PATH);

    const allResults = {};

    // 1. Health
    allResults.health = await runTest('Health Check', {
        url: `${BASE_URL}/health`,
        connections: 10,
        duration: 5
    });

    // 2. Layouts
    allResults.layouts = await runTest('Get Layouts', {
        url: `${BASE_URL}/layouts`,
        connections: 10,
        duration: 5
    });

    // 3. Parse Text (MRX)
    allResults.parseTextMrx = await runTest('Parse Text (MRX)', {
        url: `${BASE_URL}/parse-text`,
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: mrxContent,
        connections: 10,
        duration: 10
    });

    // 4. Parse Text (ACK)
    allResults.parseTextAck = await runTest('Parse Text (ACK)', {
        url: `${BASE_URL}/parse-text`,
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: ackContent,
        connections: 10,
        duration: 5
    });

    // 5. Parse Multipart (MRX)
    allResults.parseMrx = await runTest('Parse Multipart (MRX)', {
        url: `${BASE_URL}/parse`,
        method: 'POST',
        headers: { 'content-type': multiMrx.contentType },
        body: multiMrx.body,
        connections: 5,
        duration: 10
    });

    // 6. Convert MRX to ACK
    allResults.convertMrxToAck = await runTest('Convert MRX -> ACK', {
        url: `${BASE_URL}/convert/mrx-to-ack`,
        method: 'POST',
        headers: { 'content-type': multiMrx.contentType },
        body: multiMrx.body,
        connections: 5,
        duration: 10
    });

    // 7. Convert MRX to RESP
    allResults.convertMrxToResp = await runTest('Convert MRX -> RESP', {
        url: `${BASE_URL}/convert/mrx-to-resp`,
        method: 'POST',
        headers: { 'content-type': multiMrx.contentType },
        body: multiMrx.body,
        connections: 5,
        duration: 10
    });

    // 8. Convert MRX to CSV
    allResults.convertMrxToCsv = await runTest('Convert MRX -> CSV', {
        url: `${BASE_URL}/convert/mrx-to-csv`,
        method: 'POST',
        headers: { 'content-type': multiMrx.contentType },
        body: multiMrx.body,
        connections: 5,
        duration: 10
    });

    // 9. Parse Text (RESP)
    allResults.parseTextResp = await runTest('Parse Text (RESP)', {
        url: `${BASE_URL}/parse-text`,
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: respContent,
        connections: 10,
        duration: 5
    });

    // 10. Validate
    allResults.validate = await runTest('Validate Claim', {
        url: `${BASE_URL}/validate`,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'STATUS_CHANGE',
            unitsApproved: 5,
            totalUnits: 10,
            newStatus: 'PA'
        }),
        connections: 10,
        duration: 5
    });

    // Save outputs
    const reportData = {
        timestamp: new Date().toISOString(),
        results: allResults
    };

    fs.writeFileSync('performance_report.json', JSON.stringify(reportData, null, 2));
    console.log('\nFinal report updated in performance_report.json');
}

main().catch(console.error);
