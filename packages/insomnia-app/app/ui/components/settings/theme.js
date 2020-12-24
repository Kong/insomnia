// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Button from '../base/button';
import type { Theme as ThemeType, ColorScheme } from '../../../plugins';
import { getThemes } from '../../../plugins';
import HelpTooltip from '../help-tooltip';

const THEMES_PER_ROW = 5;

type Props = {
  handleChangeTheme: (string, ColorScheme) => void,
  activeTheme: string,
  handleAutoDetectColorSchemeChange: boolean => void,
  autoDetectColorScheme: boolean,
  activeLightTheme: string,
  activeDarkTheme: string,
};

type State = {
  themes: Array<ThemeType>,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class Theme extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      themes: [],
    };
  }

  componentDidMount() {
    this._loadThemes();
  }

  async _loadThemes() {
    const themes = await getThemes();
    this.setState({ themes });
  }

  renderTheme(theme: ThemeType, colorScheme: ColorScheme) {
    const { handleChangeTheme, activeTheme } = this.props;

    const isActive = activeTheme === theme.theme.name;

    return (
      <div
        key={theme.theme.name}
        className="themes__theme"
        style={{ maxWidth: `${100 / THEMES_PER_ROW}%` }}>
        <h2 className="txt-lg">{theme.theme.displayName}</h2>
        <Button
          onClick={() => handleChangeTheme(theme.theme.name, 'default')}
          className={isActive ? 'active' : ''}>
          <svg theme={theme.theme.name} width="100%" height="100%" viewBox="0 0 500 300">
            <g subtheme={theme.theme.name}>
              {/* Panes */}
              <g className="theme--pane--sub">
                <rect x="0" y="0" width="100%" height="100%" className="bg-fill" />
                <rect
                  x="25%"
                  y="0"
                  width="100%"
                  height="10%"
                  className="theme--pane__header--sub bg-fill"
                />
              </g>

              {/* Sidebar */}
              <g className="theme--sidebar--sub">
                <rect x="0" y="0" width="25%" height="100%" className="bg-fill" />
                <rect
                  x="0"
                  y="0"
                  width="25%"
                  height="10%"
                  className="theme--sidebar__header--sub bg-fill"
                />
              </g>

              {/* Lines */}
              <line x1="25%" x2="100%" y1="10%" y2="10%" strokeWidth="1" className="hl-stroke" />
              <line x1="62%" x2="62%" y1="0" y2="100%" strokeWidth="1" className="hl-stroke" />
              <line x1="25%" x2="25%" y1="0" y2="100%" strokeWidth="1" className="hl-stroke" />
              <line x1="0" x2="25%" y1="10%" y2="10%" strokeWidth="1" className="hl-stroke" />

              {/* Colors */}
              <rect x="40%" y="85%" width="5%" height="8%" className="success-fill" />
              <rect x="50%" y="85%" width="5%" height="8%" className="info-fill" />
              <rect x="60%" y="85%" width="5%" height="8%" className="warning-fill" />
              <rect x="70%" y="85%" width="5%" height="8%" className="danger-fill" />
              <rect x="80%" y="85%" width="5%" height="8%" className="surprise-fill" />
              <rect x="90%" y="85%" width="5%" height="8%" className="info-fill" />
            </g>
          </svg>
        </Button>
      </div>
    );
  }

  renderThemeRows(): React.Node {
    const { themes } = this.state;

    const rows = [];
    let row = [];
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
        {row.map(theme => this.renderTheme(theme))}
      </div>
    ));
  }

  renderThemeSelect(scheme: ColorScheme) {
    const { activeLightTheme, activeDarkTheme, handleChangeTheme } = this.props;
    const { themes } = this.state;

    const activeColorTheme = {
      light: activeLightTheme,
      dark: activeDarkTheme,
    }[scheme];

    return (
      <div className="form-control form-control--outlined">
        <label>
          Preferred {scheme} color scheme
          <HelpTooltip className="space-left">
            Lets you choose the color scheme that is used in {scheme} mode.
          </HelpTooltip>
          <select
            value={activeColorTheme}
            onChange={e => handleChangeTheme(e.target.value, scheme)}>
            {themes.map(theme => (
              <option key={theme.theme.name} value={theme.theme.name}>
                {theme.theme.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  render() {
    const { autoDetectColorScheme, handleAutoDetectColorSchemeChange } = this.props;

    return (
      <>
        <h2>Theme</h2>
        <div className="themes">{this.renderThemeRows('default')}</div>
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
