package com.mrx.fileparserengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a Data record (D) in ACK file
 * Record Length: 220 characters
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AckDataRecord {
    private String recordType; // Position 1-1 (1 char) = 'D'
    private String claimNumber; // Position 2-21 (20 chars)
    private String claimLineNumber; // Position 22-26 (5 chars)
    private String memberId; // Position 27-56 (30 chars)
    private String ackStatus; // Position 158-159 (2 chars) - 'A' or 'R'
    private String rejectCode; // Position 160-169 (10 chars) - Required if status = 'R'

    // Full raw line for reference
    private String rawLine;
}
