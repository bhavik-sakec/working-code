package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.dto.FileStatistics;
import com.mrx.fileparserengine.dto.MrxFileResponse;
import com.mrx.fileparserengine.model.HeaderRecord;
import com.mrx.fileparserengine.model.MrxDataRecord;
import com.mrx.fileparserengine.model.TrailerRecord;
import com.mrx.fileparserengine.util.FixedWidthParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Service for parsing MRX files
 */
@Slf4j
@Service
public class MrxParserService {

    /**
     * Parse MRX file content
     * 
     * @param fileContent The raw file content
     * @return Parsed MRX file response
     */
    public MrxFileResponse parseMrxFile(String fileContent) {
        log.info("Starting MRX file parsing");

        HeaderRecord header = null;
        List<MrxDataRecord> dataRecords = new ArrayList<>();
        TrailerRecord trailer = null;

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
                        MrxDataRecord dataRecord = parseMrxDataRecord(line);
                        dataRecords.add(dataRecord);
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
            log.error("Error parsing MRX file", e);
            throw new RuntimeException("Failed to parse MRX file: " + e.getMessage(), e);
        }

        // Calculate statistics
        FileStatistics statistics = FileStatistics.builder()
                .totalRecords((long) dataRecords.size())
                .build();

        log.info("MRX file parsing completed. Total records: {}", dataRecords.size());

        return MrxFileResponse.builder()
                .header(header)
                .dataRecords(dataRecords)
                .trailer(trailer)
                .statistics(statistics)
                .build();
    }

    /**
     * Parse MRX header record
     */
    private HeaderRecord parseHeaderRecord(String line) {
        return HeaderRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .sender(FixedWidthParser.extract(line, 2, 26))
                .creationDate(FixedWidthParser.extract(line, 27, 34))
                .filler(FixedWidthParser.extract(line, 35, 921))
                .build();
    }

    /**
     * Parse MRX data record
     */
    private MrxDataRecord parseMrxDataRecord(String line) {
        return MrxDataRecord.builder()
                .recordType(FixedWidthParser.extract(line, 1, 1))
                .senderClaimNumber(FixedWidthParser.extract(line, 12, 31))
                .claimLineNumber(FixedWidthParser.extract(line, 32, 36))
                .memberId(FixedWidthParser.extract(line, 37, 66))
                .patientId(FixedWidthParser.extract(line, 67, 104))
                .patientFirstName(FixedWidthParser.extract(line, 105, 119))
                .patientLastName(FixedWidthParser.extract(line, 135, 159))
                .patientDob(FixedWidthParser.extract(line, 268, 275))
                .providerTaxId(FixedWidthParser.extract(line, 279, 288))
                .renderingProviderNpi(FixedWidthParser.extract(line, 433, 444))
                .serviceFromDate(FixedWidthParser.extract(line, 610, 617))
                .diagnosisCode(FixedWidthParser.extract(line, 632, 641))
                .procedureCode(FixedWidthParser.extract(line, 672, 679))
                .unitsQuantity(FixedWidthParser.extract(line, 688, 696))
                .billedAmount(FixedWidthParser.extract(line, 729, 737))
                .allowedAmount(FixedWidthParser.extract(line, 738, 746))
                .adjustmentIdentifier(FixedWidthParser.extract(line, 768, 768))
                .rawLine(line)
                .build();
    }

    /**
     * Parse trailer record (common for MRX, ACK, RESP)
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
