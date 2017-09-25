// @flow
import React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import {describeByteSize} from '../../common/misc';

const PAGE_SIZE = 100;
const MAX_VALUE_LENGTH = 100;

type State = {
  expandedChildren: boolean,
  expandedValue: boolean,
  haveChildrenBeenExpanded: boolean,
  page: number
};

type Props = {
  value: any,
  expanded?: boolean,
  expandedValue?: boolean,
  label?: string
};

@autobind
class JSONNode extends React.PureComponent {
  props: Props;
  state: State;

  constructor (props: Props) {
    super(props);

    const expanded = props.expanded !== undefined ? props.expanded : false;

    this.state = {
      expandedChildren: expanded,
      expandedValue: expanded,
      haveChildrenBeenExpanded: expanded,
      page: 1
    };
  }

  clickExpandChildren (e) {
    e.preventDefault();
    const expandedChildren = !this.state.expandedChildren;
    this.setState({
      expandedChildren,
      hasBeenExpanded: this.state.haveChildrenBeenExpanded || expandedChildren
    });
  }

  clickExpandValue (e) {
    e.preventDefault();

    if (this.state.expandedValue) {
      return;
    }

    this.setState({expandedValue: true});
  }

  clickNextPage (e) {
    this.setState({page: this.state.page + 1});
  }

  clickShowAll (e) {
    this.setState({page: -1});
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
    const {
      expandedChildren,
      haveChildrenBeenExpanded,
      expandedValue,
      page
    } = this.state;

    const type = this.getType(value);
    let isScalar = true;

    let children = null;
    if (Array.isArray(value)) {
      isScalar = false;
      children = value.map((v, i) => ({
        value: v,
        label: i.toString()
      }));
    } else if (value !== null && typeof value === 'object') {
      isScalar = false;
      children = Object.keys(value).map(key => ({
        value: value[key],
        label: key
      }));
    }

    // Grab some metadata on children counts
    let describer = '';
    if (children) {
      const word = type === 'array' ? 'item' : 'key';
      const plural = children.length === 1 ? '' : 's';
      describer = ` ${children.length} ${word}${plural}`;
    }

    // Sort is too slow for large responses. Do something else here (like caching?)
    // children = children.sort((a, b) => {
    //   const typeA = this.getType(a.value);
    //   const typeB = this.getType(b.value);
    //
    //   const aIsHeavy = typeA === 'object' || typeA === 'array';
    //   const bIsHeavy = typeB === 'object' || typeB === 'array';
    //
    //   if (aIsHeavy && !bIsHeavy) {
    //     return 1;
    //   }
    //
    //   if (!aIsHeavy && bIsHeavy) {
    //     return -1;
    //   }
    //
    //   // Same type? Sort by key
    //   return a.value > b.value ? 1 : -1;
    // });

    // Render show-more section
    const extraChildren = [];
    const childNodes = [];
    if (children) {
      const limit = page * PAGE_SIZE;
      const next = limit + PAGE_SIZE;
      const nextLimit = next > children.length ? children.length : next;

      for (let i = 0; i < limit && i < children.length; i++) {
        const {label, value} = children[i];
        childNodes.push(
          <JSONNode key={label} value={value} label={label}/>
        );
      }

      if (limit < children.length) {
        extraChildren.push(
          <div key="show-next" onClick={this.clickNextPage} className="json-viewer__highlight">
            Show More ({limit}-{nextLimit})
          </div>
        );

        extraChildren.push(
          <div key="show-all" onClick={this.clickShowAll} className="json-viewer__highlight">
            Show All ({children.length})
          </div>
        );
      }
    }

    let valueToShow = value;
    let isValueTruncated = false;
    if (value && value.length && value.length > MAX_VALUE_LENGTH && !expandedValue) {
      valueToShow = value.slice(0, MAX_VALUE_LENGTH);
      isValueTruncated = true;
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
        'json-viewer__row--collapsed': children && children.length && !expandedChildren,
        'json-viewer__row--expanded': children && children.length && expandedChildren
      })}>
        <div onClick={this.clickExpandChildren} className="json-viewer__inner">
          {typeof label === 'string' && (
            <span className="json-viewer__label"
                  data-before={`${label}:`}
                  data-after={`${suffix}${describer}`}
            />
          )}

          {isScalar && (
            <div className={classnames('json-viewer__value', `json-viewer__value--${type}`, {
              'json-viewer__value--truncated': isValueTruncated
            })} onClick={this.clickExpandValue}>
              {isValueTruncated
                ? `${describeByteSize(Buffer.from(value).length)} hidden`
                : (valueToShow || '')
              }
            </div>
          )}
        </div>

        {children && (expandedChildren || haveChildrenBeenExpanded) && (
          <div className={classnames({
            'json-viewer__children': true,
            'hide': !expandedChildren && haveChildrenBeenExpanded
          })}>
            {childNodes}
            {extraChildren}
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
