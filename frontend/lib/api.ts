/**
 * API Service Layer
 * Handles all communication with the Spring Boot backend.
 * All URLs and endpoint paths are configurable via .env file.
 */

import { ParsedLine, FieldDefinition, ParseResult } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Endpoint Definitions from Environment Variables
const ENDPOINTS = {
    PARSE: process.env.NEXT_PUBLIC_API_PARSE,
    PARSE_TEXT: process.env.NEXT_PUBLIC_API_PARSE_TEXT,
    CONVERT_ACK: process.env.NEXT_PUBLIC_API_CONVERT_ACK,
    CONVERT_RESP: process.env.NEXT_PUBLIC_API_CONVERT_RESP,
    CONVERT_CSV: process.env.NEXT_PUBLIC_API_CONVERT_CSV,
    HEALTH: process.env.NEXT_PUBLIC_API_HEALTH,
    LAYOUTS: process.env.NEXT_PUBLIC_API_LAYOUTS,
    VALIDATE: process.env.NEXT_PUBLIC_API_VALIDATE,
    PARSE_STREAM: process.env.NEXT_PUBLIC_API_PARSE_STREAM,
};

/**
 * Custom error class for API errors.
 * Distinguishes between network errors (backend unreachable) and server errors (backend returned error).
 */
export class ApiError extends Error {
    public isNetworkError: boolean;
    public statusCode?: number;

    constructor(message: string, isNetworkError: boolean, statusCode?: number) {
        super(message);
        this.name = 'ApiError';
        this.isNetworkError = isNetworkError;
        this.statusCode = statusCode;
    }
}

/**
 * Safe fetch wrapper that catches network errors and wraps them in ApiError.
 * Prevents raw TypeError from propagating to Next.js error overlay.
 */
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
    try {
        const response = await fetch(url, options);
        return response;
    } catch {
        // Professional production-ready message
        throw new ApiError(
            'Connection Error',
            true
        );
    }
}

/**
 * Perform a light health check to verify backend availability.
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.HEALTH}`, {
            method: 'GET',
            // Simple timeout for health check
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Parse a file on the backend. Sends the file to the unified parse endpoint
 * which auto-detects the file type (ACK, RESP, MRX) and returns a ParseResult-compatible response.
 */
/**
 * ⚡ SESSION API v3: Initialize a random-access file session.
 * Used for 1M-10M row files where we don't want to load everything at once.
 */
interface SessionInitResponse {
    sessionId: string;
    detectedSchema: string;
    status: 'INDEXING' | 'COMPLETED' | 'FAILED';
    totalLines: number;
    summary: ParseResult['summary'];
    errorLines: number[];
}

export async function initSession(file: File): Promise<SessionInitResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/session/init`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Session initialization failed: ${response.statusText}`);
    }

    return response.json();
}

/**
 * ⚡ SESSION API v3: Fetch a specific range of rows from an active session.
 */
export async function fetchSessionRows(sessionId: string, start: number, limit: number): Promise<ParsedLine[]> {
    const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/rows?start=${start}&limit=${limit}`);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch rows: ${response.statusText}`);
    }

    return response.json();
}

/**
 * ⚡ SESSION API v3: Poll the status of a background indexing session.
 */
export async function fetchSessionStatus(sessionId: string): Promise<{
    status: 'INDEXING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    progress: number;
    indexedLines: number;
    totalBytes: number;
    processedBytes: number;
    isCompleted: boolean;
    summary?: ParseResult['summary'];
}> {
    const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/status`);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch session status: ${response.statusText}`);
    }

    return response.json();
}

/**
 * ⚡ SESSION API v3: Cancel an active background session.
 */
export async function cancelSession(sessionId: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok && response.status !== 404) {
            console.warn(`Failed to cancel session: ${response.statusText}`);
        }
    } catch (err) {
        // Silently swallow network errors during cancellation (fire-and-forget)
        console.warn('Network error while cancelling session:', err);
    }
}

/**
 * ⚡ SESSION API v3: Execute a batch randomization/update on a large-file session (Streaming version).
 * Returns updates incrementally via NDJSON.
 */
export async function batchExecuteSessionStream(
    sessionId: string,
    config: {
        mode: 'DY' | 'PA' | 'R',
        pct: number,
        count: number,
        randomizeCodes: boolean,
        denialCode: string
    },
    onUpdate: (data: { type: 'row_update' | 'complete', index?: number, row?: ParsedLine, applied?: number, eligible?: number, summary?: ParseResult['summary'] }) => void
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/batch-execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });

    if (!response.ok) {
        throw new Error(`Streaming batch failed: ${response.statusText}`);
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line);
                onUpdate(data);
            } catch (e) {
                console.warn('Error parsing batch stream chunk', e);
            }
        }
    }
}

/**
 * ⚡ SESSION API v3: Execute a batch randomization/update on a large-file session.
 */
