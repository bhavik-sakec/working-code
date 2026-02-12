package com.mrx.fileparserengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO mirroring the frontend's FieldDefinition interface.
 * Contains schema metadata for a single field in a fixed-width record.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FieldDefinitionDTO {
    private String name;
    private int start; // 1-based index
    private int end; // 1-based index
    private int length;
    private String type; // "Alpha", "Numeric", "AlphaNumeric"
    private String description;
    private String expectedValue;
}
