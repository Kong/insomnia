import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import * as models from '../../../models/index';
import type { Response } from '../../../models/response';
import { ResponseTimelineViewer } from '../../components/viewers/response-timeline-viewer';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface State {
  response: Response | null;
  showBody?: boolean;
  title: string | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseDebugModal extends PureComponent<{}, State> {
  modal: Modal | null = null;

  state: State = {
    response: null,
    showBody: false,
    title: '',
  };

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  hide() {
    this.modal?.hide();
  }

  async show(options: { responseId?: string; response?: Response; title?: string; showBody?: boolean }) {
    const response = options.response
      ? options.response
      : await models.response.getById(options.responseId || 'n/a');
    this.setState({
      response,
      title: options.title || null,
      showBody: options.showBody,
    });
    this.modal?.show();
  }

  render() {
    const { response, title, showBody } = this.state;
    return (
      <Modal ref={this._setModalRef} tall>
        <ModalHeader>{title || 'Response Timeline'}</ModalHeader>
        <ModalBody>
          <div
            style={{
              display: 'grid',
            }}
            className="tall"
          >
            {response ? (
              <ResponseTimelineViewer
                response={response}
                showBody={showBody}
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
