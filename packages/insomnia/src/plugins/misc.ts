import Color from 'color';

import { getAppDefaultTheme } from '../common/constants';
import { ThemeSettings } from '../models/settings';
import type { Theme } from './index';
import { ColorScheme, getThemes } from './index';

export type HexColor = `#${string}`;
export type RGBColor = `rgb(${string})`;
export type RGBAColor = `rgba(${string})`;

export type ThemeColor = HexColor | RGBColor | RGBAColor;

// notice that for each sub-block (`background`, `foreground`, `highlight`) the `default` key is required if the sub-block is present
export interface ThemeBlock {
  background?: {
    default: ThemeColor;
    success?: ThemeColor;
    notice?: ThemeColor;
    warning?: ThemeColor;
    danger?: ThemeColor;
    surprise?: ThemeColor;
    info?: ThemeColor;
  };
  foreground?: {
    default: ThemeColor;
    success?: ThemeColor;
    notice?: ThemeColor;
    warning?: ThemeColor;
    danger?: ThemeColor;
    surprise?: ThemeColor;
    info?: ThemeColor;
  };
  highlight?: {
    default: ThemeColor;
    xxs?: ThemeColor;
    xs?: ThemeColor;
    sm?: ThemeColor;
    md?: ThemeColor;
    lg?: ThemeColor;
    xl?: ThemeColor;
  };
}

export interface CompleteStyleBlock {
  background: Required<Required<ThemeBlock>['background']>;
  foreground: Required<Required<ThemeBlock>['foreground']>;
  highlight: Required<Required<ThemeBlock>['highlight']>;
}

export interface StylesThemeBlocks {
  appHeader?: ThemeBlock;
  dialog?: ThemeBlock;
  dialogFooter?: ThemeBlock;
  dialogHeader?: ThemeBlock;
  dropdown?: ThemeBlock;
  editor?: ThemeBlock;
  link?: ThemeBlock;
  overlay?: ThemeBlock;
  pane?: ThemeBlock;
  paneHeader?: ThemeBlock;
  sidebar?: ThemeBlock;
  sidebarHeader?: ThemeBlock;
  sidebarList?: ThemeBlock;

  /** does not respect parent wrapping theme */
  tooltip?: ThemeBlock;

  transparentOverlay?: ThemeBlock;
}

export type ThemeInner = ThemeBlock & {
  rawCss?: string;
  styles?: StylesThemeBlocks | null;
};

export interface PluginTheme {
  /** this name is used to generate CSS classes, and must be lower case and must not contain whitespace */
  name: string;
  displayName: string;
  theme: ThemeInner;
}

export const validateThemeName = (name: string) => {
  const validName = name.replace(/\s/gm, '-').toLowerCase();
  const isValid = name === validName;

  if (!isValid) {
    // `console.error`ing instead of throwing because this is a check that we had relatively late in the game and we don't want to break existing themes that might work (albeit, by accident)
    console.error(`[theme] found an invalid theme name "${name}".  Try using ${validName}`);
  }
  return validName;
};

export const containsNunjucks = (data: string) => (
  data.includes('{{') && data.includes('}}')
);
const getChildValue = (theme: any, path: string[]) => {
  return path.reduce((acc, v: string) => {
    try {
      acc = acc[v];
    } catch (e) {
      return undefined;
    }
    return acc;
  }, theme);
};

/** In July 2022, the ability to use Nunjucks in themes was removed. This validator is a means of alerting any users of a theme depending on Nunjucks.  The failure mode for this case (in practice) is that the CSS variable will just not be used, thus it's not something we'd want to go as far as throwing an error about. */
export const validateTheme = (pluginTheme: PluginTheme) => {
  const checkIfContainsNunjucks = (pluginTheme: PluginTheme) => (keyPath: string[]) => {
    const data = getChildValue(pluginTheme.theme, keyPath);

    if (!data) {
      return;
    }

    if (typeof data === 'string' && containsNunjucks(data)) {
      console.error(`[plugin] Nunjucks values in plugin themes are no longer valid. The plugin ${pluginTheme.displayName} (${pluginTheme.name}) has an invalid value, "${data}" at the path $.theme.${keyPath.join('.')}`);
    }

    if (typeof data === 'object') {
      Object.keys(data).forEach(ownKey => {
        checkIfContainsNunjucks(pluginTheme)([...keyPath, ownKey]);
      });
    }
  };

  const check = checkIfContainsNunjucks(pluginTheme);

  check(['rawCss']);

  [
    'background',
    'foreground',
    'highlight',
  ].forEach(rootPath => {
    check([rootPath]);

    Object.keys(pluginTheme.theme.styles ?? {}).forEach(style => {
      check(['styles', style, rootPath]);
    });
  });

};

