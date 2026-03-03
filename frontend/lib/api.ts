/**
 * API Service Layer
 * Handles all communication with the Spring Boot backend.
 * All URLs and endpoint paths are configurable via .env file.
 */

import { ParsedLine } from './types';

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
