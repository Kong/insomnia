import React, { FC, ReactNode, useState } from 'react';
import styled from 'styled-components';

import { IconEnum, SvgIcon } from './svg-icon';

const StyledCard = styled.div({
  '&&': {
    transition: 'all 0.1s ease-out',
  },
  height: '196px',
  width: '204px',
  border: '1px solid var(--hl-sm)',
  display: 'flex',
  flexDirection: 'column',
  flexGrow: '0',
  flexShrink: '0',
  color: 'var(--font-dark)',
  borderRadius: 'var(--radius-md)',

  '&:hover': {
    borderColor: 'var(--color-surprise)',
    boxShadow: 'var(--padding-sm) var(--padding-sm) calc(var(--padding-xl) * 1.5) calc(0px - var(--padding-xl)) rgba(0, 0, 0, 0.2)',
    cursor: 'pointer',
    '.title': {
      color: 'var(--color-surprise)',
    },
  },

  '&.selected': {
    backgroundColor: 'rgba(var(--color-surprise-rgb), 0.05)',
    borderColor: 'var(--color-surprise)',
    '.title': {
      color: 'var(--color-surprise)',
    },
    cursor: 'default',
    '&:hover': {
      boxShadow: 'none',
    },
  },

  '&.deselected': {
    backgroundColor: 'transparent',
    border: '1px solid var(--hl-sm)',
    cursor: 'default',
    '&:hover': {
      borderColor: 'var(--color-surprise)',
      boxShadow: '3px 3px 20px -10px rgba(0, 0, 0, 0.2)',
    },
  },
});

const CardHeader = styled.div({
  textAlign: 'left',
  height: '20px',
  padding: 'var(--padding-md) var(--padding-xs) 0 var(--padding-xs)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',

  '.header-item': {
    fontSize: 'var(--font-size-xs)',
    padding: 'var(--padding-xs)',
  },

  '.card-badge': {
    marginLeft: 'var(--padding-sm)',
    backgroundColor: 'var(--hl-xs)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    overflow: 'hidden',

    '&.card-icon': {
      padding: 0,
    },

    '&:empty': {
      visibility: 'hidden',
    },
  },

  '.card-menu': {
    margin: 'calc(-1 * var(--padding-sm))',
    marginRight: 'var(--padding-xs)',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    fontWeight: '900',
    fontSize: 'var(--font-size-lg)',
    color: 'var(--font-color)',

    button: {
      padding: 'var(--padding-xs) var(--padding-sm)',

      '&:hover': {
        backgroundColor: 'var(--hl-xxs)',
      },
    },
  },

  '.card-checkbox-label': {
    display: 'block',
    position: 'relative',
    margin: 'auto',
    cursor: 'default',
    fontSize: 'var(--font-size-xl)',
    lineHeight: 'var(--font-size-xl)',
    height: 'var(--font-size-xl)',
    width: 'var(--font-size-xl)',
    clear: 'both',

    '.card-checkbox': {
      position: 'absolute',
      top: '0',
      left: '0',
      height: 'var(--font-size-xl)',
      width: 'var(--font-size-xl)',
      backgroundColor: 'rgba(var(--color-surprise-rgb), 0.1)',
      borderRadius: 'var(--radius-md)',
      border: '2px solid var(--color-surprise)',

      '&::after': {
        position: 'absolute',
        content: '""',
        height: '0',
        width: '0',
        borderRadius: 'var(--radius-md)',
        border: 'solid var(--color-font-info)',
        borderWidth: '0 var(--padding-sm) var(--padding-sm) 0',
        transform: 'rotate(0deg) scale(0)',
        opacity: '1',
      },
    },

    input :{
      position: 'absolute',
      opacity: '0',
      cursor: 'default',

      '&:checked ~ .card-checkbox': {
        backgroundColor: 'var(--color-surprise)',
        borderRadius: 'var(--radius-md)',
        transform: 'rotate(0deg) scale(1)',
        opacity: '1',

        '&::after': {
          transform: 'rotate(45deg) scale(1)',
          opacity: '1',
          left: '0.375rem',
          top: '0.125rem',
          width: '0.3125rem',
          height: '0.625rem',
          border: 'solid var(--color-bg)',
          borderWidth: '0 2px 2px 0',
          backgroundColor: 'transparent',
          borderRadius: '0',
        },
      },
    },
  },
});

