import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Button from '../base/button';
import type { Theme as ThemeType, ColorScheme } from '../../../plugins';
import { getThemes } from '../../../plugins';
import HelpTooltip from '../help-tooltip';
const THEMES_PER_ROW = 5;

interface Props {
  handleChangeTheme: (arg0: string, arg1: ColorScheme) => void;
  activeTheme: string;
  handleAutoDetectColorSchemeChange: (arg0: boolean) => void;
  autoDetectColorScheme: boolean;
  activeLightTheme: string;
  activeDarkTheme: string;
}

interface State {
  themes: ThemeType[];
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class Theme extends PureComponent<Props, State> {
  state: State = {
    themes: [],
  }

  componentDidMount() {
    this._loadThemes();
  }

  async _loadThemes() {
    const themes = await getThemes();
    this.setState({
      themes,
    });
  }

  renderThemePreview(themeName: string) {
    return (
      /* @ts-expect-error -- TSCONVERSION */
      <svg theme={themeName} width="100%" height="100%" viewBox="0 0 500 300">
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
            <rect x="0" y="0" width="100%" height="10%" className="bg-fill" />
          </g>

          {/* Panes */}
          <g className="theme--pane--sub">
            {/* Response Area */}
            <rect x="0" y="10%" width="100%" height="100%" className="bg-fill" />

            {/* URL Bars */}
            <rect
              x="25%"
              y="10%"
              width="100%"
              height="10%"
              className="theme--pane__header--sub bg-fill"
            />
            {/* Send Button */}
            <g>
              <rect x="53%" y="10%" width="9%" height="10%" className="surprise-fill" />
            </g>
          </g>

          {/* Sidebar */}
          <g className="theme--sidebar--sub">
            <rect x="0" y="10%" width="25%" height="100%" className="bg-fill" />
          </g>

          {/* Lines */}
          <line x1="0%" x2="100%" y1="10%" y2="10%" strokeWidth="1" className="hl-stroke" />
          <line x1="25%" x2="100%" y1="20%" y2="20%" strokeWidth="1" className="hl-stroke" />
          <line x1="62%" x2="62%" y1="10%" y2="100%" strokeWidth="1" className="hl-stroke" />
          <line x1="25%" x2="25%" y1="10%" y2="100%" strokeWidth="1" className="hl-stroke" />

          {/* Color Squares */}
          <rect x="40%" y="85%" width="5%" height="8%" className="success-fill" />
          <rect x="50%" y="85%" width="5%" height="8%" className="info-fill" />
          <rect x="60%" y="85%" width="5%" height="8%" className="warning-fill" />
          <rect x="70%" y="85%" width="5%" height="8%" className="danger-fill" />
          <rect x="80%" y="85%" width="5%" height="8%" className="surprise-fill" />
          <rect x="90%" y="85%" width="5%" height="8%" className="info-fill" />
        </g>
      </svg>
    );
  }

  renderTheme(theme: ThemeType) {
    const { handleChangeTheme, activeTheme, autoDetectColorScheme } = this.props;
    const isActive = activeTheme === theme.theme.name;
    const disabled = autoDetectColorScheme;
    return (
      <div
        key={theme.theme.name}
        className="themes__theme"
        style={{
          maxWidth: `${100 / THEMES_PER_ROW}%`,
        }}>
        <h2 className="txt-lg">{theme.theme.displayName}</h2>
        <Button
          disabled={disabled}
          onClick={() => handleChangeTheme(theme.theme.name, 'default')}
          className={isActive ? 'active' : ''}>
          {this.renderThemePreview(theme.theme.name)}
        </Button>
      </div>
    );
  }

  renderThemeRows() {
    const { themes } = this.state;
    const rows: ThemeType[][] = [];
    let row: ThemeType[] = [];

    for (const theme of themes) {
      row.push(theme);

      if (row.length === THEMES_PER_ROW) {
        rows.push(row);
        row = [];
      }
    }

    // Push the last row if it wasn't finished
    if (row.length) {
      rows.push(row);
    }

    return rows.map((row, i) => (
      <div key={i} className="themes__row">
        {row.map(this.renderTheme)}
      </div>
    ));
  }

  renderThemeSelect(scheme: 'light' | 'dark') {
    const {
      activeLightTheme,
      activeDarkTheme,
      handleChangeTheme,
      autoDetectColorScheme,
    } = this.props;
    const { themes } = this.state;
    const activeColorTheme =
      scheme === 'light' ? activeLightTheme : activeDarkTheme;
    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>
            Preferred {scheme} color scheme
            <HelpTooltip className="space-left">
              Lets you choose the color scheme that is used in {scheme} mode.
            </HelpTooltip>
            <select
              value={activeColorTheme}
              onChange={(e) => handleChangeTheme(e.target.value, scheme)}
            >
              {themes.map((theme) => (
                <option key={theme.theme.name} value={theme.theme.name}>
                  {theme.theme.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="themes select__preview">
          <div className="themes__theme" style={{ maxWidth: '50%' }}>
            <Button disabled={!autoDetectColorScheme}>
              {this.renderThemePreview(activeColorTheme)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { autoDetectColorScheme, handleAutoDetectColorSchemeChange } = this.props;
    return (
      <>
        <div className="themes general__preview">{this.renderThemeRows()}</div>
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
              onChange={e => handleAutoDetectColorSchemeChange(e.target.checked)}
            />
          </label>
        </div>
        <div className="form-row">
          {this.renderThemeSelect('light')}
          {this.renderThemeSelect('dark')}
        </div>
      </>
    );
  }
}

export default Theme;
