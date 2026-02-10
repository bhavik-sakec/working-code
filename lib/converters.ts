
import { ParseResult, ParsedLine } from './ack-parser';

function getFieldValue(line: ParsedLine, fieldName: string): string {
    const field = line.fields.find(f => f.def.name === fieldName);
    return field ? field.value.trim() : '';
}

function pad(value: string | number, length: number, char: string = ' ', align: 'left' | 'right' = 'left'): string {
    const str = String(value);
    if (str.length >= length) return str.slice(0, length);
    const padding = char.repeat(length - str.length);
    return align === 'left' ? str + padding : padding + str;
}

export function convertMrxToAck(mrxResult: ParseResult, timestamp: string): string {
    const lines: string[] = [];
    const dateStr = timestamp.slice(0, 8); // YYYYMMDD
    const timeStr = timestamp.slice(8, 14) || '000000'; // HHMMSS

    // MRX Header
    const mrxHeader = mrxResult.lines.find(l => l.type === 'Header');
    // We can use MRX header data if needed, but we mostly construct new ACK header

    // --- ACK HEADER ---
    let header = 'H';
    header += pad('PRIME', 25, ' ', 'left');
    header += pad('BCBSMN', 25, ' ', 'left');
    header += dateStr; // 8 chars

    // Original File Name (from MRX Header ideally, or constructed)
    const originalFileName = mrxHeader ? getFieldValue(mrxHeader, 'Original File Name') : `BCBSMN_PRIME_CLAIMS_${timestamp}.txt`;
    header += pad(originalFileName, 45, ' ', 'left');
    header += pad('', 116, ' ', 'left'); // Filler

    lines.push(pad(header, 220, ' ', 'left'));

    // --- ACK DATA ---
    const dataLines = mrxResult.lines.filter(l => l.type === 'Data');
    dataLines.forEach((mrxLine, index) => {
        if (!mrxLine.isValid) return; // Skip invalid lines? Or try to process?

        const claimId = getFieldValue(mrxLine, 'Sender Claim Number');
        const lineNum = getFieldValue(mrxLine, 'Claim Line Number');
        const memberId = getFieldValue(mrxLine, 'Member ID');
        const patientId = getFieldValue(mrxLine, 'Patient ID');
        // Client Provider ID -> 16 chars. MRX doesn't have a direct "Client Provider ID", maybe use Tax ID or NPI?
        // Spec map: MRX Provider Tax ID -> ACK Client Provider ID? Or just NPI?
        // Let's use NPI padded.
        const provNpi = getFieldValue(mrxLine, 'Rendering Provider NPI #');
        const provTaxId = getFieldValue(mrxLine, 'Provider Tax ID Number');

        let line = 'D';
        line += pad(claimId, 20, ' ', 'left');
        line += pad(lineNum, 5, '0', 'right');
        line += pad(memberId, 30, ' ', 'left');
        line += pad(patientId, 38, ' ', 'left');
        line += pad(provNpi, 16, ' ', 'left'); // Mapping NPI to Client Provider ID for now
        line += pad(provNpi, 12, ' ', 'left');
        line += pad(provTaxId, 10, ' ', 'left');
        line += 'A'; // Status Accepted
        line += pad('', 7, ' ', 'left'); // Reject ID
        line += pad('', 80, ' ', 'left'); // Reject Reason

        lines.push(pad(line, 220, ' ', 'left'));
    });

    // --- ACK TRAILER ---
    let trailer = 'T';
    trailer += pad('TRAILER', 7, ' ', 'left');
    trailer += pad(dataLines.length.toString(), 20, ' ', 'left');
    trailer += pad('', 192, ' ', 'left');

    lines.push(pad(trailer, 220, ' ', 'left'));

    return lines.join('\n');
}

export function convertMrxToResp(mrxResult: ParseResult, timestamp: string): string {
    const lines: string[] = [];
    const dateStr = timestamp.slice(0, 8); // YYYYMMDD

    // --- RESP HEADER ---
    let header = 'H';
    header += 'PRIME';
    header += pad('BCBSMN', 25, ' ', 'left');
    header += dateStr; // Creation Date
    header += dateStr; // Selection From
    header += dateStr; // Selection To
    header += pad('', 175, ' ', 'left');

    lines.push(pad(header, 230, ' ', 'left'));

    // --- RESP DATA ---
    const dataLines = mrxResult.lines.filter(l => l.type === 'Data');
    dataLines.forEach((mrxLine, index) => {
        const claimId = getFieldValue(mrxLine, 'Sender Claim Number');
        const lineNum = getFieldValue(mrxLine, 'Claim Line Number');
        const memberId = getFieldValue(mrxLine, 'Member ID');
        const patientId = getFieldValue(mrxLine, 'Patient ID');
        const provNpi = getFieldValue(mrxLine, 'Rendering Provider NPI #');
        const provTin = getFieldValue(mrxLine, 'Provider Tax ID Number');
        // MRX Assigned ID - generate dummy
        const mrxClaimNum = `PAYCODE${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
        const mrxLineNum = '001';

        const allowedAmt = getFieldValue(mrxLine, 'Allowed Amount') || '0';
        const units = getFieldValue(mrxLine, 'Units/Quantity') || '0';
        const unitsInt = parseInt(units, 10);
        const procCode = getFieldValue(mrxLine, 'Procedure Code');

        let line = 'D';
        line += pad(claimId, 20, ' ', 'left');
        line += pad(lineNum, 5, ' ', 'left');
        line += pad(memberId, 30, ' ', 'left');
        line += pad(patientId, 38, ' ', 'left');
        line += pad(provNpi, 12, ' ', 'left');
        line += pad(provTin, 9, ' ', 'left');
        line += pad(mrxClaimNum, 12, ' ', 'left');
        line += pad(mrxLineNum, 3, ' ', 'left');
        line += pad(allowedAmt, 9, '0', 'right'); // Amount
        line += pad(units, 9, '0', 'right'); // Approved
        line += pad('0', 9, '0', 'right'); // Denied
        line += 'PD'; // Paid
        line += pad('', 10, ' ', 'left'); // Denial Code
        line += pad('', 20, ' ', 'left'); // Auth Num
        line += pad(procCode, 8, ' ', 'left');
        line += 'A'; // Response Ind
        line += 'Y'; // ITS Ind
        line += ' '; // Filler
        line += pad('', 17, ' ', 'left'); // SCCF
        line += pad('', 3, ' ', 'left'); // Adj Reason
        line += pad('207104', 10, ' ', 'left'); // Client Num

        lines.push(pad(line, 230, ' ', 'left'));
    });

    // --- RESP TRAILER ---
    let trailer = 'TTRAILER' + dataLines.length.toString();
    trailer = pad(trailer, 230, ' ', 'left');
    lines.push(trailer);

    return lines.join('\n');
}

export function convertMrxToCsv(mrxResult: ParseResult): string {
    const dataLines = mrxResult.lines.filter(l => l.type === 'Data');
    if (dataLines.length === 0) return '';

    // Get headers from definition
    const headers = dataLines[0].fields.map(f => f.def.name);

    const rows = dataLines.map(line => {
        return line.fields.map(f => `"${f.value.trim()}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}
