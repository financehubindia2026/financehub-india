// scripts/lib/markdown.js
// -----------------------------------------------------------------------------
// Configures the Markdown -> HTML renderer used for every article body.
// Supports: headings (with anchor ids for TOC), lists, tables, code blocks,
// images, blockquotes, admonitions/notes, links, video embeds, raw HTML
// blocks, footnotes, and emoji shortcodes.
// -----------------------------------------------------------------------------
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import footnote from "markdown-it-footnote";
import container from "markdown-it-container";
import { full as emoji } from "markdown-it-emoji";

const md = new MarkdownIt({
  html: true, // allow raw HTML blocks in article markdown
  linkify: true,
  typographer: true,
  breaks: false,
});

md.use(anchor, {
  slugify: (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-"),
  level: [2, 3],
  tabIndex: false,
});
md.use(footnote);
md.use(emoji);

// Admonitions / notes: ::: note | tip | warning | danger  ... :::
const ADMONITION_TYPES = {
  note: { label: "Note", icon: "📝" },
  tip: { label: "Tip", icon: "💡" },
  warning: { label: "Warning", icon: "⚠️" },
  danger: { label: "Important", icon: "🚫" },
};
for (const [type, { label, icon }] of Object.entries(ADMONITION_TYPES)) {
  md.use(container, type, {
    render(tokens, idx) {
      if (tokens[idx].nesting === 1) {
        const info = tokens[idx].info.trim().slice(type.length).trim();
        const title = info || label;
        return `<div class="admonition admonition-${type}"><p class="admonition-title">${icon} ${md.utils.escapeHtml(
          title
        )}</p>\n`;
      }
      return "</div>\n";
    },
  });
}

// Video embeds: ::: video https://youtube.com/watch?v=XXXX :::
md.use(container, "video", {
  validate(params) {
    return params.trim().match(/^video\s+(\S+)/);
  },
  render(tokens, idx) {
    if (tokens[idx].nesting === 1) {
      const m = tokens[idx].info.trim().match(/^video\s+(\S+)/);
      const url = m ? m[1] : "";
      const embedUrl = toEmbedUrl(url);
      return `<div class="video-embed"><iframe src="${embedUrl}" title="Embedded video" loading="lazy" allowfullscreen frameborder="0"></iframe><div class="video-embed-extra" hidden>`;
    }
    return `</div></div>\n`;
  },
});

function toEmbedUrl(url) {
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
}

/**
 * Renders Markdown body text to HTML, and post-processes <img> tags to add
 * loading="lazy" for performance (Step 15: Image Processing).
 */
export function renderMarkdown(source) {
  let html = md.render(source);
  html = html.replace(/<img (?![^>]*loading=)/g, '<img loading="lazy" ');
  return html;
}

export default md;
