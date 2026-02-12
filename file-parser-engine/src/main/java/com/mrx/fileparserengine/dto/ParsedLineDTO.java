package com.mrx.fileparserengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * DTO mirroring the frontend's ParsedLine interface.
 * Contains the parsed result of a single line in a fixed-width file.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ParsedLineDTO {
    private int lineNumber;
    private String raw;
    private String type; // "Header", "Data", "Trailer", "Unknown"
    private List<ParsedFieldDTO> fields;
    @JsonProperty("isValid")
    private boolean isValid;
    private String globalError;
    private int rawLength;
    private List<String> alignmentTips;
}
