import * as models from '../../models';
import { showPrompt } from '../components/modals';

export const createRequestGroup = (parentId: string) => {
  showPrompt({
    title: 'New Folder',
    defaultValue: 'My Folder',
    submitName: 'Create',
    label: 'Name',
    selectText: true,
    onComplete: async name => {
      const requestGroup = await models.requestGroup.create({
        parentId,
        name,
      });
      await models.requestGroupMeta.create({
        parentId: requestGroup._id,
        collapsed: false,
      });
    },
  });
};
