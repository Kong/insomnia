import React, { PureComponent } from 'react';

import { clickLink } from '../../../common/electron-helpers';
import { LIBCURL_DEBUG_MIGRATION_MAP } from '../../../common/misc';
import * as models from '../../../models';
import { Response, ResponseTimelineEntry } from '../../../models/response';
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

  componentDidUpdate(prevProps) {
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
    let prefix: string | null = null;

    switch (name) {
      case LIBCURL_DEBUG_MIGRATION_MAP.HeaderIn:
        prefix = '< ';
        break;

      case LIBCURL_DEBUG_MIGRATION_MAP.DataIn:
        prefix = '| ';
        break;

      case LIBCURL_DEBUG_MIGRATION_MAP.SslDataIn:
        prefix = '<< ';
        break;

      case LIBCURL_DEBUG_MIGRATION_MAP.HeaderOut:
        prefix = '> ';
        break;

      case LIBCURL_DEBUG_MIGRATION_MAP.DataOut:
        prefix = '| ';
        break;

      case LIBCURL_DEBUG_MIGRATION_MAP.SslDataOut:
        prefix = '>> ';
        break;

      case LIBCURL_DEBUG_MIGRATION_MAP.Text:
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
