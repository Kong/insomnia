import { fakerFunctions } from 'insomnia/src/common/templating/faker-functions';
import { Liquid } from 'liquidjs';

/** @ignore */
class Interpolator {
  private engine: Liquid;

  constructor() {
    this.engine = new Liquid({
      outputDelimiterLeft: '{{',
      outputDelimiterRight: '}}',
      tagDelimiterLeft: '{%',
      tagDelimiterRight: '%}',
      strictVariables: true,
      jsTruthy: true,
      ownPropertyOnly: false,
    });
  }

  render = async (template: string, context: object): Promise<string> => {
    // TODO: support plugins
    return this.engine.parseAndRender(this.renderWithFaker(template), context);
  };

  renderWithFaker = (template: string) => {
    const segments = template.split('}}');
    if (segments.length === 1) {
      return template;
    }

    const translatedSegments = segments.map(segment => {
      const tagStart = segment.lastIndexOf('{{');
      if (tagStart === -1) {
        return segment;
      }

      const tagName = segment.slice(tagStart + 2).trim();
      if (!tagName.startsWith('$')) {
        // it is a tag probably for interpolating, at least not for generating
        return segment + '}}';
      }
      const funcName = tagName.slice(1) as keyof typeof fakerFunctions; // remove prefix '$'

      if (!fakerFunctions[funcName]) {
        throw new Error(`replaceIn: no faker function is found: ${funcName}`);
      }

      const generated = fakerFunctions[funcName]();
      return segment.slice(0, tagStart) + generated;
    });

    return translatedSegments.join('');
  };
}

/** @ignore */
const interpolator = new Interpolator();

/** @ignore */
export function getInterpolator() {
  return interpolator;
}
