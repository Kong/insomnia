// This linter override allows Nunjuck templates to be rendered before attempting
// the linting process to ensure accurate parsing of values is completed.
// It still uses under the hood the jsonlint-mod-fixed library found at
// https://github.com/circlecell/jsonlint-mod/blob/master/lib/jsonlint.js

import 'codemirror/addon/lint/json-lint';

import CodeMirror from 'codemirror';
import * as jsonlint from 'jsonlint-mod-fixed';

import { render } from '../../../../../../insomnia/src/templating/index';
CodeMirror.registerHelper('lint', 'json', validator);

interface ValidationError {
  message: string;
  from: CodeMirror.Position;
  to: CodeMirror.Position;
}

async function validator(text: string): Promise<ValidationError[]> {
  const found: ValidationError[] = [];

  // Override jsonlint's parseError function so we pull the errors into our collection of ValidationErrors
  jsonlint.parser.parseError = (str: string, hash: jsonlint.ParseErrorHash) => {
    if (hash.line && !(hash.loc)) {
      found.push({
        from: CodeMirror.Pos(hash.line),
        to: CodeMirror.Pos(hash.line),
        message: str,
      });
    } else if (hash.loc) {
      const loc = hash.loc;
      found.push({
        from: CodeMirror.Pos(loc.first_line - 1, loc.first_column),
        to: CodeMirror.Pos(loc.last_line - 1, loc.last_column),
        message: str,
      });
    }
  };

  // Render any Nunjucks templates before attempting to parse
  const renderedText: string | null = await render(text, {});
  if (renderedText) {
    try {
      jsonlint.parse(renderedText);
    } catch (e) {}
  }

  return found;
}
