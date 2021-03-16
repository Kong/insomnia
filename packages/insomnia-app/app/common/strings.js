import { getAppId } from './constants';
import { APP_ID_INSOMNIA } from '../../config';

export default {
  workspace: getAppId() === APP_ID_INSOMNIA ? 'Workspace' : 'Document',
  workspaces: getAppId() === APP_ID_INSOMNIA ? 'Workspaces' : 'Documents',
  apiSpec: 'Document',
};
