import { getLocale } from "../i18n/locale";
export type NewsBlock = { type: "paragraph" | "heading" | "listItem"; text: string };
export type NewsLink = { title: string; url: string };
export type OfficialNewsArticle = {
  title: string;
  sourceUrl: string;
  publishedLabel: string | null;
  preview: string;
  blocks: NewsBlock[];
  links: NewsLink[];
  imageUrl: string | null;
  fullTextAvailable: boolean;
};

export function newsDateLabel(value: string): string {
  const date = /^(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\s+(\d{1,2}),\s*(\d{4})$/iu.exec(value.trim());
  if (!date) return value;
  if (getLocale() === "uk-UA") return `${Number(date[2])} ${date[1]} ${date[3]}`;
  const months = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  const parsed = new Date(Date.UTC(Number(date[3]), months.indexOf(date[1].toLowerCase()), Number(date[2]), 12));
  return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function readableText(value: string): string {
  const named: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', apos: "'", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", lt: "<", gt: ">" };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const point = code.toLowerCase().startsWith("#x") ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  });
}
export function safeNewsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// Older backends return preview only. Never present that response as a complete article.
export function decodeOfficialNewsArticle(value: unknown, item: { title: string; sourceUrl: string; publishedLabel: string | null }): OfficialNewsArticle {
  if (!object(value)) throw new Error("Не вдалося прочитати новину. Спробуйте ще раз.");
  const validBlocks = Array.isArray(value.blocks) && value.blocks.every(block => object(block)
    && ["paragraph", "heading", "listItem"].includes(String(block.type)) && typeof block.text === "string" && block.text.trim().length > 0);
  const blocks = validBlocks ? value.blocks as NewsBlock[] : [];
  const fullTextAvailable = value.fullTextAvailable === true && blocks.length > 0;
  const links: NewsLink[] = [];
  if (fullTextAvailable && Array.isArray(value.links)) for (const link of value.links) {
    if (!object(link) || typeof link.title !== "string") continue;
    const url = safeNewsUrl(link.url);
    if (url && !links.some(other => other.url === url)) links.push({ title: link.title.trim() || "Відкрити посилання", url });
  }
  let imageUrl = safeNewsUrl(value.imageUrl);
  if (imageUrl && (new URL(imageUrl).protocol !== "https:" || new URL(imageUrl).host !== new URL(item.sourceUrl).host)) imageUrl = null;
  return {
    title: readableText(typeof value.title === "string" && value.title.trim() ? value.title.trim() : item.title),
    // Navigation uses the original list item, not a replacement URL from the response.
    sourceUrl: item.sourceUrl,
    publishedLabel: typeof value.publishedLabel === "string" && value.publishedLabel.trim() ? value.publishedLabel : item.publishedLabel,
    preview: typeof value.preview === "string" ? readableText(value.preview).replace(/^Опубліковано:[^\n]*\n\s*/, "") : "",
    blocks: fullTextAvailable ? blocks : [], links, imageUrl, fullTextAvailable,
  };
}
