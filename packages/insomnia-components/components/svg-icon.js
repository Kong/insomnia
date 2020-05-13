// @flow
import * as React from 'react';
import styled from 'styled-components';
import MemoSvgIcnArrowRight from '../assets/svgr/IcnArrowRight';
import MemoSvgIcnChevronDown from '../assets/svgr/IcnChevronDown';
import MemoSvgIcnChevronUp from '../assets/svgr/IcnChevronUp';
import MemoSvgIcnClock from '../assets/svgr/IcnClock';
import MemoSvgIcnEllipsis from '../assets/svgr/IcnEllipsis';
import MemoSvgIcnEmpty from '../assets/svgr/IcnEmpty';
import MemoSvgIcnErrors from '../assets/svgr/IcnErrors';
import MemoSvgIcnGitBranch from '../assets/svgr/IcnGitBranch';
import MemoSvgIcnGithubLogo from '../assets/svgr/IcnGithubLogo';
import MemoSvgIcnInfo from '../assets/svgr/IcnInfo';
import MemoSvgIcnSearch from '../assets/svgr/IcnSearch';
import MemoSvgIcnWarning from '../assets/svgr/IcnWarning';

export const ThemeEnum = {
  default: 'default',
  highlight: 'highlight',

  // Colors
  danger: 'danger',
  info: 'info',
  notice: 'notice',
  success: 'success',
  surprise: 'surprise',
  warning: 'warning',
};

type ThemeKeys = $Values<typeof ThemeEnum>;

export const IconEnum = {
  arrowRight: 'arrow-right',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  clock: 'clock',
  ellipsis: 'ellipsis',
  error: 'error',
  gitBranch: 'git-branch',
  github: 'github',
  info: 'info',
  search: 'search',
  warning: 'warning',

  // Blank icon
  empty: 'empty',
};

type IconKeys = $Values<typeof IconEnum>;

type Props = {
  icon: IconKeys,
  label?: React.Node,
};

const SvgIconStyled: React.ComponentType<{ theme: ThemeKeys, hasLabel: boolean }> = styled.div`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
    user-select: none;
    ${({ hasLabel }) => (hasLabel ? 'margin-right: var(--padding-xs);' : null)}
    ${({ theme }) => {
      switch (theme) {
        case ThemeEnum.danger:
        case ThemeEnum.info:
        case ThemeEnum.notice:
        case ThemeEnum.success:
        case ThemeEnum.surprise:
        case ThemeEnum.warning:
          return `fill: var(--color-${theme}); color: var(--color-font-${theme});`;
        case ThemeEnum.highlight:
          return 'fill: var(--hl); color: var(--color-font-danger);';
        case ThemeEnum.default:
        default:
          return 'fill: var(--color-font); color: var(--color-font);';
      }
    }}
  }
`;

type IconDictionary = {
  [IconKeys]: [ThemeKeys, React.ComponentType<any>],
};

class SvgIcon extends React.Component<Props> {
  static icons: IconDictionary = {
    [IconEnum.arrowRight]: [ThemeEnum.highlight, MemoSvgIcnArrowRight],
    [IconEnum.chevronDown]: [ThemeEnum.default, MemoSvgIcnChevronDown],
    [IconEnum.chevronUp]: [ThemeEnum.default, MemoSvgIcnChevronUp],
    [IconEnum.clock]: [ThemeEnum.default, MemoSvgIcnClock],
    [IconEnum.ellipsis]: [ThemeEnum.default, MemoSvgIcnEllipsis],
    [IconEnum.empty]: [ThemeEnum.default, MemoSvgIcnEmpty],
    [IconEnum.error]: [ThemeEnum.danger, MemoSvgIcnErrors],
    [IconEnum.gitBranch]: [ThemeEnum.default, MemoSvgIcnGitBranch],
    [IconEnum.github]: [ThemeEnum.default, MemoSvgIcnGithubLogo],
    [IconEnum.info]: [ThemeEnum.highlight, MemoSvgIcnInfo],
    [IconEnum.search]: [ThemeEnum.default, MemoSvgIcnSearch],
    [IconEnum.warning]: [ThemeEnum.notice, MemoSvgIcnWarning],
  };

  render() {
    const { icon, label } = this.props;

    if (!SvgIcon.icons[icon]) {
      throw new Error(
        `Invalid icon "${icon}" used. Must be one of ${Object.values(SvgIcon.icons).join('|')}`,
      );
    }

    const [theme, Svg] = SvgIcon.icons[icon];

    return (
      <SvgIconStyled theme={theme} hasLabel={!!label}>
        <Svg />
        {label}
      </SvgIconStyled>
    );
  }
}

export default SvgIcon;
