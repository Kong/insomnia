// @flow
import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import Tooltip from './tooltip';
import SvgIcon, { IconEnum } from './svg-icon';

type Props = {|
  className?: string,
|};

const StyledSidebar: React.ComponentType<{}> = styled.div`
  /* To constants */
  background-color: var(--color-bg);
  border: 1px solid var(--hl-md);
  color: var(--color-font);
  position: relative;
  svg {
    font-size: var(--font-size-xl);
    fill: var(--hl-lg);
  }
  .method {
    h6 {
      font-size: var(--font-size-xxs);
    }
  }
  .method-post {
    color: var(--color-success);
  }
  .method-get {
    color: var(--color-surprise);
  }
  .method-del {
    color: var(--color-danger);
  }
  .method-options-head,
  .method-custom {
    color: var(--color-info);
  }
  .method-patch {
    color: var(--color-notice);
  }
  .method-put {
    color: var(--color-warning);
  }

  h6 {
    font-size: var(--font-size-xs);
    display: flex;
    flex-grow: 1;
    &:hover {
      cursor: default;
    }
  }
  h5 {
    font-size: var(--font-size-sm);
  }
  /* END To constants */
  width: 260px;
  height: 100%;
`;

const StyledSection: React.ComponentType<{}> = styled(motion.ul)`
  overflow: hidden;
  box-sizing: border-box;
  border-bottom: 1px solid var(--hl-md);
`;

const StyledHeader: React.ComponentType<{}> = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;


  &:hover {
    background-color: var(--hl-xs);
  }

  & > * {
    padding: var(--padding-md) var(--padding-md) var(--padding-md) var(--padding-md);
    font-size: var(--font-size-md);

    svg {
      margin-left: var(--padding-sm);
      
      &:hover {
        fill:var(--color-font);
        opacity: 1;
      }
      
    }
  }
`;

const StyledItem: React.ComponentType<{}> = styled.li`
  padding: var(--padding-sm) 0 var(--padding-sm) 0;
  margin: 0px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--padding-lg), 1fr));
  column-gap: var(--padding-sm);
  grid-template-rows: 1fr;
  align-items: start;
  white-space: nowrap;
  font-size: var(--font-size-md);
  line-height: calc(var(--font-size) * 1.25);

  a {
    color: var(--hl-xl);
  }

  div:nth-child(1) {
    text-align: right;
  }

  &:hover {
    background-color: var(--hl-xxs);
    cursor: default;
  }

  &:last-child {
    margin-bottom: var(--padding-md);
  }
`;

const StyledFilter: React.ComponentType<{}> = styled(motion.div)`
  padding-left: var(--padding-md);
  padding-right: var(--padding-md);
  overflow:hidden;
    input {
      box-sizing:border-box;
      width:100%;
      font-size: var(--font-size-md);
      padding: var(--padding-sm);
      margin-top: var(--padding-md);
      margin-bottom: var(--padding-sm);
    }
