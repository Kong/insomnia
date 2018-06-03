// @flow
import * as React from 'react';
import type { RequestHistory } from '../../../models/request';
import Tooltip from '../tooltip';

type Props = {
  handleForward: Function,

  // Optional
  requestHistory?: RequestHistory,
  small?: boolean,
  className?: string,
};

class ForwardTag extends React.PureComponent<Props> {
  render() {
    const message = (
      <table>
        <tbody>
          <tr>
            <td className="text-left pad-right">Click to go forward.</td>
          </tr>
        </tbody>
      </table>
    );

    return (
      <button
        type="button"
        className="btn btn--super-duper-extra-compact"
        onClick={this.props.handleForward}>
        <Tooltip message={message} position="bottom">
          <i className="fa fa-arrow-right" />
        </Tooltip>
      </button>
    );
  }
}

export default ForwardTag;
