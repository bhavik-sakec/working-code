package com.mrx.fileparserengine.controller;

import com.mrx.fileparserengine.service.UnifiedParserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UnifiedParserControllerSecurityTest {

    @Mock
    private UnifiedParserService unifiedParserService;

    @InjectMocks
    private UnifiedParserController controller;

    @Test
    void testConvertMrxToAck_InvalidTimestamp_ShouldReturnBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "test.mrx", "text/plain", "content".getBytes());
        // Injection attempt
        ResponseEntity<Map<String, String>> response = controller.convertMrxToAck(file, "<script>alert(1)</script>");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().containsKey("error"));
        assertEquals("Invalid timestamp format. Only alphanumeric characters, hyphens, and underscores are allowed.",
                response.getBody().get("error"));
    }

    @Test
    void testConvertMrxToAck_PathTraversal_ShouldReturnBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "test.mrx", "text/plain", "content".getBytes());
        // Path traversal attempt
        ResponseEntity<Map<String, String>> response = controller.convertMrxToAck(file, "../../../etc/passwd");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().containsKey("error"));
    }

    @Test
    void testConvertMrxToAck_ValidTimestamp_ShouldReturnOk() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.mrx", "text/plain", "content".getBytes());
        when(unifiedParserService.convertMrxToAck(anyString(), anyString())).thenReturn("ACK_CONTENT");

        ResponseEntity<Map<String, String>> response = controller.convertMrxToAck(file, "20231010_120000");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("ACK_CONTENT", response.getBody().get("content"));
    }

    @Test
    void testConvertMrxToResp_InvalidTimestamp_ShouldReturnBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "test.mrx", "text/plain", "content".getBytes());
        // Special characters attempt
        ResponseEntity<Map<String, String>> response = controller.convertMrxToResp(file, "2023@#$");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().containsKey("error"));
    }
}
