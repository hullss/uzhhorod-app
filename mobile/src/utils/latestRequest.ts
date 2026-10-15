// Ignore late responses after a newer search, a changed direction, or leaving a screen.
export class LatestRequest {
  private revision = 0;
  begin() { return ++this.revision; }
  invalidate() { this.revision++; }
  isCurrent(revision: number) { return revision === this.revision; }
}
