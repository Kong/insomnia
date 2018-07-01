// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import ResponseTimelineViewer from '../../components/viewers/response-timeline-viewer';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import * as models from '../../../models/index';
import type { Response } from '../../../models/response';
import type { Settings } from '../../../models/settings';

type Props = { settings: Settings };

type State = {
  response: Response | null
};

@autobind
class ResponseDebugModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);

    this.state = {
      response: null
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { responseId?: string, response?: Response }) {
    const response = options.response
      ? options.response
      : await models.response.getById(options.responseId || 'n/a');

    this.setState({ response });
    this.modal && this.modal.show();
  }

  render() {
    const { settings } = this.props;
    const { response } = this.state;

    return (
      <Modal ref={this._setModalRef} tall>
        <ModalHeader>OAuth 2 Response</ModalHeader>
        <ModalBody>
          <div style={{ display: 'grid' }} className="tall pad-top">
            {response ? (
              <ResponseTimelineViewer
                editorFontSize={settings.editorFontSize}
                editorIndentSize={settings.editorIndentSize}
                editorLineWrapping={settings.editorLineWrapping}
                timeline={response.timeline}
              />
            ) : (
              <div>No response found</div>
            )}
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

export default ResponseDebugModal;
