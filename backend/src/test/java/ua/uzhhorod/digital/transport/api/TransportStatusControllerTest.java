package ua.uzhhorod.digital.transport.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import ua.uzhhorod.digital.transport.domain.TransportRoute;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;

@SpringBootTest
@AutoConfigureMockMvc
class TransportStatusControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TransportRouteRepository routeRepository;

    @Test
    void returnsTransportModuleStatus() throws Exception {
        mockMvc.perform(get("/api/transport/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("available"));
    }

    @Test
    void returnsRoutesFromDatabase() throws Exception {
        routeRepository.save(new TransportRoute(
                UUID.randomUUID(), "uzh-18", "18", "вул. Шумна — мкрн. Доманинці", true));

        mockMvc.perform(get("/api/transport/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.externalId == 'uzh-18')]").exists());
    }

    @Test
    void searchesRoutesByNumber() throws Exception {
        routeRepository.save(new TransportRoute(
                UUID.randomUUID(), "uzh-20", "20", "вул. Перемоги — пл. Шандора Петефі", true));

        mockMvc.perform(get("/api/transport/routes").param("query", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].routeNumber").value("20"));
    }
}