`;

const StyledPanel: React.ComponentType<{}> = styled(motion.div)`
height: 0px;
`;

function Sidebar(props: Props) {
  // Temp garbage for easing/transition/sequencing dial-in
  const [visible, setVisible] = useState(false);
  const [visible2, setVisible2] = useState(false);
  const [visible3, setVisible3] = useState(true);
  const [visible4, setVisible4] = useState(true);
  const toggleVisible = () => setVisible(!visible);
  const toggleVisible2 = () => setVisible2(!visible2);
  const toggleVisible3 = () => setVisible3(!visible3);
  const toggleVisible4 = () => setVisible4(!visible4);

  return (
    <StyledSidebar className="theme--sidebar">
      <StyledSection>
        <StyledHeader>
          <h6>INFO</h6>
        </StyledHeader>
      </StyledSection>

      <StyledSection>
        <StyledHeader>
          <h6 onClick={toggleVisible2}>SERVERS</h6>
          <div>
            <motion.span
              initial={{ opacity: visible2 ? 0.6 : 0 }}
              animate={{ opacity: visible2 ? 0.6 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.2 }}>
              <SvgIcon icon={IconEnum.trashcan} />
            </motion.span>
            <motion.span
              onClick={toggleVisible3}
              initial={{ opacity: visible2 ? 0.6 : 0 }}
              animate={{ opacity: visible2 ? 0.6 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
              <SvgIcon icon={IconEnum.search} />
            </motion.span>
            <motion.span
              initial={{ opacity: visible2 ? 0.6 : 0.4 }}
              animate={{ opacity: visible2 ? 0.6 : 0.4 }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.1 }}>
              <Tooltip message="Add" position="top">
                  <SvgIcon icon={IconEnum.plus} />
              </Tooltip>
            </motion.span>
          </div>
        </StyledHeader>

        <StyledPanel
          initial={{ height: visible2 ? '100%' : '0px' }}
          animate={{ height: visible2 ? '100%' : '0px' }}
          transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}
        >
          <StyledFilter
              initial={{ height: visible3 ? '0px' : '100%' }}
              animate={{ height: visible3 ? '0px' : '100%' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input placeholder='Filter...' />
          </StyledFilter>
          <StyledItem>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <div>development.konghq.com</div>
          </StyledItem>
          <StyledItem>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <div>staging.konghq.com</div>
          </StyledItem>
          <StyledItem>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <div>production.konghq.com</div>
          </StyledItem>
        </StyledPanel>
      </StyledSection>

      <StyledSection>
        <StyledHeader>
          <h6 onClick={toggleVisible}>PATHS</h6>
          <div>
            <motion.span
              initial={{ opacity: visible ? 0.6 : 0 }}
              animate={{ opacity: visible ? 0.6 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.2 }}>
              <SvgIcon icon={IconEnum.trashcan} />
            </motion.span>
            <motion.span
            onClick={toggleVisible4}
              initial={{ opacity: visible ? 0.6 : 0 }}
              animate={{ opacity: visible ? 0.6 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
              <SvgIcon icon={IconEnum.search} />
            </motion.span>
            <motion.span
              initial={{ opacity: visible ? 0.6 : 0.4 }}
              animate={{ opacity: visible ? 0.6 : 0.4 }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.1 }}>
              <Tooltip message="Add" position="top">
                  <SvgIcon icon={IconEnum.plus} />
              </Tooltip>
            </motion.span>
          </div>
        </StyledHeader>
        <StyledPanel
          initial={{ height: visible ? '100%' : '0px' }}
          animate={{ height: visible ? '100%' : '0px' }}
          transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}
        >
          <StyledFilter
              initial={{ height: visible4 ? '0px' : '100%' }}
              animate={{ height: visible4 ? '0px' : '100%' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input placeholder='Filter...' />
          </StyledFilter>
          <StyledItem>
            <div>
              <SvgIcon icon={IconEnum.folderOpen} />
            </div>
            <h5>pet</h5>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-post">POST</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-get">GET</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-put">PUT</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-del">DEL</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-post">POST</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-put">PUT</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div>
              <SvgIcon icon={IconEnum.folderOpen} />
            </div>
            <h5>store</h5>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-put">PUT</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-del">DEL</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-post">POST</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div></div>
            <h6 className="method-put">PUT</h6>
            <p>/store/inventory/(orderId)</p>
          </StyledItem>
          <StyledItem>
            <div>
              <SvgIcon icon={IconEnum.folder} />
            </div>
            <h5>user</h5>
          </StyledItem>
        </StyledPanel>
      </StyledSection>

      <StyledSection>
        <StyledHeader>
          <h6>MODELS</h6>
          <SvgIcon icon={IconEnum.plus} />
        </StyledHeader>
      </StyledSection>

      <StyledSection>
        <StyledHeader>
          <h6>SECURITY</h6>
          <SvgIcon icon={IconEnum.plus} />
        </StyledHeader>
      </StyledSection>

    </StyledSidebar>
  );
}

export default Sidebar;
