import React, { Component, NamedExoticComponent, ReactNode, SVGProps } from 'react';
import styled from 'styled-components';

import { SvgIcnArrowRight } from './assets/svgr/IcnArrowRight';
import { SvgIcnChevronDown } from './assets/svgr/IcnChevronDown';
import { SvgIcnChevronUp } from './assets/svgr/IcnChevronUp';
import { SvgIcnClock } from './assets/svgr/IcnClock';
import { SvgIcnEmpty } from './assets/svgr/IcnEmpty';
import { SvgIcnErrors } from './assets/svgr/IcnErrors';
import { SvgIcnGitBranch } from './assets/svgr/IcnGitBranch';
import { SvgIcnGithubLogo } from './assets/svgr/IcnGithubLogo';
import { SvgIcnBitbucketLogo } from './assets/svgr/IcnBitbucketLogo';
import { SvgIcnWarning } from './assets/svgr/IcnWarning';
import { SvgIcnEllipsis } from './assets/svgr/IcnEllipsis';
import { SvgIcnBurgerMenu } from './assets/svgr/IcnBurgerMenu';
import { SvgIcnCheckmark } from './assets/svgr/IcnCheckmark';
import { SvgIcnCookie } from './assets/svgr/IcnCookie';
import { SvgIcnDragGrip } from './assets/svgr/IcnDragGrip';
import { SvgIcnElevator } from './assets/svgr/IcnElevator';
import { SvgIcnEllipsisCircle } from './assets/svgr/IcnEllipsisCircle';
import { SvgIcnFile } from './assets/svgr/IcnFile';
import { SvgIcnFolderOpen } from './assets/svgr/IcnFolderOpen';
import { SvgIcnFolder } from './assets/svgr/IcnFolder';
import { SvgIcnGear } from './assets/svgr/IcnGear';
import { SvgIcnGitlabLogo } from './assets/svgr/IcnGitlabLogo';
import { SvgIcnGui } from './assets/svgr/IcnGui';
import { SvgIcnIndentation } from './assets/svgr/IcnIndentation';
import { SvgIcnMinusCircleFill } from './assets/svgr/IcnMinusCircleFill';
import { SvgIcnMinusCircle } from './assets/svgr/IcnMinusCircle';
import { SvgIcnPlaceholder } from './assets/svgr/IcnPlaceholder';
import { SvgIcnPlay } from './assets/svgr/IcnPlay';
import { SvgIcnPlus } from './assets/svgr/IcnPlus';
import { SvgIcnProhibited } from './assets/svgr/IcnProhibited';
import { SvgIcnQuestionFill } from './assets/svgr/IcnQuestionFill';
import { SvgIcnQuestion } from './assets/svgr/IcnQuestion';
import { SvgIcnSearch } from './assets/svgr/IcnSearch';
import { SvgIcnSecCert } from './assets/svgr/IcnSecCert';
import { SvgIcnSuccess } from './assets/svgr/IcnSuccess';
import { SvgIcnSync } from './assets/svgr/IcnSync';
import { SvgIcnTrashcan } from './assets/svgr/IcnTrashcan';
import { SvgIcnTriangle } from './assets/svgr/IcnTriangle';
import { SvgIcnUser } from './assets/svgr/IcnUser';
import { SvgIcnWarningCircle } from './assets/svgr/IcnWarningCircle';
import { SvgIcnX } from './assets/svgr/IcnX';
import { SvgIcnInfo } from './assets/svgr/IcnInfo';
import { SvgIcnKey } from './assets/svgr/IcnKey';
import { SvgIcnBrackets } from './assets/svgr/IcnBrackets';
import { ValueOf } from 'type-fest';

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
} as const;

type ThemeKeys = ValueOf<typeof ThemeEnum>;

export const IconEnum = {
  arrowRight: 'arrow-right',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  clock: 'clock',
  ellipsis: 'ellipsis',
  error: 'error',
  gitBranch: 'git-branch',
  github: 'github',
  bitbucket: 'bitbucket',
  info: 'info',
  search: 'search',
  warning: 'warning',
  burgerMenu: 'burger-menu',
  checkmark: 'checkmark',
  cookie: 'cookie',
  dragGrip: 'drag-grip',
  elevator: 'elevator',
  ellipsesCircle: 'ellipses-circle',
  file: 'file',
  folder: 'folder',
  folderOpen: 'folder-open',
  gear: 'gear',
  gitlabLogo: 'gitlab-logo',
  gui: 'gui',
  indentation: 'indentation',
  minusCircle: 'minus-circle',
  minusCircleFill: 'minus-circle-fill',
  placeholder: 'placeholder',
  play: 'play',
  plus: 'plus',
  prohibited: 'prohibited',
  questionFill: 'question-fill',
  question: 'question',
  secCert: 'sec-cert',
  success: 'success',
  sync: 'sync',
  trashcan: 'trashcan',
  triangle: 'triangle',
  user: 'user',
  warningCircle: 'warning-circle',
  x: 'x',
  key: 'key',
  brackets: 'brackets',

  /** Blank icon */
  empty: 'empty',
} as const;

