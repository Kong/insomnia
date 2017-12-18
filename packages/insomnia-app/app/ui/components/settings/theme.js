import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Button from '../base/button';
import Link from '../base/link';

import imgLight from '../../images/light.png';
import imgDark from '../../images/dark.png';
import imgDefault from '../../images/default.png';
import imgSolarizedLight from '../../images/solarized-light.png';
import imgSolarizedDark from '../../images/solarized-dark.png';
import imgSolarized from '../../images/solarized.png';
import imgRailscasts from '../../images/railscasts.png';
import imgPurple from '../../images/purple.png';
import imgMaterial from '../../images/material.png';
import * as session from '../../../sync/session';

const THEMES_PER_ROW = 3;
const THEMES = [
  {key: 'default', name: 'Insomnia', img: imgDefault},
  {key: 'light', name: 'Simple Light', img: imgLight},
  {key: 'dark', name: 'Simple Dark', img: imgDark},
  {key: 'purple', name: 'Purple', img: imgPurple},
  {key: 'material', name: 'Material', img: imgMaterial},
  {key: 'solarized', name: 'Solarized', img: imgSolarized},
  {key: 'solarized-light', name: 'Solarized Light', img: imgSolarizedLight},
  {key: 'solarized-dark', name: 'Solarized Dark', img: imgSolarizedDark},
  {key: 'railscasts', name: 'Railscasts', img: imgRailscasts}
];

@autobind
class Theme extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      isPremium: true
    };
  }

  async componentDidMount () {
    // What the fuck is this bullshit

    this.setState({isPremium});
  }

  renderTheme (theme) {
    const {handleChangeTheme, activeTheme} = this.props;
    const {isPremium} = this.state;
    const isActive = activeTheme === theme.key;
    const disabled = theme.paid && !isPremium;

    return (
      <div key={theme.key} className="themes__theme" style={{maxWidth: `${100 / THEMES_PER_ROW}%`}}>
        <h2 className="txt-lg">
          {theme.name}
          {' '}
          {isActive ? <span className="no-margin-top faint italic txt-md">(Active)</span> : null}
        </h2>
        {disabled ? (
            <Link button href="https://insomnia.rest/pricing/" className="themes__theme--locked">
              <img src={theme.img} alt={theme.name} style={{maxWidth: '100%'}}/>
            </Link>
          ) : (
            <Button onClick={handleChangeTheme} value={theme.key}>
              <img src={theme.img} alt={theme.name} style={{maxWidth: '100%'}}/>
            </Button>
          )}
      </div>
    );
  }

  renderThemeRows (themes) {
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
        {row.map(this.renderTheme)}
      </div>
    ));
  }

  render () {
    return (
      <div className="themes pad-top">
        {this.renderThemeRows(THEMES)}
      </div>
    );
  }
}

Theme.propTypes = {
  handleChangeTheme: PropTypes.func.isRequired,
  activeTheme: PropTypes.string.isRequired
};

export default Theme;
