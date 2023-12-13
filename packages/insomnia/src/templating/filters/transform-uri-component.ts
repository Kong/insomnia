import { PluginTemplateFilter } from '../extensions';

const transformUriComponentFilter: PluginTemplateFilter = {
  name: 'transformUriComponent',
  displayName: 'Encode and decode URI component',
  args: [
    {
      displayName: 'Is decode',
      type: 'boolean',
      defaultValue: false,
    },
  ],
  description: '',
  run: function(_ctx: any, text: string, isDecode: boolean) {
    return isDecode
      ? decodeURIComponent(text)
      : encodeURIComponent(text);
  },
};

export default transformUriComponentFilter;
