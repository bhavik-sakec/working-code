package com.mrx.fileparserengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a Data record (D) in MRX file
 * Record Length: 921 characters
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MrxDataRecord {
    private String recordType; // Position 1-1 (1 char) = 'D'
    private String senderClaimNumber; // Position 12-31 (20 chars)
    private String claimLineNumber; // Position 32-36 (5 chars)
    private String memberId; // Position 37-66 (30 chars)
    private String patientId; // Position 67-104 (38 chars)
    private String patientFirstName; // Position 105-119 (15 chars)
    private String patientLastName; // Position 135-159 (25 chars)
    private String patientDob; // Position 268-275 (8 chars)
    private String providerTaxId; // Position 279-288 (10 chars)
    private String renderingProviderNpi; // Position 433-444 (12 chars)
    private String serviceFromDate; // Position 610-617 (8 chars)
    private String diagnosisCode; // Position 632-641 (10 chars)
    private String procedureCode; // Position 672-679 (8 chars)
    private String unitsQuantity; // Position 688-696 (9 chars)
    private String billedAmount; // Position 729-737 (9 chars)
    private String allowedAmount; // Position 738-746 (9 chars)
    private String adjustmentIdentifier; // Position 768-768 (1 char)

    // Full raw line for reference
    private String rawLine;
}
