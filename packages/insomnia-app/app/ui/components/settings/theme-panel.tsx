import React, { FC } from 'react';
import styled from 'styled-components';

import { ColorScheme } from '../../../plugins';
import { PluginTheme } from '../../../plugins/misc';
import { useThemes } from '../../hooks/theme';
import { HelpTooltip } from '../help-tooltip';

const THEMES_PER_ROW = 5;

const isDark = (mode: 'dark' | 'light') => mode === 'dark';
const isLight = (mode: 'dark' | 'light') => mode === 'light';

const RootWrapper = styled.div({});

const CheckboxWrapper = styled.div({
  marginLeft: 'var(--padding-md)',
});

const Themes = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
});

const ThemeButton = styled.div<{ $isActive: boolean; $isInOsThemeMode: boolean }>(({ $isActive, $isInOsThemeMode }) => ({
  position: 'relative',
  margin: 'var(--padding-md) var(--padding-md)',
  fontSize: 0,
  borderRadius: 'var(--radius-md)',
  transition: 'all 150ms ease-out',
  // This is a workaround for some anti-aliasing artifacts that impact the color scheme badges.
  // The box shadow is placed on a pseudo-element. When it is active, it is configured to overlap
  // 1px with the underlying geometry to prevent gaps caused by anti-aliasing.
  '&:before': {
    display: 'block',
    position: 'absolute',
    boxShadow: '0 0 0 1px var(--hl-sm)',
    transition: 'all 150ms ease-out',
    borderRadius: 'var(--radius-md)',
    width: '100%',
    height: '100%',
    content: "''",
    ...($isActive ? {
      boxShadow: '0 0 0 var(--padding-xs) var(--color-surprise)',
      width: 'calc(100% - 2px)',
      height: 'calc(100% - 2px)',
      margin: '1px',
    } : {}),
  },
  '&:hover:before': {
    ...($isInOsThemeMode ? { boxShadow: '0 0 0 0 var(--color-surprise)' } : {}),
  },
  ...($isActive ? {
    transform: 'scale(1.05)',
  } : {}),
  '&:hover': {
    transform: 'scale(1.05)',
  },
  ...($isInOsThemeMode ? {
    '&:hover .overlay-wrapper': {
      display: 'flex',
    },
    '&:hover .theme-preview': {
      visibility: 'hidden', // this prevents alpha-blending problems with the underlying svg bleeding through
    },
  } : {}),
}));

const ThemeTitle = styled.h2({
  marginTop: 0,
  marginBottom: 'var(--padding-xs)',
  fontSize: 'var(--font-size-md)',
});

const ThemeWrapper = styled.div({
  maxWidth: `${100 / THEMES_PER_ROW}%`,
  minWidth: 110,
  marginBottom: 'var(--padding-md)',
  marginTop: 'var(--padding-md)',
  textAlign: 'center',
});

const ColorSchemeBadge = styled.div<{ $theme: 'dark' | 'light'}>(({ $theme }) => ({
  position: 'absolute',
  top: 0,
  width: 12,
  height: 12,
  fill: 'white',
  padding: 4,
  transition: 'background-color 150ms ease-out',
  backgroundColor: 'var(--color-surprise)',
  ...(isDark($theme) ? {
    right: 0,
    borderTopRightRadius: 'var(--radius-md)',
    borderBottomLeftRadius: 'var(--radius-md)',
  } : {}),
  ...(isLight($theme) ? {
    left: 0,
    borderTopLeftRadius: 'var(--radius-md)',
    borderBottomRightRadius: 'var(--radius-md)',
  } : {}),
}));

const OverlayWrapper = styled.div({
  position: 'absolute',
  height: '100%',
  width: '100%',
  alignItems: 'center',
  flexWrap: 'nowrap',
  justifyContent: 'space-evenly',
  boxSizing: 'content-box',

  display: 'none', // controlled by hover on the ThemeWrapper
});

const OverlaySide = styled.div<{ $theme: 'dark' | 'light' }>(({ $theme }) => ({
  display: 'flex',
  cursor: 'pointer',
  flexGrow: 1,
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  background: 'var(--color-bg)',
  '& svg': {
    opacity: 0.4,
    fill: 'var(--color-fg)',
    height: 20,
  },
  '&:hover svg': {
    opacity: 1,
    fill: 'var(--color-surprise)',
  },
  boxSizing: 'border-box',
  border: '1px solid var(--hl-sm)',
  ...(isDark($theme) ? {
    borderTopRightRadius: 'var(--radius-md)',
    borderBottomRightRadius: 'var(--radius-md)',
    borderLeftStyle: 'none',
  } : {}),
  ...(isLight($theme) ? {
    borderTopLeftRadius: 'var(--radius-md)',
    borderBottomLeftRadius: 'var(--radius-md)',
    borderRightStyle: 'none',
  } : {}),
  '&:hover': {
    border: '1px solid var(--color-surprise)',
  },
}));

