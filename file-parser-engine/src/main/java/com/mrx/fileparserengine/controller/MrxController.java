package com.mrx.fileparserengine.controller;

import com.mrx.fileparserengine.dto.MrxFileResponse;
import com.mrx.fileparserengine.service.MrxParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * REST Controller for MRX file operations
 */
@Slf4j
@RestController
@RequestMapping("/api/mrx")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MrxController {

    private final MrxParserService mrxParserService;

    /**
     * Parse MRX file from uploaded file
     * 
     * @param file The uploaded MRX file
     * @return Parsed MRX file response
     */
    @PostMapping("/parse")
    public ResponseEntity<MrxFileResponse> parseMrxFile(@RequestParam("file") MultipartFile file) {
        try {
            log.info("Received MRX file upload: {}", file.getOriginalFilename());

            // Read file content
            String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);

            // Parse file
            MrxFileResponse response = mrxParserService.parseMrxFile(fileContent);

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Error reading uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("Error parsing MRX file", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Parse MRX file from raw text content
     * 
     * @param fileContent The raw file content
     * @return Parsed MRX file response
     */
    @PostMapping("/parse-text")
    public ResponseEntity<MrxFileResponse> parseMrxText(@RequestBody String fileContent) {
        try {
            log.info("Received MRX text content for parsing");

            // Parse file
            MrxFileResponse response = mrxParserService.parseMrxFile(fileContent);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error parsing MRX text", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
