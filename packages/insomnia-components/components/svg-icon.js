// @flow
import * as React from 'react';
import styled from 'styled-components';
import MemoSvgIcnArrowRight from '../assets/svgr/IcnArrowRight';
import MemoSvgIcnChevronDown from '../assets/svgr/IcnChevronDown';
import MemoSvgIcnChevronUp from '../assets/svgr/IcnChevronUp';
import MemoSvgIcnClock from '../assets/svgr/IcnClock';
import MemoSvgIcnEmpty from '../assets/svgr/IcnEmpty';
import MemoSvgIcnErrors from '../assets/svgr/IcnErrors';
import MemoSvgIcnGitBranch from '../assets/svgr/IcnGitBranch';
import MemoSvgIcnGithubLogo from '../assets/svgr/IcnGithubLogo';
import MemoSvgIcnBitbucketLogo from '../assets/svgr/IcnBitbucketLogo';
import MemoSvgIcnWarning from '../assets/svgr/IcnWarning';
import MemoSvgIcnEllipsis from '../assets/svgr/IcnEllipsis';
import MemoSvgIcnBurgerMenu from '../assets/svgr/IcnBurgerMenu';
import MemoSvgIcnCheckmark from '../assets/svgr/IcnCheckmark';
import MemoSvgIcnCookie from '../assets/svgr/IcnCookie';
import MemoSvgIcnDragGrip from '../assets/svgr/IcnDragGrip';
import MemoSvgIcnElevator from '../assets/svgr/IcnElevator';
import MemoSvgIcnEllipsisCircle from '../assets/svgr/IcnEllipsisCircle';
import MemoSvgIcnFile from '../assets/svgr/IcnFile';
import MemoSvgIcnFolderOpen from '../assets/svgr/IcnFolderOpen';
import MemoSvgIcnFolder from '../assets/svgr/IcnFolder';
import MemoSvgIcnGear from '../assets/svgr/IcnGear';
import MemoSvgIcnGitlabLogo from '../assets/svgr/IcnGitlabLogo';
import MemoSvgIcnGUI from '../assets/svgr/IcnGui';
import MemoSvgIcnIndendation from '../assets/svgr/IcnIndentation';
import MemoSvgIcnMinusCircleFill from '../assets/svgr/IcnMinusCircleFill';
import MemoSvgIcnMinusCircle from '../assets/svgr/IcnMinusCircle';
import MemoSvgIcnPlaceholder from '../assets/svgr/IcnPlaceholder';
import MemoSvgIcnPlay from '../assets/svgr/IcnPlay';
import MemoSvgIcnPlus from '../assets/svgr/IcnPlus';
import MemoSvgIcnProhibited from '../assets/svgr/IcnProhibited';
import MemoSvgIcnQuestionFill from '../assets/svgr/IcnQuestionFill';
import MemoSvgIcnQuestion from '../assets/svgr/IcnQuestion';
import MemoSvgIcnSearch from '../assets/svgr/IcnSearch';
import MemoSvgIcnSecCert from '../assets/svgr/IcnSecCert';
import MemoSvgIcnSuccess from '../assets/svgr/IcnSuccess';
import MemoSvgIcnSync from '../assets/svgr/IcnSync';
import MemoSvgIcnTrashcan from '../assets/svgr/IcnTrashcan';
import MemoSvgIcnTriangle from '../assets/svgr/IcnTriangle';
import MemoSvgIcnUser from '../assets/svgr/IcnUser';
import MemoSvgIcnWarningCircle from '../assets/svgr/IcnWarningCircle';
import MemoSvgIcnX from '../assets/svgr/IcnX';
import MemoSvgIcnInfo from '../assets/svgr/IcnInfo';

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
    [IconEnum.bitbucket]: [ThemeEnum.default, MemoSvgIcnBitbucketLogo],
    [IconEnum.info]: [ThemeEnum.highlight, MemoSvgIcnInfo],
    [IconEnum.search]: [ThemeEnum.default, MemoSvgIcnSearch],
    [IconEnum.warning]: [ThemeEnum.notice, MemoSvgIcnWarning],
    [IconEnum.burgerMenu]: [ThemeEnum.default, MemoSvgIcnBurgerMenu],
    [IconEnum.checkmark]: [ThemeEnum.default, MemoSvgIcnCheckmark],
    [IconEnum.cookie]: [ThemeEnum.default, MemoSvgIcnCookie],
    [IconEnum.dragGrip]: [ThemeEnum.default, MemoSvgIcnDragGrip],
    [IconEnum.elevator]: [ThemeEnum.default, MemoSvgIcnElevator],
    [IconEnum.ellipsesCircle]: [ThemeEnum.default, MemoSvgIcnEllipsisCircle],
    [IconEnum.elevator]: [ThemeEnum.default, MemoSvgIcnElevator],
    [IconEnum.file]: [ThemeEnum.default, MemoSvgIcnFile],
    [IconEnum.folder]: [ThemeEnum.default, MemoSvgIcnFolder],
    [IconEnum.folderOpen]: [ThemeEnum.default, MemoSvgIcnFolderOpen],
    [IconEnum.gear]: [ThemeEnum.default, MemoSvgIcnGear],
    [IconEnum.gitlabLogo]: [ThemeEnum.default, MemoSvgIcnGitlabLogo],
    [IconEnum.gui]: [ThemeEnum.default, MemoSvgIcnGUI],
    [IconEnum.indentation]: [ThemeEnum.default, MemoSvgIcnIndendation],
    [IconEnum.minusCircle]: [ThemeEnum.default, MemoSvgIcnMinusCircle],
    [IconEnum.minusCircleFill]: [ThemeEnum.default, MemoSvgIcnMinusCircleFill],
    [IconEnum.placeholder]: [ThemeEnum.default, MemoSvgIcnPlaceholder],
    [IconEnum.play]: [ThemeEnum.default, MemoSvgIcnPlay],
    [IconEnum.plus]: [ThemeEnum.default, MemoSvgIcnPlus],
    [IconEnum.prohibited]: [ThemeEnum.default, MemoSvgIcnProhibited],
    [IconEnum.question]: [ThemeEnum.default, MemoSvgIcnQuestion],
    [IconEnum.questionFill]: [ThemeEnum.default, MemoSvgIcnQuestionFill],
    [IconEnum.secCert]: [ThemeEnum.default, MemoSvgIcnSecCert],
    [IconEnum.success]: [ThemeEnum.success, MemoSvgIcnSuccess],
    [IconEnum.sync]: [ThemeEnum.default, MemoSvgIcnSync],
    [IconEnum.trashcan]: [ThemeEnum.default, MemoSvgIcnTrashcan],
    [IconEnum.triangle]: [ThemeEnum.default, MemoSvgIcnTriangle],
    [IconEnum.user]: [ThemeEnum.default, MemoSvgIcnUser],
    [IconEnum.warningCircle]: [ThemeEnum.default, MemoSvgIcnWarningCircle],
    [IconEnum.x]: [ThemeEnum.default, MemoSvgIcnX],
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

export default SvgIcon;
