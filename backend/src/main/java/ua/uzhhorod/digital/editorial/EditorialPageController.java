package ua.uzhhorod.digital.editorial;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class EditorialPageController {
    @GetMapping({"/admin", "/admin/"})
    public String editor() {
        return "forward:/admin/index.html";
    }
}
