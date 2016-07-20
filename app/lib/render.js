import nunjucks from 'nunjucks';

nunjucks.configure({
  autoescape: false
});

export default function (template, context = {}) {
  try {
    return nunjucks.renderString(template, context);
  } catch (e) {
    throw new Error(
      e.message.replace('(unknown path)\n  ', '')
    );
  }
}
