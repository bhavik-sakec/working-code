package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.model.FileLayout;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.Constructor;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class LayoutLoaderService {

    private final Map<String, FileLayout> layouts = new HashMap<>();

    @PostConstruct
    public void init() {
        loadLayouts();
    }

    private void loadLayouts() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:layouts/*.yaml");

            LoaderOptions options = new LoaderOptions();
            Yaml yaml = new Yaml(new Constructor(FileLayout.class, options));

            for (Resource resource : resources) {
                try (InputStream is = resource.getInputStream()) {
                    FileLayout layout = yaml.load(is);
                    layouts.put(layout.getName().toUpperCase(), layout);
                    log.info("Loaded layout: {}", layout.getName());
                }
            }
        } catch (Exception e) {
            log.error("Failed to load layouts", e);
        }
    }

    public FileLayout getLayout(String type) {
        return layouts.get(type.toUpperCase());
    }

    public Map<String, FileLayout> getAllLayouts() {
        return new HashMap<>(layouts);
    }
}
