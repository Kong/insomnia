import dompurify from 'dompurify';
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

declare const safeHTMLBrand: unique symbol;
// Nominal type: only markdownToHTML can produce one, so a value typed as
// SafeHTML is traceable back to having passed through DOMPurify. Anything
// consuming raw untrusted text for dangerouslySetInnerHTML must go through
// this function instead of casting a plain string.
export type SafeHTML = string & { readonly [safeHTMLBrand]: never };

export const markdownToHTML = (input: string): SafeHTML => dompurify.sanitize(marked.parse(input)) as SafeHTML;
