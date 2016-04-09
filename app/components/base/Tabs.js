import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'

class TabList extends Component {
  render () {
    const {className} = this.props;
    return (
      <div className={classnames('tabs__list', className)}>
        {this.props.children}
      </div>
    )
  }
}

class Tab extends Component {
  render () {
    const {className} = this.props;
    return (
      <div className={classnames('tabs__list__tab', className)}>
        {this.props.children}
      </div>
    )
  }
}


class TabPanel extends Component {
  render () {
    const {className} = this.props;
    return (
      <div className={classnames('tabs__panel', className)}>
        {this.props.children}
      </div>
    )
  }
}

class Tabs extends Component {
  _handleClick (e) {
    // Did we click a tab? Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;

    for (let i = 0; i < 5; i++) {
      if (target.className.indexOf('tabs__list__tab') !== -1) {
        let newIndex = -1;
        for (let i = 0; i < target.parentNode.children.length; i++) {
            newIndex = target === target.parentNode.children[i] ? i : newIndex;
        }
        
        this.props.onChange && this.props.onChange(newIndex);
        return;
      }

      target = target.parentNode;
    }
  }
  
  getChildren () {
    const {selectedIndex} = this.props;
    
    let panelCoount = -1;
    return this.props.children.map(c => {
      if (c.type === TabPanel) {
        return panelCount++ !== selectedIndex ? null : c;
      } else {
        return c;
      }
    })
  }
  
  render () {
    const {className} = this.props;

    return (
      <div className={classnames('tabs', className)}>
        {this.getChildren()}
      </div>
    );
  }
}

Tabs.propTypes = {
  selectedIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func
};

export {Tabs, TabList, TabPanel, Tab};
