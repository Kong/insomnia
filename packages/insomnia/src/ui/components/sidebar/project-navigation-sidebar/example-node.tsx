import { useState } from 'react';
import { Button } from 'react-aria-components';
import { useParams } from 'react-router';

import { ExampleActionsDropdown } from '~/ui/components/dropdowns/example-actions-dropdown';
import { EditableInput } from '~/ui/components/editable-input';
import { Icon } from '~/ui/components/icon';
import type { ExampleFlatItem } from '~/ui/components/sidebar/project-navigation-sidebar/types';
import { useUpdateExample } from '~/ui/hooks/use-example-mutations';

import { ACTIVE_BORDER_CLASS, GUIDE_LINE_CSS, ICON_CLASS, ROW_CLASS, TOGGLE_BTN_CLASS } from './styles';

interface ExampleNodeProps {
  item: ExampleFlatItem;
  // Number of ancestor indent levels to strip when the sidebar is focused on a
  // single collection (the project and workspace rows are no longer shown).
  depthOffset?: number;
}

export const ExampleNode = ({ item, depthOffset = 0 }: ExampleNodeProps) => {
  const { doc, level, workspace, project, hidden } = item;
  const updateExample = useUpdateExample();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const params = useParams() as { exampleId?: string };
  const isSelected = doc._id === params.exampleId;

  return (
    <div
      className={`${ROW_CLASS} ${hidden ? 'opacity-40' : ''}`}
      style={{ paddingLeft: `${Math.max(level + 3 - depthOffset, 1)}rem` }}
      data-testid={`example-node-${doc.name || doc.response.statusCode}`}
      data-project={project.name}
      data-workspace={workspace.name}
      data-selected={isSelected}
      onContextMenu={e => {
        e.preventDefault();
        setIsContextMenuOpen(true);
      }}
    >
      <Button slot="drag" className="hidden" />
      {/*
        Examples have no toggle of their own, but this spacer keeps their content
        column aligned with the parent request row one indent level below it
        (see the toggle Button in request-node.tsx).
      */}
      <span className={TOGGLE_BTN_CLASS} />
      {Array.from({ length: level + 2 }, (_, i) => i)
        .filter(i => i >= depthOffset)
        .map(i => (
          <span
            key={i}
            className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`}
            style={{ left: `${i + 1.5 - depthOffset}em` }}
          />
        ))}
      <span className={ACTIVE_BORDER_CLASS} />
      {/* Icon and label share the same padded row as a request's method badge,
          so example rows line up with their parent request row. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left transition-colors">
        <span className="flex w-10 shrink-0 items-center justify-center">
          <Icon icon="code" className={ICON_CLASS} />
        </span>
        <EditableInput
          value={doc.name || `Example ${doc.response.statusCode}`}
          name="example name"
          ariaLabel={doc.name}
          className="flex-1 text-base hover:bg-transparent!"
          onEditableChange={editable => setIsEditable(editable)}
          onSubmit={newName =>
            updateExample.mutate({ exampleId: doc._id, parentId: doc.parentId, patch: { name: newName } })
          }
        />
        <span className="flex shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) px-1 text-[0.65rem] text-(--color-success)">
          {doc.response.statusCode}
        </span>
      </div>
      {!isEditable && (
        <ExampleActionsDropdown
          example={doc}
          organizationId={item.organizationId}
          projectId={project._id}
          workspaceId={workspace._id}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
        />
      )}
    </div>
  );
};
