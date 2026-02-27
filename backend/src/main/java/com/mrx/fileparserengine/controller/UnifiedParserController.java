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
     * Get all available layout definitions.
     * Returns YAML layout configurations for ACK, RESP, and MRX file types.
     *
     * @return Map of layout name to FileLayout object
     */
    @GetMapping("/layouts")
    public ResponseEntity<?> getLayouts() {
        try {
            return ResponseEntity.ok(unifiedParserService.getAllLayouts());
        } catch (Exception e) {
            log.error("Error fetching layouts", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch layouts"));
        }
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

    private static final String ALLOWED_TIMESTAMP_PATTERN = "^[a-zA-Z0-9_-]*$";

    /**
     * Validate timestamp to prevent security issues (XSS, Path Traversal).
     * 
     * @param timestamp The input timestamp string
     * @throws IllegalArgumentException if invalid
     */
    private void validateTimestamp(String timestamp) {
        if (timestamp != null && !timestamp.isEmpty() && !timestamp.matches(ALLOWED_TIMESTAMP_PATTERN)) {
            throw new IllegalArgumentException(
                    "Invalid timestamp format. Only alphanumeric characters, hyphens, and underscores are allowed.");
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
            // SECURITY: Validate input to prevent XSS/Injection in filename
            validateTimestamp(timestamp);

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

        } catch (IllegalArgumentException e) {
            log.warn("Security validation failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
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
            // SECURITY: Validate input
            validateTimestamp(timestamp);

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

        } catch (IllegalArgumentException e) {
            log.warn("Security validation failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
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
            String timestamp = java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));

            String csvContent = unifiedParserService.convertMrxToCsv(fileContent);

            return ResponseEntity.ok(Map.of(
                    "content", csvContent,
                    "fileName", "TEST.MCMSMN_CLAIMS_EXPORT_" + timestamp + ".csv"));

        } catch (IOException e) {
            log.error("Error reading file for CSV conversion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error converting MRX to CSV", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
