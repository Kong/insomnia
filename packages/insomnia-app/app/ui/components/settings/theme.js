// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Button from '../base/button';
import type { Theme as ThemeType, ColorScheme } from '../../../plugins';
import { getThemes } from '../../../plugins';
import { isDarkTheme } from '../../../plugins/misc';
import HelpTooltip from '../help-tooltip';

const THEMES_PER_ROW = 5;

type Props = {
  handleChangeTheme: (ThemeType, ColorScheme) => void,
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
    const { handleChangeTheme, activeTheme, activeLightTheme, activeDarkTheme } = this.props;

    const isActive =
      (colorScheme === 'default' && activeTheme === theme.theme.name) ||
      (colorScheme === 'light' && activeLightTheme === theme.theme.name) ||
      (colorScheme === 'dark' && activeDarkTheme === theme.theme.name);

    return (
      <div
        key={theme.theme.name}
        className="themes__theme"
        style={{ maxWidth: `${100 / THEMES_PER_ROW}%` }}>
        <h2 className="txt-lg">{theme.theme.displayName}</h2>
        <Button
          onClick={() => handleChangeTheme(theme, colorScheme)}
          value={theme.theme.name}
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

  renderThemeRows(colorScheme: ColorScheme): React.Node {
    const { themes } = this.state;

    const filteredThemes: { ColorScheme: Array<ThemeType> } = {
      default: themes,
      light: themes.filter(theme => !isDarkTheme(theme)),
      dark: themes.filter(theme => isDarkTheme(theme)),
    }[colorScheme];

    const rows = [];
    let row = [];
    for (const theme of filteredThemes) {
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
        {row.map(theme => this.renderTheme(theme, colorScheme))}
      </div>
    ));
  }

  renderColorSchemes(): React.Node {
    const { autoDetectColorScheme } = this.props;

    if (!autoDetectColorScheme) {
      return (
        <>
          <h2>Theme</h2>
          <div className="themes">{this.renderThemeRows('default')}</div>
        </>
      );
    }

    return (
      <>
        <h2>Light Theme</h2>
        <div className="themes">{this.renderThemeRows('light')}</div>
        <h2>Dark Theme</h2>
        <div className="themes">{this.renderThemeRows('dark')}</div>
      </>
    );
  }

  _handleAutoDetectColorSchemeChange(e: SyntheticEvent<HTMLInputElement>) {
    const { handleAutoDetectColorSchemeChange } = this.props;

    handleAutoDetectColorSchemeChange(e.target.checked);
  }

  render() {
    const { autoDetectColorScheme } = this.props;

    return (
      <>
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
              onChange={this._handleAutoDetectColorSchemeChange}
            />
          </label>
        </div>
        {this.renderColorSchemes()}
      </>
    );
  }
}

export default Theme;
