import marked from 'marked';

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  // @ts-expect-error -- TSCONVERSION missing from marked types
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: false,
});

export function markdownToHTML(markdown) {
  return marked(markdown);
}
