// This linter is a fork of Codemirror's built-in javascript linter that enables top-level
// await usage. It does this by wrapping the text in an async function, then offsetting any
// lint errors to account for the wrapper.
//
// The major modifications are marked in comments starting with "CHANGED ---"
import CodeMirror from 'codemirror';
import { JSHINT, type LintError, LintOptions } from 'jshint';
CodeMirror.registerHelper('lint', 'javascript', validator);

interface ValidationError {
  message: string;
  severity: string;
  from: CodeMirror.Position;
  to: CodeMirror.Position;
}

function validator(text: string, options: LintOptions): ValidationError[] {
  if (!options.indent) {
    // JSHint error.character actually is a column index, this fixes underlining on lines using tabs for indentation
    options.indent = 1;
  }

  // JSHint default value is 4
  // CHANGED ----------------------------------------------------------- //
  // Wrap text with async function to "enable" top-level await
  const textWithWrapper = `async function asyncWrapper() {\n${text}\n}`;
  JSHINT(textWithWrapper, options, options.globals);
  const errors = JSHINT.data()?.errors;
  const result: ValidationError[] = [];

  if (errors) {
    parseErrors(errors, result);
  }

  return result;
}

function parseErrors(errors: LintError[], output: ValidationError[]) {
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
