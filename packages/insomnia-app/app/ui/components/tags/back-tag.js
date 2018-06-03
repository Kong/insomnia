// @flow
import * as React from 'react';
import type { RequestHistory } from '../../../models/request';
import Tooltip from '../tooltip';

type Props = {
  handleBack: Function,

  // Optional
  requestHistory?: RequestHistory,
  small?: boolean,
  className?: string,
};

class BackTag extends React.PureComponent<Props> {
  render() {
    const message = (
      <table>
        <tbody>
          <tr>
            <td className="text-left pad-right">Click to go back.</td>
          </tr>
        </tbody>
      </table>
    );

    return (
      <button
        type="button"
        className="btn btn--super-duper-extra-compact"
        onClick={this.props.handleBack}>
        <Tooltip message={message} position="bottom">
          <i className="fa fa-arrow-left" />
        </Tooltip>
      </button>
    );
  }
}

export default BackTag;
