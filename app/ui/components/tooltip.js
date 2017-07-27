// @flow
import React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import ReactDOM from 'react-dom';

@autobind
class Tooltip extends React.PureComponent {
  props: {
    children: React.Children,
    message: string,

    // Optional
    position?: string,
    className?: string,
    delay?: number
  };

  state: {
    visible: boolean
  };

  _showTimeout: number;

  // TODO: Figure out what type these should be
  _tooltip: any;
  _bubble: any;

  constructor (props: any) {
    super(props);

    this.state = {
      left: null,
      top: null,
      bottom: null,
      right: null,
      maxWidth: null,
      maxHeight: null,
      visible: false
    };
  }

  _setTooltipRef (n: React.Element<*>): void {
    this._tooltip = n;
  }

  _setBubbleRef (n: React.Element<*>): void {
    this._bubble = n;
  }

  _handleClick (e: MouseEvent): void {
    e.stopPropagation();
  }

  _handleMouseEnter (e: MouseEvent): void {
    this._showTimeout = setTimeout((): void => {
      const tooltip = ReactDOM.findDOMNode(this._tooltip);
      const bubble = ReactDOM.findDOMNode(this._bubble);

      if (!tooltip || !(tooltip instanceof HTMLDivElement)) {
        return;
      }

      if (!bubble || !(bubble instanceof HTMLDivElement)) {
        return;
      }

      const tooltipRect = tooltip.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const margin = 3;

      switch (this.props.position) {
        case 'right':
          bubble.style.top = `${tooltipRect.top - (bubbleRect.height / 2) + (tooltipRect.height / 2)}px`;
          bubble.style.left = `${tooltipRect.left + tooltipRect.width + margin}px`;
          break;

        case 'bottom':
          bubble.style.top = `${tooltipRect.top + tooltipRect.height + margin}px`;
          bubble.style.left = `${tooltipRect.left - (bubbleRect.width / 2) + (tooltipRect.width / 2)}px`;
          break;

        case 'top':
        default:
          bubble.style.top = `${tooltipRect.top - bubbleRect.height - margin}px`;
          bubble.style.left = `${tooltipRect.left - (bubbleRect.width / 2) + (tooltipRect.width / 2)}px`;
          break;
      }

      this.setState({visible: true});
    }, this.props.delay || 100);
  }

  _handleMouseLeave (): void {
    clearTimeout(this._showTimeout);
    this.setState({visible: false});

    const bubble = ReactDOM.findDOMNode(this._bubble);
    if (!bubble || !(bubble instanceof HTMLDivElement)) {
      return;
    }

    // Reset positioning stuff
    bubble.style.left = '';
    bubble.style.top = '';
    bubble.style.bottom = '';
    bubble.style.right = '';
  }

  _getContainer (): HTMLElement {
    let container = document.querySelector('#tooltips-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltips-container';

      document.body && document.body.appendChild(container);
    }

    return container;
  }

  componentDidMount () {
    // Move the element to the body so we can position absolutely
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().appendChild(el);
    }
  }

  componentWillUnmount () {
    // Remove the element from the body
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().removeChild(el);
    }
  }

  render () {
    const {children, message, className} = this.props;
    const {visible} = this.state;

    const tooltipClasses = classnames(className, 'tooltip');
    const bubbleClasses = classnames('tooltip__bubble', {
      'tooltip__bubble--visible': visible
    });

    return (
      <div className={tooltipClasses}
           ref={this._setTooltipRef}
           onClick={this._handleClick}
           onMouseEnter={this._handleMouseEnter}
           onMouseLeave={this._handleMouseLeave}>
        <div className={bubbleClasses} ref={this._setBubbleRef}>
          {message}
        </div>
        {children}
      </div>
    );
  }
}

export default Tooltip;
