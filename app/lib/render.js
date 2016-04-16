import nunjucks from 'nunjucks'

nunjucks.configure({autoescape: false});

export default function (template, context = {}) {
  return nunjucks.renderString(template, context);
}
