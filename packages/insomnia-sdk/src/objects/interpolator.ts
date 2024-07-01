import { fakerFunctions } from 'insomnia/src/ui/components/templating/faker-functions';
import { configure, type ConfigureOptions, type Environment as NunjuncksEnv } from 'nunjucks';

class Interpolator {
    private engine: NunjuncksEnv;

    constructor(config: ConfigureOptions) {
        this.engine = configure(config);
    }

    render = (template: string, context: object) => {
        // TODO: handle timeout
        // TODO: support plugin?
        return this.engine.renderString(
            this.renderWithFaker(template),
            context
        );
    };

    renderWithFaker = (template: string) => {
        const segments = template.split('}}');
        if (segments.length === 1) {
            return template;
        }

        const translatedSegments = segments.map(segment => {
            const tagStart = segment.lastIndexOf('{{');
            if ((tagStart) < 0) {
                return segment;
            }

            const tagName = segment
                .slice(tagStart + 2)
                .trim();
            if (!tagName.startsWith('$')) {
                // it is a tag probably for interpolating, at least not for generating
                return segment + '}}';
            }
            const funcName = tagName.slice(1) as keyof typeof fakerFunctions; // remove prefix '$'

            if (!fakerFunctions[funcName]) {
                throw Error(`replaceIn: no faker function is found: ${funcName}`);
            };

            const generated = fakerFunctions[funcName]();
            return segment.slice(0, tagStart) + generated;
        });

        return translatedSegments.join('');
    };
}

const interpolator = new Interpolator({
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

export function getInterpolator() {
    return interpolator;
}
