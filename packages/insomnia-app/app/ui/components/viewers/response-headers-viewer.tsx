import React, { Fragment, PureComponent } from 'react';
import CopyButton from '../base/copy-button';
import type { ResponseHeader } from '../../../models/response';
import Link from '../base/link';
import { URL } from 'url';

interface Props {
  headers: ResponseHeader[];
}

function validateURL(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    if (!parsedUrl.hostname) return false;
    return true;
  } catch (error) {
    return false;
  }
}

class ResponseHeadersViewer extends PureComponent<Props> {
  render() {
    const { headers } = this.props;
    const headersString = headers.map(h => `${h.name}: ${h.value}`).join('\n');
    return (
      <Fragment>
        <table className="table--fancy table--striped table--compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => (
              <tr className="selectable" key={i}>
                <td
                  style={{
                    width: '50%',
                  }}
                  className="force-wrap">
                  {h.name}
                </td>
                <td
                  style={{
                    width: '50%',
                  }}
                  className="force-wrap">
                  {validateURL(h.value) ? <Link href={h.value}>{h.value}</Link> : h.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p key="copy" className="pad-top">
          <CopyButton className="pull-right" content={headersString} />
        </p>
      </Fragment>
    );
  }
}

export default ResponseHeadersViewer;
