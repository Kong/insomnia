import Color from 'color';
import type { ThemeSettings } from 'insomnia-data';
import { services } from 'insomnia-data';
import { getAppDefaultTheme } from 'insomnia-data/common';

import type { PluginTheme, ThemeBlock, ThemeColor } from '~/common/plugins/bridge-types';
import type { ColorScheme } from '~/common/plugins/types';

import { plugins } from './renderer-bridge';

export interface CompleteStyleBlock {
  background: Required<Required<ThemeBlock>['background']>;
  foreground: Required<Required<ThemeBlock>['foreground']>;
  highlight: Required<Required<ThemeBlock>['highlight']>;
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

export const containsTemplateSyntax = (data: string) => data.includes('{{') && data.includes('}}');
const getChildValue = (theme: any, path: string[]) => {
  return path.reduce((acc, v: string) => {
    try {
      acc = acc[v];
    } catch {
      return;
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

    if (typeof data === 'string' && containsTemplateSyntax(data)) {
      console.error(
        `[plugin] Nunjucks values in plugin themes are no longer valid. The plugin ${pluginTheme.displayName} (${pluginTheme.name}) has an invalid value, "${data}" at the path $.theme.${keyPath.join('.')}`,
      );
    }

    if (typeof data === 'object') {
      Object.keys(data).forEach(ownKey => {
        checkIfContainsNunjucks(pluginTheme)([...keyPath, ownKey]);
      });
    }
  };

  const check = checkIfContainsNunjucks(pluginTheme);

  check(['rawCss']);

  ['background', 'foreground', 'highlight'].forEach(rootPath => {
    check([rootPath]);

    Object.keys(pluginTheme.theme.styles ?? {}).forEach(style => {
      check(['styles', style, rootPath]);
    });
  });
};

// A dark accent gets white text, a light one gets black
const accentBlock = (block: ThemeBlock | undefined, color: Color) => {
  if (!block) {
    return block;
  }
  const surprise = color.hex() as ThemeColor;
  return {
    ...block,
    ...(block.background?.surprise ? { background: { ...block.background, surprise } } : {}),
    ...(block.foreground?.surprise
      ? { foreground: { ...block.foreground, surprise: color.isDark() ? ('#fff' as const) : ('#000' as const) } }
      : {}),
  };
};

export const applyAccentColor = (pluginTheme: PluginTheme, accentColor?: string): PluginTheme => {
  if (!accentColor) {
    return pluginTheme;
  }

  let color: Color;
  try {
    color = Color(accentColor);
  } catch {
    console.log('[theme] Failed to parse accent color', accentColor);
    return pluginTheme;
  }

  const { theme } = pluginTheme;
  const styles = Object.fromEntries(
    Object.entries(theme.styles ?? {}).map(([name, block]) => [name, accentBlock(block, color)]),
  );
  return {
    ...pluginTheme,
    theme: {
      ...theme,
      ...accentBlock(
        {
          background: { ...baseTheme.background, ...theme.background },
          foreground: { ...baseTheme.foreground, ...theme.foreground },
        },
        color,
      ),
      styles,
    },
  };
};

export const generateThemeCSS = (pluginTheme: PluginTheme) => {
  const { theme, name } = pluginTheme;
  validateTheme(pluginTheme);
  validateThemeName(name);

  let css = '';
  // For the top-level variables, merge with the base theme to ensure that we have everything we need.
  css += wrapStyles(
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
    css += wrapStyles('.theme--dropdown__menu', getThemeBlockCSS(styles.dropdown || styles.dialog));
    // Tooltips
    css += wrapStyles('.theme--tooltip', getThemeBlockCSS(styles.tooltip || styles.dialog));
    // Overlay
    css += wrapStyles('.theme--transparent-overlay', getThemeBlockCSS(styles.transparentOverlay));
    // Dialogs
    css += wrapStyles('.theme--dialog', getThemeBlockCSS(styles.dialog));
    css += wrapStyles('.theme--dialog__header', getThemeBlockCSS(styles.dialogHeader));
    css += wrapStyles('.theme--dialog__footer', getThemeBlockCSS(styles.dialogFooter));
    // Panes
    css += wrapStyles('.theme--pane', getThemeBlockCSS(styles.pane));
    css += wrapStyles('.theme--pane__header', getThemeBlockCSS(styles.paneHeader));
    css += wrapStyles('.theme--app-header', getThemeBlockCSS(styles.appHeader));
    // Sidebar Styles
    css += wrapStyles('.theme--sidebar', getThemeBlockCSS(styles.sidebar));
    css += wrapStyles('.theme--sidebar__list', getThemeBlockCSS(styles.sidebarList));
    css += wrapStyles('.theme--sidebar__header', getThemeBlockCSS(styles.sidebarHeader));
    // Link
    css += wrapStyles('.theme--link', getThemeBlockCSS(styles.link));
    // Code Editors
    css += wrapStyles('.theme--editor', getThemeBlockCSS(styles.editor));
    // HACK: Dialog styles for CodeMirror dialogs too
    css += wrapStyles('.CodeMirror-info', getThemeBlockCSS(styles.dialog));
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
    } catch {
      console.log('[theme] Failed to parse theme color', value);
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

function wrapStyles(selector: string, styles: string) {
  if (!styles) {
    return '';
  }

  // Remove theme attribute dependency - use :root for global variables
  if (selector === '') {
    return `:root {\n${styles}\n}\n\n`;
  }

  // For specific selectors, no theme wrapping needed
  return `${selector} {\n${styles}\n}\n\n`;
}

export function getColorScheme({ autoDetectColorScheme }: Omit<ThemeSettings, 'accentColor'>): ColorScheme {
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

export function applyColorScheme(settings: ThemeSettings) {
  const scheme = getColorScheme(settings);

  switch (scheme) {
    case 'light': {
      setTheme(settings.lightTheme, settings.accentColor);
      break;
    }

    case 'dark': {
      setTheme(settings.darkTheme, settings.accentColor);
      break;
    }

    case 'default': {
      setTheme(settings.theme, settings.accentColor);
      break;
    }

    default: {
      throw new Error(scheme);
    }
  }
}
const themeStyleSheets = new Map<string, CSSStyleSheet>();
let latestThemeRequest = 0;

export async function setTheme(themeName: string, accentColor?: string) {
  if (!document || !('adoptedStyleSheets' in document)) {
    return;
  }

  latestThemeRequest += 1;
  const themeRequest = latestThemeRequest;
  const themes = await plugins.getThemes();
  let selectedTheme = themes.find(t => t.theme.name === themeName);

  if (!selectedTheme) {
    console.log(`[theme] Theme not found ${themeName}`);
    themeName = getAppDefaultTheme();
    const fallbackTheme = themes.find(t => t.theme.name === themeName);
    if (!fallbackTheme) return;
    selectedTheme = fallbackTheme;
  }

  // Only inject the selected theme
  let themeCSS = generateThemeCSS(applyAccentColor(selectedTheme.theme, accentColor));
  const { rawCss } = selectedTheme.theme.theme;

  if (typeof rawCss === 'string') {
    themeCSS += '\n\n' + rawCss;
  }

  const styleSheet = new CSSStyleSheet();
  await styleSheet.replace(themeCSS);

  // A newer call, such as from dragging the accent picker, supersedes this one
  if (themeRequest !== latestThemeRequest) {
    return;
  }

  // Clear existing theme stylesheets
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
    sheet => !Array.from(themeStyleSheets.values()).includes(sheet),
  );
  themeStyleSheets.set(themeName, styleSheet);

  document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
  await syncTitleBarColors();
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

const DIALOG_BACKDROP_SELECTOR = '.modal__backdrop, [style*="--visual-viewport-height"]';

let dialogBackdrops: string[] = [];

// Backdrops can report modern formats like oklab(), which Color can't parse
function parseCssColor(value: string) {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context) {
    return Color('transparent');
  }
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  return Color.rgb(red, green, blue).alpha(alpha / 255);
}

export async function syncTitleBarColors() {
  const probe = document.createElement('div');
  probe.className = 'theme--app-header';
  // Theme classes only set variables, so apply them to read the real colors
  probe.style.backgroundColor = 'var(--color-bg)';
  probe.style.color = 'var(--color-font)';
  document.body.append(probe);
  const { backgroundColor, color: foregroundColor } = getComputedStyle(probe);
  probe.remove();
  const { autoDetectColorScheme } = await services.settings.get();
  const themeSource = autoDetectColorScheme ? 'system' : parseCssColor(backgroundColor).isDark() ? 'dark' : 'light';
  // The same blend the backdrops apply to the page, one layer at a time
  const dim = (value: string) =>
    dialogBackdrops
      .map(parseCssColor)
      .reduce((result, backdrop) => result.mix(backdrop.alpha(1), backdrop.alpha()), parseCssColor(value))
      .hex();
  window.main?.setTitleBarColors({ color: dim(backgroundColor), symbolColor: dim(foregroundColor), themeSource });
}

// The window controls sit above the page, so dialog backdrops can't darken them
export function dimTitleBarWithDialogs() {
  const observer = new MutationObserver(() => {
    const backdrops = [...document.querySelectorAll(DIALOG_BACKDROP_SELECTOR)].map(
      element => getComputedStyle(element).backgroundColor,
    );
    if (backdrops.join(',') !== dialogBackdrops.join(',')) {
      dialogBackdrops = backdrops;
      syncTitleBarColors();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
