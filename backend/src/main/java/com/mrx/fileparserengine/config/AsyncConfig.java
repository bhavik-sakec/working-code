package com.mrx.fileparserengine.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * ⚡ Async MVC Configuration for StreamingResponseBody support.
 *
 * When large files (40K+ MRX lines) are uploaded, the parse endpoint returns a
 * StreamingResponseBody that writes JSON directly to the HTTP output stream.
 * This requires an async task executor and a generous timeout.
 *
 * Without this config:
 * - Default async timeout is 30s → large file serialization times out
 * - Default thread pool may be exhausted under concurrent uploads
 */
@Configuration
public class AsyncConfig implements WebMvcConfigurer {

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        // 10 minutes — enough for 1M line MRX files to serialize to JSON safely
        configurer.setDefaultTimeout(600_000);

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("stream-json-");
        executor.initialize();
        configurer.setTaskExecutor(executor);
    }
}
