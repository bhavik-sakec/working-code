
export type RecordType = 'Header' | 'Data' | 'Trailer';

export interface FieldDefinition {
    name: string;
    start: number; // 1-based index
    end: number;   // 1-based index
    length: number;
    type: 'Alpha' | 'Numeric' | 'AlphaNumeric';
    validation?: (value: string) => string | null; // returns error message or null
    description?: string;
    expectedValue?: string;
    editable?: boolean;
    uiType?: 'dropdown' | 'text' | string;
}

export interface AckSchemaType {
    header: FieldDefinition[];
    data: FieldDefinition[];
    trailer: FieldDefinition[];
}

export interface ParsedField {
    def: FieldDefinition;
    value: string;
    isValid: boolean;
    error?: string;
    valid?: boolean; // Legacy/Backend support
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
    valid?: boolean; // Legacy/Backend support
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
    detectedSchema?: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    rawContent?: string;
    validationErrors?: string[];
}
