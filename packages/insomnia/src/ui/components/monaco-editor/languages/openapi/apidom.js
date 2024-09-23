import * as monaco from 'monaco-editor';

export const languageId = 'apidom';

export const conf = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],

  onEnterRules: [
    {
      beforeText: /:\s*$/,
      action: { indentAction: monaco.languages.IndentAction.Indent },
    },
    {
      beforeText: /-\s+\w*$/,
      action: { indentAction: monaco.languages.IndentAction.None, appendText: '- ' },
    },
    {
      beforeText: /-\s*$/,
      action: { indentAction: monaco.languages.IndentAction.None, appendText: '- ' },
    },
  ],
};

export const language = {
  // set defaultToken to invalid to see what you do not tokenize yet
  defaultToken: 'invalid',
  keywords: ['swagger', 'info', 'host', 'basePath', 'tags', 'schemes', 'paths', 'externalDocs'],
  typeKeywords: ['description', 'title', 'termsOfService'],
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  // the main tokenizer for our languages
  tokenizer: {
    root: [
      // identifiers and keywords
      [
        /[a-zA-Z_$][\w$]*/,
        {
          cases: {
            '@keywords': { token: 'keyword' },
            '@typeKeywords': { token: 'type' },
            '@default': 'identifier',
          },
        },
      ],
      // whitespace
      { include: '@whitespace' },
      // strings for todos
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
      [/"/, 'string', '@string'],
    ],
    whitespace: [[/[ \t\r\n]+/, '']],
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
  },
};

monaco.languages.register({ id: languageId });
monaco.languages.setLanguageConfiguration(languageId, conf);
monaco.languages.setMonarchTokensProvider(languageId, language);
