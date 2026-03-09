package com.mrx.fileparserengine.service;

import com.mrx.fileparserengine.model.FileLayout;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.Constructor;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class LayoutLoaderService {

    private static final List<String> LAYOUT_FILES = List.of(
            "layouts/mrx.yaml",
            "layouts/ack.yaml",
            "layouts/resp.yaml");

    private final Map<String, FileLayout> layouts = new HashMap<>();

    @PostConstruct
    public void init() {
        loadLayouts();
    }

    private void loadLayouts() {
        LoaderOptions options = new LoaderOptions();
        Yaml yaml = new Yaml(new Constructor(FileLayout.class, options));

        for (String path : LAYOUT_FILES) {
            Resource resource = new ClassPathResource(path);
            if (!resource.exists()) {
                log.warn("Layout file not found: {}", path);
                continue;
            }
            try (InputStream is = resource.getInputStream()) {
                FileLayout layout = yaml.load(is);
                layouts.put(layout.getName().toUpperCase(), layout);
                log.info("Loaded layout: {}", layout.getName());
            } catch (Exception e) {
                log.error("Failed to load layout: {}", path, e);
            }
        }

        log.info("Total layouts loaded: {}", layouts.size());
    }

    public FileLayout getLayout(String type) {
        return layouts.get(type.toUpperCase());
    }

    public Map<String, FileLayout> getAllLayouts() {
        return new HashMap<>(layouts);
    }
}