export const generateThemeCSS = (pluginTheme: PluginTheme) => {
  const { theme, name } = pluginTheme;
  validateTheme(pluginTheme);
  validateThemeName(name);

  let css = '';
  // For the top-level variables, merge with the base theme to ensure that we have everything we need.
  css += wrapStyles(
    name,
    '',
    getThemeBlockCSS({
      ...theme,
      background: { ...baseTheme.background, ...theme.background },
      foreground: { ...baseTheme.foreground, ...theme.foreground },
      highlight: { ...baseTheme.highlight, ...theme.highlight },
    }),
  );

  if (theme.styles) {
    const styles = theme.styles;
    // Dropdown Menus
    css += wrapStyles(
      name,
      '.theme--dropdown__menu',
      getThemeBlockCSS(styles.dropdown || styles.dialog),
    );
    // Tooltips
    css += wrapStyles(name, '.theme--tooltip', getThemeBlockCSS(styles.tooltip || styles.dialog));
    // Overlay
    css += wrapStyles(
      name,
      '.theme--transparent-overlay',
      getThemeBlockCSS(styles.transparentOverlay),
    );
    // Dialogs
    css += wrapStyles(name, '.theme--dialog', getThemeBlockCSS(styles.dialog));
    css += wrapStyles(name, '.theme--dialog__header', getThemeBlockCSS(styles.dialogHeader));
    css += wrapStyles(name, '.theme--dialog__footer', getThemeBlockCSS(styles.dialogFooter));
    // Panes
    css += wrapStyles(name, '.theme--pane', getThemeBlockCSS(styles.pane));
    css += wrapStyles(name, '.theme--pane__header', getThemeBlockCSS(styles.paneHeader));
    css += wrapStyles(name, '.theme--app-header', getThemeBlockCSS(styles.appHeader));
    // Sidebar Styles
    css += wrapStyles(name, '.theme--sidebar', getThemeBlockCSS(styles.sidebar));
    css += wrapStyles(name, '.theme--sidebar__list', getThemeBlockCSS(styles.sidebarList));
    css += wrapStyles(name, '.theme--sidebar__header', getThemeBlockCSS(styles.sidebarHeader));
    // Link
    css += wrapStyles(name, '.theme--link', getThemeBlockCSS(styles.link));
    // Code Editors
    css += wrapStyles(name, '.theme--editor', getThemeBlockCSS(styles.editor));
    // HACK: Dialog styles for CodeMirror dialogs too
    css += wrapStyles(name, '.CodeMirror-info', getThemeBlockCSS(styles.dialog));
  }

  css += '\n';
  return css;
};

