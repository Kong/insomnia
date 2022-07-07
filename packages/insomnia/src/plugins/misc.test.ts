import { describe, expect, it } from '@jest/globals';

import { containsNunjucks, PluginTheme, validateTheme, validateThemeName } from './misc';

describe('containsNunjucks', () => {
  it('will return true if the value contains nunjucks without', () => {
    expect(containsNunjucks('{{asdf}}')).toBeTruthy();
  });

  it('will return true if the value contains nunjucks with spaces', () => {
    expect(containsNunjucks('{{ asdf }}')).toBeTruthy();
  });

  it('will return false if the value contains nunjucks', () => {
    expect(containsNunjucks('#rgb(1,2,3)')).toBeFalsy();
  });
});

describe('validateTheme', () => {
  const nunjucksValue = '{{ nunjucks.4.lyfe }}';
  const name = 'mock-plugin';
  const displayName = 'Mock Plugin';
  const mockMessage = (path: string[]) => `[plugin] Nunjucks values in plugin themes are no longer valid. The plugin ${displayName} (${name}) has an invalid value, "${nunjucksValue}" at the path $.theme.${path.join('.')}`;

  jest.spyOn(console, 'error').mockImplementation(() => {});

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
