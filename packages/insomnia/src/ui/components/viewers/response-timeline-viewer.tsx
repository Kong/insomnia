import React, { PureComponent } from 'react';

import { clickLink } from '../../../common/electron-helpers';
import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import * as models from '../../../models';
import type { Response } from '../../../models/response';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  showBody?: boolean;
  response: Response;
}

interface State {
  timeline: ResponseTimelineEntry[];
  timelineKey: string;
}

export class ResponseTimelineViewer extends PureComponent<Props, State> {
  state: State = {
    timeline: [],
    timelineKey: '',
  };

  componentDidMount() {
    this.refreshTimeline();
  }

  componentDidUpdate(prevProps: Props) {
    const { response } = this.props;

    if (response._id !== prevProps.response._id) {
      this.refreshTimeline();
    }
  }

  async refreshTimeline() {
    const { response, showBody } = this.props;
    const timeline = models.response.getTimeline(response, showBody);

    this.setState({
      timeline,
      timelineKey: response._id,
    });
  }

  renderRow(row: ResponseTimelineEntry, i: number, all: ResponseTimelineEntry[]) {
    const { name, value } = row;
    const previousName = i > 0 ? all[i - 1].name : '';
    const prefixLookup: Record<ResponseTimelineEntry['name'], string> = {
      HeaderIn: '< ',
      DataIn: '| ',
      SslDataIn: '<< ',
      HeaderOut: '> ',
      DataOut: '| ',
      SslDataOut: '>> ',
      Text: '* ',
    };
    const prefix: string = prefixLookup[name] || '* ';

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
      .filter(r => r !== null)
      .join('\n')
      .trim();

    return (
      <CodeEditor
        key={timelineKey}
        hideLineNumbers
        readOnly
        onClickLink={clickLink}
        defaultValue={rows}
        className="pad-left"
        mode="curl"
      />
    );
  }
}
