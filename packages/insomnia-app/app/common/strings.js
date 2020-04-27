import {
getAppId,
} from './constants';
import { APP_ID_INSOMNIA } from '../../config';

export default {
  workspace: getAppId() === APP_ID_INSOMNIA ? 'Workspace' : 'Document',
  apiSpec: 'Document',
};
