import marked from 'marked';

const renderer = new marked.Renderer();

renderer.heading = function(text, level) {
  const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');

  return `<h${level}><a name="${escapedText}" class="anchor" href="#${escapedText}"><span class="header-link"></span></a>${text}</h${level}>`;
};

marked.setOptions({
  renderer: renderer,
  gfm: true,
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
