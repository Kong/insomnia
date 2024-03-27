import { configure, type ConfigureOptions, type Environment as NunjuncksEnv } from 'nunjucks';

class Intepolator {
    private engine: NunjuncksEnv;

    constructor(config: ConfigureOptions) {
        this.engine = configure(config);
    }

    render = (template: string, context: object) => {
        // TODO: handle timeout
        // TODO: support plugin?
        return this.engine.renderString(template, context);
    };
}

const intepolator = new Intepolator({
    autoescape: false,
    // Don't escape HTML
    throwOnUndefined: true,
    // Strict mode
    tags: {
        blockStart: '{%',
        blockEnd: '%}',
        variableStart: '{{',
        variableEnd: '}}',
        commentStart: '{#',
        commentEnd: '#}',
    },
});

export function getIntepolator() {
    return intepolator;
}
