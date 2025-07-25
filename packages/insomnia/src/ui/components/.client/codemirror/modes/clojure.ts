import CodeMirror from 'codemirror';

CodeMirror.extendMode('clojure', { fold: 'brace' } as Partial<CodeMirror.Mode<any>>);
