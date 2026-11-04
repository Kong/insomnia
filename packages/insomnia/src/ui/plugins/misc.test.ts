import { describe, expect, it, vi } from 'vitest';

import type { PluginTheme } from '~/common/plugins/bridge-types';

import { applyAccentColor, containsTemplateSyntax, generateThemeCSS, validateTheme, validateThemeName } from './misc';

describe('containsTemplateSyntax', () => {
  it('will return true if the value contains nunjucks without', () => {
    expect(containsTemplateSyntax('{{asdf}}')).toBeTruthy();
  });

  it('will return true if the value contains nunjucks with spaces', () => {
    expect(containsTemplateSyntax('{{ asdf }}')).toBeTruthy();
  });

  it('will return false if the value contains nunjucks', () => {
    expect(containsTemplateSyntax('#rgb(1,2,3)')).toBeFalsy();
  });
});

describe('validateTheme', () => {
  const nunjucksValue = '{{ nunjucks.4.lyfe }}';
  const name = 'mock-plugin';
  const displayName = 'Mock Plugin';
  const mockMessage = (path: string[]) =>
    `[plugin] Nunjucks values in plugin themes are no longer valid. The plugin ${displayName} (${name}) has an invalid value, "${nunjucksValue}" at the path $.theme.${path.join('.')}`;

  vi.spyOn(console, 'error').mockImplementation(() => {});

  it('will validate rawCSS in the plugin theme', () => {
    const pluginTheme: PluginTheme = {
      name,
      displayName,
      theme: {
        rawCss: nunjucksValue,
      },
    };

    validateTheme(pluginTheme);

    const message = mockMessage(['rawCss']);
    expect(console.error).toHaveBeenLastCalledWith(message);
  });

  it('will validate top-level theme blocks in the plugin theme', () => {
    const pluginTheme: PluginTheme = {
      name,
      displayName,
      theme: {
        background: {
          // @ts-ignore
          default: nunjucksValue,
          info: '#abcdef',
        },
      },
    };

    validateTheme(pluginTheme);

    const message = mockMessage(['background', 'default']);
    expect(console.error).toHaveBeenLastCalledWith(message);
  });

  it('will validate styles sub-theme blocks in the plugin theme', () => {
    const pluginTheme: PluginTheme = {
      name,
      displayName,
      theme: {
        styles: {
          appHeader: {
            foreground: {
              // @ts-ignore
              default: nunjucksValue,
              info: '#abcdef',
            },
          },
        },
      },
    };

    validateTheme(pluginTheme);

    const message = mockMessage(['styles', 'appHeader', 'foreground', 'default']);
    expect(console.error).toHaveBeenLastCalledWith(message);
  });
});

describe('validateThemeName', () => {
  it('will return valid names as-is', () => {
    const name = 'default-dark';
    const validName = validateThemeName(name);
    expect(name).toEqual(validName);
  });

  it('will lowercase', () => {
    const name = 'Default-dark';
    const validName = validateThemeName(name);
    expect(name).not.toEqual(validName);
    expect(validName).toEqual('default-dark');
  });

  it('will replace spaces', () => {
    const name = 'default dark';
    const validName = validateThemeName(name);
    expect(name).not.toEqual(validName);
    expect(validName).toEqual('default-dark');
  });
});

const accentTheme: PluginTheme = {
  name: 'test-theme',
  displayName: 'Test Theme',
  theme: {
    background: { default: '#111', surprise: '#7c6cf0' },
    foreground: { default: '#eee', surprise: '#fff' },
    styles: {
      sidebar: { background: { default: '#111', surprise: '#6d5ae6' }, foreground: { default: '#eee', surprise: '#000' } },
      dialog: { background: { default: '#222' } },
    },
  },
};

describe('applyAccentColor', () => {
  it('leaves the theme alone without an accent', () => {
    expect(applyAccentColor(accentTheme, '')).toBe(accentTheme);
  });

  it('leaves the theme alone with an invalid accent', () => {
    expect(applyAccentColor(accentTheme, 'red; } body { display: none')).toBe(accentTheme);
  });

  it('replaces the accent at every level that sets one', () => {
    const { theme: result } = applyAccentColor(accentTheme, '#e5484d');
    expect(result.background?.surprise).toBe('#E5484D');
    expect(result.styles?.sidebar?.background?.surprise).toBe('#E5484D');
  });

  it('keeps blocks that set no accent unchanged', () => {
    const { theme: result } = applyAccentColor(accentTheme, '#e5484d');
    expect(result.styles?.dialog).toEqual({ background: { default: '#222' } });
    expect(result.background?.default).toBe('#111');
  });

  it('picks readable text for the accent', () => {
    expect(applyAccentColor(accentTheme, '#ffee00').theme.foreground?.surprise).toBe('#000');
    expect(applyAccentColor(accentTheme, '#1a1a6e').theme.styles?.sidebar?.foreground?.surprise).toBe('#fff');
  });

  it('reaches the generated CSS', () => {
    const css = generateThemeCSS(applyAccentColor(accentTheme, '#e5484d'));
    expect(css).toContain('--color-surprise: rgb(229, 72, 77)');
    expect(css).not.toContain('rgb(124, 108, 240)');
  });
});
