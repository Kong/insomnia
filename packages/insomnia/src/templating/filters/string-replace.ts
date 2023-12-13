import { PluginTemplateFilter } from '../extensions';

const stringReplaceFilter: PluginTemplateFilter = {
  name: 'stringReplace',
  displayName: 'String replace',
  description: 'String replace',
  args: [
    {
      displayName: 'Find string',
      type: 'string',
      placeholder: 'Find string',
      defaultValue: '',
    },
    {
      displayName: 'Using REGEX',
      type: 'boolean',
      defaultValue: false,
    },
    {
      displayName: 'Replace string',
      type: 'string',
      placeholder: 'Replace string',
      defaultValue: '',
    },
  ],
  async run(_context: any, text: string, find: string, isRegex: string, replace: string) {
    if (isRegex === 'true') {
      const regex = new RegExp(find, 'im');
      return text.replace(regex, replace);
    }
    return text.replace(find, replace);
  },
};

export default stringReplaceFilter;
