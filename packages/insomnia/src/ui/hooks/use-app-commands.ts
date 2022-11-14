import { IpcRendererEvent } from 'electron/renderer';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { parse } from 'url';

import { newCommand } from '../redux/modules/global';
import { selectActiveWorkspace } from '../redux/selectors';

export const useAppCommands = () => {
  const dispatch = useDispatch();
  const activeWorkspace = useSelector(selectActiveWorkspace);

  // Handle Application Commands
  useEffect(() => {
    return window.main.on('shell:open', (_: IpcRendererEvent, url: string) => {
      console.log('[renderer] Received Deep Link URL', url);
      const parsed = parse(url, true);
      const command = `${parsed.hostname}${parsed.pathname}`;
      const args = JSON.parse(JSON.stringify(parsed.query));
      args.workspaceId = args.workspaceId || activeWorkspace?._id;
      newCommand(command, args)(dispatch);
    });
  }, [activeWorkspace?._id, dispatch]);
};