function getThemeBlockCSS(block?: ThemeBlock) {
  if (!block) {
    return '';
  }

  const indent = '\t';
  let css = '';

  const addColorVar = (variable: string, value?: string) => {
    if (!value) {
      return;
    }

    try {
      const parsedColor = Color(value);
      const rgb = parsedColor.rgb();
      addVar(variable, rgb.string());
      addVar(`${variable}-rgb`, rgb.array().join(', '));
    } catch (err) {
      console.log('Failed to parse theme color', value);
    }
  };

  const addVar = (variable: string, value?: string) => {
    if (!value) {
      return;
    }

    css += `${indent}--${variable}: ${value};\n`;
  };

  const addComment = (comment: string) => {
    css += `${indent}/* ${comment} */\n`;
  };

  const addNewLine = () => {
    css += '\n';
  };

  if (block.background) {
    const { background } = block;
    addComment('Background');
    addColorVar('color-bg', background.default);
    addColorVar('color-success', background.success);
    addColorVar('color-notice', background.notice);
    addColorVar('color-warning', background.warning);
    addColorVar('color-danger', background.danger);
    addColorVar('color-surprise', background.surprise);
    addColorVar('color-info', background.info);
    addNewLine();
  }

  if (block.foreground) {
    const { foreground } = block;
    addComment('Foreground');
    addColorVar('color-font', foreground.default);
    addColorVar('color-font-success', foreground.success);
    addColorVar('color-font-notice', foreground.notice);
    addColorVar('color-font-warning', foreground.warning);
    addColorVar('color-font-danger', foreground.danger);
    addColorVar('color-font-surprise', foreground.surprise);
    addColorVar('color-font-info', foreground.info);
    addNewLine();
  }

  if (block.highlight) {
    const { highlight } = block;
    addComment('Highlight');
    addColorVar('hl', highlight.default);
    addColorVar('hl-xxs', highlight.xxs);
    addColorVar('hl-xs', highlight.xs);
    addColorVar('hl-sm', highlight.sm);
    addColorVar('hl-md', highlight.md);
    addColorVar('hl-lg', highlight.lg);
    addColorVar('hl-xl', highlight.xl);
    addNewLine();
  }

  return css.replace(/\s+$/, '');
}

function wrapStyles(theme: string, selector: string, styles: string) {
  if (!styles) {
    return '';
  }

  return [
    `[theme="${theme}"] ${selector}, `,
    `[subtheme="${theme}"] ${selector ? selector + '--sub' : ''} {`,
    styles,
    '}',
    '',
    '',
  ].join('\n');
}

export function getColorScheme({ autoDetectColorScheme }: ThemeSettings): ColorScheme {
  if (!autoDetectColorScheme) {
    return 'default';
  }

  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'default';
}

export async function applyColorScheme(settings: ThemeSettings) {
  const scheme = getColorScheme(settings);

  switch (scheme) {
    case 'light':
      await setTheme(settings.lightTheme);
      break;

    case 'dark':
      await setTheme(settings.darkTheme);
      break;

    case 'default':
      await setTheme(settings.theme);
      break;

    default:
      throw new Error(scheme);
  }
}

export async function setTheme(themeName: string) {
  if (!document) {
    return;
  }

  const head = document.head;
  const body = document.body;

  if (!head || !body) {
    return;
  }

  const themes: Theme[] = await getThemes();

  // If theme isn't installed for some reason, set to the default
  if (!themes.find(t => t.theme.name === themeName)) {
    console.log(`[theme] Theme not found ${themeName}`);
    themeName = getAppDefaultTheme();
  }

  body.setAttribute('theme', themeName);

  for (const theme of themes) {
    let themeCSS = generateThemeCSS(theme.theme);
    const { name } = theme.theme;
    const { rawCss } = theme.theme.theme;
    let s = document.querySelector(`style[data-theme-name="${name}"]`);

    if (!s) {
      s = document.createElement('style');
      s.setAttribute('data-theme-name', name);
      head.appendChild(s);
    }

    if (typeof rawCss === 'string' && name === themeName) {
      themeCSS += '\n\n' + rawCss;
    }

    s.innerHTML = themeCSS;
  }
}

export const baseTheme: CompleteStyleBlock = {
  background: {
    default: '#fff',
    success: '#75ba24',
    notice: '#d8c84d',
    warning: '#ec8702',
    danger: '#e15251',
    surprise: '#6030BF',
    info: '#20aed9',
  },
  foreground: {
    default: '#666',
    success: '#fff',
    notice: '#fff',
    warning: '#fff',
    danger: '#fff',
    surprise: '#fff',
    info: '#fff',
  },
  highlight: {
    default: 'rgba(130, 130, 130, 1)',
    xxs: 'rgba(130, 130, 130, 0.05)',
    xs: 'rgba(130, 130, 130, 0.1)',
    sm: 'rgba(130, 130, 130, 0.25)',
    md: 'rgba(130, 130, 130, 0.35)',
    lg: 'rgba(130, 130, 130, 0.5)',
    xl: 'rgba(130, 130, 130, 0.8)',
  },
};
