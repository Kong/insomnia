import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef, FC, forwardRef, ForwardRefRenderFunction, PureComponent } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { ApiSpec } from '../../../models/api-spec';
import { baseSpace, SpaceSubset } from '../../../models/helpers/base-space';
import getWorkspaceName from '../../../models/helpers/get-workspace-name';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { isBaseSpace, isLocalSpace } from '../../../models/space';
import { Workspace } from '../../../models/workspace';
import { setActiveSpace, setActiveWorkspace } from '../../redux/modules/global';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalFooter from '../base/modal-footer';
import ModalHeader from '../base/modal-header';
import { showModal } from '.';

interface Options {
  workspace: Workspace;
  apiSpec: ApiSpec;
  onDone?: () => void;
}

interface FormFields {
  newName: string;
  spaceId: string;
}

interface Props extends Options {
  hide: () => void,
}

const SpaceOption: FC<SpaceSubset> = space => (
  <option key={space._id} value={space._id}>
    {space.name} ({isBaseSpace(space) ? 'Base' : isLocalSpace(space) ? 'Local' : 'Remote'})
  </option>
);

const WorkspaceDuplicateModalInternalWithRef: ForwardRefRenderFunction<Modal, Props> = ({ workspace, apiSpec, onDone, hide }, ref) => {
  const dispatch = useDispatch();

  const spaces = useSelector(selectSpaces);
  const activeSpace = useSelector(selectActiveSpace) || baseSpace;

  const title = `Duplicate ${getWorkspaceLabel(workspace).singular}`;
  const defaultWorkspaceName = getWorkspaceName(workspace, apiSpec);

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
    } } = useForm<FormFields>({
      defaultValues: {
        newName: defaultWorkspaceName,
        spaceId: activeSpace?._id,
      },
    });

  const onSubmit = async ({ spaceId, newName }: FormFields) => {
    // TODO: just use the default base space ID instead of using null (once we have a base space by default)
    const parentId = spaceId === baseSpace._id ? null : spaceId;
    // @ts-expect-error workspace parentId can be null
    const newWorkspace = await workspaceOperations.duplicate(workspace, { name: newName, parentId });
    dispatch(setActiveSpace(spaceId));
    dispatch(setActiveWorkspace(newWorkspace._id));
    hide();
    onDone?.();
  };

  return <Modal ref={ref} onShow={reset}>
    <ModalHeader>{title}</ModalHeader>
    <ModalBody className="wide">
      <form className="wide pad" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-control form-control--wide form-control--outlined">
          <label>
            New Name
            <input {...register('newName', { validate: v => Boolean(v.trim()) || 'Should not be blank' })} />
            {errors.newName && <div className="font-error space-top">{errors.newName.message}</div>}
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>
            {strings.space.plural} to duplicate into
            <select {...register('spaceId')}>
              {SpaceOption(baseSpace)}
              {spaces.map(SpaceOption)}
            </select>
          </label>
        </div>
      </form>
    </ModalBody>
    <ModalFooter>
      <button className="btn" onClick={handleSubmit(onSubmit)}>
        Duplicate
      </button>
    </ModalFooter>
  </Modal>;
};

const WorkspaceDuplicateModalInternal = forwardRef(WorkspaceDuplicateModalInternalWithRef);

interface State {
  options?: Options;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class WorkspaceDuplicateModal extends PureComponent<{}, State> {
  state: State = { };
  modal = createRef<Modal>();

  show(options: Options) {
    this.setState({ options }, () => {
      this.modal?.current?.show();
    });
  }

  hide() {
    this.modal?.current?.hide();
  }

  render() {
    if (this.state.options) {
      return <WorkspaceDuplicateModalInternal
        ref={this.modal}
        {...this.state.options}
        hide={this.hide}
      />;
    } else {
      return null;
    }
  }
}

export const showWorkspaceDuplicateModal = (options: Options) => showModal(WorkspaceDuplicateModal, options);
