/**
 * API Service Layer
 * Handles all communication with the Spring Boot backend.
 * All URLs and endpoint paths are configurable via .env file.
 */

import { ParsedLine } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Endpoint Definitions from Environment Variables
const ENDPOINTS = {
    PARSE: process.env.NEXT_PUBLIC_API_PARSE || '/api/unified/parse',
    PARSE_TEXT: process.env.NEXT_PUBLIC_API_PARSE_TEXT || '/api/unified/parse-text',
    CONVERT_ACK: process.env.NEXT_PUBLIC_API_CONVERT_ACK || '/api/unified/mrx/convert/ack',
    CONVERT_RESP: process.env.NEXT_PUBLIC_API_CONVERT_RESP || '/api/unified/mrx/convert/resp',
    CONVERT_CSV: process.env.NEXT_PUBLIC_API_CONVERT_CSV || '/api/unified/mrx/convert/csv',
    HEALTH: process.env.NEXT_PUBLIC_API_HEALTH || '/api/unified/health',
    LAYOUTS: process.env.NEXT_PUBLIC_API_LAYOUTS || '/api/unified/layouts',
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
            'Connection Error, Its not you its us😊',
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
export async function parseFileOnBackend(file: File): Promise<{
    lines: ParsedLine[];
    summary: { total: number; valid: number; invalid: number; accepted: number; rejected: number };
    detectedSchema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    rawContent: string;
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
 * Parse raw text content on the backend.
 */
export async function parseTextOnBackend(text: string): Promise<{
    lines: ParsedLine[];
    summary: { total: number; valid: number; invalid: number; accepted: number; rejected: number };
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
export async function convertMrxToAckOnBackend(file: File, timestamp: string): Promise<{ content: string; fileName: string }> {
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
 */
export async function convertMrxToRespOnBackend(file: File, timestamp: string): Promise<{ content: string; fileName: string }> {
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
export async function convertMrxToCsvOnBackend(file: File): Promise<{ content: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);

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
