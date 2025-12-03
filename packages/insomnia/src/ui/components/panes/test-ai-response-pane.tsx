import type { FC } from 'react';
import { Icon } from '~/basic-components/icon';
import {
  useRequestLoaderData,
  type RequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { Pane, PaneHeader } from '~/ui/components/panes/pane';
import { StringStatusTag } from '~/ui/components/tags/status-tag';
import { useSafeState } from '~/ui/hooks/use-safe-state';

interface Props {
  activeRequestId: string;
  reports: any[];
  loading: boolean;
}

export const TestAiResponsePane: FC<Props> = ({ activeRequestId, reports, loading }) => {
  const { activeRequest, activeRequestMeta, activeResponse, responses, requestVersions } =
    useRequestLoaderData() as RequestLoaderData;
  const passedCount = reports.filter(r => r.status === 'passed').length;
  const failedCount = reports.filter(r => r.status === 'failed').length;
  const total = reports?.length;
  const [selected, setSelected] = useSafeState<number | null>(null);
  return (
    <Pane type="response">
      {activeResponse ? null : (
        <PaneHeader className="row-spaced">
          {loading ? <Icon icon="spinner" className="ml-(--padding-md) animate-spin" /> : null}
          {!loading && (
            <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
              {Boolean(passedCount) && (
                <StringStatusTag status={'success'} statusMessage={`${passedCount}/${total} Passed`} />
              )}
              {Boolean(failedCount) && (
                <StringStatusTag status={'danger'} statusMessage={`${failedCount}/${total} Failed`} />
              )}
            </div>
          )}
        </PaneHeader>
      )}
      {!loading && (
        <ul>
          {reports.map(({ status, answer }, id) => (
            <li
              key={id}
              className="relative flex h-(--line-height-xs) w-full items-center gap-3 overflow-hidden pr-2 pl-(--padding-md) text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) data-[selected=true]:bg-(--hl-xs) data-[selected=true]:text-(--color-font)"
              data-selected={selected === id}
              onClick={() => (selected === id ? setSelected(null) : setSelected(id))}
            >
              <Icon
                className={status === 'passed' ? 'text-(--color-success)' : 'text-(--color-danger)'}
                icon={status === 'passed' ? 'check' : 'xmark'}
              />
              <span>{answer.ticket_text}</span>
            </li>
          ))}
        </ul>
      )}
      {selected !== null && !loading && (
        <div className="flex flex-col gap-2 border-t border-(--hl-sm) p-2">
          <div className="font-semibold">{reports[selected].answer.ticket_text}</div>
          <div>
            <span className="inline-flex w-[70px]">expected</span>
            <StringStatusTag
              statusMessage={reports[selected].expected}
              status={reports[selected].status === 'passed' ? 'success' : 'danger'}
            />
          </div>
          <div>
            <span className="inline-flex w-[70px]">actual</span>
            <StringStatusTag
              statusMessage={reports[selected].actual}
              status={reports[selected].status === 'passed' ? 'success' : 'danger'}
            />
          </div>
        </div>
      )}
    </Pane>
  );
};
