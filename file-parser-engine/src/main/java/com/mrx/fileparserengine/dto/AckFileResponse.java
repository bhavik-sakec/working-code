package com.mrx.fileparserengine.dto;

import com.mrx.fileparserengine.model.AckDataRecord;
import com.mrx.fileparserengine.model.HeaderRecord;
import com.mrx.fileparserengine.model.TrailerRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for parsed ACK file response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AckFileResponse {
    private HeaderRecord header;
    private List<AckDataRecord> dataRecords;
    private TrailerRecord trailer;
    private FileStatistics statistics;
}
