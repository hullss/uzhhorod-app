package ua.uzhhorod.digital;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.cors.allowed-origins=http://localhost:8083,http://127.0.0.1:8083")
@AutoConfigureMockMvc
class WebCorsConfigurationTest {
    @Autowired private MockMvc mvc;

    @Test void allowedOriginGetsCorsHeaders() throws Exception {
        mvc.perform(get("/api/transport/status").header("Origin", "http://localhost:8083"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8083"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }

    @Test void accountPreflightAllowsBearerAndJson() throws Exception {
        mvc.perform(options("/api/account/login").header("Origin", "http://127.0.0.1:8083")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:8083"));
    }

    @Test void unknownOriginsAreRejected() throws Exception {
        mvc.perform(get("/api/transport/status").header("Origin", "https://untrusted.example"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test void nativeRequestsDoNotNeedCors() throws Exception {
        mvc.perform(get("/api/transport/status")).andExpect(status().isOk());
    }

    @Test void wildcardAndNullOriginsAreNotAccepted() {
        assertThatThrownBy(() -> new WebCorsConfiguration("*")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WebCorsConfiguration("null")).isInstanceOf(IllegalArgumentException.class);
    }
}
