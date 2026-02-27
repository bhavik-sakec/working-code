package com.mrx.fileparserengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents the Trailer record (T) in MRX, ACK, and RESP files
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrailerRecord {
    private String recordType; // Position 1-1 (1 char)
    private String trailer; // Position 2-8 (7 chars)
    private Long totalRecords; // Position 9-28 (20 chars)
    private String filler; // Position 29-220 (202 chars)
}
