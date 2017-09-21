// @flow
import React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';

@autobind
class JSONNode extends React.PureComponent {
  state: {
    expanded: boolean,
    hasBeenExpanded: boolean
  };

  props: {
    value: any,
    label?: string
  };

  constructor (props: any) {
    super(props);
    this.state = {
      expanded: false,
      hasBeenExpanded: false
    };
  }

  clickExpand (e) {
    e.preventDefault();
    const expanded = !this.state.expanded;
    this.setState({
      expanded,
      hasBeenExpanded: this.state.hasBeenExpanded || expanded
    });
  }

  getType (value: any) {
    const type = Object.prototype.toString.call(value);
    switch (type) {
      case '[object Boolean]':
        return 'boolean';
      case '[object Object]':
        return 'object';
      case '[object Array]':
        return 'array';
      case '[object Number]':
        return 'number';
      case '[object String]':
        return 'string';
      case '[object Null]':
        return 'null';
      default:
        return 'unknown';
    }
  }

  render () {
    const {value, label} = this.props;
    const {expanded, hasBeenExpanded} = this.state;
    const type = this.getType(value);
    let isScalar = true;

    let children = null;
    if (Array.isArray(value)) {
      isScalar = false;
      children = value.map((v, i) => (
        <JSONNode key={i} value={v} label={i.toString()}/>
      ));
    } else if (value !== null && typeof value === 'object') {
      isScalar = false;
      children = Object.keys(value).sort((a, b) => {
        const typeA = this.getType(value[a]);
        const typeB = this.getType(value[b]);

        // Same type? Sort by key
        if (typeA === typeB) {
          return a > b ? 1 : -1;
        }

        const aIsHeavy = typeA === 'object' || typeA === 'array';
        const bIsHeavy = typeB === 'object' || typeB === 'array';

        if (aIsHeavy && !bIsHeavy) {
          return 1;
        }

        if (!aIsHeavy && bIsHeavy) {
          return -1;
        }

        return 0;
      }).map(key => (
        <JSONNode key={key} value={value[key]} label={key}/>
      ));
    }

    let describer = '';
    if (children) {
      const word = type === 'array' ? 'item' : 'key';
      const plural = children.length === 1 ? '' : 's';
      describer = ` ${children.length} ${word}${plural}`;
    }

    let suffix = '';
    if (type === 'array') {
      suffix = ' [ ] ';
    } else if (type === 'object') {
      suffix = ' { } ';
    }

    return (
      <div key={label || 'n/a'} className={classnames({
        'json-viewer__row': true,
        'json-viewer__row--expandable': children,
        'json-viewer__row--collapsed': children && children.length && !expanded,
        'json-viewer__row--expanded': children && children.length && expanded
      })}>
        <div onClick={this.clickExpand} className="json-viewer__inner">
          {typeof label === 'string' && (
            <span className="json-viewer__label"
                  data-before={`${label}:`}
                  data-after={`${suffix}${describer}`}
            />
          )}

          {isScalar && (
            <div className={`json-viewer__value json-viewer__value--${type}`}>
              {value + ''}
            </div>
          )}
        </div>

        {children && (expanded || hasBeenExpanded) && (
          <div className={classnames({
            'json-viewer__children': true,
            'hide': !expanded && hasBeenExpanded
          })}>
            {children}
          </div>
        )}
      </div>
    );
  }
}

class JSONViewer extends React.PureComponent {
  props: {
    body: Buffer,

    // Optional
    className?: string
  };

  render () {
    const {
      body,
      className
    } = this.props;

    return (
      <div className={classnames(className, 'json-viewer')}>
        <JSONNode label="root" value={JSON.parse(body.toString())} expanded/>
      </div>
    );
  }
}

export default JSONViewer;
