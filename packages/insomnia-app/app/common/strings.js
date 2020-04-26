import {
getAppId,
} from './constants';

export default {
  workspace: getAppId() === 'com.insomnia.app' ? 'Workspace' : 'Document',
};
