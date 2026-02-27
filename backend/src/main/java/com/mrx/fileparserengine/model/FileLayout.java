package com.mrx.fileparserengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileLayout {
    private String name;
    private int lineLength;
    private List<FieldDefinition> header;
    private List<FieldDefinition> data;
    private List<FieldDefinition> trailer;
    private List<Map<String, String>> denialCodes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldDefinition {
        private String name;
        private int start;
        private int end;
        private int length;
        private String type;
        private String expectedValue;
        private String description;
        private boolean editable;
        private String uiType;
    }
}
