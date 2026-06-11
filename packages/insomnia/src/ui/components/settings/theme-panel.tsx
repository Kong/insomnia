import React, { type FC } from 'react';
import { Button, Checkbox, Label } from 'react-aria-components';

import type { PluginTheme } from '~/plugins/bridge-types';

import { useThemes } from '../../hooks/theme';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';

const ThemePreview: FC<{ theme: PluginTheme }> = ({ theme }) => (
  <svg
    className="theme-preview"
    width="100%"
    height="100%"
    viewBox="0 0 500 300"
    style={
      {
        '--color-bg': theme.theme.background?.default,
        '--color-success': theme.theme.background?.success,
        '--color-info': theme.theme.background?.info,
        '--color-warning': theme.theme.background?.warning,
        '--color-danger': theme.theme.background?.danger,
        '--color-surprise': theme.theme.background?.surprise,
      } as React.CSSProperties
    }
  >
    <g>
      {/* App Header */}
      <g className="theme--app-header--sub">
        <rect x="0" y="0" width="100%" height="10%" style={{ fill: 'var(--color-bg)' }} />
      </g>

      {/* Panes */}
      <g className="theme--pane--sub">
        {/* Response Area */}
        <rect x="0" y="10%" width="100%" height="100%" style={{ fill: 'var(--color-bg)' }} />

        {/* URL Bars */}
        <rect
          x="25%"
          y="10%"
          width="100%"
          height="10%"
          className="theme--pane__header--sub"
          style={{ fill: 'var(--color-bg)' }}
        />
        {/* Send Button */}
        <g>
          <rect x="53%" y="10%" width="9%" height="10%" style={{ fill: 'var(--color-surprise)' }} />
        </g>
      </g>

      {/* Sidebar */}
      <g className="theme--sidebar--sub">
        <rect x="0" y="10%" width="25%" height="100%" style={{ fill: 'var(--color-bg)' }} />
      </g>

      {/* Lines */}
      <line x1="0%" x2="100%" y1="10%" y2="10%" strokeWidth="1" style={{ stroke: 'var(--hl-md)' }} />
      <line x1="25%" x2="100%" y1="20%" y2="20%" strokeWidth="1" style={{ stroke: 'var(--hl-md)' }} />
      <line x1="62%" x2="62%" y1="10%" y2="100%" strokeWidth="1" style={{ stroke: 'var(--hl-md)' }} />
      <line x1="25%" x2="25%" y1="10%" y2="100%" strokeWidth="1" style={{ stroke: 'var(--hl-md)' }} />

      {/* Color Squares */}
      <rect x="40%" y="85%" width="5%" height="8%" style={{ fill: 'var(--color-success)' }} />
      <rect x="50%" y="85%" width="5%" height="8%" style={{ fill: 'var(--color-info)' }} />
      <rect x="60%" y="85%" width="5%" height="8%" style={{ fill: 'var(--color-warning)' }} />
      <rect x="70%" y="85%" width="5%" height="8%" style={{ fill: 'var(--color-danger)' }} />
      <rect x="80%" y="85%" width="5%" height="8%" style={{ fill: 'var(--color-surprise)' }} />
      <rect x="90%" y="85%" width="5%" height="8%" style={{ fill: 'var(--color-info)' }} />
    </g>
  </svg>
);

export const ThemePanel: FC = () => {
  const { themes, activate, changeAutoDetect, isActive, isActiveDark, isActiveLight, autoDetectColorScheme } =
    useThemes();

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2">
        <Checkbox
          slot={null}
          isSelected={autoDetectColorScheme}
          onChange={isSelected => changeAutoDetect(isSelected)}
          className="group flex h-full items-center p-0"
        >
          <div className="flex h-4 w-4 items-center justify-center rounded-sm ring-1 ring-(--hl-sm) transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
            <Icon
              icon={'check'}
              className="h-3 w-3 opacity-0 group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100"
            />
          </div>
        </Checkbox>
        Use OS color scheme
        <HelpTooltip className="space-left">
          Select different themes for when you’re using light versus dark color schemes on your OS. Check this box, then
          hover over a theme and select either light (sun) or dark (moon).
        </HelpTooltip>
      </Label>

      <ul className="grid grid-flow-row grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
        {themes.map(theme => (
          <div key={theme.name} className="flex flex-col gap-1">
            <div className="truncate text-center text-sm select-none">{theme.displayName}</div>
            <div
              data-active-dark-theme={isActiveDark(theme) || undefined}
              data-active-light-theme={isActiveLight(theme) || undefined}
              data-active-theme={isActive(theme) || undefined}
              className="group relative flex overflow-hidden rounded-sm shadow-md transition-colors data-active-theme:ring-2 data-active-theme:ring-(--color-surprise)"
            >
              {autoDetectColorScheme && (
                <div className="absolute top-0 left-0 hidden h-full w-full grid-cols-2 group-hover:grid group-focus:grid group-data-active-theme:grid">
                  <Button
                    onPress={() => {
                      activate(theme.name, 'light');
                    }}
                    style={
                      {
                        '--color-surprise': theme.theme.background?.surprise,
                      } as React.CSSProperties
                    }
                    className="flex items-center justify-center group-data-active-light-theme:bg-(--hl-lg) group-data-active-light-theme:text-(--color-surprise) hover:bg-(--hl-md) focus:bg-(--hl-md)"
                  >
                    <Icon icon="sun" />
                  </Button>
                  <Button
                    onPress={() => {
                      activate(theme.name, 'dark');
                    }}
                    style={
                      {
                        '--color-surprise': theme.theme.background?.surprise,
                      } as React.CSSProperties
                    }
                    className="flex items-center justify-center group-data-active-dark-theme:bg-(--hl-md) group-data-active-dark-theme:text-(--color-surprise) hover:bg-(--hl-md) focus:bg-(--hl-md)"
                  >
                    <Icon icon="moon" />
                  </Button>
                </div>
              )}
              <Button
                onPress={() => {
                  activate(theme.name, 'default');
                }}
              >
                <ThemePreview theme={theme} />
              </Button>
            </div>
          </div>
        ))}
      </ul>
    </div>
  );
};
