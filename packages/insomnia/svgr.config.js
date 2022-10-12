module.exports = {
  template: (variables, { tpl }) => tpl`
      import React, { SVGProps, memo } from 'react';

      export const ${variables.componentName} = memo<SVGProps<SVGSVGElement>>(props => (
        ${variables.jsx}
      ));
  `,
  icon: true,
  replaceAttrValues: {
    '#000': '',
    '#FFF': 'currentColor',
  },
  ext: 'tsx',
  prettier: true,
  prettierConfig: {
    arrowParens: 'avoid',
    singleQuote: true,
    parser: 'typescript',
  },
  typescript: true,
};
