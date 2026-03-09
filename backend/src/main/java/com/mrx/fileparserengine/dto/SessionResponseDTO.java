package com.mrx.fileparserengine.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class SessionResponseDTO {
    private String sessionId;
    private String fileName;
    private String detectedSchema;
    private String status;
    private long totalLines;
    private SummaryDTO summary;
    private List<FieldDefinitionDTO> headerFields;
    private List<FieldDefinitionDTO> dataFields;
    private List<FieldDefinitionDTO> trailerFields;
    private List<Integer> errorLines; // High priority error indices
}
