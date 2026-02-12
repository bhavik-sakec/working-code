package com.mrx.fileparserengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Statistics for parsed files
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileStatistics {
    private Long totalRecords;
    private Long acceptedCount;
    private Long rejectedCount;
    private Long paidCount;
    private Long deniedCount;
    private Long partialCount;
}
