import React, { CSSProperties, Component, NamedExoticComponent, ReactNode, SVGProps } from 'react';
import styled from 'styled-components';

import { SvgIcnArrowRight } from './assets/svgr/IcnArrowRight';
import { SvgIcnBitbucketLogo } from './assets/svgr/IcnBitbucketLogo';
import { SvgIcnBrackets } from './assets/svgr/IcnBrackets';
import { SvgIcnBurgerMenu } from './assets/svgr/IcnBurgerMenu';
import { SvgIcnCheckmark } from './assets/svgr/IcnCheckmark';
import { SvgIcnChevronDown } from './assets/svgr/IcnChevronDown';
import { SvgIcnChevronUp } from './assets/svgr/IcnChevronUp';
import { SvgIcnClock } from './assets/svgr/IcnClock';
import { SvgIcnCookie } from './assets/svgr/IcnCookie';
import { SvgIcnDragGrip } from './assets/svgr/IcnDragGrip';
import { SvgIcnElevator } from './assets/svgr/IcnElevator';
import { SvgIcnEllipsis } from './assets/svgr/IcnEllipsis';
import { SvgIcnEllipsisCircle } from './assets/svgr/IcnEllipsisCircle';
import { SvgIcnEmpty } from './assets/svgr/IcnEmpty';
import { SvgIcnErrors } from './assets/svgr/IcnErrors';
import { SvgIcnFile } from './assets/svgr/IcnFile';
import { SvgIcnFolder } from './assets/svgr/IcnFolder';
import { SvgIcnFolderOpen } from './assets/svgr/IcnFolderOpen';
import { SvgIcnGear } from './assets/svgr/IcnGear';
import { SvgIcnGitBranch } from './assets/svgr/IcnGitBranch';
import { SvgIcnGithubLogo } from './assets/svgr/IcnGithubLogo';
import { SvgIcnGitlabLogo } from './assets/svgr/IcnGitlabLogo';
import { SvgIcnGlobe } from './assets/svgr/IcnGlobe';
import { SvgIcnGui } from './assets/svgr/IcnGui';
import { SvgIcnHome } from './assets/svgr/IcnHome';
import { SvgIcnIndentation } from './assets/svgr/IcnIndentation';
import { SvgIcnInfo } from './assets/svgr/IcnInfo';
import { SvgIcnKey } from './assets/svgr/IcnKey';
import { SvgIcnMinusCircle } from './assets/svgr/IcnMinusCircle';
import { SvgIcnMinusCircleFill } from './assets/svgr/IcnMinusCircleFill';
import { SvgIcnPlaceholder } from './assets/svgr/IcnPlaceholder';
import { SvgIcnPlay } from './assets/svgr/IcnPlay';
import { SvgIcnPlus } from './assets/svgr/IcnPlus';
import { SvgIcnProhibited } from './assets/svgr/IcnProhibited';
import { SvgIcnQuestion } from './assets/svgr/IcnQuestion';
import { SvgIcnQuestionFill } from './assets/svgr/IcnQuestionFill';
import { SvgIcnSearch } from './assets/svgr/IcnSearch';
import { SvgIcnSecCert } from './assets/svgr/IcnSecCert';
import { SvgIcnSuccess } from './assets/svgr/IcnSuccess';
import { SvgIcnSync } from './assets/svgr/IcnSync';
import { SvgIcnTrashcan } from './assets/svgr/IcnTrashcan';
import { SvgIcnTriangle } from './assets/svgr/IcnTriangle';
import { SvgIcnUser } from './assets/svgr/IcnUser';
import { SvgIcnWarning } from './assets/svgr/IcnWarning';
import { SvgIcnWarningCircle } from './assets/svgr/IcnWarningCircle';
import { SvgIcnX } from './assets/svgr/IcnX';
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
  bitbucket: 'bitbucket',
  brackets: 'brackets',
  burgerMenu: 'burger-menu',
  checkmark: 'checkmark',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  clock: 'clock',
  cookie: 'cookie',
  dragGrip: 'drag-grip',
  elevator: 'elevator',
  ellipsesCircle: 'ellipses-circle',
  ellipsis: 'ellipsis',
  error: 'error',
  file: 'file',
  folder: 'folder',
  folderOpen: 'folder-open',
  gear: 'gear',
  gitBranch: 'git-branch',
  github: 'github',
  gitlabLogo: 'gitlab-logo',
  globe: 'globe',
  gui: 'gui',
  indentation: 'indentation',
  info: 'info',
  home: 'home',
  key: 'key',
  minusCircle: 'minus-circle',
  minusCircleFill: 'minus-circle-fill',
  placeholder: 'placeholder',
  play: 'play',
  plus: 'plus',
  prohibited: 'prohibited',
  question: 'question',
  questionFill: 'question-fill',
  search: 'search',
  secCert: 'sec-cert',
  success: 'success',
  sync: 'sync',
  trashcan: 'trashcan',
  triangle: 'triangle',
  user: 'user',
  warning: 'warning',
  warningCircle: 'warning-circle',
  x: 'x',

  /** Blank icon */
  empty: 'empty',
} as const;

export type IconId = ValueOf<typeof IconEnum>;

