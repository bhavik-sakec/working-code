package com.mrx.fileparserengine.controller;

import com.mrx.fileparserengine.dto.AckFileResponse;
import com.mrx.fileparserengine.service.AckParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * REST Controller for ACK file operations
 */
@Slf4j
@RestController
@RequestMapping("/api/ack")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AckController {

    private final AckParserService ackParserService;

    /**
     * Parse ACK file from uploaded file
     * 
     * @param file The uploaded ACK file
     * @return Parsed ACK file response
     */
    @PostMapping("/parse")
    public ResponseEntity<AckFileResponse> parseAckFile(@RequestParam("file") MultipartFile file) {
        try {
            log.info("Received ACK file upload: {}", file.getOriginalFilename());

            // Read file content
            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);

            // Parse file
            AckFileResponse response = ackParserService.parseAckFile(fileContent);

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Error reading uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error parsing ACK file", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Parse ACK file from raw text content
     * 
     * @param fileContent The raw file content
     * @return Parsed ACK file response
     */
    @PostMapping("/parse-text")
    public ResponseEntity<AckFileResponse> parseAckText(@RequestBody String fileContent) {
        try {
            log.info("Received ACK text content for parsing");

            // Parse file
            AckFileResponse response = ackParserService.parseAckFile(fileContent);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error parsing ACK text", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
