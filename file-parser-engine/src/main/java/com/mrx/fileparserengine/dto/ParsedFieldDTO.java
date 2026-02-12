package com.mrx.fileparserengine.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO mirroring the frontend's ParsedField interface.
 * Contains the parsed value, the field definition, and validation results.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ParsedFieldDTO {
    private FieldDefinitionDTO def;
    private String value;
    @JsonProperty("isValid")
    private boolean isValid;
    private String error;
}