export async function batchExecuteSession(
    sessionId: string,
    config: {
        mode: 'DY' | 'PA' | 'R',
        pct: number,
        count: number,
        randomizeCodes: boolean,
        denialCode: string
    }
): Promise<{ applied: number, eligible: number, summary: ParseResult['summary'] }> {

    try {
        const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/batch-execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
            // ⚡ 2-minute timeout — prevents infinite hang on large file operations
            signal: AbortSignal.timeout(120_000)
        });
        if (!response.ok) {
            let errorMsg = `Batch execution failed: ${response.statusText}`;
            try {
                const data = await response.json();
                if (data && data.error) errorMsg = data.error;
            } catch {}
            throw new ApiError(errorMsg, false, response.status);
        }
        return response.json();
    } catch (err) {
        if (err instanceof ApiError) throw err;
        if (err instanceof DOMException && err.name === 'TimeoutError') {
            throw new ApiError('Batch operation timed out. The file may be too large for this operation.', false);
        }
        throw new ApiError('Network or server error during batch execution.', true);
    }
}

export async function parseFileOnBackend(file: File): Promise<{
    lines: ParsedLine[];
    summary: { total: number; totalClaims: number; valid: number; invalid: number; accepted: number; rejected: number };
    detectedSchema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    rawContent: string;
    validationErrors?: string[];
}> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.PARSE}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new ApiError(
            `Backend parsing failed (${response.status}): ${errorBody || response.statusText}`,
            false,
            response.status
        );
    }


    return response.json();
}

/**
 * Stream binary file to backend and read result incrementally via compact NDJSON.
 *
 * NEW COMPACT WIRE FORMAT (v2):
 *   Meta packet  — sent ONCE, contains all field definitions indexed by line type
 *   Line packets — compact: only values[], no embedded field defs
 *   Summary      — sent once at the end
 *
 * The frontend reconstructs full ParsedLine/ParsedField objects by pairing
 * values[i] with the corresponding FieldDefinitionDTO from the meta packet.
 *
 * Payload: ~7GB → ~100MB for 1M-line files.
 */
export async function streamParseFile(
    file: File,
    onProgress: (data: { lines?: ParsedLine[], result?: Partial<ParseResult>, progress?: number, processedLines?: number }) => void,
    signal?: AbortSignal
): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.PARSE_STREAM}`, {
        method: 'POST',
        body: formData,
        signal,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new ApiError(
            `Parsing failed (${response.status}): ${errorBody || response.statusText}`,
            false,
            response.status
        );
    }

    if (!response.body) {
        throw new ApiError('Response body is empty', false);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let bytesRead = 0;
    let totalProcessedLines = 0;

    // Cached field definitions from meta packet — keyed by line type initial character
    let headerDefs: FieldDefinition[]  = [];
    let dataDefs:   FieldDefinition[]  = [];
    let trailerDefs: FieldDefinition[] = [];

    // Batching: group parsed lines to reduce store updates/re-renders
    let lineBatch: ParsedLine[] = [];
    const BATCH_SIZE = 2000; // Increased batch size for large files
    const BATCH_INTERVAL_MS = 300;
    let lastUpdateTimestamp = Date.now();

    const flushBatch = () => {
        if (lineBatch.length > 0) {
            onProgress({
                lines: [...lineBatch],
                progress: Math.min(99, Math.round((bytesRead / file.size) * 100)),
                processedLines: totalProcessedLines
            });
            lineBatch = [];
            lastUpdateTimestamp = Date.now();
        }
    };

    /**
     * Reconstruct a full ParsedLine from the compact wire format.
     * The backend sends {n, t, rl, ok, err, v, fi?, fe?} — we expand it
     * using the field definition arrays from the meta packet.
     */
    const reconstructLine = (data: { t: string, n: number, rl: number, ok: boolean, err?: string, v?: string[], fi?: boolean[], fe?: Record<string, string> }): ParsedLine => {
        let defs: FieldDefinition[];
        switch (data.t) {
            case 'Header':  defs = headerDefs;  break;
            case 'Trailer': defs = trailerDefs; break;
            case 'Data':    defs = dataDefs;    break;
            default:        defs = [];          break;
        }

        const values: string[]   = data.v  ?? [];
        const fieldValid: boolean[] = data.fi ?? [];  // sparse — only present when there are errors
        const fieldErrors: Record<string, string> = data.fe ?? {};

        const fields = defs.map((def: FieldDefinition, idx: number) => ({
            def,
            value: values[idx] ?? '',
            isValid: fieldValid.length > 0 ? (fieldValid[idx] ?? true) : true,
            valid:   fieldValid.length > 0 ? (fieldValid[idx] ?? true) : true,
            error:   fieldErrors[String(idx)] ?? null,
        }));

        return {
            lineNumber: data.n,
            type:       data.t,
            rawLength:  data.rl,
            isValid:    data.ok,
            valid:      data.ok,
            globalError: data.err ?? null,
            fields,
            raw: null,
        } as unknown as ParsedLine;
    };

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            flushBatch();
            break;
        }

        bytesRead += value.length;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
            if (!chunk.trim()) continue;
            try {
                const data = JSON.parse(chunk);

                if (data.type === 'meta') {
                    // Cache field defs — received once, used for every line
                    headerDefs  = data.headerFields  ?? [];
                    dataDefs    = data.dataFields    ?? [];
                    trailerDefs = data.trailerFields ?? [];
                    onProgress({ result: { detectedSchema: data.detectedSchema } });

                } else if (data.type === 'line') {
                    // Compact line — reconstruct ParsedLine on the frontend
                    const parsedLine = reconstructLine(data);
                    lineBatch.push(parsedLine);
                    totalProcessedLines++;

                } else if (data.type === 'summary') {
                    flushBatch();
                    onProgress({
                        result: { summary: data.summary },
                        progress: 100,
                        processedLines: totalProcessedLines
                    });

                } else if (data.type === 'error') {
                    throw new Error(data.message);
                }
            } catch (e: unknown) {
                if (e instanceof SyntaxError) {
                    // Partial JSON chunk — ignore, will be retried
                    console.warn('Partial NDJSON chunk, skipping');
                } else {
                    throw e;
                }
            }
        }

        // Flush periodically
        if (lineBatch.length >= BATCH_SIZE || (Date.now() - lastUpdateTimestamp > BATCH_INTERVAL_MS)) {
            flushBatch();
        }
    }
}


/**
 * Parse raw text content on the backend.
 */
export async function parseTextOnBackend(text: string): Promise<{
    lines: ParsedLine[];
    summary: { total: number; totalClaims: number; valid: number; invalid: number; accepted: number; rejected: number };
    detectedSchema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    rawContent: string;
}> {
    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.PARSE_TEXT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
    });

    if (!response.ok) {
        throw new ApiError(
            `Backend parsing failed (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}

