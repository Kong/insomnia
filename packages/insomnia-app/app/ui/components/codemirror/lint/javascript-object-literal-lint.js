// @flow
import CodeMirror from 'codemirror';
import { JSHINT } from 'jshint';

export function objectLiteralValidator(text, updateLinting) {
  const textWithWrapper = `(\n${text}\n);`;

  JSHINT(textWithWrapper, { expr: true, indent: 1 });

  const errors = JSHINT.data().errors;
  const result = [];

  if (errors) {
    parseErrors(errors, result);
  }

  updateLinting(result);
}

function parseErrors(errors, output) {
  for (let i = 0; i < errors.length; i++) {
    const error = errors[i];
    if (error) {
      if (error.line <= 0) {
        if (window.console) {
          window.console.warn(
            'Cannot display JSHint error (invalid line ' + error.line + ')',
            error,
          );
        }
        continue;
      }

      const start = error.character - 1;
      let end = start + 1;
      if (error.evidence) {
        const index = error.evidence.substring(start).search(/.\b/);
        if (index > -1) {
          end += index;
        }
      }

      // Convert to format expected by validation service
      const hint = {
        message: error.reason,
        severity: error.code ? (error.code.startsWith('W') ? 'warning' : 'error') : 'error',
        from: CodeMirror.Pos(error.line - 1, start),
        to: CodeMirror.Pos(error.line - 1, end),
      };

      // CHANGED ----------------------------------------------------------- //
      // Offset an extra line to account for async wrapper function
      hint.from.line -= 1;
      hint.to.line -= 1;

      output.push(hint);
    }
  }
}
