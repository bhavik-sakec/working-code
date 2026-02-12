package com.mrx.fileparserengine.controller;

import com.mrx.fileparserengine.dto.UnifiedParseResponse;
import com.mrx.fileparserengine.service.UnifiedParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Unified REST Controller for file parsing operations.
 * This single endpoint handles ACK, RESP, and MRX files with auto-detection.
 * Returns data in the format expected by the frontend's GridView components.
 */
@Slf4j
@RestController
@RequestMapping("/api/unified")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UnifiedParserController {

    private final UnifiedParserService unifiedParserService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of("status", "UP", "engine", "MAGELLAN-FORGE-V1"));
    }

    /**
     * Parse any file (ACK/RESP/MRX) with auto-detection.
     * Returns ParseResult-compatible JSON for the frontend.
     *
     * @param file The uploaded file
     * @return Unified parse response
     */
    @PostMapping("/parse")
    public ResponseEntity<UnifiedParseResponse> parseFile(@RequestParam("file") MultipartFile file) {
        try {
            log.info("Received file upload for unified parsing: {}", file.getOriginalFilename());

            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);
            String fileNameHint = file.getOriginalFilename();

            UnifiedParseResponse response = unifiedParserService.parseFile(fileContent, fileNameHint);

            if ("INVALID".equals(response.getDetectedSchema())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Error reading uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error parsing file", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Parse raw text content with auto-detection.
     *
     * @param fileContent The raw file content
     * @return Unified parse response
     */
    @PostMapping("/parse-text")
    public ResponseEntity<UnifiedParseResponse> parseText(@RequestBody String fileContent) {
        try {
            log.info("Received text content for unified parsing");

            UnifiedParseResponse response = unifiedParserService.parseFile(fileContent, null);

            if ("INVALID".equals(response.getDetectedSchema())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error parsing text content", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Convert MRX file content to ACK format.
     *
     * @param file      The MRX file
     * @param timestamp Optional timestamp for the generated file name
     * @return Generated ACK file content
     */
    @PostMapping("/mrx/convert/ack")
    public ResponseEntity<Map<String, String>> convertMrxToAck(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "timestamp", defaultValue = "") String timestamp) {
        try {
            log.info("Converting MRX to ACK");

            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);
            if (timestamp.isEmpty()) {
                timestamp = java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
            }

            String ackContent = unifiedParserService.convertMrxToAck(fileContent, timestamp);

            return ResponseEntity.ok(Map.of(
                    "content", ackContent,
                    "fileName", "TEST.MCMSMN_CLAIMS_ACK_" + timestamp + ".txt"));

        } catch (IOException e) {
            log.error("Error reading file for ACK conversion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error converting MRX to ACK", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Convert MRX file content to RESP format.
     *
     * @param file      The MRX file
     * @param timestamp Optional timestamp for the generated file name
     * @return Generated RESP file content
     */
    @PostMapping("/mrx/convert/resp")
    public ResponseEntity<Map<String, String>> convertMrxToResp(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "timestamp", defaultValue = "") String timestamp) {
        try {
            log.info("Converting MRX to RESP");

            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);
            if (timestamp.isEmpty()) {
                timestamp = java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
            }

            String respContent = unifiedParserService.convertMrxToResp(fileContent, timestamp);

            return ResponseEntity.ok(Map.of(
                    "content", respContent,
                    "fileName", "TEST.PRIME_BCBSMN_GEN_CLAIMS_RESP_" + timestamp + ".txt"));

        } catch (IOException e) {
            log.error("Error reading file for RESP conversion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error converting MRX to RESP", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Convert MRX file content to CSV format.
     *
     * @param file The MRX file
     * @return Generated CSV content
     */
    @PostMapping("/mrx/convert/csv")
    public ResponseEntity<Map<String, String>> convertMrxToCsv(@RequestParam("file") MultipartFile file) {
        try {
            log.info("Converting MRX to CSV");

            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);

            String csvContent = unifiedParserService.convertMrxToCsv(fileContent);

            return ResponseEntity.ok(Map.of(
                    "content", csvContent,
                    "fileName", "MRX_EXPORT.csv"));

        } catch (IOException e) {
            log.error("Error reading file for CSV conversion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error converting MRX to CSV", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
