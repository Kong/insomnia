import React, { PureComponent } from 'react';

import { clickLink } from '../../../common/electron-helpers';
import * as models from '../../../models';
import { Response } from '../../../models/response';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  response: Response;
}

interface State {
  timeline: any[];
  timelineKey: string;
  body: string;
}

export class ResponseTimelineViewer extends PureComponent<Props, State> {
  state: State = {
    timeline: [],
    timelineKey: '',
    body: '',
  };

  componentDidMount() {
    this.refreshTimeline();
  }

  componentDidUpdate(prevProps) {
    const { response } = this.props;

    if (response._id !== prevProps.response._id) {
      this.refreshTimeline();
    }
  }

  async refreshTimeline() {
    const { response } = this.props;
    const timeline = await models.response.getTimeline(response);
    const body = await models.response.getBodyBuffer(response)?.toString('utf8') || '';

    this.setState({
      timeline,
      timelineKey: response._id,
      body: body,
    });
  }

  renderRow(row, i, all) {
    const { name, value } = row;
    const previousName = i > 0 ? all[i - 1].name : '';
    let prefix: string | null = null;

    switch (name) {
      case 'HEADER_IN':
        prefix = '< ';
        break;

      case 'DATA_IN':
        prefix = '| ';
        break;

      case 'SSL_DATA_IN':
        prefix = '<< ';
        break;

      case 'HEADER_OUT':
        prefix = '> ';
        break;

      case 'DATA_OUT':
        prefix = '| ';
        break;

      case 'SSL_DATA_OUT':
        prefix = '>> ';
        break;

      case 'TEXT':
        prefix = '* ';
        break;

      default:
        return null;
    }

    const lines = (value + '').replace(/\n$/, '').split('\n');
    const newLines = lines.filter(l => !l.match(/^\s*$/)).map(l => `${prefix}${l}`);
    let leadingSpace = '';

    // Prefix each section with a newline to separate them
    if (previousName !== name) {
      leadingSpace = '\n';
    }

    // Join all lines together
    return leadingSpace + newLines.join('\n');
  }

  render() {
    const { timeline, timelineKey } = this.state;
    const rows = timeline
      .map(this.renderRow)
      .filter(r => r !== null);

    rows.push(`\n|\n${this.state.body}`);

    const value = rows
      .join('\n')
      .trim();

    return (
      <CodeEditor
        key={timelineKey}
        hideLineNumbers
        readOnly
        onClickLink={clickLink}
        defaultValue={value}
        className="pad-left"
        mode="curl"
      />
    );
  }
}
