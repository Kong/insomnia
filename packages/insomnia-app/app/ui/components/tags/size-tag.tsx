import classnames from 'classnames';
import React, { PureComponent } from 'react';

import * as misc from '../../../common/misc';
import Tooltip from '../tooltip';

interface Props {
  bytesRead: number;
  bytesContent: number;
  small?: boolean;
  className?: string;
  tooltipDelay?: number;
}

class SizeTag extends PureComponent<Props> {
  render() {
    const { bytesRead, bytesContent, small, className, tooltipDelay } = this.props;
    const responseSizeReadStringShort = misc.describeByteSize(bytesRead);
    const responseSizeReadString = misc.describeByteSize(bytesRead, true);
    const responseSizeRawString = misc.describeByteSize(bytesContent, true);
    const message = (
      <table>
        <tbody>
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
        </tbody>
      </table>
    );
    return (
      <div
        className={classnames(
          'tag',
          {
            'tag--small': small,
          },
          className,
        )}>
        <Tooltip message={message} position="bottom" delay={tooltipDelay}>
          {responseSizeReadStringShort}
        </Tooltip>
      </div>
    );
  }
}

export default SizeTag;
