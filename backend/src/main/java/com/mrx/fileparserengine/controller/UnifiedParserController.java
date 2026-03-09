package com.mrx.fileparserengine.controller;

import com.mrx.fileparserengine.dto.SessionResponseDTO;
import com.mrx.fileparserengine.dto.UnifiedParseResponse;
import com.mrx.fileparserengine.service.UnifiedParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/**
 * Unified REST Controller for file parsing operations.
 * This single endpoint handles ACK, RESP, and MRX files with auto-detection.
 * Returns data in the format expected by the frontend's GridView components.
 */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.PUT, RequestMethod.OPTIONS}, allowedHeaders = "*")
public class UnifiedParserController {

    private final UnifiedParserService unifiedParserService;

    /**
     * Handle MultipartException - when a non-multipart request is sent to a
     * multipart endpoint.
     */
    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<Map<String, String>> handleMultipartException(MultipartException e) {
        log.warn("Multipart request error: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of(
                        "error", "Request must be sent as multipart/form-data with a 'file' parameter",
                        "hint", "For raw text content, use /api/unified/parse-text endpoint instead"));
    }

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
     * ⚡ Returns Callable&lt;ResponseEntity&gt; — Spring MVC executes it on an async
     * thread pool with a 5-minute timeout (configured in AsyncConfig).
     * Without async, a 40K-line MRX file blocks the Tomcat NIO thread for
     * ~20–40 seconds during parsing + JSON serialization, hitting the default
     * 30s connection timeout and returning nothing to the browser.
     *
     * @param file The uploaded file
     * @return Unified parse response (async for all files)
     */
    @PostMapping(value = "/parse", consumes = "multipart/form-data")
    public java.util.concurrent.Callable<ResponseEntity<UnifiedParseResponse>> parseFile(
            @RequestParam("file") MultipartFile file) {

        final String fileNameHint = file.getOriginalFilename();
        final Path tempFile;

        try {
            tempFile = Files.createTempFile("mrx_upload_" + UUID.randomUUID(), ".tmp");
            file.transferTo(tempFile.toFile());
            log.info("Saved upload to temp file: {} ({} bytes)", tempFile, Files.size(tempFile));
        } catch (IOException e) {
            log.error("Error saving uploaded file to disk", e);
            return () -> ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }

        log.info("Received file upload for unified parsing: {}", fileNameHint);

        return () -> {
            try {
                long start = System.currentTimeMillis();
                UnifiedParseResponse response = unifiedParserService.parseFile(tempFile, fileNameHint);

                // Cleanup temp file after parsing
                Files.deleteIfExists(tempFile);

                long parseMs = System.currentTimeMillis() - start;
                int lineCount = response.getLines() != null ? response.getLines().size() : 0;
                long usedMem = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
                log.info("Parsed {} lines in {}ms. Schema: {}. Memory: {}MB", lineCount, parseMs, response.getDetectedSchema(), usedMem);

                return ResponseEntity.ok(response);

            } catch (Exception e) {
                log.error("Error parsing content from Path", e);
                // Try cleanup in case of error
                try {
                    Files.deleteIfExists(tempFile);
                } catch (IOException ignored) {
                }
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        };
    }

    /**
     * Stream parse any file (ACK/RESP/MRX) with auto-detection.
     * Returns NDJSON stream for incremental frontend loading.
     *
     * @param file The uploaded file
     * @return Streaming response
     */
    @PostMapping(value = "/parse-stream", consumes = "multipart/form-data")
    public ResponseEntity<StreamingResponseBody> parseFileStream(
            @RequestParam("file") MultipartFile file) {

        final String fileNameHint = file.getOriginalFilename();
        final Path tempFile;

        try {
            tempFile = Files.createTempFile("mrx_stream_" + UUID.randomUUID(), ".tmp");
            file.transferTo(tempFile.toFile());
            log.info("Saved upload to temp file for streaming: {} ({} bytes)", tempFile, Files.size(tempFile));
        } catch (IOException e) {
            log.error("Error saving uploaded file to disk", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }

        log.info("Starting unified streaming parse for: {}", fileNameHint);

        try {
            StreamingResponseBody stream = unifiedParserService.parseToStream(tempFile, fileNameHint);

            return ResponseEntity.ok()
                    .header("Content-Type", "application/x-ndjson")
                    .body(outputStream -> {
                        try {
                            stream.writeTo(outputStream);
                        } finally {
                            try {
                                Files.deleteIfExists(tempFile);
                                log.info("Cleaned up streaming temp file: {}", tempFile);
                            } catch (IOException e) {
                                log.warn("Failed to delete temp file: {}", tempFile);
                            }
                        }
                    });
        } catch (Exception e) {
            log.error("Failed to initialize streaming parse", e);
            try {
                Files.deleteIfExists(tempFile);
            } catch (IOException ignored) {
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Parse raw text content with auto-detection.
     * ⚡ Uses async Callable (same as /parse endpoint).
     *
     * @param fileContent The raw file content
     * @return Unified parse response
     */
    @PostMapping("/parse-text")
    public java.util.concurrent.Callable<ResponseEntity<UnifiedParseResponse>> parseText(
            @RequestBody String fileContent) {

        log.info("Received text content for unified parsing ({} chars)", fileContent.length());

        return () -> {
            try {
                long parseStart = System.currentTimeMillis();
                UnifiedParseResponse response = unifiedParserService.parseFile(fileContent, null);
                long parseMs = System.currentTimeMillis() - parseStart;
                long usedMem = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);

                int lineCount = response.getLines() != null ? response.getLines().size() : 0;
                log.info("Parsed {} lines in {}ms. Schema: {}. Memory: {}MB", lineCount, parseMs, response.getDetectedSchema(), usedMem);

                return ResponseEntity.ok(response);

            } catch (Exception e) {
                log.error("Error parsing text content", e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        };
    }

    /** Expected fixed line length for the MRX protocol. */
    private static final int MRX_LINE_LENGTH = 921;

    /**
     * Validates that every non-empty line in an MRX file is exactly MRX_LINE_LENGTH
     * chars.
     * Returns an error message if a violation is found, or null if the file is
     * clean.
     * Only reads the file once (BufferedReader, fast scan — no parsing).
     */
    private String validateMrxLineLengths(Path filePath) throws IOException {
        try (java.io.BufferedReader reader = Files.newBufferedReader(filePath,
                java.nio.charset.StandardCharsets.ISO_8859_1)) {
            int lineNum = 0;
            String line;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isEmpty())
                    continue;
                if (line.length() != MRX_LINE_LENGTH) {
                    return String.format(
                            "Structural integrity check failed: Line %d has %d characters (expected %d). " +
                                    "All MRX lines must be exactly %d characters. Fix the data before converting.",
                            lineNum, line.length(), MRX_LINE_LENGTH, MRX_LINE_LENGTH);
                }
            }
        }
        return null; // Clean
    }

    private static final String ALLOWED_TIMESTAMP_PATTERN = "^[a-zA-Z0-9._-]*$";

    /**
     * Validate timestamp to prevent security issues (XSS, Path Traversal).
     * 
     * @param timestamp The input timestamp string
     * @throws IllegalArgumentException if invalid
     */
    private void validateTimestamp(String timestamp) {
        if (timestamp != null && !timestamp.isEmpty() && !timestamp.matches(ALLOWED_TIMESTAMP_PATTERN)) {
            throw new IllegalArgumentException(
                    "Invalid timestamp format. Only alphanumeric characters, dots, hyphens, and underscores are allowed.");
        }
    }

    /**
     * Clean timestamp to prevent double extensions and ensure consistent format.
     * Removes existing .txt, .TXT, .csv, .CSV from the end.
     */
    private String cleanTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isEmpty())
            return timestamp;
        // Normalize: case-insensitive removal of common extensions
        return timestamp.replaceAll("(?i)\\.(txt|csv)$", "");
    }

    /**
     * Convert MRX file content to ACK format.
     *
     * @param file      The MRX file
     * @param timestamp Optional timestamp for the generated file name
     * @return Generated ACK file content
     */
    @PostMapping(value = { "/mrx/convert/ack", "/convert/mrx-to-ack" }, consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> convertMrxToAck(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "timestamp", defaultValue = "") String timestamp,
            @RequestParam(value = "rejectPercentage", defaultValue = "0") int rejectPercentage,
            @RequestParam(value = "rejectCount", defaultValue = "0") int rejectCount,
            @RequestParam(value = "randomizeRejectCodes", defaultValue = "false") boolean randomizeRejectCodes) {
        try {
            // SECURITY: Validate input to prevent XSS/Injection in filename
            validateTimestamp(timestamp);
            timestamp = cleanTimestamp(timestamp);

            long usedMemStart = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
            log.info("Converting MRX to ACK. Memory: {}MB", usedMemStart);

            Path tempFile = Files.createTempFile("mrx_ack_" + UUID.randomUUID(), ".tmp");
            file.transferTo(tempFile.toFile());

            // ── STRUCTURAL INTEGRITY GATE ──
            String lengthError = validateMrxLineLengths(tempFile);
            if (lengthError != null) {
                Files.deleteIfExists(tempFile);
                log.warn("ACK conversion blocked — MRX structural error: {}", lengthError);
                return ResponseEntity.status(HttpStatus.valueOf(422))
                        .body(Map.of("error", lengthError));
            }

            if (timestamp.isEmpty()) {
                timestamp = java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
            }
            String datePart = timestamp.length() >= 8 ? timestamp.substring(0, 8) : timestamp;

            String ackContent = unifiedParserService.convertMrxToAck(tempFile, timestamp,
                    Math.max(0, Math.min(100, rejectPercentage)), rejectCount, randomizeRejectCodes);

            // Cleanup
            Files.deleteIfExists(tempFile);

            long usedMemEnd = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
            return ResponseEntity.ok(Map.of(
                    "content", ackContent,
                    "fileName", "TEST.PRIME_BCBSMN_GEN_CLAIMS_ACK_" + datePart + ".txt",
                    "memoryUsed", usedMemEnd + "MB"));

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
    @PostMapping(value = { "/mrx/convert/resp", "/convert/mrx-to-resp" }, consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> convertMrxToResp(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "timestamp", defaultValue = "") String timestamp,
            @RequestParam(value = "denyPercentage", defaultValue = "0") int denyPercentage,
            @RequestParam(value = "denyCount", defaultValue = "0") int denyCount,
            @RequestParam(value = "denialCode", defaultValue = "") String denialCode,
            @RequestParam(value = "partialPercentage", defaultValue = "0") int partialPercentage,
            @RequestParam(value = "partialCount", defaultValue = "0") int partialCount,
            @RequestParam(value = "partialApprovedPercent", defaultValue = "50") int partialApprovedPercent,
            @RequestParam(value = "randomizeDenialCodes", defaultValue = "false") boolean randomizeDenialCodes) {
        try {
            validateTimestamp(timestamp);
            timestamp = cleanTimestamp(timestamp);

            long usedMemStart = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
            log.info("Converting MRX to RESP [deny={}%, partial={}%]. Memory: {}MB", denyPercentage, partialPercentage, usedMemStart);

            Path tempFile = Files.createTempFile("mrx_resp_" + UUID.randomUUID(), ".tmp");
            file.transferTo(tempFile.toFile());

            // ── STRUCTURAL INTEGRITY GATE ──
            String lengthError = validateMrxLineLengths(tempFile);
            if (lengthError != null) {
                Files.deleteIfExists(tempFile);
                log.warn("RESP conversion blocked — MRX structural error: {}", lengthError);
                return ResponseEntity.status(HttpStatus.valueOf(422))
                        .body(Map.of("error", lengthError));
            }

            if (timestamp.isEmpty()) {
                timestamp = java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
            }
            String datePart = timestamp.length() >= 8 ? timestamp.substring(0, 8) : timestamp;

            String respContent = unifiedParserService.convertMrxToResp(
                    tempFile, timestamp,
                    Math.max(0, Math.min(100, denyPercentage)), denyCount, denialCode,
                    Math.max(0, Math.min(100, partialPercentage)), partialCount,
                    Math.max(1, Math.min(99, partialApprovedPercent)),
                    randomizeDenialCodes);

            // Cleanup
            Files.deleteIfExists(tempFile);

            long usedMemEnd = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
            return ResponseEntity.ok(Map.of(
                    "content", respContent,
                    "fileName", "TEST.PRIME.BCBSMN_GEN_CLAIM_RESP_" + datePart + ".txt",
                    "memoryUsed", usedMemEnd + "MB"));

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
    @PostMapping(value = { "/mrx/convert/csv", "/convert/mrx-to-csv" }, consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> convertMrxToCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "timestamp", defaultValue = "") String timestamp) {
        try {
            log.info("Converting MRX to CSV");

            Path tempFile = Files.createTempFile("mrx_csv_" + UUID.randomUUID(), ".tmp");
            file.transferTo(tempFile.toFile());

            if (timestamp.isEmpty()) {
                timestamp = java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
            }
            String datePart = timestamp.length() >= 8 ? timestamp.substring(0, 8) : timestamp;

            String csvContent = unifiedParserService.convertMrxToCsv(tempFile);

            // Cleanup
            Files.deleteIfExists(tempFile);

            return ResponseEntity.ok(Map.of(
                    "content", csvContent,
                    "fileName", "CSV_MRX_" + datePart + ".csv"));

        } catch (IOException e) {
            log.error("Error reading file for CSV conversion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error converting MRX to CSV", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Unified validation endpoint for claim operations.
     * Supports two validation types via the 'type' field:
     *
     * - STATUS_CHANGE: Validates if a status change is allowed.
     * Required fields: 'unitsApproved' (int), 'newStatus' (string: PD/PA/DY)
     *
     * - PARTIAL_UNITS: Validates partial approval unit split.
     * Required fields: 'totalUnits', 'newApproved', 'newDenied' (all int)
     *
     * @param request Map containing 'type' and type-specific fields
     * @return Validation result with isValid flag, error message, and allowed
     *         statuses
     */
    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validate(@RequestBody Map<String, Object> request) {
        try {
            String type = (String) request.get("type");
            if (type == null || type.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("isValid", false, "error",
                                "Missing 'type' field. Use STATUS_CHANGE or PARTIAL_UNITS."));
            }

            Map<String, Object> result;

            switch (type) {
                case "STATUS_CHANGE" -> {
                    int unitsApproved = parseIntParam(request.get("unitsApproved"));
                    int totalUnits = parseIntParam(request.get("totalUnits"));
                    String newStatus = (String) request.get("newStatus");
                    log.info("Validating status change: unitsApproved={}, totalUnits={}, newStatus={}", unitsApproved,
                            totalUnits, newStatus);
                    result = unifiedParserService.validateStatusChange(unitsApproved, totalUnits, newStatus);
                }
                case "PARTIAL_UNITS" -> {
                    int totalUnits = parseIntParam(request.get("totalUnits"));
                    int newApproved = parseIntParam(request.get("newApproved"));
                    int newDenied = parseIntParam(request.get("newDenied"));
                    log.info("Validating partial units: total={}, approved={}, denied={}", totalUnits, newApproved,
                            newDenied);
                    result = unifiedParserService.validatePartialUnits(totalUnits, newApproved, newDenied);
                }
                default -> {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("isValid", false, "error",
                                    "Unknown type: " + type + ". Use STATUS_CHANGE or PARTIAL_UNITS."));
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error during validation", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("isValid", false, "error", "Invalid request: " + e.getMessage()));
        }
    }

    /**
     * ⚡ ELITE TIER: Initialize a large-file parsing session.
     * Indexes the file on the server and returns metadata + summary.
     */
    @PostMapping(value = "/session/init", consumes = "multipart/form-data")
    public ResponseEntity<SessionResponseDTO> initSession(
            @RequestParam("file") MultipartFile file) {

        final String fileNameHint = file.getOriginalFilename();
        final Path persistentFile;

        try {
            // In a pro system, we might move this to a dedicated "uploads" directory
            // For now we use temp files that persist for the session duration
            persistentFile = Files.createTempFile("mrx_session_" + UUID.randomUUID(), ".tmp");
            file.transferTo(persistentFile.toFile());
            log.info("Initialized session file: {} ({} bytes)", persistentFile, Files.size(persistentFile));

            SessionResponseDTO sessionResponse = unifiedParserService.createSession(persistentFile, fileNameHint);
            return ResponseEntity.ok(sessionResponse);
        } catch (IOException e) {
            log.error("Error initializing session", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * ⚡ ELITE TIER: Fetch a range of rows for an active session.
     * Enables O(1) random access to any part of a 10M line file.
     */
    @GetMapping("/session/{sessionId}/rows")
    public ResponseEntity<?> getSessionRows(
            @PathVariable String sessionId,
            @RequestParam(value = "start", defaultValue = "0") int start,
            @RequestParam(value = "limit", defaultValue = "200") int limit) {
        try {
            return ResponseEntity.ok(unifiedParserService.getSessionRows(sessionId, start, limit));
        } catch (Exception e) {
            log.error("Error fetching session rows", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * ⚡ ELITE TIER: Poll the status of a background indexing session.
     */
    @GetMapping("/session/{sessionId}/status")
    public ResponseEntity<Map<String, Object>> getSessionStatus(@PathVariable String sessionId) {
        return ResponseEntity.ok(unifiedParserService.getSessionStatus(sessionId));
    }

    /**
     * ⚡ ELITE TIER: Export the full file of the session.
     */
    @GetMapping("/session/{sessionId}/export")
    public ResponseEntity<org.springframework.core.io.Resource> exportSession(@PathVariable String sessionId) {
        try {
            Path filePath = unifiedParserService.getSessionFile(sessionId);
            if (filePath == null || !Files.exists(filePath)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            // Retrieve the original filename from a session
            var session = unifiedParserService.getSessionManager().getSession(sessionId);
            String originalFileName = "export.txt";
            if (session != null && session.getFileName() != null && !session.getFileName().isBlank()) {
                originalFileName = session.getFileName();
            }
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(filePath.toUri());
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + originalFileName + "\"")
                    .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, "text/plain; charset=ISO-8859-1")
                    .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                    .header(org.springframework.http.HttpHeaders.PRAGMA, "no-cache")
                    .contentLength(Files.size(filePath))
                    .body(resource);
        } catch (Exception e) {
            log.error("Error exporting session file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * ⚡ ELITE TIER: Execute a batch randomization/update on a large-file session.
     * Returns Callable to avoid blocking Tomcat NIO threads during I/O-heavy operations.
     */
    @PostMapping("/session/{sessionId}/batch-execute-stream")
    public ResponseEntity<StreamingResponseBody> batchExecuteSessionStream(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> config) {

        final String mode = (String) config.get("mode");
        final int pct = parseIntParam(config.get("pct"));
        final int count = parseIntParam(config.get("count"));
        final boolean randomizeCodes = (boolean) config.getOrDefault("randomizeCodes", false);
        final String denialCode = (String) config.getOrDefault("denialCode", "");

        log.info("Batch Streaming executing on session {}: mode={}, pct={}%", sessionId, mode, pct);

        StreamingResponseBody stream = unifiedParserService.applySessionBatchActionStream(
            sessionId, mode, pct, count, randomizeCodes, denialCode
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "application/x-ndjson")
                .body(stream);
    }

    @PostMapping("/session/{sessionId}/batch-execute")
    public java.util.concurrent.Callable<ResponseEntity<Map<String, Object>>> batchExecuteSession(

            @PathVariable String sessionId,
            @RequestBody Map<String, Object> config) {

        // Parse config on the request thread (fast, no I/O)
        final String mode = (String) config.get("mode");
        final int pct = parseIntParam(config.get("pct"));
        final int count = parseIntParam(config.get("count"));
        final boolean randomizeCodes = (boolean) config.getOrDefault("randomizeCodes", false);
        final String denialCode = (String) config.getOrDefault("denialCode", "");

        long usedMem = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
        log.info("Batch executing on session {}: mode={}, pct={}% . Memory: {}MB", sessionId, mode, pct, usedMem);

        // Execute on async thread pool — frees the NIO thread immediately
        return () -> {
            try {
                Map<String, Object> result = unifiedParserService.applySessionBatchAction(
                    sessionId, mode, pct, count, randomizeCodes, denialCode
                );
                return ResponseEntity.ok(result);
            } catch (Exception e) {
                log.error("Error during session batch execute", e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
            }
        };
    }

    /**
     * ⚡ ELITE TIER: Cancel an active background indexing session.
     */
    @DeleteMapping("/session/{sessionId}")
    public ResponseEntity<Void> cancelSession(@PathVariable String sessionId) {
        unifiedParserService.stopSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    private int parseIntParam(Object obj) {
        if (obj instanceof Number) {
            return ((Number) obj).intValue();
        } else if (obj instanceof String) {
            String str = ((String) obj).trim();
            return str.isEmpty() ? 0 : Integer.parseInt(str);
        }
        return 0;
    }

}
