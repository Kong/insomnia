import jmespath from 'jmespath';

import { PluginTemplateFilter } from '../extensions';

const jmespathFilter: PluginTemplateFilter = {
    name: 'jmespath',
    displayName: 'JMESPath',
    args: [
        {
            displayName: 'Query path',
            type: 'string',
            placeholder: 'Query path',
            defaultValue: '',
        },
    ],
    description: '',
    run: function(_ctx: any, fromObject: string | object, path: string) {
        let body1 = {};
        if (typeof fromObject === 'string') {
            body1 = JSON.parse(fromObject);
        } else {
            body1 = fromObject;
        }
        return jmespath.search(body1, path);
    },
};
export default jmespathFilter;
