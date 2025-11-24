import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['src/ui/design-tokens/index.ts'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'inso',
      buildPath: 'src/ui/css/',
      files: [
        {
          destination: 'token.css',
          format: 'css/variables',
        },
      ],
    },
  },
});
sd.buildAllPlatforms();
