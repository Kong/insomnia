import React, { FC, useRef } from 'react';
import { AriaDialogProps, AriaOverlayProps, FocusScope, useDialog, useModal, useOverlay, usePreventScroll } from 'react-aria';
import { useDispatch, useSelector } from 'react-redux';

import { SegmentEvent, trackSegmentEvent } from '../../../common/analytics';
import { isDesign, Workspace, WorkspaceScope } from '../../../models/workspace';
import { activateWorkspace, createWorkspaceAndChildren } from '../../redux/modules/workspace';
import { selectActiveProject } from '../../redux/selectors';

export const ModalDialog: FC<{ title: string } & AriaOverlayProps & AriaDialogProps> = props => {
  const { title, children } = props;

  // Handle interacting outside the dialog and pressing
  // the Escape key to close the modal.
  const ref = React.useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(props, ref);

  // Prevent scrolling while the modal is open, and hide content
  // outside the modal from screen readers.
  usePreventScroll();
  const { modalProps } = useModal();

  // Get props for the dialog and its title
  const { dialogProps, titleProps } = useDialog(props, ref);

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 100,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      {...underlayProps}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...overlayProps}
          {...dialogProps}
          {...modalProps}
          ref={ref}
          style={{
            background: 'white',
            color: 'black',
            padding: 30,
          }}
        >
          <h3
            {...titleProps}
            style={{ marginTop: 0 }}
          >
            {title}
          </h3>
          {children}
        </div>
      </FocusScope>
    </div>
  );
};

type OnWorkspaceCreateCallback = (arg0: Workspace) => Promise<void> | void;
export const CreateCollectionModal: FC<{
  scope: WorkspaceScope;
  onCreate: OnWorkspaceCreateCallback;
  onClose?: () => void;
}> = ({ scope, onClose, onCreate }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeProject = useSelector(selectActiveProject);
  const dispatch = useDispatch();

  const design = isDesign({
    scope,
  });
  const title = design ? 'Design Document' : 'Request Collection';
  const defaultValue = design ? 'my-spec.yaml' : 'My Collection';
  const segmentEvent = design ? SegmentEvent.documentCreate : SegmentEvent.collectionCreate;

  const handleCreate = async () => {
    const workspace = await createWorkspaceAndChildren({
      name: inputRef.current?.value,
      scope,
      parentId: activeProject._id,
    });

    if (onCreate) {
      await onCreate(workspace);
    }
    trackSegmentEvent(segmentEvent);
    onClose?.();
    await dispatch(activateWorkspace({ workspace }));
  };
  return (
    <ModalDialog
      title={`Create New ${title}`}
      isOpen
      onClose={onClose}
      isDismissable
    >
      <form style={{ display: 'flex', flexDirection: 'column' }}>
        <label htmlFor="collection-name">Name</label>
        <input
          id="collection-name"
          ref={inputRef}
          defaultValue={defaultValue}
          placeholder={defaultValue}
        />
        <button
          type="button"
          onClick={handleCreate}
          style={{ marginTop: 10 }}
        >
          Create
        </button>
      </form>
    </ModalDialog>
  );
};
