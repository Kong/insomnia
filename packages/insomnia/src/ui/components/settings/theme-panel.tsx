import React, { type FC } from 'react';
import { Button, Checkbox, Label } from 'react-aria-components';

import type { PluginTheme } from '../../../plugins/misc';
import { useThemes } from '../../hooks/theme';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';

const ThemePreview: FC<{ theme: PluginTheme }> = ({ theme: { name: themeName } }) => (
  <svg
    // @ts-expect-error -- something about themes
    // eslint-disable-next-line react/no-unknown-property
    theme={themeName}
    className="theme-preview"
    width="100%"
    height="100%"
    viewBox="0 0 500 300"
  >
    {/*
      A WORD TO THE WISE: If you, dear traveler from the future, are here
      for the purpose of theming things due to changes in the app structure,
      please remember to add `--sub` to your classes or else the selected class'
      theme variables will apply to all theme previews.  Search your codebase
      for `--sub` to see more.
    */}

    <g
      // @ts-expect-error -- something about themes
      // eslint-disable-next-line react/no-unknown-property
      subtheme={themeName}
    >
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
  const {
    themes,
    activate,
    changeAutoDetect,
    isActive,
    isActiveDark,
    isActiveLight,
    autoDetectColorScheme,
  } = useThemes();

  return (
    <div className='flex flex-col gap-2'>
      <Label className="flex items-center gap-2">
        <Checkbox slot={null} isSelected={autoDetectColorScheme} onChange={isSelected => changeAutoDetect(isSelected)} className="group p-0 flex items-center h-full">
          <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
            <Icon icon={'check'} className='opacity-0 group-data-[selected]:opacity-100 group-data-[indeterminate]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
          </div>
        </Checkbox>
        Use OS color scheme
        <HelpTooltip className="space-left">
          Select different themes for when you’re using light versus dark color schemes on your OS. Check this box, then hover over a theme and select either light (sun) or dark (moon).
        </HelpTooltip>
      </Label>

      <ul className='grid grid-flow-row grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5'>
        {themes.map(theme => (
          <div key={theme.name} className='flex flex-col gap-1'>
            <div className='text-center text-sm truncate select-none'>{theme.displayName}</div>
            <div
              data-active-dark-theme={isActiveDark(theme) || undefined}
              data-active-light-theme={isActiveLight(theme) || undefined}
              data-active-theme={isActive(theme) || undefined}
              className='group flex relative rounded overflow-hidden shadow-md transition-colors data-[active-theme]:ring-2 data-[active-theme]:ring-[--color-surprise]'
            >
              {autoDetectColorScheme && (
                <div className='group-hover:grid group-focus:grid group-data-[active-theme]:grid absolute top-0 left-0 w-full h-full hidden grid-cols-2'>
                  <Button
                    onPress={() => {
                      activate(theme.name, 'light');
                    }}
                    style={{
                      '--color-surprise': theme.theme.background?.surprise,
                    } as React.CSSProperties}
                    className="flex items-center justify-center hover:bg-[--hl-md] focus:bg-[--hl-md] group-data-[active-light-theme]:bg-[--hl-lg] group-data-[active-light-theme]:text-[--color-surprise]"
                  >
                    <Icon icon="sun" />
                  </Button>
                  <Button
                    onPress={() => {
                      activate(theme.name, 'dark');
                    }}
                    style={{
                      '--color-surprise': theme.theme.background?.surprise,
                    } as React.CSSProperties}
                    className="flex items-center justify-center hover:bg-[--hl-md] focus:bg-[--hl-md] group-data-[active-dark-theme]:bg-[--hl-md] group-data-[active-dark-theme]:text-[--color-surprise]"
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
