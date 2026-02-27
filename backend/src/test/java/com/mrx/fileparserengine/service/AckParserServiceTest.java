package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.dto.AckFileResponse;
import com.mrx.fileparserengine.model.AckDataRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AckParserServiceTest {

    @Autowired
    private AckParserService ackParserService;

    @Test
    void testParseAckFile() {
        // Sample ACK file content - 220 characters per line
        // Header: positions 1-220
        String header = String.format("%-220s", "HPRIME BCBSMN                   202602132026010120260131");

        // Data record 1: Accepted claim
        // Record type (1), Claim# (2-21), Line# (22-26), Member ID (27-56), ... Status
        // (158-159), Reject Code (160-169)
        StringBuilder data1 = new StringBuilder();
        data1.append("D"); // 1: Record type
        data1.append(String.format("%-20s", "12345678901234567890")); // 2-21: Claim number
        data1.append(String.format("%-5s", "00001")); // 22-26: Line number
        data1.append(String.format("%-30s", "MEM123456789")); // 27-56: Member ID
        data1.append(String.format("%-101s", "")); // 57-157: Filler
        data1.append("A "); // 158-159: Status
        data1.append(String.format("%-60s", "")); // 160-220: Rest

        // Data record 2: Rejected claim
        StringBuilder data2 = new StringBuilder();
        data2.append("D"); // 1: Record type
        data2.append(String.format("%-20s", "98765432109876543210")); // 2-21: Claim number
        data2.append(String.format("%-5s", "00002")); // 22-26: Line number
        data2.append(String.format("%-30s", "MEM987654321")); // 27-56: Member ID
        data2.append(String.format("%-101s", "")); // 57-157: Filler
        data2.append("R "); // 158-159: Status
        data2.append(String.format("%-10s", "EDI3108")); // 160-169: Reject code
        data2.append(String.format("%-50s", "")); // 170-220: Rest

        // Trailer: Record type (1), Trailer text (2-8), Total records (9-28)
        StringBuilder trailerBuilder = new StringBuilder();
        trailerBuilder.append("T"); // 1: Record type
        trailerBuilder.append(String.format("%-7s", "TRAILER")); // 2-8: Trailer text
        trailerBuilder.append(String.format("%20s", "2")); // 9-28: Total records (right-aligned, 20 chars)
        trailerBuilder.append(String.format("%-192s", "")); // 29-220: Filler
        String trailer = trailerBuilder.toString();

        String ackContent = header + "\n" + data1 + "\n" + data2 + "\n" + trailer;

        AckFileResponse response = ackParserService.parseAckFile(ackContent);

        // Verify header
        assertNotNull(response.getHeader());
        assertEquals("H", response.getHeader().getRecordType());
        assertEquals("PRIME", response.getHeader().getPrime());
        assertEquals("BCBSMN", response.getHeader().getSender());

        // Verify data records
        assertEquals(2, response.getDataRecords().size());

        AckDataRecord record1 = response.getDataRecords().get(0);
        assertEquals("D", record1.getRecordType());
        assertEquals("12345678901234567890", record1.getClaimNumber());
        assertEquals("00001", record1.getClaimLineNumber());
        assertEquals("A", record1.getAckStatus());

        AckDataRecord record2 = response.getDataRecords().get(1);
        assertEquals("R", record2.getAckStatus());
        assertEquals("EDI3108", record2.getRejectCode());

        // Verify statistics
        assertEquals(2L, response.getStatistics().getTotalRecords());
        assertEquals(1L, response.getStatistics().getAcceptedCount());
        assertEquals(1L, response.getStatistics().getRejectedCount());

        // Verify trailer
        assertNotNull(response.getTrailer());
        assertEquals("T", response.getTrailer().getRecordType());
        assertEquals(2L, response.getTrailer().getTotalRecords());
    }
}
