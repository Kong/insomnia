import { ipcRenderer } from 'electron';
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
    ipcRenderer.on('run-command', (_, commandUri) => {
      const parsed = parse(commandUri, true);
      const command = `${parsed.hostname}${parsed.pathname}`;
      const args = JSON.parse(JSON.stringify(parsed.query));
      args.workspaceId = args.workspaceId || activeWorkspace?._id;
      newCommand(command, args)(dispatch);
    });
  }, [activeWorkspace?._id, dispatch]);
};
