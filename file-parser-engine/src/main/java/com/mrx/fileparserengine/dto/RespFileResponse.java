package com.mrx.fileparserengine.dto;

import com.mrx.fileparserengine.model.HeaderRecord;
import com.mrx.fileparserengine.model.RespDataRecord;
import com.mrx.fileparserengine.model.TrailerRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for parsed RESP file response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RespFileResponse {
    private HeaderRecord header;
    private List<RespDataRecord> dataRecords;
    private TrailerRecord trailer;
    private FileStatistics statistics;
}
