import React, {Component, PropTypes} from 'react';
import Button from '../base/Button';

import imgLight from '../../../static/themes/light.png';
import imgDark from '../../../static/themes/dark.png';
import imgDefault from '../../../static/themes/default.png';

const THEMES = [[
  {key: 'default', name: 'Insomnia', img: imgDefault},
  {key: 'light', name: 'Simple Light', img: imgLight},
  {key: 'dark', name: 'Simple Dark', img: imgDark},
]];

class SettingsTheme extends Component {
  render () {
    const {handleChangeTheme, activeTheme} = this.props;
    return (
      <div className="pad">
        {THEMES.map(row => {
          return (
            <div className="row-fill">
              {row.map(theme => (
                <div key={theme.key} className="text-center" style={{alignSelf: 'flex-start'}}>
                  <h2>
                    {theme.name}
                  </h2>
                  <Button onClick={handleChangeTheme} value={theme.key}>
                    <img src={theme.img} alt={theme.name} style={{maxWidth: '100%'}}/>
                  </Button>
                  {theme.key === activeTheme ? (
                      <p className="no-margin-top faint italic txt-sm">
                        <i className="fa fa-paint-brush"/> Active
                      </p>
                    ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    )
  }
}

SettingsTheme.propTypes = {
  handleChangeTheme: PropTypes.func.isRequired,
  activeTheme: PropTypes.string.isRequired,
};

export default SettingsTheme;
