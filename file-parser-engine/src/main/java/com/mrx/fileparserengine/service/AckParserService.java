package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.dto.AckFileResponse;
import com.mrx.fileparserengine.dto.FileStatistics;
import com.mrx.fileparserengine.model.AckDataRecord;
import com.mrx.fileparserengine.model.HeaderRecord;
import com.mrx.fileparserengine.model.TrailerRecord;
import com.mrx.fileparserengine.util.FixedWidthParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Service for parsing ACK files
 */
@Slf4j
@Service
public class AckParserService {

    /**
     * Parse ACK file content
     * 
     * @param fileContent The raw file content
     * @return Parsed ACK file response
     */
    public AckFileResponse parseAckFile(String fileContent) {
        log.info("Starting ACK file parsing");

        HeaderRecord header = null;
        List<AckDataRecord> dataRecords = new ArrayList<>();
        TrailerRecord trailer = null;

        long acceptedCount = 0;
        long rejectedCount = 0;

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
                        AckDataRecord dataRecord = parseAckDataRecord(line);
                        dataRecords.add(dataRecord);

                        // Count accepted/rejected
                        if ("A".equalsIgnoreCase(dataRecord.getAckStatus())) {
                            acceptedCount++;
                        } else if ("R".equalsIgnoreCase(dataRecord.getAckStatus())) {
                            rejectedCount++;
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
            log.error("Error parsing ACK file", e);
            throw new RuntimeException("Failed to parse ACK file: " + e.getMessage(), e);
        }

        // Calculate statistics
        FileStatistics statistics = FileStatistics.builder()
                .totalRecords((long) dataRecords.size())
                .acceptedCount(acceptedCount)
                .rejectedCount(rejectedCount)
                .build();

        log.info("ACK file parsing completed. Total: {}, Accepted: {}, Rejected: {}",
                dataRecords.size(), acceptedCount, rejectedCount);

        return AckFileResponse.builder()
                .header(header)
                .dataRecords(dataRecords)
                .trailer(trailer)
                .statistics(statistics)
                .build();
    }

    /**
     * Parse ACK header record
     */
    private HeaderRecord parseHeaderRecord(String line) {
        return HeaderRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .prime(FixedWidthParser.extract(line, 2, 6))
                .sender(FixedWidthParser.extract(line, 7, 31))
                .creationDate(FixedWidthParser.extract(line, 32, 39))
                .selectionFromDate(FixedWidthParser.extract(line, 40, 47))
                .selectionToDate(FixedWidthParser.extract(line, 48, 55))
                .filler(FixedWidthParser.extract(line, 56, 220))
                .build();
    }

    /**
     * Parse ACK data record
     */
    private AckDataRecord parseAckDataRecord(String line) {
        return AckDataRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .claimNumber(FixedWidthParser.extract(line, 2, 21))
                .claimLineNumber(FixedWidthParser.extract(line, 22, 26))
                .memberId(FixedWidthParser.extract(line, 27, 56))
                .ackStatus(FixedWidthParser.extract(line, 158, 159))
                .rejectCode(FixedWidthParser.extract(line, 160, 169))
                .rawLine(line)
                .build();
    }

    /**
     * Parse trailer record
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
                .filler(FixedWidthParser.extract(line, 29, 220))
                .build();
    }
}
