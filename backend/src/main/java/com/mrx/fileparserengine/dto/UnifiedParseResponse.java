package com.mrx.fileparserengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Unified response DTO that mirrors the frontend's ParseResult interface.
 * This is the top-level response returned by the unified parse endpoint.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedParseResponse {
    private List<ParsedLineDTO> lines;
    private SummaryDTO summary;
    private String detectedSchema; // "ACK", "RESP", "MRX", "INVALID"
    private String rawContent; // full raw text content for frontend state
}
