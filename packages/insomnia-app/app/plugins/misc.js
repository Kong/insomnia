// @flow
import Color from 'color';
import { render, THROW_ON_ERROR } from '../common/render';
import { getThemes } from './index';
import type { Theme } from './index';
import { getAppDefaultTheme } from '../common/constants';

type ThemeBlock = {
  background?: {
    default: string,
    success?: string,
    notice?: string,
    warning?: string,
    danger?: string,
    surprise?: string,
    info?: string,
  },
  foreground?: {
    default: string,
    success?: string,
    notice?: string,
    warning?: string,
    danger?: string,
    surprise?: string,
    info?: string,
  },
  highlight?: {
    default: string,
    xxs?: string,
    xs?: string,
    sm?: string,
    md?: string,
    lg?: string,
    xl?: string,
  },
};

type ThemeInner = {
  ...ThemeBlock,
  rawCss?: string,
  styles: ?{
    dialog?: ThemeBlock,
    dialogFooter?: ThemeBlock,
    dialogHeader?: ThemeBlock,
    dropdown?: ThemeBlock,
    editor?: ThemeBlock,
    link?: ThemeBlock,
    overlay?: ThemeBlock,
    pane?: ThemeBlock,
    paneHeader?: ThemeBlock,
    sidebar?: ThemeBlock,
    sidebarHeader?: ThemeBlock,
    sidebarList?: ThemeBlock,
    tooltip?: ThemeBlock,
    transparentOverlay?: ThemeBlock,
  },
};

export type PluginTheme = {
  name: string,
  displayName: string,
  theme: ThemeInner,
};

export async function generateThemeCSS(theme: PluginTheme): Promise<string> {
  const renderedTheme: ThemeInner = await render(
    theme.theme,
    theme.theme,
    null,
    THROW_ON_ERROR,
    theme.name,
  );
  const n = theme.name;

  let css = '';

  // For the top-level variables, merge with the base theme to ensure that
  // we have everything we need.
  css += wrapStyles(
    n,
    '',
    getThemeBlockCSS({
      ...renderedTheme,
      background: { ..._baseTheme.background, ...renderedTheme.background },
      foreground: { ..._baseTheme.foreground, ...renderedTheme.foreground },
      highlight: { ..._baseTheme.highlight, ...renderedTheme.highlight },
    }),
  );

  if (renderedTheme.styles) {
    const styles = renderedTheme.styles;

    // Dropdown Menus
    css += wrapStyles(
      n,
      '.theme--dropdown__menu',
      getThemeBlockCSS(styles.dropdown || styles.dialog),
    );

    // Tooltips
    css += wrapStyles(n, '.theme--tooltip', getThemeBlockCSS(styles.tooltip || styles.dialog));

    // Overlay
    css += wrapStyles(
      n,
      '.theme--transparent-overlay',
      getThemeBlockCSS(styles.transparentOverlay),
    );

    // Dialogs
    css += wrapStyles(n, '.theme--dialog', getThemeBlockCSS(styles.dialog));
    css += wrapStyles(n, '.theme--dialog__header', getThemeBlockCSS(styles.dialogHeader));
    css += wrapStyles(n, '.theme--dialog__footer', getThemeBlockCSS(styles.dialogFooter));

    // Panes
    css += wrapStyles(n, '.theme--pane', getThemeBlockCSS(styles.pane));
    css += wrapStyles(n, '.theme--pane__header', getThemeBlockCSS(styles.paneHeader));

    css += wrapStyles(n, '.theme--app-header', getThemeBlockCSS(styles.appHeader));

    // Sidebar Styles
    css += wrapStyles(n, '.theme--sidebar', getThemeBlockCSS(styles.sidebar));
    css += wrapStyles(n, '.theme--sidebar__list', getThemeBlockCSS(styles.sidebarList));
    css += wrapStyles(n, '.theme--sidebar__header', getThemeBlockCSS(styles.sidebarHeader));

    // Link
    css += wrapStyles(n, '.theme--link', getThemeBlockCSS(styles.link));

    // Code Editors
    css += wrapStyles(n, '.theme--editor', getThemeBlockCSS(styles.editor));

    // HACK: Dialog styles for CodeMirror dialogs too
    css += wrapStyles(n, '.CodeMirror-info', getThemeBlockCSS(styles.dialog));
  }

  return css;
}

function getThemeBlockCSS(block?: ThemeBlock): string {
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

  const addComment = comment => {
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

export function getColorScheme(settings: Settings): ColorScheme {
  if (!settings.autoDetectColorScheme) {
    return 'default';
  }

  if (window.matchMedia(`(prefers-color-scheme: light)`).matches) {
    return 'light';
  }

  if (window.matchMedia(`(prefers-color-scheme: dark)`).matches) {
    return 'dark';
  }

  return 'default';
}

export async function applyColorScheme(settings: Settings): Promise<void> {
  const scheme = getColorScheme(settings);
  if (scheme === 'light') {
    await setTheme(settings.lightTheme);
  } else if (scheme === 'dark') {
    await setTheme(settings.darkTheme);
  } else {
    await setTheme(settings.theme);
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

  const themes: Array<Theme> = await getThemes();

  // If theme isn't installed for some reason, set to the default
  if (!themes.find(t => t.theme.name === themeName)) {
    console.log(`[theme] Theme not found ${themeName}`);
    themeName = getAppDefaultTheme();
  }

  body.setAttribute('theme', themeName);

  for (const theme of themes) {
    let themeCSS = (await generateThemeCSS(theme.theme)) + '\n';
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

export async function setFont(settings: Object) {
  if (!document) {
    return;
  }

  const html = document.querySelector('html');

  if (!html) {
    return;
  }

  html.style.setProperty('--font-default', settings.fontInterface);
  html.style.setProperty('--font-monospace', settings.fontMonospace);
  html.style.setProperty('--font-ligatures', settings.fontVariantLigatures ? 'normal' : 'none');
  html.style.setProperty('font-size', `${settings.fontSize}px`);
}

const _baseTheme = {
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