const CardBody = styled.div({
  justifyContent: 'normal',
  fontWeight: '400',
  color: 'var(--font-color)',
  marginTop: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  overflowY: 'auto',

  '.title': {
    fontSize: 'var(--font-size-md)',
    paddingRight: 'var(--padding-md)',
    overflowX: 'hidden',
    textOverflow: 'ellipsis',
  },

  '.version': {
    fontSize: 'var(--font-size-xs)',
    paddingTop: 'var(--padding-xs)',
  },
});

const CardFooter = styled.div({
  marginTop: 'auto',
  paddingLeft: 'var(--padding-md)',
  paddingTop: 'var(--padding-sm)',
  paddingBottom: 'var(--padding-sm)',
  color: 'var(--hl-xl)',

  'span': {
    display: 'flex',
    justifyContent: 'left',
    flexDirection: 'row',
    marginBottom: 'var(--padding-xs)',
    svg: {
      width: '1em',
      height: '1em',
    },
  },

  '.icoLabel': {
    paddingLeft: 'var(--padding-xs)',
    fontSize: 'var(--font-size-sm)',
    '*': {
      display: 'inline',
    },
  },
});

export interface CardProps {
  docBranch?: ReactNode;
  docLog?: ReactNode;
  docMenu?: ReactNode;
  docTitle?: ReactNode;
  docVersion?: ReactNode;
  tagLabel: ReactNode;
  docFormat?: ReactNode;
  onChange?: (event: React.SyntheticEvent<HTMLInputElement>) => any;
  onClick?: (event: React.SyntheticEvent<HTMLDivElement>) => any;
  selectable?: boolean;
  avatars?: ReactNode;
}

export const Card: FC<CardProps> = props => {
  const [state, setState] = useState({
    selected: false,
    selectable: false,
  });

  const {
    tagLabel,
    docTitle,
    docVersion,
    docBranch,
    docLog,
    docMenu,
    docFormat,
    selectable,
    avatars,
    onClick,
  } = props;

  return (
    <StyledCard className={state.selected ? 'selected' : 'deselected'} onClick={onClick}>
      <CardHeader>
        <div className="header-item card-badge">{tagLabel}</div>
        {avatars}
        {selectable ? (
          <div className="header-item card-menu">
            <label className="card-checkbox-label">
              <input
                type="checkbox"
                onChange={event => {
                  setState(state => ({
                    ...state,
                    selected: !state.selected,
                  }));

                  props.onChange?.(event);
                }}
              />
              <span className="card-checkbox" />
            </label>
          </div>
        ) : (
          <div className="header-item card-menu">{docMenu}</div>
        )}
      </CardHeader>
      <CardBody>
        {docTitle && (
          <div className="title">
            <strong>{docTitle}</strong>
          </div>
        )}
        {docVersion && <div className="version">{docVersion}</div>}
      </CardBody>
      <CardFooter>
        {docFormat && (
          <span>
            <SvgIcon icon={IconEnum.file} />
            <div className="icoLabel">{docFormat}</div>
          </span>
        )}
        {docBranch && (
          <span>
            <SvgIcon icon={IconEnum.gitBranch} />
            <div className="icoLabel">{docBranch}</div>
          </span>
        )}
        {docLog && (
          <span>
            <SvgIcon icon={IconEnum.clock} />
            <div className="icoLabel">{docLog}</div>
          </span>
        )}
      </CardFooter>
    </StyledCard>
  );
};