/**
 * Convert MRX file to ACK format on the backend.
 */
export async function convertMrxToAckOnBackend(
    file: File,
    timestamp: string
): Promise<{ content: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp);

    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.CONVERT_ACK}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new ApiError(
            `ACK conversion failed (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}

/**
 * Convert MRX file to RESP format on the backend.
 * Optionally applies deny/partial modifications to the generated output.
 */
export async function convertMrxToRespOnBackend(
    file: File,
    timestamp: string
): Promise<{ content: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp);

    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.CONVERT_RESP}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new ApiError(
            `RESP conversion failed (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}

/**
 * Convert MRX file to CSV format on the backend.
 */
export async function convertMrxToCsvOnBackend(file: File, timestamp: string): Promise<{ content: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp);

    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.CONVERT_CSV}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new ApiError(
            `CSV conversion failed (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}

/**
 * Fetch all layout definitions from the backend.
 * Returns YAML layout configurations for ACK, RESP, and MRX file types.
 */
export async function fetchLayouts(): Promise<{
    [key: string]: {
        name: string;
        lineLength: number;
        header: Array<{
            name: string;
            start: number;
            end: number;
            length: number;
            type: string;
            description?: string;
            expectedValue?: string;
            editable?: boolean;
            uiType?: string;
        }>;
        data: Array<{
            name: string;
            start: number;
            end: number;
            length: number;
            type: string;
            description?: string;
            expectedValue?: string;
            editable?: boolean;
            uiType?: string;
        }>;
        trailer: Array<{
            name: string;
            start: number;
            end: number;
            length: number;
            type: string;
            description?: string;
            expectedValue?: string;
            editable?: boolean;
            uiType?: string;
        }>;
        denialCodes?: Array<{ code: string; short: string; long?: string }>;
    };
}> {
    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.LAYOUTS}`, {
        method: 'GET',
    });

    if (!response.ok) {
        throw new ApiError(
            `Failed to fetch layouts (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}


/**
 * Validation response from the unified /validate endpoint.
 */
export interface ValidationResult {
    isValid: boolean;
    error: string | null;
    allowedStatuses?: string[];
    // STATUS_CHANGE response fields
    suggestedStatus?: string;
    suggestedApproved?: number;
    suggestedDenied?: number;
    // PARTIAL_UNITS response fields
    wasCorrected?: boolean;
    correctedApproved?: number;
    correctedDenied?: number;
}

/**
 * Validate if a claim status change is allowed.
 * Calls the unified /validate endpoint with type STATUS_CHANGE.
 */
export async function validateStatusChange(
    unitsApproved: number,
    totalUnits: number,
    newStatus: string
): Promise<ValidationResult> {
    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.VALIDATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'STATUS_CHANGE', unitsApproved, totalUnits, newStatus }),
    });

    if (!response.ok) {
        throw new ApiError(
            `Validation failed (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}

/**
 * Validate partial approval units.
 * Calls the unified /validate endpoint with type PARTIAL_UNITS.
 */
export async function validatePartialUnits(
    totalUnits: number,
    newApproved: number,
    newDenied: number
): Promise<ValidationResult> {
    const response = await safeFetch(`${API_BASE_URL}${ENDPOINTS.VALIDATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PARTIAL_UNITS', totalUnits, newApproved, newDenied }),
    });

    if (!response.ok) {
        throw new ApiError(
            `Validation failed (${response.status}): ${response.statusText}`,
            false,
            response.status
        );
    }

    return response.json();
}
