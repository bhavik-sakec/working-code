package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Unified parser service that mirrors the frontend's parsing logic.
 * Contains all schema definitions for ACK, RESP, and MRX file types.
 * Returns ParseResult-compatible responses for the frontend GridView.
 */
@Slf4j
@Service
public class UnifiedParserService {

    // ========================================================================
    // SCHEMA DEFINITIONS (mirrors frontend ack-schema.ts, resp-schema.ts,
    // mrx-schema.ts)
    // ========================================================================

    // --- ACK Schema ---
    private static final List<FieldDefinitionDTO> ACK_HEADER = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "H", "Valid Value: H=Header Record"),
            field("Sender Value", 2, 26, 25, "AlphaNumeric", "PRIME", "Value = 'PRIME'"),
            field("Receiver Value", 27, 51, 25, "AlphaNumeric", "BCBSMN", "Value = BCBSMN"),
            field("Creation Date", 52, 59, 8, "Numeric", null, "YYYYMMDD"),
            field("Original File Name", 60, 106, 47, "AlphaNumeric", null, "Original Filename"),
            field("Filler", 107, 220, 114, "AlphaNumeric", null, "Blank Fill"));

    private static final List<FieldDefinitionDTO> ACK_DATA = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "D", "Valid Value: D=Data"),
            field("Client Claim #", 2, 21, 20, "AlphaNumeric", null, "Client claim #"),
            field("Claim Line #", 22, 26, 5, "Numeric", null, "Client line #"),
            field("Member ID", 27, 56, 30, "AlphaNumeric", null, "Client member ID"),
            field("Patient ID", 57, 94, 38, "AlphaNumeric", null, "Client patient ID"),
            field("Client Provider ID", 95, 110, 16, "AlphaNumeric", null, "Client provider ID"),
            field("Prov NPI", 111, 122, 12, "AlphaNumeric", null, "Rendering provider NPI"),
            field("Prov Tax ID", 123, 132, 10, "AlphaNumeric", null, "Rendering provider TIN"),
            field("Status", 133, 133, 1, "Alpha", null, "'A'=Accepted; 'R'=Rejected"),
            field("Reject ID", 134, 140, 7, "AlphaNumeric", null, "Magellan Reject ID"),
            field("Reject Reason", 141, 220, 80, "AlphaNumeric", null, "Reject Description"));

    private static final List<FieldDefinitionDTO> ACK_TRAILER = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "T", "Valid Value: T=Trailer Record"),
            field("Value", 2, 8, 7, "Alpha", "TRAILER", "Value: 'TRAILER'"),
            field("Total Records", 9, 28, 20, "Numeric", null, "Total Number of Records sent"),
            field("Filler", 29, 220, 192, "AlphaNumeric", null, "Blank Fill"));

    // --- RESP Schema ---
    private static final List<FieldDefinitionDTO> RESP_HEADER = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "H", "Valid Value: 'H'=Header"),
            field("'PRIME' Alpha", 2, 6, 5, "Alpha", "PRIME", "Valid Value: 'PRIME'"),
            field("Receiver ID", 7, 31, 25, "AlphaNumeric", "BCBSMN", "Valid Value: 'CUSTOMER'"),
            field("Creation Date", 32, 39, 8, "Numeric", null, "CCYYMMDD"),
            field("Selection From Date", 40, 47, 8, "Numeric", null, "CCYYMMDD"),
            field("Selection To Date", 48, 55, 8, "Numeric", null, "Populate with same date as Selection From Date"),
            field("Filler A/N", 56, 230, 175, "AlphaNumeric", null, "blank fill"));

    private static final List<FieldDefinitionDTO> RESP_DATA = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "D", "Valid Value: 'D'=Data"),
            field("Claim Number", 2, 21, 20, "AlphaNumeric", null, "Client submitted Claim Number"),
            field("Claim Line Number", 22, 26, 5, "Numeric", null, "Client submitted Claim Line Number"),
            field("Member ID", 27, 56, 30, "AlphaNumeric", null, "Client submitted Member ID"),
            field("Patient ID", 57, 94, 38, "AlphaNumeric", null,
                    "Client submitted Patient ID (if received on inbound file)"),
            field("Provider NPI", 95, 106, 12, "Numeric", null,
                    "Client submitted Pay to Provider NPI (if received on inbound file)"),
            field("Provider TIN", 107, 115, 9, "Numeric", null, "Client submitted Pay to Provider TIN"),
            field("MRx Claim Number", 116, 127, 12, "AlphaNumeric", null, "MRx assigned Claim Number"),
            field("MRx Claim Line Number", 128, 130, 3, "Numeric", null, "MRx assigned Claim Line Number"),
            field("Allowed Amount", 131, 139, 9, "Numeric", null, "Populate with Allowed Amount"),
            field("Units approved", 140, 148, 9, "Numeric", null,
                    "Indicates the number of whole units MRx approved for this claim line"),
            field("Units Denied", 149, 157, 9, "Numeric", null,
                    "Indicates the number of whole units MRx denied for this claim line"),
            field("MRx Claim Status", 158, 159, 2, "Alpha", null,
                    "Valid Values: DY=Denied, PA= Partial Approval, PD=Paid"),
            field("Denial Code", 160, 169, 10, "AlphaNumeric", null,
                    "MRx denial code (or neutral code for claim lines not edited at MRx )"),
            field("MRx Authorization Number", 170, 189, 20, "AlphaNumeric", null, "When applicable"),
            field("Procedure Code", 190, 197, 8, "AlphaNumeric", null, ""),
            field("Response indicator", 198, 198, 1, "AlphaNumeric", null,
                    "Valid: A=original claim, J=adj, R=replacement, C=adjustment request"),
            field("ITS Indicator", 199, 199, 1, "AlphaNumeric", null, "Valid Values: Y=Yes, N=No"),
            field("Filler A/N", 200, 200, 1, "AlphaNumeric", null, ""),
            field("SCCF # A/N", 201, 217, 17, "AlphaNumeric", null, ""),
            field("Adjustment reason", 218, 220, 3, "AlphaNumeric", null,
                    "Values: 'RAA' (Retro Auth Adj), 'CSA' (Claims Support Adj)"),
            field("Client #", 221, 230, 10, "AlphaNumeric", null, ""));

    private static final List<FieldDefinitionDTO> RESP_TRAILER = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "T", "Valid Value: 'T' = Trailer"),
            field("Trailer A/N", 2, 8, 7, "AlphaNumeric", "TRAILER", "Valid Value: 'TRAILER'"),
            field("Total Records", 9, 28, 20, "Numeric", null, ""),
            field("Filler", 29, 230, 202, "AlphaNumeric", null, "blank fill"));

    // --- MRX Schema (key fields) ---
    private static final List<FieldDefinitionDTO> MRX_HEADER = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "H", "Valid Value: H=Header Record"),
            field("Sender", 2, 26, 25, "AlphaNumeric", null, "Sender ID"),
            field("Run Date", 27, 34, 8, "Numeric", null, "The date the extract was run"),
            field("Original File Name", 35, 81, 47, "AlphaNumeric", null,
                    "Value: BCBSMN_PRIME_CLAIMS_ccyymmddhhmmss.txt"),
            field("Filler", 82, 921, 840, "AlphaNumeric", null, "Blank Fill"));

    private static final List<FieldDefinitionDTO> MRX_DATA = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "D", "Valid Value: D=Data"),
            field("Filler1", 2, 11, 10, "AlphaNumeric", null, ""),
            field("Sender Claim Number", 12, 31, 20, "AlphaNumeric", null, "Client Claim Number"),
            field("Claim Line Number", 32, 36, 5, "Numeric", null, "Client Line Number"),
            field("Member ID", 37, 66, 30, "AlphaNumeric", null, "Member ID"),
            field("Patient ID", 67, 104, 38, "AlphaNumeric", null, "Patient ID"),
            field("Patient First Name", 105, 119, 15, "AlphaNumeric", null, ""),
            field("Filler2", 120, 134, 15, "AlphaNumeric", null, ""),
            field("Patient Last Name", 135, 159, 25, "AlphaNumeric", null, ""),
            field("Filler3", 160, 267, 108, "AlphaNumeric", null, ""),
            field("Patient DOB", 268, 275, 8, "Numeric", null, "YYYYMMDD"),
            field("Filler4", 276, 278, 3, "AlphaNumeric", null, ""),
            field("Provider Tax ID Number", 279, 288, 10, "AlphaNumeric", null, "Provider TIN"),
            field("Filler5", 289, 432, 144, "AlphaNumeric", null, ""),
            field("Rendering Provider NPI #", 433, 444, 12, "Numeric", null, "Provider NPI"),
            field("Filler6", 445, 609, 165, "AlphaNumeric", null, ""),
            field("Service From Date", 610, 617, 8, "Numeric", null, "YYYYMMDD"),
            field("Filler7", 618, 631, 14, "AlphaNumeric", null, ""),
            field("Diagnosis Code", 632, 641, 10, "AlphaNumeric", null, ""),
            field("Filler8", 642, 671, 30, "AlphaNumeric", null, ""),
            field("Procedure Code", 672, 679, 8, "AlphaNumeric", null, ""),
            field("Filler9", 680, 687, 8, "AlphaNumeric", null, ""),
            field("Units/Quantity", 688, 696, 9, "Numeric", null, ""),
            field("Filler10", 697, 728, 32, "AlphaNumeric", null, ""),
            field("Billed Amount", 729, 737, 9, "Numeric", null, ""),
            field("Allowed Amount", 738, 746, 9, "Numeric", null, ""),
            field("Filler11", 747, 767, 21, "AlphaNumeric", null, ""),
            field("Adjustment Identifier", 768, 768, 1, "AlphaNumeric", null, ""),
            field("Filler12", 769, 921, 153, "AlphaNumeric", null, ""));

    private static final List<FieldDefinitionDTO> MRX_TRAILER = List.of(
            field("Record Type", 1, 1, 1, "Alpha", "T", "Valid Value: T = Trailer Record"),
            field("Total Records", 2, 21, 20, "Numeric", null, "Total # of claim records sent in file"),
            field("Total Claims", 22, 41, 20, "Numeric", null, "Total # of claims sent in file"),
            field("Sender Code", 42, 66, 25, "AlphaNumeric", "BCBSMN", "Value = BCBSMN"),
            field("Filler", 67, 921, 855, "AlphaNumeric", null, "Blank Fill"));

    // Line lengths per file type
    private static final int ACK_LINE_LENGTH = 220;
    private static final int RESP_LINE_LENGTH = 230;
    private static final int MRX_LINE_LENGTH = 921;

    // ========================================================================
    // PUBLIC: Unified parse method
    // ========================================================================

    /**
     * Parse file content and auto-detect file type.
     * Returns a ParseResult-compatible response for the frontend.
     *
     * @param fileContent  raw text content of the file
     * @param fileNameHint optional filename to help with detection
     * @return UnifiedParseResponse
     */
    public UnifiedParseResponse parseFile(String fileContent, String fileNameHint) {
        // Detect file type
        String detectedSchema = detectSchema(fileContent, fileNameHint);
        log.info("Detected schema: {} for file: {}", detectedSchema, fileNameHint);

        if ("INVALID".equals(detectedSchema)) {
            return UnifiedParseResponse.builder()
                    .lines(Collections.emptyList())
                    .summary(SummaryDTO.builder().build())
                    .detectedSchema("INVALID")
                    .rawContent(fileContent)
                    .build();
        }

        // Get the expected line length and schema fields
        int expectedLineLength = getExpectedLineLength(detectedSchema);
        List<FieldDefinitionDTO> headerFields = getHeaderFields(detectedSchema);
        List<FieldDefinitionDTO> dataFields = getDataFields(detectedSchema);
        List<FieldDefinitionDTO> trailerFields = getTrailerFields(detectedSchema);

        // Parse lines
        String[] rawLines = fileContent.split("\\r?\\n", -1);
        List<ParsedLineDTO> parsedLines = new ArrayList<>();

        for (int index = 0; index < rawLines.length; index++) {
            String raw = rawLines[index];
            if (raw.trim().isEmpty() && raw.length() == 0)
                continue;
            if (raw.trim().isEmpty())
                continue;

            int lineNumber = index + 1;
            String firstChar = raw.isEmpty() ? "" : raw.substring(0, 1).toUpperCase();
            String type = "Unknown";
            List<FieldDefinitionDTO> schemaFields = Collections.emptyList();

            switch (firstChar) {
                case "H":
                    type = "Header";
                    schemaFields = headerFields;
                    break;
                case "D":
                    type = "Data";
                    schemaFields = dataFields;
                    break;
                case "T":
                    type = "Trailer";
                    schemaFields = trailerFields;
                    break;
            }

            List<ParsedFieldDTO> fields = new ArrayList<>();
            boolean lineIsValid = true;
            String globalError = null;
            List<String> alignmentTips = new ArrayList<>();

            // Length mismatch check
            if (raw.length() != expectedLineLength) {
                lineIsValid = false;
                globalError = String.format("Length Mismatch (%d/%d)", raw.length(), expectedLineLength);

                // Detect leading shift
                int trimStartCount = raw.length() - raw.stripLeading().length();
                if (trimStartCount > 0) {
                    alignmentTips
                            .add(String.format("%d leading space(s) detected. Row starts at index %d instead of 1.",
                                    trimStartCount, trimStartCount + 1));
                }

                // Detect relative shift for known anchors
                if ("Header".equals(type) && !"MRX".equals(detectedSchema)) {
                    int primeIdx = raw.indexOf("PRIME");
                    if (primeIdx != -1 && primeIdx != 1) {
                        int diff = primeIdx - 1;
                        alignmentTips.add(
                                String.format("Shift detected near 'PRIME': Fields are pushed %d char(s) to the %s.",
                                        Math.abs(diff), diff > 0 ? "right" : "left"));
                    }
                }

                if (raw.length() > expectedLineLength) {
                    alignmentTips.add(String.format("Line is OVERFLOWING. Delete %d char(s) to restore alignment.",
                            raw.length() - expectedLineLength));
                } else {
                    alignmentTips.add(String.format("Line readable but SHORT. Add %d space(s) at the end.",
                            expectedLineLength - raw.length()));
                }
            }

            // Parse fields
            if (!"Unknown".equals(type)) {
                for (FieldDefinitionDTO fieldDef : schemaFields) {
                    int startIdx = fieldDef.getStart() - 1;
                    int endIdx = fieldDef.getEnd();

                    String value;
                    if (startIdx >= raw.length()) {
                        value = "";
                    } else if (endIdx > raw.length()) {
                        value = raw.substring(startIdx);
                        // Pad to expected length
                        value = value + " ".repeat(endIdx - startIdx - value.length());
                    } else {
                        value = raw.substring(startIdx, endIdx);
                    }

                    boolean fieldValid = true;
                    String fieldError = null;

                    // 1. Check Expected Value
                    if (fieldDef.getExpectedValue() != null && !value.trim().equals(fieldDef.getExpectedValue())) {
                        fieldValid = false;
                        fieldError = String.format("Expected '%s', found '%s'", fieldDef.getExpectedValue(), value);
                    }

                    // 2. Custom validations
                    if (fieldValid) {
                        // Date validation
                        if (fieldDef.getName().contains("Date") && "Numeric".equals(fieldDef.getType())
                                && fieldDef.getLength() == 8) {
                            String trimmed = value.trim();
                            if (!trimmed.isEmpty() && !trimmed.matches("^\\d{8}$")) {
                                fieldValid = false;
                                fieldError = "Must be YYYYMMDD";
                            }
                        }
                        // Status validation for ACK
                        if ("Status".equals(fieldDef.getName()) && "ACK".equals(detectedSchema)) {
                            String trimmed = value.trim();
                            if (!trimmed.isEmpty() && !trimmed.equals("A") && !trimmed.equals("R")) {
                                fieldValid = false;
                                fieldError = "Must be 'A' or 'R'";
                            }
                        }
                    }

                    // 3. Type validation (Numeric)
                    if (fieldValid && "Numeric".equals(fieldDef.getType())) {
                        String trimmed = value.trim();
                        if (!trimmed.isEmpty() && !trimmed.matches("^\\s*\\d+\\s*$")) {
                            fieldValid = false;
                            fieldError = "Must be numeric";
                        }
                    }

                    if (!fieldValid)
                        lineIsValid = false;

                    fields.add(ParsedFieldDTO.builder()
                            .def(fieldDef)
                            .value(value)
                            .isValid(fieldValid)
                            .error(fieldError)
                            .build());
                }
            } else {
                lineIsValid = false;
                globalError = "Unknown Record Type (Must be H, D, or T)";
            }

            parsedLines.add(ParsedLineDTO.builder()
                    .lineNumber(lineNumber)
                    .raw(raw)
                    .type(type)
                    .fields(fields)
                    .isValid(lineIsValid)
                    .globalError(globalError)
                    .rawLength(raw.length())
                    .alignmentTips(alignmentTips.isEmpty() ? null : alignmentTips)
                    .build());
        }

        // Calculate summary
        int validCount = (int) parsedLines.stream().filter(ParsedLineDTO::isValid).count();
        int acceptedCount;
        int rejectedCount;

        if ("RESP".equals(detectedSchema)) {
            acceptedCount = (int) parsedLines.stream()
                    .filter(l -> "Data".equals(l.getType()))
                    .filter(l -> l.getFields().stream().anyMatch(f -> "MRx Claim Status".equals(f.getDef().getName()) &&
                            ("PD".equals(f.getValue().trim()) || "PA".equals(f.getValue().trim()))))
                    .count();
            rejectedCount = (int) parsedLines.stream()
                    .filter(l -> "Data".equals(l.getType()))
                    .filter(l -> l.getFields().stream().anyMatch(
                            f -> "MRx Claim Status".equals(f.getDef().getName()) && "DY".equals(f.getValue().trim())))
                    .count();
        } else if ("MRX".equals(detectedSchema)) {
            acceptedCount = (int) parsedLines.stream().filter(l -> "Data".equals(l.getType())).count();
            rejectedCount = 0;
        } else {
            // ACK
            acceptedCount = (int) parsedLines.stream()
                    .filter(l -> "Data".equals(l.getType()))
                    .filter(l -> l.getFields().stream()
                            .anyMatch(f -> "Status".equals(f.getDef().getName()) && "A".equals(f.getValue())))
                    .count();
            rejectedCount = (int) parsedLines.stream()
                    .filter(l -> "Data".equals(l.getType()))
                    .filter(l -> l.getFields().stream()
                            .anyMatch(f -> "Status".equals(f.getDef().getName()) && "R".equals(f.getValue())))
                    .count();
        }

        SummaryDTO summary = SummaryDTO.builder()
                .total(parsedLines.size())
                .valid(validCount)
                .invalid(parsedLines.size() - validCount)
                .accepted(acceptedCount)
                .rejected(rejectedCount)
                .build();

        log.info("Parsing completed. Schema: {}, Total: {}, Valid: {}, Accepted: {}, Rejected: {}",
                detectedSchema, parsedLines.size(), validCount, acceptedCount, rejectedCount);

        return UnifiedParseResponse.builder()
                .lines(parsedLines)
                .summary(summary)
                .detectedSchema(detectedSchema)
                .rawContent(fileContent)
                .build();
    }

    // ========================================================================
    // MRX CONVERSION: Generate ACK content from MRX content
    // ========================================================================

    public String convertMrxToAck(String mrxContent, String timestamp) {
        UnifiedParseResponse mrxResult = parseFile(mrxContent, null);
        List<String> lines = new ArrayList<>();
        String dateStr = timestamp.length() >= 8 ? timestamp.substring(0, 8) : timestamp;

        // Find header
        ParsedLineDTO mrxHeader = mrxResult.getLines().stream()
                .filter(l -> "Header".equals(l.getType()))
                .findFirst().orElse(null);

        // --- ACK HEADER ---
        StringBuilder header = new StringBuilder("H");
        header.append(pad("PRIME", 25, ' ', true));
        header.append(pad("BCBSMN", 25, ' ', true));
        header.append(dateStr);

        String originalFileName = "";
        if (mrxHeader != null) {
            originalFileName = getFieldValue(mrxHeader, "Original File Name");
        }
        if (originalFileName.isEmpty()) {
            originalFileName = "BCBSMN_PRIME_CLAIMS_" + timestamp + ".txt";
        }
        header.append(pad(originalFileName, 47, ' ', true));
        header.append(pad("", 114, ' ', true));
        lines.add(pad(header.toString(), 220, ' ', true));

        // --- ACK DATA ---
        List<ParsedLineDTO> dataLines = mrxResult.getLines().stream()
                .filter(l -> "Data".equals(l.getType()) && l.isValid())
                .toList();

        for (ParsedLineDTO mrxLine : dataLines) {
            String claimId = getFieldValue(mrxLine, "Sender Claim Number");
            String lineNum = getFieldValue(mrxLine, "Claim Line Number");
            String memberId = getFieldValue(mrxLine, "Member ID");
            String patientId = getFieldValue(mrxLine, "Patient ID");
            String provNpi = getFieldValue(mrxLine, "Rendering Provider NPI #");
            String provTaxId = getFieldValue(mrxLine, "Provider Tax ID Number");

            StringBuilder line = new StringBuilder("D");
            line.append(pad(claimId, 20, ' ', true));
            line.append(padNum(lineNum, 5));
            line.append(pad(memberId, 30, ' ', true));
            line.append(pad(patientId, 38, ' ', true));
            line.append(pad(provNpi, 16, ' ', true));
            line.append(pad(provNpi, 12, ' ', true));
            line.append(pad(provTaxId, 10, ' ', true));
            line.append("A");
            line.append(pad("", 7, ' ', true));
            line.append(pad("", 80, ' ', true));
            lines.add(pad(line.toString(), 220, ' ', true));
        }

        // --- ACK TRAILER ---
        StringBuilder trailer = new StringBuilder("T");
        trailer.append(pad("TRAILER", 7, ' ', true));
        trailer.append(pad(String.valueOf(dataLines.size()), 20, ' ', true));
        trailer.append(pad("", 192, ' ', true));
        lines.add(pad(trailer.toString(), 220, ' ', true));

        return String.join("\n", lines);
    }

    // ========================================================================
    // MRX CONVERSION: Generate RESP content from MRX content
    // ========================================================================

    public String convertMrxToResp(String mrxContent, String timestamp) {
        UnifiedParseResponse mrxResult = parseFile(mrxContent, null);
        List<String> lines = new ArrayList<>();
        String dateStr = timestamp.length() >= 8 ? timestamp.substring(0, 8) : timestamp;

        // --- RESP HEADER ---
        StringBuilder header = new StringBuilder("H");
        header.append("PRIME");
        header.append(pad("BCBSMN", 25, ' ', true));
        header.append(dateStr); // Creation Date
        header.append(dateStr); // Selection From
        header.append(dateStr); // Selection To
        header.append(pad("", 175, ' ', true));
        lines.add(pad(header.toString(), 230, ' ', true));

        // --- RESP DATA ---
        List<ParsedLineDTO> dataLines = mrxResult.getLines().stream()
                .filter(l -> "Data".equals(l.getType()))
                .toList();

        Random random = new Random();
        for (ParsedLineDTO mrxLine : dataLines) {
            String claimId = getFieldValue(mrxLine, "Sender Claim Number");
            String lineNum = getFieldValue(mrxLine, "Claim Line Number");
            String memberId = getFieldValue(mrxLine, "Member ID");
            String patientId = getFieldValue(mrxLine, "Patient ID");
            String provNpi = getFieldValue(mrxLine, "Rendering Provider NPI #");
            String provTin = getFieldValue(mrxLine, "Provider Tax ID Number");
            String mrxClaimNum = "PAYCODE" + String.format("%05d", random.nextInt(100000));
            String mrxLineNum = "001";

            String allowedAmt = getFieldValue(mrxLine, "Allowed Amount");
            if (allowedAmt.isEmpty())
                allowedAmt = "0";
            String units = getFieldValue(mrxLine, "Units/Quantity");
            if (units.isEmpty())
                units = "0";
            String procCode = getFieldValue(mrxLine, "Procedure Code");

            StringBuilder line = new StringBuilder("D");
            line.append(pad(claimId, 20, ' ', true));
            line.append(pad(lineNum, 5, ' ', true));
            line.append(pad(memberId, 30, ' ', true));
            line.append(pad(patientId, 38, ' ', true));
            line.append(pad(provNpi, 12, ' ', true));
            line.append(pad(provTin, 9, ' ', true));
            line.append(pad(mrxClaimNum, 12, ' ', true));
            line.append(pad(mrxLineNum, 3, ' ', true));
            line.append(padNum(allowedAmt, 9));
            line.append(padNum(units, 9));
            line.append(padNum("0", 9));
            line.append("PD");
            line.append(pad("", 10, ' ', true));
            line.append(pad("", 20, ' ', true));
            line.append(pad(procCode, 8, ' ', true));
            line.append("A"); // Response Ind
            line.append("Y"); // ITS Ind
            line.append(" "); // Filler
            line.append(pad("", 17, ' ', true)); // SCCF
            line.append(pad("", 3, ' ', true)); // Adj Reason
            line.append(pad("207104", 10, ' ', true)); // Client Num
            lines.add(pad(line.toString(), 230, ' ', true));
        }

        // --- RESP TRAILER ---
        String trailer = "TTRAILER" + dataLines.size();
        lines.add(pad(trailer, 230, ' ', true));

        return String.join("\n", lines);
    }

    // ========================================================================
    // MRX CONVERSION: Generate CSV from MRX content
    // ========================================================================

    public String convertMrxToCsv(String mrxContent) {
        UnifiedParseResponse mrxResult = parseFile(mrxContent, null);
        List<ParsedLineDTO> dataLines = mrxResult.getLines().stream()
                .filter(l -> "Data".equals(l.getType()))
                .toList();

        if (dataLines.isEmpty())
            return "";

        // Get headers from first data line's field definitions
        List<String> headers = dataLines.get(0).getFields().stream()
                .map(f -> f.getDef().getName())
                .toList();

        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", headers)).append("\n");

        for (ParsedLineDTO line : dataLines) {
            List<String> values = line.getFields().stream()
                    .map(f -> "\"" + f.getValue().trim() + "\"")
                    .toList();
            csv.append(String.join(",", values)).append("\n");
        }

        return csv.toString();
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    private String detectSchema(String fileContent, String fileNameHint) {
        if (fileContent == null || fileContent.trim().isEmpty())
            return "INVALID";

        String firstLine = fileContent.split("\\r?\\n")[0];
        if (firstLine.trim().isEmpty())
            return "INVALID";

        // Check by line length (same logic as frontend)
        if (firstLine.length() >= 900)
            return "MRX";
        if (firstLine.length() >= 230)
            return "RESP";
        if (firstLine.length() >= 220)
            return "ACK";

        // Content-based heuristics
        if (firstLine.trim().length() > 0) {
            int primeIndex = firstLine.indexOf("PRIME");
            if (primeIndex >= 1 && primeIndex <= 5)
                return "RESP";
            if (firstLine.length() < 100)
                return "INVALID";
            return "ACK";
        }

        return "INVALID";
    }

    private int getExpectedLineLength(String schema) {
        return switch (schema) {
            case "ACK" -> ACK_LINE_LENGTH;
            case "RESP" -> RESP_LINE_LENGTH;
            case "MRX" -> MRX_LINE_LENGTH;
            default -> 0;
        };
    }

    private List<FieldDefinitionDTO> getHeaderFields(String schema) {
        return switch (schema) {
            case "ACK" -> ACK_HEADER;
            case "RESP" -> RESP_HEADER;
            case "MRX" -> MRX_HEADER;
            default -> Collections.emptyList();
        };
    }

    private List<FieldDefinitionDTO> getDataFields(String schema) {
        return switch (schema) {
            case "ACK" -> ACK_DATA;
            case "RESP" -> RESP_DATA;
            case "MRX" -> MRX_DATA;
            default -> Collections.emptyList();
        };
    }

    private List<FieldDefinitionDTO> getTrailerFields(String schema) {
        return switch (schema) {
            case "ACK" -> ACK_TRAILER;
            case "RESP" -> RESP_TRAILER;
            case "MRX" -> MRX_TRAILER;
            default -> Collections.emptyList();
        };
    }

    private static FieldDefinitionDTO field(String name, int start, int end, int length, String type,
            String expectedValue, String description) {
        return FieldDefinitionDTO.builder()
                .name(name)
                .start(start)
                .end(end)
                .length(length)
                .type(type)
                .expectedValue(expectedValue)
                .description(description)
                .build();
    }

    private String getFieldValue(ParsedLineDTO line, String fieldName) {
        return line.getFields().stream()
                .filter(f -> fieldName.equals(f.getDef().getName()))
                .map(f -> f.getValue().trim())
                .findFirst()
                .orElse("");
    }

    private String pad(String value, int length, char ch, boolean leftAligned) {
        if (value == null)
            value = "";
        if (value.length() >= length)
            return value.substring(0, length);
        String padding = String.valueOf(ch).repeat(length - value.length());
        return leftAligned ? value + padding : padding + value;
    }

    private String padNum(String value, int length) {
        if (value == null)
            value = "0";
        value = value.trim();
        if (value.length() >= length)
            return value.substring(0, length);
        return "0".repeat(length - value.length()) + value;
    }
}
