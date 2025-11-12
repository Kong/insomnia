import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Insomnia Component Docs',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://insomnia.rest/',
  baseUrl: '/',

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
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
          postcssOptions.plugins.push(require('tailwindcss'));
          postcssOptions.plugins.push(require('autoprefixer'));
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
    // Replace with your project's social card
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
