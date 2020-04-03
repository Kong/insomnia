// @flow
import * as React from 'react';
import styled, {css} from 'styled-components';
import MemoSvgIcnArrowRight from '../assets/svgr/IcnArrowRight';
import MemoSvgIcnInfo from '../assets/svgr/IcnInfo';
import MemoSvgIcnClock from '../assets/svgr/IcnClock';
import MemoSvgIcnChevronDown from '../assets/svgr/IcnChevronDown';
import MemoSvgIcnChevronUp from '../assets/svgr/IcnChevronUp';
import MemoSvgIcnErrors from '../assets/svgr/IcnErrors';
import MemoSvgIcnGitBranch from '../assets/svgr/IcnGitBranch';
import MemoSvgIcnGithubLogo from '../assets/svgr/IcnGithubLogo';
import MemoSvgIcnWarning from '../assets/svgr/IcnWarning';

export const ThemeEnum = {
  default: 'default',
  danger: 'danger',
  warning: 'warning',
  notice: 'notice',
  highlight: 'highlight',
};

type ThemeKeys = $Values<typeof ThemeEnum>;

export const IconEnum = {
  info: 'info',
  clock: 'clock',
  arrowRight: 'arrow-right',
  chevronUp: 'chevron-up',
  chevronDown: 'chevron-down',
  warning: 'warning',
  error: 'error',
  github: 'github',
  gitBranch: 'git-branch',
};

type IconKeys = $Values<typeof IconEnum>;

type Props = {
  icon: IconKeys;
};

const SvgIconStyled: React.ComponentType<{theme: ThemeKeys}> = styled.div`
  display: inline-block;
  width: 1em;
  height: 1em;
  position: relative;

  svg {
    display: block;
    height: 100%;
    width: auto;
    transform: scale(0.9);
    ${
      ({theme}) => {
        switch (theme) {
          case ThemeEnum.danger:
          case ThemeEnum.warning:
          case ThemeEnum.notice:
            return css`
                  fill: var(--color-${theme});
                  color: var(--color-font-${theme});`;
          case ThemeEnum.highlight:
            return css`
                  fill: var(--hl);
                  color: var(--color-font-danger);`;
          case ThemeEnum.default:
          default:
            return css`
                  fill: var(--color-font);
                  color: var(--color-font);`;
        }
      }
    }

    // Ensures that the svg doesn't "bounce out" of the div
    // (flex-box parent styles can cause this to happen)
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
`;

type IconDictionary = {
  [IconKeys]: [ThemeKeys, React.ComponentType<any>];
}

class SvgIcon extends React.Component<Props> {
  static icons: IconDictionary = {
    [IconEnum.info]: [ThemeEnum.highlight, MemoSvgIcnInfo],
    [IconEnum.clock]: [ThemeEnum.default, MemoSvgIcnClock],
    [IconEnum.chevronDown]: [ThemeEnum.default, MemoSvgIcnChevronDown],
    [IconEnum.chevronUp]: [ThemeEnum.default, MemoSvgIcnChevronUp],
    [IconEnum.arrowRight]: [ThemeEnum.highlight, MemoSvgIcnArrowRight],
    [IconEnum.error]: [ThemeEnum.danger, MemoSvgIcnErrors],
    [IconEnum.gitBranch]: [ThemeEnum.default, MemoSvgIcnGitBranch],
    [IconEnum.github]: [ThemeEnum.default, MemoSvgIcnGithubLogo],
    [IconEnum.warning]: [ThemeEnum.notice, MemoSvgIcnWarning],
  };

  render() {
    const { icon } = this.props;
    const [theme, Svg] = SvgIcon.icons[icon];

    return (
      <SvgIconStyled theme={theme}>
        <Svg />
      </SvgIconStyled>
    );
  }
}

export default SvgIcon;
