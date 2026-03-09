package com.mrx.fileparserengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO mirroring the frontend's ParseResult.summary.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SummaryDTO {
    private int total;
    private int totalClaims;
    private int valid;
    private int invalid;
    private int accepted;
    private int rejected;
    private int partial;
}
