package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.dto.FileStatistics;
import com.mrx.fileparserengine.dto.RespFileResponse;
import com.mrx.fileparserengine.model.HeaderRecord;
import com.mrx.fileparserengine.model.RespDataRecord;
import com.mrx.fileparserengine.model.TrailerRecord;
import com.mrx.fileparserengine.util.FixedWidthParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Service for parsing RESP files
 */
@Slf4j
@Service
public class RespParserService {

    /**
     * Parse RESP file content
     * 
     * @param fileContent The raw file content
     * @return Parsed RESP file response
     */
    public RespFileResponse parseRespFile(String fileContent) {
        log.info("Starting RESP file parsing");

        HeaderRecord header = null;
        List<RespDataRecord> dataRecords = new ArrayList<>();
        TrailerRecord trailer = null;

        long paidCount = 0;
        long deniedCount = 0;
        long partialCount = 0;

        try (BufferedReader reader = new BufferedReader(new StringReader(fileContent))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                if (line.trim().isEmpty()) {
                    continue;
                }

                // Get record type (first character)
                String recordType = FixedWidthParser.extract(line, 1, 1);

                switch (recordType) {
                    case "H":
                        header = parseHeaderRecord(line);
                        log.debug("Parsed header record at line {}", lineNumber);
                        break;
                    case "D":
                        RespDataRecord dataRecord = parseRespDataRecord(line);
                        dataRecords.add(dataRecord);

                        // Count status types
                        String status = dataRecord.getClaimStatus();
                        if ("PD".equalsIgnoreCase(status)) {
                            paidCount++;
                        } else if ("DY".equalsIgnoreCase(status)) {
                            deniedCount++;
                        } else if ("PA".equalsIgnoreCase(status)) {
                            partialCount++;
                        }
                        break;
                    case "T":
                        trailer = parseTrailerRecord(line);
                        log.debug("Parsed trailer record at line {}", lineNumber);
                        break;
                    default:
                        log.warn("Unknown record type '{}' at line {}", recordType, lineNumber);
                }
            }
        } catch (Exception e) {
            log.error("Error parsing RESP file", e);
            throw new RuntimeException("Failed to parse RESP file: " + e.getMessage(), e);
        }

        // Calculate statistics
        FileStatistics statistics = FileStatistics.builder()
                .totalRecords((long) dataRecords.size())
                .paidCount(paidCount)
                .deniedCount(deniedCount)
                .partialCount(partialCount)
                .build();

        log.info("RESP file parsing completed. Total: {}, Paid: {}, Denied: {}, Partial: {}",
                dataRecords.size(), paidCount, deniedCount, partialCount);

        return RespFileResponse.builder()
                .header(header)
                .dataRecords(dataRecords)
                .trailer(trailer)
                .statistics(statistics)
                .build();
    }

    /**
     * Parse RESP header record (230 characters)
     */
    private HeaderRecord parseHeaderRecord(String line) {
        return HeaderRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .prime(FixedWidthParser.extract(line, 2, 6))
                .sender(FixedWidthParser.extract(line, 7, 31))
                .creationDate(FixedWidthParser.extract(line, 32, 39))
                .selectionFromDate(FixedWidthParser.extract(line, 40, 47))
                .selectionToDate(FixedWidthParser.extract(line, 48, 55))
                .filler(FixedWidthParser.extract(line, 56, 230))
                .build();
    }

    /**
     * Parse RESP data record
     */
    private RespDataRecord parseRespDataRecord(String line) {
        return RespDataRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .claimNumber(FixedWidthParser.extract(line, 2, 21))
                .claimLineNumber(FixedWidthParser.extract(line, 22, 26))
                .mrxClaimNumber(FixedWidthParser.extract(line, 116, 127))
                .allowedAmount(FixedWidthParser.extract(line, 131, 139))
                .unitsApproved(FixedWidthParser.extract(line, 140, 148))
                .unitsDenied(FixedWidthParser.extract(line, 149, 157))
                .claimStatus(FixedWidthParser.extract(line, 158, 159))
                .denialCode(FixedWidthParser.extract(line, 160, 169))
                .authorizationNumber(FixedWidthParser.extract(line, 170, 189))
                .procedureCode(FixedWidthParser.extract(line, 190, 197))
                .rawLine(line)
                .build();
    }

    /**
     * Parse trailer record (230 characters)
     */
    private TrailerRecord parseTrailerRecord(String line) {
        String totalRecordsStr = FixedWidthParser.extract(line, 9, 28);
        Long totalRecords = null;

        try {
            if (!totalRecordsStr.isEmpty()) {
                totalRecords = Long.parseLong(totalRecordsStr);
            }
        } catch (NumberFormatException e) {
            log.warn("Failed to parse total records: {}", totalRecordsStr);
        }

        return TrailerRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .trailer(FixedWidthParser.extract(line, 2, 8))
                .totalRecords(totalRecords)
                .filler(FixedWidthParser.extract(line, 29, 230))
                .build();
    }
}
