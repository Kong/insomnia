// @flow
import React from 'react';
import classnames from 'classnames';
import * as misc from '../../../common/misc';
import Tooltip from '../tooltip';

class SizeTag extends React.PureComponent {
  props: {
    bytesRead: number,
    bytesContent: number,

    // Optional
    small?: boolean,
    className?: string
  };

  render () {
    const {bytesRead, bytesContent, small, className} = this.props;
    const responseSizeReadString = misc.describeByteSize(bytesRead);
    const responseSizeRawString = misc.describeByteSize(bytesContent);
    const message = (
      <table>
        <tr>
          <td className="text-left pad-right">Read</td>
          <td className="text-right selectable no-wrap">{responseSizeReadString}</td>
        </tr>
        {bytesContent >= 0 && (
          <tr>
            <td className="text-left pad-right">Content</td>
            <td className="text-right selectable no-wrap">{responseSizeRawString}</td>
          </tr>
        )}
      </table>
    );
    return (
      <div className={classnames('tag', {'tag--small': small}, className)}>
        <Tooltip message={message} position="bottom">
          <strong>SIZE</strong>&nbsp;{responseSizeReadString}
        </Tooltip>
      </div>
    );
  }
}

export default SizeTag;
