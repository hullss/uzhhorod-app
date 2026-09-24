package ua.uzhhorod.digital;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class UzhhorodDigitalApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(UzhhorodDigitalApiApplication.class, args);
    }
}
