import { PluginTemplateFilter, PluginTemplateFilterContext } from '../extensions';

const currentResponseFilter: PluginTemplateFilter = {
  name: 'domXPath',
  displayName: 'Get element by XPath',
  args: [
    {
      displayName: 'XPath',
      type: 'string',
      defaultValue: '',
    },
    {
      displayName: 'Default namespace',
      type: 'string',
      defaultValue: '',
    },
  ],
  description: '',
  run: async function(_ctx: PluginTemplateFilterContext, dom: Document, xpath?: string, defaultNs?: string) {
    if (dom && xpath) {
      return dom.evaluate(xpath, dom, () => (defaultNs || null), XPathResult.STRING_TYPE, null).stringValue;
    }
    return '';
  },
};

export default currentResponseFilter;
