import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'Insomnia Component Docs',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://insomnia.rest/',
  baseUrl: '/',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        theme: {
          customCss: ['./src/css/default.css'],
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    async function myPlugin(_context, _options) {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins = [require('@tailwindcss/postcss')];
          return postcssOptions;
        },
      };
    },
  ],
  themes: ['@docusaurus/theme-live-codeblock'],
  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
    },
    themeConfig: {
      liveCodeBlock: {
        playgroundPosition: 'bottom',
      },
    },
    navbar: {
      title: 'Insomnia',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Components',
        },
        {
          href: 'https://github.com/kong/insomnia',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {},
  } satisfies Preset.ThemeConfig,
};

export default config;
