import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { strings } from '../../../common/strings';
import * as models from '../../../models/index';
import { isRemoteProject, projectHasSettings } from '../../../models/project';
import { RootState } from '../../redux/modules';
import * as projectActions from '../../redux/modules/project';
import { selectActiveProject } from '../../redux/selectors';
import { DebouncedInput } from '../base/debounced-input';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';

export type ReduxProps = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>;

type Props = ReduxProps;

@autoBindMethodsForReact(AUTOBIND_CFG)
class ProjectSettingsModal extends PureComponent<Props> {
  modal: Modal | null = null;

  _handleSetModalRef(n: Modal) {
    this.modal = n;
  }

  _handleRemoveProject() {
    this.props.handleRemoveProject(this.props.project);
    this.hide();
  }

  async _handleRename(name: string) {
    const { project } = this.props;
    await models.project.update(project, { name });
  }

  show() {
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { project } = this.props;
    if (!projectHasSettings(project)) {
      return null;
    }

    const isRemote = isRemoteProject(project);

    return (
      <Modal ref={this._handleSetModalRef} freshState>
        <ModalHeader key={`header::${project._id}`}>
          {strings.project.singular} Settings{' '}
          <div className="txt-sm selectable faint monospace">{project._id}</div>
        </ModalHeader>
        <ModalBody key={`body::${project._id}`} className="pad">
          <div className="form-control form-control--outlined">
            <label>
              Name
              {isRemote && (
                <>
                  <HelpTooltip className="space-left">
                    To rename a {strings.remoteProject.singular.toLowerCase()} {strings.project.singular.toLowerCase()} please visit <a href="https://app.insomnia.rest/app/teams">the insomnia website.</a>
                  </HelpTooltip>
                  <input disabled readOnly defaultValue={project.name} />
                </>
              )}
              {!isRemote && (
                <DebouncedInput
                // @ts-expect-error -- TSCONVERSION props are spread into an input element
                  type="text"
                  delay={500}
                  placeholder={`My ${strings.project.singular}`}
                  defaultValue={project.name}
                  onChange={this._handleRename}
                />
              )}
            </label>
          </div>
          <h2>Actions</h2>
          <div className="form-control form-control--padded">
            <PromptButton
              onClick={this._handleRemoveProject}
              addIcon
              className="width-auto btn btn--clicky inline-block"
            >
              <i className="fa fa-trash-o" /> Delete
            </PromptButton>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => {
  const project = selectActiveProject(state);
  return { project };
};

const mapDispatchToProps = dispatch => {
  const boundProjectActions = bindActionCreators(projectActions, dispatch);
  return {
    handleRemoveProject: boundProjectActions.removeProject,
  };
};

export default connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(ProjectSettingsModal);
