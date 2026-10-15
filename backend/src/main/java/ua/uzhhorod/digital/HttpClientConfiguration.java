package ua.uzhhorod.digital;

import java.time.Duration;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

/** Every provider has a deadline, even when the phone abandons its own request. */
@Configuration
class HttpClientConfiguration {
    @Bean RestClientCustomizer providerTimeouts() {
        return builder -> {
            var factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(3));
            factory.setReadTimeout(Duration.ofSeconds(8));
            builder.requestFactory(factory);
        };
    }
}
