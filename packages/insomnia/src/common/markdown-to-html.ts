import dompurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  breaks: false,
  pedantic: false,
  smartLists: true,
  smartypants: false,
});

export const markdownToHTML = (input: string) => dompurify.sanitize(marked.parse(input));
