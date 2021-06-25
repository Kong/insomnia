import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Button from '../base/button';
import type { Theme as ThemeType, ColorScheme } from '../../../plugins';
import { getThemes } from '../../../plugins';
import HelpTooltip from '../help-tooltip';
import styled from 'styled-components';
const THEMES_PER_ROW = 5;

const RootWrapper = styled.div`${() => ({
  paddingTop: 10,
})}`;

const ThemeButton = styled(Button)<{ $isActive: boolean }>(({ $isActive }) => ({
  position: 'relative',
  margin: 'var(--padding-md) var(--padding-md)',
  fontSize: 0,
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  boxShadow: '0 0 0 1px var(--hl-sm)',
  ...($isActive ? {
    boxShadow: '0 0 0 var(--padding-xs) var(--color-surprise)',
    transform: 'scale(1.05)',
    transition: 'all 50ms ease-out',
  } : {}),
  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

interface Props {
  handleChangeTheme: (arg0: string, arg1: ColorScheme) => void;
  activeTheme: ThemeType;
  handleAutoDetectColorSchemeChange: (arg0: boolean) => void;
  autoDetectColorScheme: boolean;
  activeLightTheme: ThemeType;
  activeDarkTheme: ThemeType;
}

interface State {
  themes: ThemeType[];
}

const SunSvg = () => (
  <svg
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
  >
    <path
      d="M256 160c-52.9 0-96 43.1-96 96s43.1 96 96 96 96-43.1 96-96-43.1-96-96-96zm246.4 80.5l-94.7-47.3 33.5-100.4c4.5-13.6-8.4-26.5-21.9-21.9l-100.4 33.5-47.4-94.8c-6.4-12.8-24.6-12.8-31 0l-47.3 94.7L92.7 70.8c-13.6-4.5-26.5 8.4-21.9 21.9l33.5 100.4-94.7 47.4c-12.8 6.4-12.8 24.6 0 31l94.7 47.3-33.5 100.5c-4.5 13.6 8.4 26.5 21.9 21.9l100.4-33.5 47.3 94.7c6.4 12.8 24.6 12.8 31 0l47.3-94.7 100.4 33.5c13.6 4.5 26.5-8.4 21.9-21.9l-33.5-100.4 94.7-47.3c13-6.5 13-24.7.2-31.1zm-155.9 106c-49.9 49.9-131.1 49.9-181 0-49.9-49.9-49.9-131.1 0-181 49.9-49.9 131.1-49.9 181 0 49.9 49.9 49.9 131.1 0 181z"
    />
  </svg>
);

const MoonSvg = () => (
  <svg
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
  >
    <path
      d="M283.211 512c78.962 0 151.079-35.925 198.857-94.792 7.068-8.708-.639-21.43-11.562-19.35-124.203 23.654-238.262-71.576-238.262-196.954 0-72.222 38.662-138.635 101.498-174.394 9.686-5.512 7.25-20.197-3.756-22.23A258.156 258.156 0 0 0 283.211 0c-141.309 0-256 114.511-256 256 0 141.309 114.511 256 256 256z" />
  </svg>
);

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Theme extends PureComponent<Props, State> {
  state: State = {
    themes: [],
  }

  componentDidMount() {
    this._loadThemes();
  }

  async _loadThemes() {
    const themes = await getThemes();
    this.setState({ themes });
  }

  renderThemePreview(themeType: ThemeType) {
    const {
      autoDetectColorScheme,
      activeLightTheme,
      activeDarkTheme,
    } = this.props;

    const isOSDarkTheme = themeType === activeDarkTheme;
    const isOSLightTheme = themeType === activeLightTheme;

    const isActive = this.isThemeActive(themeType);
    console.log({
      autoDetectColorScheme,
      themeName: themeType,
      activeDarkTheme,
      isOSDarkTheme,
      activeLightTheme,
      isOSLightTheme,
      isOSTheme: isActive,
    });

    return (
      <div
        style={{
          position: 'relative',
        }}
      >
        {isActive && autoDetectColorScheme ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              width: 10,
              height: 10,
              fill: 'white',
              padding: 4,
              background: 'var(--color-surprise)',
              ...(isOSDarkTheme ? {
                right: 0,
                borderBottomLeftRadius: 'var(--radius-md)',
              } : {
                left: 0,
                borderBottomRightRadius: 'var(--radius-md)',
              }),
            }}
          >
            {isOSDarkTheme ? <MoonSvg /> : <SunSvg />}
          </div>
        ) : null}

        <svg
        /* @ts-expect-error -- TSCONVERSION */
          theme={themeType}
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
          <g subtheme={themeType}>
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
      </div>
    );
  }

  isThemeActive(theme: ThemeType) {
    const { autoDetectColorScheme, activeTheme, activeLightTheme, activeDarkTheme } = this.props;
    if (autoDetectColorScheme) {
      return theme === activeLightTheme || theme === activeDarkTheme;
    }
    return theme === activeTheme;
  }

  renderTheme(theme: ThemeType) {
    const { handleChangeTheme } = this.props;
    const isActive = this.isThemeActive(theme.theme.name as unknown as ThemeType);
    const onClick = () => {
      handleChangeTheme(theme.theme.name, 'default');
    };

    return (
      <div
        key={theme.theme.name}
        style={{
          maxWidth: `${100 / THEMES_PER_ROW}%`,
          paddingBottom: 'var(--padding-lg)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 'var(--padding-xs)',
            fontSize: 'var(--font-size-md)',
          }}
        >
          {theme.theme.displayName}
        </h2>

        <div>

          <ThemeButton
            onClick={onClick}
            $isActive={isActive}
          >
            {this.renderThemePreview(theme.theme.name as unknown as ThemeType)}
          </ThemeButton>
        </div>
      </div>
    );
  }

  renderOsThemeCheckbox() {
    const { autoDetectColorScheme, handleAutoDetectColorSchemeChange } = this.props;
    return (
      <div className="form-control form-control--thin">
        <label className="inline-block">
          Use OS color scheme
          <HelpTooltip className="space-left">
            Lets you choose one theme for light mode and one for dark mode.
          </HelpTooltip>
          <input
            type="checkbox"
            name="autoDetectColorScheme"
            checked={autoDetectColorScheme}
            onChange={event => {
              handleAutoDetectColorSchemeChange(event.target.checked);
            }}
          />
        </label>
      </div>
    );
  }

  renderThemes() {
    const { themes } = this.state;
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          paddingTop: 'var(--padding-lg)',
        }}
      >
        {themes.map(this.renderTheme)}
      </div>
    );
  }

  render() {
    return (
      <RootWrapper>
        {this.renderOsThemeCheckbox()}
        {this.renderThemes()}
      </RootWrapper>
    );
  }
}
