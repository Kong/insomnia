import dompurify, { type Config } from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  breaks: false,
  pedantic: false,
  smartypants: false,
  headerIds: false,
  mangle: false,
});

export const markdownToHTML = (input: string, config?: Config) => dompurify.sanitize(marked.parse(input), config);

// Allowlist for untrusted markdown (e.g. plugin READMEs). Using ALLOWED_TAGS instead of
// FORBID_TAGS means every tag not listed here — including any future resource-loading element —
// is stripped by default. The set covers all output that GFM markdown (marked ^5) can produce.
// 'class' is required for highlight.js to attach syntax-highlighting tokens to <code> blocks.
const GFM_ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'a', 'span', 'div',
];

const GFM_ALLOWED_ATTR = ['href', 'title', 'class'];

export const markdownToHTMLSafe = (input: string) =>
  dompurify.sanitize(marked.parse(input), {
    ALLOWED_TAGS: GFM_ALLOWED_TAGS,
    ALLOWED_ATTR: GFM_ALLOWED_ATTR,
  });
