import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import ReactDOM from 'react-dom';

@autobind
class Tooltip extends PureComponent {
  constructor (props) {
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

  _setTooltipRef (n) {
    this._tooltip = n;
  }

  _setBubbleRef (n) {
    this._bubble = n;
  }

  _handleMouseEnter (e) {
    this._showTimeout = setTimeout(() => {
      const tooltip = ReactDOM.findDOMNode(this._tooltip);
      const bubble = ReactDOM.findDOMNode(this._bubble);

      const tooltipRect = tooltip.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();

      let top = null;
      let left = null;
      let bottom = null;
      let right = null;
      let maxWidth = null;
      let maxHeight = null;

      switch (this.props.position) {
        case 'right':
          top = (tooltipRect.height / 2) - (bubbleRect.height / 2);
          left = tooltipRect.width;
          maxWidth = bubbleRect.right;
          break;

        case 'bottom':
          left = (tooltipRect.width / 2) - (bubbleRect.width / 2);
          top = tooltipRect.height;
          break;

        case 'top':
        default:
          left = (tooltipRect.width / 2) - (bubbleRect.width / 2);
          bottom = tooltipRect.height;
          break;
      }

      this.setState({top, left, bottom, right, maxWidth, maxHeight, visible: true});
    }, this.props.delay || 100);
  }

  _handleMouseLeave () {
    clearTimeout(this._showTimeout);
    this.setState({visible: false, left: 0, top: 0});
  }

  render () {
    const {children, message, className} = this.props;
    const {left, top, right, bottom, visible, maxHeight, maxWidth} = this.state;

    const tooltipClasses = classnames(
      className,
      'tooltip',
      `tooltip--${this.props.position || 'top'}`,
      {'tooltip--visible': visible}
    );

    const bubbleClasses = classnames('tooltip__bubble', 'overlay');

    const bubbleStyles = {
      left: left ? `${left}px` : null,
      top: top ? `${top}px` : null,
      right: right ? `${right}px` : null,
      bottom: bottom ? `${bottom}px` : null,
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`
    };

    return (
      <div className={tooltipClasses}
           ref={this._setTooltipRef}
           onMouseEnter={this._handleMouseEnter}
           onMouseLeave={this._handleMouseLeave}>
        <div style={bubbleStyles} className={bubbleClasses} ref={this._setBubbleRef}>
          {message}
        </div>
        {children}
      </div>
    );
  }
}

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  message: PropTypes.node.isRequired,

  // Optional
  position: PropTypes.string,
  className: PropTypes.string,
  delay: PropTypes.number
};

export default Tooltip;
