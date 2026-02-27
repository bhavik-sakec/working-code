package com.mrx.fileparserengine.controller;

import com.mrx.fileparserengine.dto.RespFileResponse;
import com.mrx.fileparserengine.service.RespParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * REST Controller for RESP file operations
 */
@Slf4j
@RestController
@RequestMapping("/api/resp")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RespController {

    private final RespParserService respParserService;

    /**
     * Parse RESP file from uploaded file
     * 
     * @param file The uploaded RESP file
     * @return Parsed RESP file response
     */
    @PostMapping("/parse")
    public ResponseEntity<RespFileResponse> parseRespFile(@RequestParam("file") MultipartFile file) {
        try {
            log.info("Received RESP file upload: {}", file.getOriginalFilename());

            // Read file content
            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);

            // Parse file
            RespFileResponse response = respParserService.parseRespFile(fileContent);

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Error reading uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error parsing RESP file", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Parse RESP file from raw text content
     * 
     * @param fileContent The raw file content
     * @return Parsed RESP file response
     */
    @PostMapping("/parse-text")
    public ResponseEntity<RespFileResponse> parseRespText(@RequestBody String fileContent) {
        try {
            log.info("Received RESP text content for parsing");

            // Parse file
            RespFileResponse response = respParserService.parseRespFile(fileContent);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error parsing RESP text", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
