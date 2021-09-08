import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { CSSProperties, MouseEvent, PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

export interface TooltipProps {
  children: ReactNode;
  message: ReactNode;
  position?: 'bottom' | 'top' | 'right' | 'left';
  className?: string;
  delay?: number;
  selectable?: boolean;
  wide?: boolean;
  style?: CSSProperties;
}

interface State {
  visible: boolean;
  movedToBody: boolean;
}

const StyledTooltip = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledTooltipBubble = styled.div`
  position: fixed;
  left: -999999px;
  opacity: 0;
  background: var(--color-bg);
  border: 1px solid var(--hl-sm);
  box-shadow: 0 0 1em rgba(0, 0, 0, 0.1);
  color: var(--color-font);
  padding: var(--padding-sm) var(--padding-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  max-width: 20rem;
  text-align: center;
  z-index: 10;
  white-space: normal !important;
  word-wrap: break-word;

  &.tooltip__bubble--visible {
    opacity: 1;
    z-index: 99999;
    transition: opacity 200ms;

    // Back to normal
    height: auto;
    line-height: normal;
  }

  &.tooltip__bubble--wide {
    max-width: 30rem;
  }
`;

@autoBindMethodsForReact
export class Tooltip extends PureComponent<TooltipProps, State> {
  _showTimeout: NodeJS.Timeout | null = null;
  _hideTimeout: NodeJS.Timeout | null = null;

  _tooltip: HTMLDivElement | null = null;
  _bubble: HTMLDivElement | null = null;
  _id = Math.random() + '';

  state: State = {
    visible: false,
    movedToBody: false,
  };

  _handleStopClick(e: MouseEvent) {
    e.stopPropagation();
  }

  _handleMouseEnter() {
    if (this._showTimeout !== null) {
      clearTimeout(this._showTimeout);
    }
    if (this._hideTimeout !== null) {
      clearTimeout(this._hideTimeout);
    }
    this._showTimeout = setTimeout(() => {
      const tooltip = this._tooltip;
      const bubble = this._bubble;

      if (!tooltip) {
        return;
      }

      if (!bubble) {
        return;
      }

      const tooltipRect = tooltip.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const margin = 3;
      let left = 0;
      let top = 0;

      switch (this.props.position) {
        case 'right':
          top = tooltipRect.top - bubbleRect.height / 2 + tooltipRect.height / 2;
          left = tooltipRect.left + tooltipRect.width + margin;
          break;

        case 'left':
          top = tooltipRect.top - bubbleRect.height / 2 + tooltipRect.height / 2;
          left = tooltipRect.left - bubbleRect.width - margin;
          break;

        case 'bottom':
          top = tooltipRect.top + tooltipRect.height + margin;
          left = tooltipRect.left - bubbleRect.width / 2 + tooltipRect.width / 2;
          break;

        case 'top':
        default:
          top = tooltipRect.top - bubbleRect.height - margin;
          left = tooltipRect.left - bubbleRect.width / 2 + tooltipRect.width / 2;
          break;
      }

      bubble.style.left = `${Math.max(0, left)}px`;
      bubble.style.top = `${Math.max(0, top)}px`;
      this.setState({
        visible: true,
      });
    }, this.props.delay || 400);
  }

  _handleMouseLeave(): void {
    if (this._showTimeout !== null) {
      clearTimeout(this._showTimeout);
    }
    if (this._hideTimeout !== null) {
      clearTimeout(this._hideTimeout);
    }
    this._hideTimeout = setTimeout(() => {
      this.setState({
        visible: false,
      });
      const bubble = this._bubble;

      if (!bubble) {
        return;
      }

      // Reset positioning stuff
      bubble.style.left = '';
      bubble.style.top = '';
      bubble.style.bottom = '';
      bubble.style.right = '';
    }, 100);
  }

  _getContainer() {
    let container = document.querySelector<HTMLElement>('#tooltips-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltips-container';
      container.style.zIndex = '1000000';
      container.style.position = 'relative';
      document.body && document.body.appendChild(container);
    }

    return container;
  }

  _moveBubbleToBody() {
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().appendChild(el);
      this.setState({
        movedToBody: true,
      });
    }
  }

  _removeBubbleFromBody() {
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().removeChild(el);
      this.setState({
        movedToBody: false,
      });
    }
  }

  componentDidMount() {
    // Move the element to the body so we can position absolutely
    this._moveBubbleToBody();
  }

  componentDidUpdate() {
    // If the bubble has not been moved to body, move it.
    // This can happen if there is no message during the first mount but a message is provided during on a subsequent render.
    if (!this.state.movedToBody) {
      this._moveBubbleToBody();
    }
  }

  componentWillUnmount() {
    // Remove the element from the body
    this._removeBubbleFromBody();
  }

  render() {
    const { children, message, className, selectable, wide, style } = this.props;
    const { visible } = this.state;

    if (!message) {
      return children;
    }

    const tooltipClasses = classnames(className, 'tooltip');
    const bubbleClasses = classnames('tooltip__bubble theme--tooltip', {
      'tooltip__bubble--visible': visible,
      'tooltip__bubble--wide': wide,
      selectable: selectable,
    });
    return (
      <StyledTooltip
        className={tooltipClasses}
        ref={ref => { this._tooltip = ref; }}
        id={this._id}
        onMouseEnter={this._handleMouseEnter}
        onMouseLeave={this._handleMouseLeave}
        style={style}
      >
        <StyledTooltipBubble
          className={bubbleClasses}
          onClick={this._handleStopClick}
          role="tooltip"
          aria-hidden={!visible}
          aria-describedby={this._id}
          ref={ref => { this._bubble = ref; }}
        >
          {message}
        </StyledTooltipBubble>
        {children}
      </StyledTooltip>
    );
  }
}