export interface SvgIconProps {
  icon: IconId;
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const SvgIconStyled = styled.div<{
  $theme: ThemeKeys;
  $hasLabel: boolean;
}>`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
    user-select: none;
    ${({ $hasLabel }) => ($hasLabel ? 'margin-right: var(--padding-xs);' : null)}
    ${({ $theme }) => {
    switch ($theme) {
      case ThemeEnum.danger:
      case ThemeEnum.info:
      case ThemeEnum.notice:
      case ThemeEnum.success:
      case ThemeEnum.surprise:
      case ThemeEnum.warning:
        return `fill: var(--color-${$theme}); color: var(--color-font-${$theme});`;

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
    [IconEnum.bitbucket]: [ThemeEnum.default, SvgIcnBitbucketLogo],
    [IconEnum.brackets]: [ThemeEnum.default, SvgIcnBrackets],
    [IconEnum.burgerMenu]: [ThemeEnum.default, SvgIcnBurgerMenu],
    [IconEnum.checkmark]: [ThemeEnum.default, SvgIcnCheckmark],
    [IconEnum.chevronDown]: [ThemeEnum.default, SvgIcnChevronDown],
    [IconEnum.chevronUp]: [ThemeEnum.default, SvgIcnChevronUp],
    [IconEnum.clock]: [ThemeEnum.default, SvgIcnClock],
    [IconEnum.cookie]: [ThemeEnum.default, SvgIcnCookie],
    [IconEnum.dragGrip]: [ThemeEnum.default, SvgIcnDragGrip],
    [IconEnum.elevator]: [ThemeEnum.default, SvgIcnElevator],
    [IconEnum.elevator]: [ThemeEnum.default, SvgIcnElevator],
    [IconEnum.ellipsesCircle]: [ThemeEnum.default, SvgIcnEllipsisCircle],
    [IconEnum.ellipsis]: [ThemeEnum.default, SvgIcnEllipsis],
    [IconEnum.empty]: [ThemeEnum.default, SvgIcnEmpty],
    [IconEnum.error]: [ThemeEnum.danger, SvgIcnErrors],
    [IconEnum.file]: [ThemeEnum.default, SvgIcnFile],
    [IconEnum.folderOpen]: [ThemeEnum.default, SvgIcnFolderOpen],
    [IconEnum.folder]: [ThemeEnum.default, SvgIcnFolder],
    [IconEnum.gear]: [ThemeEnum.default, SvgIcnGear],
    [IconEnum.gitBranch]: [ThemeEnum.default, SvgIcnGitBranch],
    [IconEnum.github]: [ThemeEnum.default, SvgIcnGithubLogo],
    [IconEnum.gitlabLogo]: [ThemeEnum.default, SvgIcnGitlabLogo],
    [IconEnum.globe]: [ThemeEnum.default, SvgIcnGlobe],
    [IconEnum.gui]: [ThemeEnum.default, SvgIcnGui],
    [IconEnum.home]: [ThemeEnum.default, SvgIcnHome],
    [IconEnum.indentation]: [ThemeEnum.default, SvgIcnIndentation],
    [IconEnum.info]: [ThemeEnum.highlight, SvgIcnInfo],
    [IconEnum.key]: [ThemeEnum.default, SvgIcnKey],
    [IconEnum.minusCircleFill]: [ThemeEnum.default, SvgIcnMinusCircleFill],
    [IconEnum.minusCircle]: [ThemeEnum.default, SvgIcnMinusCircle],
    [IconEnum.placeholder]: [ThemeEnum.default, SvgIcnPlaceholder],
    [IconEnum.play]: [ThemeEnum.default, SvgIcnPlay],
    [IconEnum.plus]: [ThemeEnum.default, SvgIcnPlus],
    [IconEnum.prohibited]: [ThemeEnum.default, SvgIcnProhibited],
    [IconEnum.questionFill]: [ThemeEnum.default, SvgIcnQuestionFill],
    [IconEnum.question]: [ThemeEnum.default, SvgIcnQuestion],
    [IconEnum.search]: [ThemeEnum.default, SvgIcnSearch],
    [IconEnum.secCert]: [ThemeEnum.default, SvgIcnSecCert],
    [IconEnum.success]: [ThemeEnum.success, SvgIcnSuccess],
    [IconEnum.sync]: [ThemeEnum.default, SvgIcnSync],
    [IconEnum.trashcan]: [ThemeEnum.default, SvgIcnTrashcan],
    [IconEnum.triangle]: [ThemeEnum.default, SvgIcnTriangle],
    [IconEnum.user]: [ThemeEnum.default, SvgIcnUser],
    [IconEnum.warningCircle]: [ThemeEnum.default, SvgIcnWarningCircle],
    [IconEnum.warning]: [ThemeEnum.notice, SvgIcnWarning],
    [IconEnum.x]: [ThemeEnum.default, SvgIcnX],
  };

  render() {
    const { icon, label, className, style } = this.props;

    if (!SvgIcon.icons[icon]) {
      throw new Error(
        `Invalid icon "${icon}" used. Must be one of ${Object.values(IconEnum).join('|')}`,
      );
    }

    const [theme, Svg] = SvgIcon.icons[icon];
    return (
      <SvgIconStyled
        className={className}
        style={style}
        $theme={theme}
        $hasLabel={!!label}
      >
        <Svg />
        {label}
      </SvgIconStyled>
    );
  }
}
