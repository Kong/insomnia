import React from 'react';
import Tooltip from './tooltip';

export default { title: 'Helpers | Tooltip' };

export const onTop = () => (
  <div className="text-center">
    <Tooltip message="Here is some extra info on top" position="top">
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </div>
);

export const onRight = () => (
  <div className="text-center">
    <Tooltip message="Here is some extra info on the right" position="right">
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </div>
);

export const onLeft = () => (
  <div className="text-center">
    <Tooltip message="Here is some extra info on the left" position="left">
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </div>
);

export const withDelay = () => (
  <div className="text-center">
    <Tooltip message="This tooltip had a 900ms delay" delay={900}>
      <button className="btn btn--clicky">Hover Me</button>
    </Tooltip>
  </div>
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
    <div className="text-center">
      <Tooltip message={message}>
        <button className="btn btn--clicky">Hover Me</button>
      </Tooltip>
    </div>
  );
};
