package com.mrx.fileparserengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents the Header record (H) in MRX, ACK, and RESP files
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HeaderRecord {
    private String recordType; // Position 1-1 (1 char)
    private String prime; // Position 2-6 (5 chars) - "PRIME"
    private String sender; // Position 7-31 (25 chars) - "BCBSMN"
    private String creationDate; // Position 32-39 (8 chars) - CCYYMMDD
    private String selectionFromDate; // Position 40-47 (8 chars) - CCYYMMDD
    private String selectionToDate; // Position 48-55 (8 chars) - CCYYMMDD
    private String filler; // Position 56-220 (175 chars)
}
