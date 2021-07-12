import React, { FC, useCallback } from 'react';
import styled from 'styled-components';
import { ColorScheme } from '../../../plugins';
import { PluginTheme } from '../../../plugins/misc';
import HelpTooltip from '../help-tooltip';
import { useThemes } from '../../hooks/theme';

const THEMES_PER_ROW = 5;

const isDark = (mode: 'dark' | 'light') => mode === 'dark';
const isLight = (mode: 'dark' | 'light') => mode === 'light';

const RootWrapper = styled.div({
  paddingTop: 'var(--padding-lg)',
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
  overflow: 'hidden',
  boxShadow: '0 0 0 1px var(--hl-sm)',
  transition: 'all 50ms ease-out',
  ...($isActive ? {
    boxShadow: '0 0 0 var(--padding-xs) var(--color-surprise)',
    transform: 'scale(1.05)',
  } : {}),
  '&:hover': {
    transform: 'scale(1.05)',
    ...($isInOsThemeMode ? { boxShadow: 'none' } : {}),
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
  width: 10,
  height: 10,
  fill: 'white',
  padding: 4,
  background: 'var(--color-surprise)',
  ...(isDark($theme) ? {
    right: 0,
    borderBottomLeftRadius: 'var(--radius-md)',
  } : {}),
  ...(isLight($theme) ? {
    left: 0,
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
  <svg
    viewBox="0 0 24 25"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.0002 0.337891C11.5268 0.337891 11.143 0.721647 11.143 1.19503V2.95566C11.143 3.42905 11.5268 3.8128 12.0002 3.8128C12.4736 3.8128 12.8573 3.42905 12.8573 2.95566V1.19504C12.8573 0.721648 12.4736 0.337891 12.0002 0.337891ZM18.857 12.5001C18.857 16.3384 15.787 19.4499 11.9999 19.4499C8.21275 19.4499 5.14269 16.3384 5.14269 12.5001C5.14269 8.66182 8.21275 5.55028 11.9999 5.55028C15.787 5.55028 18.857 8.66182 18.857 12.5001ZM11.1429 22.0444C11.1429 21.5711 11.5267 21.1873 12.0001 21.1873C12.4735 21.1873 12.8572 21.5711 12.8572 22.0444V23.8051C12.8572 24.2785 12.4735 24.6622 12.0001 24.6622C11.5267 24.6622 11.1429 24.2785 11.1429 23.8051V22.0444ZM2.55985 11.6314C3.03964 11.6314 3.42858 12.0204 3.42858 12.5002C3.42858 12.9799 3.03964 13.3689 2.55985 13.3689H0.868728C0.388942 13.3689 0 12.9799 0 12.5002C0 12.0204 0.388943 11.6314 0.868728 11.6314H2.55985ZM24.0006 12.5002C24.0006 12.0204 23.6117 11.6314 23.1319 11.6314H21.4408C20.961 11.6314 20.572 12.0204 20.572 12.5002C20.572 12.9799 20.961 13.3689 21.4407 13.3689H23.1319C23.6117 13.3689 24.0006 12.9799 24.0006 12.5002ZM5.93919 5.12888C6.27392 5.46814 6.27392 6.01818 5.93919 6.35744C5.60445 6.6967 5.06174 6.6967 4.727 6.35744L3.51481 5.12888C3.18008 4.78962 3.18008 4.23957 3.51481 3.90031C3.84955 3.56105 4.39226 3.56105 4.727 3.90031L5.93919 5.12888ZM20.4856 21.1001C20.8203 20.7608 20.8203 20.2108 20.4856 19.8715L19.2734 18.643C18.9387 18.3037 18.3959 18.3037 18.0612 18.643C17.7265 18.9822 17.7265 19.5323 18.0612 19.8715L19.2734 21.1001C19.6081 21.4394 20.1508 21.4394 20.4856 21.1001ZM19.2734 6.35711C18.9387 6.69636 18.396 6.69636 18.0613 6.35711C17.7265 6.01785 17.7265 5.4678 18.0613 5.12854L19.2734 3.89997C19.6082 3.56071 20.1509 3.56071 20.4856 3.89997C20.8204 4.23923 20.8204 4.78928 20.4856 5.12854L19.2734 6.35711ZM3.51511 21.1C3.84985 21.4393 4.39256 21.4393 4.7273 21.1L5.93949 19.8714C6.27422 19.5322 6.27422 18.9821 5.93949 18.6429C5.60475 18.3036 5.06204 18.3036 4.7273 18.6429L3.51511 19.8714C3.18038 20.2107 3.18038 20.7607 3.51511 21.1Z"
    />
  </svg>
);

const MoonSvg = () => (
  <svg
    viewBox="0 0 24 25"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.84271 19.1418C12.8622 19.1418 18.5526 13.3745 18.5526 6.26012C18.5526 4.12486 18.04 2.11095 17.1327 0.33788C21.2127 2.48191 24.0004 6.8015 24.0004 11.781C24.0004 18.8953 18.3099 24.6626 11.2905 24.6626C6.37777 24.6626 2.11607 21.8378 0.000447253 17.7032C1.74963 18.6225 3.73633 19.1418 5.84271 19.1418Z"
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
  onChangeTheme: (name: string, mode: ColorScheme) => void;
  theme: PluginTheme
}> = ({
  isActive,
  isDark,
  isLight,
  isInOsThemeMode,
  onChangeTheme: _onChangeTheme,
  theme,
}) => {
  const { displayName, name } = theme;

  const onChangeTheme = useCallback((mode: ColorScheme) => () => {
    _onChangeTheme(name, mode);
  }, [name, _onChangeTheme]);

  const onClickThemeButton = useCallback(() => {
    if (isInOsThemeMode) {
      // The overlays handle this behavior in OS theme mode.
      // React's event bubbling means that this will be fired when you click on an overlay, so we need to turn it off when in this mode.
      // Even still, we don't want to risk some potnetial subpixel or z-index nonsense accidentally setting the default when know we shouldn't.
      return;
    }
    onChangeTheme('default')();
  }, [onChangeTheme, isInOsThemeMode]);

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
              <OverlaySide $theme="light" onClick={onChangeTheme('light')}><SunSvg /></OverlaySide>
              <OverlaySide $theme="dark" onClick={onChangeTheme('dark')}><MoonSvg /></OverlaySide>
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
      <div className="form-control form-control--thin">
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
      </div>

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
