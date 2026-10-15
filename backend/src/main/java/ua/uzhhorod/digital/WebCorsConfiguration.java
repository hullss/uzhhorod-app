package ua.uzhhorod.digital;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Browser access is an explicit allowlist, not a replacement for endpoint authentication. */
@Configuration
public class WebCorsConfiguration implements WebMvcConfigurer {
    private final String[] origins;

    public WebCorsConfiguration(@Value("${app.cors.allowed-origins:}") String origins) {
        this.origins = Arrays.stream(origins.split(",")).map(String::trim)
                .filter(origin -> !origin.isEmpty()).toArray(String[]::new);
        if (Arrays.stream(this.origins).anyMatch(origin -> origin.contains("*") || origin.equals("null"))) {
            throw new IllegalArgumentException("CORS origins must be explicit browser origins");
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (origins.length == 0) return;
        registry.addMapping("/api/**").allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Authorization")
                .allowCredentials(false).maxAge(600);
    }
}