const SunSvg = () => (
  <svg viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="4" />
    <rect x="6.5" y="12" width="1" height="2" rx="0.5" />
    <rect x="6.5" width="1" height="2" rx="0.5" />
    <rect x="2" y="6.5" width="1" height="2" rx="0.5" transform="rotate(90 2 6.5)" />
    <rect x="14" y="6.5" width="1" height="2" rx="0.5" transform="rotate(90 14 6.5)" />
    <rect x="3.81799" y="3.11084" width="1" height="2" rx="0.5" transform="rotate(135 3.81799 3.11084)" />
    <rect x="12.3033" y="11.5962" width="1" height="2" rx="0.5" transform="rotate(135 12.3033 11.5962)" />
    <rect x="10.889" y="3.81799" width="1" height="2" rx="0.5" transform="rotate(-135 10.889 3.81799)" />
    <rect x="2.40381" y="12.3033" width="1" height="2" rx="0.5" transform="rotate(-135 2.40381 12.3033)" />
  </svg>
);

const MoonSvg = () => (
  <svg viewBox="0 0 14 14">
    <path
      d="M4.00005 11C7.86604 11 11 7.86604 11 4.00005C11 2.83978 10.7178 1.74545 10.2181 0.781982C12.4649 1.94714 14 4.29432 14 7.00005C14 10.866 10.866 14 7.00005 14C4.29432 14 1.94714 12.4649 0.781982 10.2181C1.74545 10.7178 2.83978 11 4.00005 11Z"
    />
  </svg>
);

const ThemePreview: FC<{ theme: PluginTheme }> = ({ theme: { name: themeName } }) => (
  <svg
    /* @ts-expect-error -- TSCONVERSION */
    theme={themeName}
    className="theme-preview"
    width="100%"
    height="100%"
    viewBox="0 0 500 300"
    style={{ borderRadius: 'var(--radius-md)' }}
  >
    {/*
      A WORD TO THE WISE: If you, dear traveler from the future, are here
      for the purpose of theming things due to changes in the app structure,
      please remember to add `--sub` to your classes or else the selected class'
      theme variables will apply to all theme previews.  Search your codebase
      for `--sub` to see more.
    */}

    {/* @ts-expect-error -- TSCONVERSION */}
    <g subtheme={themeName}>
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

const IndividualTheme: FC<{
  isActive: boolean;
  isDark: boolean;
  isLight: boolean;
  isInOsThemeMode: boolean;
  onChangeTheme: (name: string, mode: ColorScheme) => Promise<void>;
  theme: PluginTheme;
}> = ({
  isActive,
  isDark,
  isLight,
  isInOsThemeMode,
  onChangeTheme,
  theme,
}) => {
  const { displayName, name } = theme;

  const onClickThemeButton = () => {
    if (isInOsThemeMode) {
      // The overlays handle this behavior in OS theme mode.
      // React's event bubbling means that this will be fired when you click on an overlay, so we need to turn it off when in this mode.
      // Even still, we don't want to risk some potnetial subpixel or z-index nonsense accidentally setting the default when know we shouldn't.
      return;
    }
    return onChangeTheme(name, 'default');
  };

  return (
    <ThemeWrapper>
      <ThemeTitle>{displayName}</ThemeTitle>

      <ThemeButton
        onClick={onClickThemeButton}
        $isActive={isActive}
        $isInOsThemeMode={isInOsThemeMode}
      >
        {isInOsThemeMode ? (
          <>
            <OverlayWrapper className="overlay-wrapper">
              <OverlaySide $theme="light" onClick={() => { onChangeTheme(name, 'light'); }}><SunSvg /></OverlaySide>
              <OverlaySide $theme="dark" onClick={() => { onChangeTheme(name, 'dark'); }}><MoonSvg /></OverlaySide>
            </OverlayWrapper>

            {isActive && isDark ? (
              <ColorSchemeBadge $theme="dark"><MoonSvg /></ColorSchemeBadge>
            ) : null}

            {isActive && isLight ? (
              <ColorSchemeBadge $theme="light"><SunSvg /></ColorSchemeBadge>
            ) : null}
          </>
        ) : null}

        <ThemePreview theme={theme} />
      </ThemeButton>
    </ThemeWrapper>
  );
};

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
    <RootWrapper>
      <CheckboxWrapper className="form-control form-control--thin">
        <label className="inline-block">
          Use OS color scheme
          <HelpTooltip className="space-left">
            Pick your prefered themes for light and dark
          </HelpTooltip>
          <input
            type="checkbox"
            name="autoDetectColorScheme"
            checked={autoDetectColorScheme}
            onChange={changeAutoDetect}
          />
        </label>
      </CheckboxWrapper>

      <Themes>
        {themes.map(theme => (
          <IndividualTheme
            key={theme.name}
            theme={theme}
            isActive={isActive(theme)}
            onChangeTheme={activate}
            isDark={isActiveDark(theme)}
            isLight={isActiveLight(theme)}
            isInOsThemeMode={autoDetectColorScheme}
          />
        ))}
      </Themes>
    </RootWrapper>
  );
};
