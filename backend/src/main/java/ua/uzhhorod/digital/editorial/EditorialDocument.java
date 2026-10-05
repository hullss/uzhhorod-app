package ua.uzhhorod.digital.editorial;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "editorial_documents")
class EditorialDocument {
    @Id
    private String documentKey;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected EditorialDocument() { }

    EditorialDocument(String documentKey, String content) {
        this.documentKey = documentKey;
        update(content);
    }

    String getContent() { return content; }
    Instant getUpdatedAt() { return updatedAt; }
    void update(String nextContent) { content = nextContent; updatedAt = Instant.now(); }
}
