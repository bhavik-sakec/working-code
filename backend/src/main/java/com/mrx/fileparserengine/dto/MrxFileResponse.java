package com.mrx.fileparserengine.dto;

import com.mrx.fileparserengine.model.HeaderRecord;
import com.mrx.fileparserengine.model.MrxDataRecord;
import com.mrx.fileparserengine.model.TrailerRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for parsed MRX file response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MrxFileResponse {
    private HeaderRecord header;
    private List<MrxDataRecord> dataRecords;
    private TrailerRecord trailer;
    private FileStatistics statistics;
}
