module.exports = {
  // @ts-expect-error -- no types yet exist for svgr
  template: ({ template }, options, { componentName, jsx }) => (
    template.smart({ plugins: ['jsx', 'typescript'] }).ast`
      import React, { SVGProps, memo } from 'react';
  
      export const ${componentName} = memo<SVGProps<SVGSVGElement>>(props => (
        ${jsx}
      ));
  `),
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
