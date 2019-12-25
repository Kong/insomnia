import React from 'react';
import Tooltip from './tooltip';
import '../../../.storybook/index.less';

export default { title: 'Tooltip' };

export const onTop = () => (
  <p className="text-center">
    <Tooltip message="Here is some extra info on top" position="top">
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </p>
);

export const onRight = () => (
  <p className="text-center">
    <Tooltip message="Here is some extra info on the right" position="right">
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </p>
);

export const onLeft = () => (
  <p className="text-center">
    <Tooltip message="Here is some extra info on the left" position="left">
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </p>
);

export const withDelay = () => (
  <p className="text-center">
    <Tooltip message="This tooltip had a 900ms delay" delay={900}>
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </p>
);

export const withChildren = () => {
  const message = (
    <React.Fragment>
      This is a{' '}
      <a href="#" onClick={e => e.preventDefault()}>
        Link
      </a>
      .
    </React.Fragment>
  );

  return (
    <p className="text-center">
      <Tooltip message={message}>
        <button className="btn btn--clicky">Hover Me</button>
      </Tooltip>
    </p>
  );
};
