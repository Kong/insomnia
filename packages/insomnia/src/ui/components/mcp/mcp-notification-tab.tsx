import { useMemo, useState } from 'react';
import { Button, Input, SearchField } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import type { McpNotificationEvent } from '~/main/mcp/types';
import { Icon } from '~/ui/components/icon';
import { McpEventView } from '~/ui/components/mcp/event-view';
import { EventLogView } from '~/ui/components/websockets/event-log-view';

export interface McpNotificationTabProps {
  allEvents: McpNotificationEvent[];
}

export const McpNotificationTab = ({ allEvents }: McpNotificationTabProps) => {
  const [selectedEvent, setSelectedEvent] = useState<McpNotificationEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const handleSelection = (event: any) => {
    setSelectedEvent(selected => (selected?._id === event._id ? null : event));
  };

  const notificationEvents = useMemo(
    () =>
      allEvents.filter(event => {
        // Filter out events that don't match the search query
        if (searchQuery) {
          return JSON.stringify(event.data).toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      }),
    [allEvents, searchQuery],
  );

  return (
    <PanelGroup direction="vertical" className="grid h-full w-full grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
      <Panel minSize={10} defaultSize={50} className="box-border flex w-full flex-1 flex-col overflow-hidden">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 'var(--padding-sm)',
            gap: 'var(--padding-sm)',
          }}
        >
          <SearchField
            aria-label="Events filter"
            className="group relative w-full flex-1"
            defaultValue={searchQuery}
            onChange={query => {
              setSearchQuery(query);
            }}
          >
            <Input
              placeholder="Search"
              className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
            />
            <div className="absolute right-0 top-0 flex h-full items-center px-2">
              <Button className="flex aspect-square w-5 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] group-data-[empty]:hidden">
                <Icon icon="close" />
              </Button>
            </div>
          </SearchField>
        </div>

        {notificationEvents.length > 0 ? (
          <EventLogView events={notificationEvents} onSelect={handleSelection} selectionId={selectedEvent?._id} />
        ) : (
          <div className="flex h-full w-full flex-col items-center gap-3 pt-[5%] text-center">
            <span className="text-xl font-semibold">No notifications found</span>
          </div>
        )}
      </Panel>
      {selectedEvent && (
        <>
          <PanelResizeHandle className={'h-[1px] w-full bg-[--hl-md]'} />
          <Panel minSize={10} defaultSize={50}>
            <div className="h-full flex-1 border-t border-[var(--hl-md)]">
              <McpEventView event={selectedEvent} key={selectedEvent._id} />
            </div>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
};
