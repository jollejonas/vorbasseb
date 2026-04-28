const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  "*": new Set(["class", "id"]),
};

function sanitizeAttrs(tag: string, attrStr: string): string {
  const allowed = new Set([
    ...(ALLOWED_ATTRS[tag] ?? []),
    ...(ALLOWED_ATTRS["*"] ?? []),
  ]);
  return attrStr.replace(/(\w[\w-]*)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/g, (m, name) => {
    if (!allowed.has(name.toLowerCase())) return "";
    if (name.toLowerCase() === "href" || name.toLowerCase() === "src") {
      const valMatch = m.match(/=\s*["']?([^"'\s>]*)["']?/);
      const val = valMatch?.[1] ?? "";
      if (/^javascript:/i.test(val.trim())) return "";
    }
    return m;
  });
}

export function sanitizeHtml(html: string): string {
  // Strip script/style/event-handler tags entirely
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Process tags
  out = out.replace(/<(\/?)(\w[\w-]*)((?:\s[^>]*)?)\s*\/?>/g, (match, close, tag, attrs) => {
    const lower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) return "";
    if (close) return `</${lower}>`;
    const sanitizedAttrs = sanitizeAttrs(lower, attrs || "");
    return `<${lower}${sanitizedAttrs ? " " + sanitizedAttrs.trim() : ""}>`;
  });

  return out;
}