export type IconId = ValueOf<typeof IconEnum>;

export interface SvgIconProps {
  icon: IconId;
  label?: ReactNode;
}

const SvgIconStyled = styled.div<{
  theme: ThemeKeys;
  hasLabel: boolean;
}>`
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

export class SvgIcon extends Component<SvgIconProps> {
  static icons: Record<IconId, [ThemeKeys, NamedExoticComponent<SVGProps<SVGSVGElement>>]> = {
    [IconEnum.arrowRight]: [ThemeEnum.highlight, SvgIcnArrowRight],
    [IconEnum.chevronDown]: [ThemeEnum.default, SvgIcnChevronDown],
    [IconEnum.chevronUp]: [ThemeEnum.default, SvgIcnChevronUp],
    [IconEnum.clock]: [ThemeEnum.default, SvgIcnClock],
    [IconEnum.ellipsis]: [ThemeEnum.default, SvgIcnEllipsis],
    [IconEnum.empty]: [ThemeEnum.default, SvgIcnEmpty],
    [IconEnum.error]: [ThemeEnum.danger, SvgIcnErrors],
    [IconEnum.gitBranch]: [ThemeEnum.default, SvgIcnGitBranch],
    [IconEnum.github]: [ThemeEnum.default, SvgIcnGithubLogo],
    [IconEnum.bitbucket]: [ThemeEnum.default, SvgIcnBitbucketLogo],
    [IconEnum.info]: [ThemeEnum.highlight, SvgIcnInfo],
    [IconEnum.search]: [ThemeEnum.default, SvgIcnSearch],
    [IconEnum.warning]: [ThemeEnum.notice, SvgIcnWarning],
    [IconEnum.burgerMenu]: [ThemeEnum.default, SvgIcnBurgerMenu],
    [IconEnum.checkmark]: [ThemeEnum.default, SvgIcnCheckmark],
    [IconEnum.cookie]: [ThemeEnum.default, SvgIcnCookie],
    [IconEnum.dragGrip]: [ThemeEnum.default, SvgIcnDragGrip],
    [IconEnum.elevator]: [ThemeEnum.default, SvgIcnElevator],
    [IconEnum.ellipsesCircle]: [ThemeEnum.default, SvgIcnEllipsisCircle],
    [IconEnum.elevator]: [ThemeEnum.default, SvgIcnElevator],
    [IconEnum.file]: [ThemeEnum.default, SvgIcnFile],
    [IconEnum.folder]: [ThemeEnum.default, SvgIcnFolder],
    [IconEnum.folderOpen]: [ThemeEnum.default, SvgIcnFolderOpen],
    [IconEnum.gear]: [ThemeEnum.default, SvgIcnGear],
    [IconEnum.gitlabLogo]: [ThemeEnum.default, SvgIcnGitlabLogo],
    [IconEnum.gui]: [ThemeEnum.default, SvgIcnGui],
    [IconEnum.indentation]: [ThemeEnum.default, SvgIcnIndentation],
    [IconEnum.minusCircle]: [ThemeEnum.default, SvgIcnMinusCircle],
    [IconEnum.minusCircleFill]: [ThemeEnum.default, SvgIcnMinusCircleFill],
    [IconEnum.placeholder]: [ThemeEnum.default, SvgIcnPlaceholder],
    [IconEnum.play]: [ThemeEnum.default, SvgIcnPlay],
    [IconEnum.plus]: [ThemeEnum.default, SvgIcnPlus],
    [IconEnum.prohibited]: [ThemeEnum.default, SvgIcnProhibited],
    [IconEnum.question]: [ThemeEnum.default, SvgIcnQuestion],
    [IconEnum.questionFill]: [ThemeEnum.default, SvgIcnQuestionFill],
    [IconEnum.secCert]: [ThemeEnum.default, SvgIcnSecCert],
    [IconEnum.success]: [ThemeEnum.success, SvgIcnSuccess],
    [IconEnum.sync]: [ThemeEnum.default, SvgIcnSync],
    [IconEnum.trashcan]: [ThemeEnum.default, SvgIcnTrashcan],
    [IconEnum.triangle]: [ThemeEnum.default, SvgIcnTriangle],
    [IconEnum.user]: [ThemeEnum.default, SvgIcnUser],
    [IconEnum.warningCircle]: [ThemeEnum.default, SvgIcnWarningCircle],
    [IconEnum.x]: [ThemeEnum.default, SvgIcnX],
    [IconEnum.key]: [ThemeEnum.default, SvgIcnKey],
    [IconEnum.brackets]: [ThemeEnum.default, SvgIcnBrackets],
  };

  render() {
    const { icon, label } = this.props;

    if (!SvgIcon.icons[icon]) {
      throw new Error(
        `Invalid icon "${icon}" used. Must be one of ${Object.values(IconEnum).join('|')}`,
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
