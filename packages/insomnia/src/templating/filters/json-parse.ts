
import { PluginTemplateFilter } from '../extensions';

const jsonParseFilter: PluginTemplateFilter = {
    name: 'jsonParse',
    displayName: 'JSON parse',
    args: [],
    description: '',
    run: function(_ctx: any, value: string) {
        let body;
        try {
            body = JSON.parse(value);
        } catch (err) {
            throw new Error(`Invalid JSON: ${err.message}`);
        }

        return body;
    },
};

export default jsonParseFilter;
