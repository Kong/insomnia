import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { RequestLoaderData } from '../../routes/request';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';

export const MockRequestSender = () => {
  const { mockServerAndRoutes } = useRouteLoaderData('request/:requestId') as RequestLoaderData;

  const [selectedMockServer, setSelectedMockServer] = useState('');
  const [selectedMockRoute, setSelectedMockRoute] = useState('');
  return (
    <div className="px-32 h-full flex flex-col justify-center">
      <div className="flex place-content-center text-9xl pb-2">
        <Icon icon="cube" />
      </div>
      <div className="flex place-content-center pb-2">
        Choose an existing Mock file and route, or create a new one.
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!selectedMockServer || !selectedMockRoute) {
            return;
          }
        }}
      >
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Choose Mock Server
              <HelpTooltip position="top" className="space-left">
                Select from created mock servers to send this request to
              </HelpTooltip>
              <select
                value={selectedMockServer}
                onChange={event => {
                  const selected = event.currentTarget.value;
                  setSelectedMockServer(selected);
                }}
              >
                <option value="">-- Select... --</option>
                {mockServerAndRoutes
                  .map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))
                }
              </select>
            </label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Choose Mock Route
              <HelpTooltip position="top" className="space-left">
                Select from created mock routes to send this request to
              </HelpTooltip>
              <select
                value={selectedMockRoute}
                onChange={event => {
                  const selected = event.currentTarget.value;
                  setSelectedMockRoute(selected);
                }}
              >
                <option value="">-- Select... --</option>
                {mockServerAndRoutes.find(s => s._id === selectedMockServer)?.routes
                  .map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))
                }
              </select>
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            isDisabled={!selectedMockServer || !selectedMockRoute}
            className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};
