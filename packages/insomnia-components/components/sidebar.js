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
  background-color: #fafafa;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  position: relative;
  svg {
    font-size: var(--font-size-xl);
    fill: #737373;
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
  min-height: 1100px;
`;

const StyledSection: React.ComponentType<{}> = styled(motion.ul)`
  overflow: hidden;
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-border);

  /* Header */
  li:nth-child(1) {
    display: flex;
    justify-content: space-between;
    align-items: center;

    &:hover {
    background-color: var(--hl-xs);
  }

    & > * {
      padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-md);
      font-size: var(--font-size-md);

      svg {
        margin-left: var(--spacing-sm);
        
        &:hover {
          fill:#000;
          opacity: 1;
        }
        
      }
    }
  }

  /* Footer */
  &:last-child {
    border-top: 1px solid var(--color-border);
    border-bottom: none;
    position: absolute;
    bottom: 0;
    width: 100%;

    li {
      justify-content: start;
      line-height: var(--font-line-height-sm);

      & > * {
        padding: var(--spacing-md) 0 var(--spacing-md) var(--spacing-sm);
        margin-left: 0px;
        font-weight: var(--font-weight-regular);
      }
    }
  }

  }
`;

const StyledItem: React.ComponentType<{}> = styled.li`
  padding: var(--spacing-sm) 0 var(--spacing-sm) 0;
  margin: 0px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--spacing-xxl), 1fr));
  column-gap: var(--spacing-sm);
  grid-template-rows: 1fr;
  align-items: start;
  white-space: nowrap;
  font-size: var(--font-size-md);
  line-height: var(--font-line-height-md);

  .inline-icon {
    svg {
      font-size: var(--font-line-height-sm);
      margin-left: var(--spacing-xs);
    }
  }

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
    margin-bottom: var(--spacing-md);
  }
`;

const StyledFilter: React.ComponentType<{}> = styled(motion.div)`
text-align: left;
padding: 0;
width:100%;
display:block;
overflow:hidden;
input {
  box-sizing:border-box;
  font-size: var(--font-size-md);
  min-width: 88%;
  padding: var(--padding-sm);
  margin: 0 var(--padding-md);
  }
`;

function Sidebar(props: Props) {
  // Temp garbage for easing/transition/sequencing dial-in
  const toggleVisible = () => setVisible(!visible);
  const toggleVisible2 = () => setVisible2(!visible2);
  const [visible, setVisible] = useState(false);
  const [visible2, setVisible2] = useState(false);

  const [visible3, setVisible3] = useState(true);
  const toggleVisible3 = () => setVisible3(!visible3);

  const [visible4, setVisible4] = useState(true);
  const toggleVisible4 = () => setVisible4(!visible4);

  return (
    <StyledSidebar>
      {/*
      <StyledSection>
        <li>
          <h6>DOCUMENT</h6><SvgIcon icon={IconEnum.chevronUp} />
        </li>
        <StyledItem>
          <div>
            <SvgIcon icon={IconEnum.gui} />
          </div>
          <div className="inline-icon">
            No Environment
            <Dropdown renderButton={() => <SvgIcon icon={IconEnum.triangle} />}>
              <DropdownItem>Item 1</DropdownItem>
              <DropdownItem>Item 2</DropdownItem>
              <DropdownItem>Item 3</DropdownItem>
            </Dropdown>
          </div>
        </StyledItem>
        <StyledItem>
          <div>
            <SvgIcon icon={IconEnum.cookie} />
          </div>
          <div>
            No Cookies (<a href="#">Add</a>)
          </div>
        </StyledItem>
        <StyledItem>
          <div>
            <SvgIcon icon={IconEnum.secCert} />
          </div>
          <div>
            No Client Certificates (<a href="#">Add</a>)
          </div>
        </StyledItem>
      </StyledSection>
      */}
      <StyledSection>
        <li>
          <h6>INFO</h6>
        </li>
      </StyledSection>

      <StyledSection
        initial={{ height: visible2 ? '100%' : '45px' }}
        animate={{ height: visible2 ? '100%' : '45px' }}
        transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
        <li>
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
        </li>

        <StyledFilter
            initial={{ height: visible3 ? '0px' : '45px' }}
            animate={{ height: visible3 ? '0px' : '45px' }}
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
      </StyledSection>

      <StyledSection
        initial={{ height: visible ? '100%' : '45px' }}
        animate={{ height: visible ? '100%' : '45px' }}
        transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
        <li>
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
        </li>
        <StyledFilter
            initial={{ height: visible4 ? '0px' : '45px' }}
            animate={{ height: visible4 ? '0px' : '45px' }}
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
      </StyledSection>

      <StyledSection>
        <li>
          <h6>MODELS</h6>
          <SvgIcon icon={IconEnum.plus} />
        </li>
      </StyledSection>

      <StyledSection>
        <li>
          <h6>SECURITY</h6>
          <SvgIcon icon={IconEnum.plus} />
        </li>
      </StyledSection>

      <StyledSection>
        <li>
          <div>
            <SvgIcon icon={IconEnum.gear} />
          </div>
          <h5>Settings</h5>
        </li>
      </StyledSection>
    </StyledSidebar>
  );
}

export default Sidebar;
