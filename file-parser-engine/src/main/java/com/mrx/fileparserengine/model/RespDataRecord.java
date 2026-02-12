package com.mrx.fileparserengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a Data record (D) in RESP file
 * Record Length: 230 characters
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RespDataRecord {
    private String recordType; // Position 1-1 (1 char) = 'D'
    private String claimNumber; // Position 2-21 (20 chars)
    private String claimLineNumber; // Position 22-26 (5 chars)
    private String mrxClaimNumber; // Position 116-127 (12 chars)
    private String allowedAmount; // Position 131-139 (9 chars)
    private String unitsApproved; // Position 140-148 (9 chars)
    private String unitsDenied; // Position 149-157 (9 chars)
    private String claimStatus; // Position 158-159 (2 chars) - PD/DY/PA
    private String denialCode; // Position 160-169 (10 chars) - Required for DY & PA
    private String authorizationNumber; // Position 170-189 (20 chars)
    private String procedureCode; // Position 190-197 (8 chars)

    // Full raw line for reference
    private String rawLine;
}
