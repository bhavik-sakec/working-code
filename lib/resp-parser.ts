import { RespSchema } from './resp-schema';
import { FieldDefinition } from './ack-schema';
import { ParsedLine, ParseResult, ParsedField } from './ack-parser';

const RESP_LINE_LENGTH = 230;

export function parseRespFile(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/);
    const parsedLines: ParsedLine[] = [];

    rawLines.forEach((raw, index) => {
        if (!raw.trim() && raw.length === 0) return; // Skip completely empty lines

        const lineNumber = index + 1;
        const firstChar = raw.charAt(0).toUpperCase();
        let type: ParsedLine['type'] = 'Unknown';
        let schemaFields: FieldDefinition[] = [];

        if (firstChar === 'H') {
            type = 'Header';
            schemaFields = RespSchema.header;
        } else if (firstChar === 'D') {
            type = 'Data';
            schemaFields = RespSchema.data;
        } else if (firstChar === 'T') {
            type = 'Trailer';
            schemaFields = RespSchema.trailer;
        }

        const fields: ParsedField[] = [];
        let lineIsValid = true;
        let globalError: string | undefined;
        const alignmentTips: string[] = [];

        if (raw.length !== RESP_LINE_LENGTH && raw.length > 0) {
            lineIsValid = false;
            globalError = `Length Mismatch (${raw.length}/${RESP_LINE_LENGTH})`;

            if (raw.length > RESP_LINE_LENGTH) {
                alignmentTips.push(`Line is OVERFLOWING. Delete ${raw.length - RESP_LINE_LENGTH} char(s).`);
            } else {
                alignmentTips.push(`Line is SHORT. Add ${RESP_LINE_LENGTH - raw.length} space(s).`);
            }
        }

        if (type !== 'Unknown') {
            schemaFields.forEach(field => {
                const startIdx = field.start - 1;
                const endIdx = field.end;
                const value = raw.slice(startIdx, endIdx);
                let fieldValid = true;
                let fieldError: string | undefined;

                if (field.expectedValue && value.trim() !== field.expectedValue) {
                    fieldValid = false;
                    fieldError = `Expected '${field.expectedValue}', found '${value}'`;
                }

                if (fieldValid && field.type === 'Numeric') {
                    if (value.trim() && !/^\s*\d+\s*$/.test(value)) {
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
        } else if (raw.length > 0) {
            lineIsValid = false;
            globalError = "Unknown Record Type (Must be H, D, or T)";
        }

        if (raw.length > 0 || type !== 'Unknown') {
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
        }
    });

    const validCount = parsedLines.filter(l => l.isValid).length;
    const acceptedCount = parsedLines.filter(l => l.type === 'Data' && l.fields.some(f => f.def.name === 'MRx Claim Status' && (f.value.trim() === 'PD' || f.value.trim() === 'PA'))).length;
    const rejectedCount = parsedLines.filter(l => l.type === 'Data' && l.fields.some(f => f.def.name === 'MRx Claim Status' && f.value.trim() === 'DY')).length;

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
