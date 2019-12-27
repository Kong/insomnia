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
`;

class SvgIcon extends React.Component<Props> {
  static icns = {
    'arrow-right': <IcnArrowRight />,
    'chevron-up': <IcnChevronUp />,
    'chevron-down': <IcnChevronDown />,
    'warning': <IcnWarning />,
    'error': <IcnError />,
  };

  render() {
    const { icon } = this.props;
    return (
      <SvgIconStyled>
        {SvgIcon.icns[icon]}
      </SvgIconStyled>
    );
  }
}

export default SvgIcon;
