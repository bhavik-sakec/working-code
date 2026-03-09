package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.dto.SummaryDTO;
import com.mrx.fileparserengine.model.FileLayout;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class SessionManager {

    @Data
    @Builder
    public static class FileSession {
        private String id;
        private Path filePath;
        private String schema;
        private FileLayout layout;
        private List<Long> lineOffsets;
        private List<Integer> dataLineIndexes; // Indices of lines starting with 'D'
        private List<Integer> errorLines;
        private SummaryDTO summary;
        private String status; // "INDEXING", "COMPLETED", "FAILED"
        private long totalBytes;
        private long processedBytes;
        private int totalLinesToIndex;
        private int indexedLines;
        private boolean isCompleted;
        private volatile boolean cancelled; // Handle mid-process termination
        private String fileName;
        private long createdAt;
    }

    private final Map<String, FileSession> sessions = new ConcurrentHashMap<>();

    public void saveSession(FileSession session) {
        // Simple eviction: remove oldest if more than 20 sessions to allow for more active workspaces
        if (sessions.size() >= 20) {
            String oldestId = sessions.entrySet().stream()
                    .filter(e -> !e.getValue().getStatus().equals("INDEXING")) // Try to preserve active ones
                    .min(Comparator.comparingLong(e -> e.getValue().getCreatedAt()))
                    .map(Map.Entry::getKey)
                    .orElseGet(() -> sessions.entrySet().stream() // If all indexing, take oldest anyway
                        .min(Comparator.comparingLong(e -> e.getValue().getCreatedAt()))
                        .map(Map.Entry::getKey)
                        .orElse(null));

            if (oldestId != null) {
                FileSession evicted = sessions.remove(oldestId);
                if (evicted != null && "INDEXING".equals(evicted.getStatus())) {
                    evicted.setCancelled(true);
                    log.info("Evicting active session {}. Thread termination requested.", oldestId);
                } else {
                    log.info("Evicting old session: {}", oldestId);
                }
            }
        }
        sessions.put(session.getId(), session);
    }

    public FileSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    public void removeSession(String sessionId) {
        sessions.remove(sessionId);
    }
}
