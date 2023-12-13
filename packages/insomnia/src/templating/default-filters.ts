
import customFilters from './filters';

export const defaultFilters = [
  {
    name: 'abs',
    description: 'Return the absolute value of the argument',
    displayName: 'abs',
    args: [],
  },
  {
    name: 'batch',
    description: 'Return a list of lists with the given number of items',
    displayName: 'batch',
    args: [
      {
        displayName: 'Max length of batch item',
        type: 'number',
        placeholder: 'Max length of batch item',
        defaultValue: 1,
      },
    ],
  },
  {
    name: 'capitalize',
    description: 'Make the first letter uppercase, the rest lower case',
    displayName: 'capitalize',
    args: [],
  },
  {
    name: 'center',
    description: 'Center the value in a field of a given width',
    displayName: 'center',
    args: [
      {
        displayName: 'Min width',
        type: 'number',
        placeholder: 'Min width',
        defaultValue: 0,
      },
    ],
  },
  {
    name: 'default',
    description: 'If value is strictly undefined, return default, otherwise value',
    displayName: 'default',
    args: [
      {
        displayName: 'Default value',
        type: 'string',
        placeholder: 'Default value',
        defaultValue: '',
      },
      {
        displayName: 'Use default if value is falsy value',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'd',
    description: 'If value is strictly undefined, return default, otherwise value',
    displayName: 'default (short)',
    args: [
      {
        displayName: 'Default value',
        type: 'string',
        placeholder: 'Default value',
        defaultValue: '',
      },
      {
        displayName: 'Use default if value is falsy value',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'dictsort',
    description: 'Sort a dict and yield (key, value) pairs',
    displayName: 'dictsort',
    args: [],
  },
  {
    name: 'dump',
    description: 'Call JSON.stringify on an object and dump the result into the template',
    displayName: 'dump',
    args: [
      {
        displayName: 'Indent',
        type: 'number',
        placeholder: 'Indent',
        defaultValue: undefined,
      },
    ],
  },
  {
    name: 'escape',
    description: 'Convert the characters &, <, >, ‘, and ” in strings to HTML-safe sequences. Use this if you need to display text that might contain such characters in HTML. Marks return value as markup string',
    displayName: 'escape',
    args: [],
  },
  {
    name: 'e',
    description: 'Convert the characters &, <, >, ‘, and ” in strings to HTML-safe sequences. Use this if you need to display text that might contain such characters in HTML. Marks return value as markup string',
    displayName: 'escape (short)',
    args: [],
  },
  {
    name: 'first',
    description: 'Get the first item in an array or the first letter if it\'s a string',
    displayName: 'first',
    args: [],
  },
  {
    name: 'float',
    description: 'Convert a value into a floating point number. If the conversion fails 0.0 is returned. This default can be overridden by using the first parameter',
    displayName: 'float',
    args: [
      {
        displayName: 'Default value',
        type: 'number',
        placeholder: 'Default value',
        defaultValue: undefined,
      },
    ],
  },
  {
    name: 'forceescape',
    description: 'Enforce HTML escaping. This will probably double escape variables.',
    displayName: 'forceescape',
    args: [],
  },
  {
    name: 'groupby',
    description: 'Group a sequence of objects by a common attribute',
    displayName: 'groupby',
    args: [
      {
        displayName: 'Group by attribute',
        type: 'string',
        placeholder: 'Group by attribute',
        defaultValue: '',
      },
    ],
  },
  {
    name: 'indent',
    description: 'Indent a string using spaces. Default behaviour is not to indent the first line. Default indentation is 4 spaces.',
    displayName: 'indent',
    args: [
      {
        displayName: 'Indent spaces',
        type: 'number',
        placeholder: 'Indent spaces',
        defaultValue: 4,
      },
    ],
  },
  {
    name: 'int',
    description: 'Convert the value into an integer. If the conversion fails 0 is returned.',
    displayName: 'int',
    args: [],
  },
  {
    name: 'join',
    description: 'Return a string which is the concatenation of the strings in a sequence',
    displayName: 'join',
    args: [
      {
        displayName: 'Separator',
        type: 'string',
        placeholder: 'Separator',
        defaultValue: '',
      },
      {
        displayName: 'Join attribute',
        type: 'string',
        placeholder: 'Join attribute',
        defaultValue: undefined,
      },
    ],
  },
  {
    name: 'last',
    description: 'Get the last item in an array or the last letter if it\'s a string',
    displayName: 'last',
    args: [],
  },
  {
    name: 'length',
    description: 'Return the length of an array or string, or the number of keys in an object',
    displayName: 'length',
    args: [],
  },
  {
    name: 'list',
    description: 'Convert the value into a list. If it was a string the returned list will be a list of characters.',
    displayName: 'list',
    args: [],
  },
  {
    name: 'lower',
    description: 'Convert string to all lower case',
    displayName: 'lower',
    args: [],
  },
  {
    name: 'nl2br',
    description: 'Replace new lines with <br /> HTML elements',
    displayName: 'nl2br',
    args: [],
  },
  {
    name: 'random',
    description: 'Select a random value from an array. (This will change everytime the page is refreshed)',
    displayName: 'random',
    args: [],
  },
  {
    name: 'reject',
    description: 'Filters a sequence of objects by applying a test to each object, and rejecting the objects with the test succeeding. If no test is specified, each object will be evaluated as a boolean.',
    displayName: 'reject',
    args: [
      {
        displayName: 'Test',
        type: 'model',
        model: 'nunjucks-test',
        defaultValue: undefined,
      },
      {
        displayName: 'Second argument',
        type: 'string',
        placeholder: 'Second argument',
        defaultValue: undefined,
      },
    ],
  },
  {
    name: 'rejectattr',
    description: 'Filter a sequence of objects by applying a test to the specified attribute of each object, ' +
      'and rejecting the objects with the test succeeding. This is the opposite of selectattr filter. ' +
      'If no test is specified, the attribute’s value will be evaluated as a boolean.',
    displayName: 'rejectattr',
    args: [
      {
        displayName: 'Attribute',
        type: 'string',
        placeholder: 'Attribute',
        defaultValue: '',
      },
    ],
  },
  {
    name: 'replace',
    description: 'Replace one item with another. The first item is the item to be replaced, the second item is the replaced value.',
    displayName: 'replace',
    args: [
      {
        displayName: 'Search value',
        type: 'string',
        placeholder: 'Search value',
        defaultValue: '',
      },
      {
        displayName: 'Replace value',
        type: 'string',
        placeholder: 'Replace value',
        defaultValue: '',
      },
      {
        displayName: 'Replace from charactor index',
        type: 'number',
        placeholder: 'Replace from charactor index',
        defaultValue: 0,
      },
    ],
  },
  {
    name: 'reverse',
    description: 'Reverse a string',
    displayName: 'reverse',
    args: [],
  },
  {
    name: 'round',
    description: 'Round a number',
    displayName: 'round',
    args: [
      {
        displayName: 'Number of digits to round',
        type: 'number',
        placeholder: 'Number of digits to round',
        defaultValue: 0,
      },
      {
        displayName: 'Number of digits to round',
        type: 'enum',
        defaultValue: '',
        options: [
          {
            displayName: 'Default round',
            value: '',
            description: 'Default round',
            placeholder: 'Default round',
          },
          {
            displayName: 'Ceil round',
            value: 'ceil',
            description: 'Ceil round',
            placeholder: 'Ceil round',
          },
          {
            displayName: 'Floor round',
            value: 'floor',
            description: 'Floor round',
            placeholder: 'Floor round',
          },
        ],
      },
    ],
  },
  {
    name: 'safe',
    description: 'Mark the value as safe which means that in an environment with automatic escaping enabled this variable will not be escaped.',
    displayName: 'safe',
    args: [],
  },
  {
    name: 'select',
    description: 'Filters a sequence of objects by applying a test to each object, and only selecting the objects with the test succeeding. ' +
      'If no test is specified, each object will be evaluated as a boolean.',
    displayName: 'select',
    args: [
      {
        displayName: 'Test',
        type: 'model',
        model: 'nunjucks-test',
        defaultValue: undefined,
      },
      {
        displayName: 'Second argument',
        type: 'string',
        placeholder: 'Second argument',
        defaultValue: undefined,
      },
    ],
  },
  {
    name: 'selectattr',
    description: 'Filter a sequence of objects by applying a test to the specified attribute of each object, and only selecting the objects with the test succeeding. ' +
      'This is the opposite to rejectattr. ' +
      'If no test is specified, the attribute’s value will be evaluated as a boolean. ',
    displayName: 'selectattr',
    args: [
      {
        displayName: 'Attribute',
        type: 'string',
        placeholder: 'Attribute',
        defaultValue: '',
      },
    ],
  },
  {
    name: 'slice',
    description: 'Slice an iterator and return a list of lists containing those items.',
    displayName: 'slice',
    args: [
      {
        displayName: 'Max length of slice item',
        type: 'number',
        placeholder: 'Max length of slice item',
        defaultValue: 1,
      },
    ],
  },
  {
    name: 'sort',
    description: 'Sort arr with JavaScript\'s arr.sort function. If reverse is true, result will be reversed. ' +
      'Sort is case-insensitive by default, but setting caseSens to true makes it case-sensitive. ' +
      'If attr is passed, will compare attr from each item.',
    displayName: 'sort',
    args: [
      {
        displayName: 'Reverse',
        type: 'boolean',
        defaultValue: false,
      },
      {
        displayName: 'Is case sensitive',
        type: 'boolean',
        defaultValue: false,
      },
      {
        displayName: 'Sort attribute',
        type: 'string',
        placeholder: 'Sort attribute',
        defaultValue: '',
      },
    ],
  },
  {
    name: 'string',
    description: 'Convert an object to a string',
    displayName: 'string',
    args: [],
  },
  {
    name: 'striptags',
    description: 'Analog of jinja\'s striptags. If preserve_linebreaks is false (default), ' +
      'strips SGML/XML tags and replaces adjacent whitespace with one space. ' +
      'If preserve_linebreaks is true, normalizes whitespace, trying to preserve original linebreaks. ' +
      'Use second behavior if you want to pipe {{ text | striptags(true) | escape | nl2br }}. Use default one otherwise.',
    displayName: 'striptags',
    args: [
      {
        displayName: 'Preserve linebreaks',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'sum',
    description: 'Output the sum of items in the array',
    displayName: 'sum',
    args: [],
  },
  {
    name: 'title',
    description: 'Make the first letter of the string uppercase',
    displayName: 'title',
    args: [],
  },
  {
    name: 'trim',
    description: 'Strip leading and trailing whitespace',
    displayName: 'trim',
    args: [],
  },
  {
    name: 'truncate',
    description: 'Return a truncated copy of the string. ' +
      'The length is specified with the first parameter which defaults to 255. ' +
      'If the second parameter is true the filter will cut the text at length. ' +
      'Otherwise it will discard the last word. If the text was in fact truncated ' +
      'it will append an ellipsis sign ("..."). A different ellipsis sign than "(...)" can be specified using the third parameter.',
    displayName: 'truncate',
    args: [
      {
        displayName: 'Number of characters',
        type: 'number',
        placeholder: 'Number of characters',
        defaultValue: 255,
      },
      {
        displayName: 'Is replace truncated',
        type: 'boolean',
        defaultValue: false,
      },
      {
        displayName: 'Replace truncated by',
        type: 'string',
        placeholder: 'Replace truncated by',
        defaultValue: '...',
      },
    ],
  },
  {
    name: 'upper',
    description: 'Convert the string to upper case',
    displayName: 'upper',
    args: [],
  },
  {
    name: 'urlencode',
    description: 'Escape strings for use in URLs, using UTF-8 encoding. Accepts both dictionaries and regular strings as well as pairwise iterables.',
    displayName: 'urlencode',
    args: [],
  },
  {
    name: 'urlize',
    description: 'Convert URLs in plain text into clickable links',
    displayName: 'urlize',
    args: [
      {
        displayName: 'Truncate URL text by a given number',
        type: 'number',
        placeholder: 'Truncate URL text by a given number',
        defaultValue: 255,
      },
      {
        displayName: 'Apply truncate',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'wordcount',
    description: 'Count and output the number of words in a string',
    displayName: 'wordcount',
    args: [],
  },
  ...customFilters,
];
