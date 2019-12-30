// @flow
import * as React from 'react';
import styled from 'styled-components';
import IcnArrowRight from '../assets/icn-arrow-right.svg';
import IcnChevronDown from '../assets/icn-chevron-down.svg';
import IcnChevronUp from '../assets/icn-chevron-up.svg';
import IcnWarning from '../assets/icn-warning.svg';
import IcnError from '../assets/icn-errors.svg';

type Props = {
  icon: 'arrow-right' | 'chevron-up' | 'chevron-down' | 'warning' | 'error',
};

const SvgIconStyled: React.ComponentType<any> = styled.div`
  display: inline-block;
  width: 1em;
  height: 1em;
  position: relative;

  svg {
    display: block;
    height: 100%;
    width: auto;
    transform: scale(0.9);

    // Ensures that the svg doesn't "bounce out" of the div
    // (flex-box parent styles can cause this to happen)
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  svg .fill-font {
    fill: var(--color-font);
  }
  svg .fill-danger {
    fill: var(--color-danger);
  }
  svg .fill-danger-font {
    fill: var(--color-font-danger);
  }
  svg .fill-warning {
    fill: var(--color-warning);
  }
  svg .fill-warning-font {
    fill: var(--color-font-warning);
  }
  svg .fill-notice {
    fill: var(--color-notice);
  }
  svg .fill-notice-font {
    fill: var(--color-font-notice);
  }
  svg .fill-hl {
    fill: var(--hl);
  }
  svg .fill-hl-font {
    fill: var(--color-font-danger);
  }
`;

class SvgIcon extends React.Component<Props> {
  static icns = {
    'arrow-right': <IcnArrowRight />,
    'chevron-up': <IcnChevronUp />,
    'chevron-down': <IcnChevronDown />,
    warning: <IcnWarning />,
    error: <IcnError />,
  };

  render() {
    const { icon } = this.props;
    return <SvgIconStyled>{SvgIcon.icns[icon]}</SvgIconStyled>;
  }
}

export default SvgIcon;
