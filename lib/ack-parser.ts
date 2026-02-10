
import { AckSchema, FieldDefinition } from './ack-schema';

export interface ParsedField {
    def: FieldDefinition;
    value: string;
    isValid: boolean;
    error?: string;
}

export interface ParsedLine {
    lineNumber: number;
    raw: string;
    type: 'Header' | 'Data' | 'Trailer' | 'Unknown';
    fields: ParsedField[];
    isValid: boolean;
    globalError?: string;
    rawLength: number;
    alignmentTips?: string[];
}

export interface ParseResult {
    lines: ParsedLine[];
    summary: {
        total: number;
        valid: number;
        invalid: number;
        accepted: number;
        rejected: number;
    };
}

const LINE_LENGTH = 220;

export function parseAckFile(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/);
    const parsedLines: ParsedLine[] = [];

    rawLines.forEach((raw, index) => {
        if (!raw.trim()) return; // Skip empty lines

        const lineNumber = index + 1;
        const firstChar = raw.charAt(0).toUpperCase();
        let type: ParsedLine['type'] = 'Unknown';
        let schemaFields: FieldDefinition[] = [];

        if (firstChar === 'H') {
            type = 'Header';
            schemaFields = AckSchema.header;
        } else if (firstChar === 'D') {
            type = 'Data';
            schemaFields = AckSchema.data;
        } else if (firstChar === 'T') {
            type = 'Trailer';
            schemaFields = AckSchema.trailer;
        }

        const fields: ParsedField[] = [];
        let lineIsValid = true;
        let globalError: string | undefined;
        const alignmentTips: string[] = [];

        // --- SHIFT DETECTION LOGIC ---
        if (raw.length !== LINE_LENGTH) {
            lineIsValid = false;
            globalError = `Length Mismatch (${raw.length}/${LINE_LENGTH})`;

            // Detect leading shift
            const trimStartCount = raw.length - raw.trimStart().length;
            if (trimStartCount > 0) {
                alignmentTips.push(`${trimStartCount} leading space(s) detected. Row starts at index ${trimStartCount + 1} instead of 1.`);
            }

            // Detect relative shift for known anchors
            if (type === 'Header') {
                const primeIdx = raw.indexOf('PRIME');
                if (primeIdx !== -1 && primeIdx !== 1) { // PRIME should be at pos 2 (index 1)
                    const diff = primeIdx - 1;
                    alignmentTips.push(`Shift detected near 'PRIME': Fields are pushed ${diff} char(s) to the ${diff > 0 ? 'right' : 'left'}.`);
                }
            } else if (type === 'Data') {
                // Check if '00001' or 'MEMBER' is shifted
                const memberIdx = raw.indexOf('MEMBER');
                if (memberIdx !== -1) {
                    const expectedIdx = 26; // Pos 27
                    if (memberIdx !== expectedIdx) {
                        const diff = memberIdx - expectedIdx;
                        alignmentTips.push(`Data Leakage: 'MEMBER' found at pos ${memberIdx + 1} (Expected 27). Shift of ${diff} char(s).`);
                    }
                }
            }

            if (raw.length > LINE_LENGTH) {
                alignmentTips.push(`Line is OVERFLOWING. Delete ${raw.length - LINE_LENGTH} char(s) to restore alignment.`);
            } else {
                alignmentTips.push(`Line readable but SHORT. Add ${LINE_LENGTH - raw.length} space(s) at the end.`);
            }
        }

        if (type !== 'Unknown') {
            schemaFields.forEach(field => {
                // defined start is 1-based, slice is 0-based.
                // start: 1 -> index 0. end: 1 -> slice(0, 1)
                const startIdx = field.start - 1;
                const endIdx = field.end;

                const value = raw.slice(startIdx, endIdx);
                let fieldValid = true;
                let fieldError: string | undefined;

                // 1. Check Expected Value
                if (field.expectedValue && value.trim() !== field.expectedValue) {
                    fieldValid = false;
                    fieldError = `Expected '${field.expectedValue}', found '${value}'`;
                }

                // 2. Custom Validation
                if (fieldValid && field.validation) {
                    const customError = field.validation(value.trim()); // trim for logic checks?
                    // Note: Fixed width usually implies spaces matter. 
                    // However, for numbers/values, we usually trim before check.
                    // Let's passed raw value to validation if it's strict, but mostly we check content.
                    // Spec says "Left Justified Blank Fill" -> 'PRIME    '.
                    // checks like "Numeric" usually apply to the trimmed part.
                    if (customError) {
                        fieldValid = false;
                        fieldError = customError;
                    }
                }

                // 3. Type Validation (Basic)
                if (fieldValid && field.type === 'Numeric') {
                    if (!/^\s*\d+\s*$/.test(value)) { // Allow padding
                        fieldValid = false;
                        fieldError = "Must be numeric";
                    }
                }

                if (!fieldValid) lineIsValid = false;

                fields.push({
                    def: field,
                    value,
                    isValid: fieldValid,
                    error: fieldError
                });
            });
        } else {
            lineIsValid = false;
            globalError = "Unknown Record Type (Must be H, D, or T)";
        }

        parsedLines.push({
            lineNumber,
            raw,
            type,
            fields,
            isValid: lineIsValid,
            globalError,
            rawLength: raw.length,
            alignmentTips: alignmentTips.length > 0 ? alignmentTips : undefined
        });
    });

    const validCount = parsedLines.filter(l => l.isValid).length;
    const acceptedCount = parsedLines.filter(l => l.type === 'Data' && l.fields.some(f => f.def.name === 'Status' && f.value === 'A')).length;
    const rejectedCount = parsedLines.filter(l => l.type === 'Data' && l.fields.some(f => f.def.name === 'Status' && f.value === 'R')).length;

    return {
        lines: parsedLines,
        summary: {
            total: parsedLines.length,
            valid: validCount,
            invalid: parsedLines.length - validCount,
            accepted: acceptedCount,
            rejected: rejectedCount
        }
    };
}
