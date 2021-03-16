// @flow

import { askToImportIntoWorkspace, ensureActivityIsForApp, ForceToWorkspaceKeys } from '../helpers';
import * as modals from '../../../components/modals';
import * as constants from '../../../../common/constants';
import { APP_ID_DESIGNER, APP_ID_INSOMNIA } from '../../../../../config';

const { ACTIVITY_DEBUG, ACTIVITY_HOME, ACTIVITY_INSOMNIA, ACTIVITY_SPEC } = constants;

describe('askToImportIntoWorkspace', () => {
  it('should return null if forcing to a new workspace', () => {
    const func = askToImportIntoWorkspace('id', ForceToWorkspaceKeys.new);

    expect(func()).toBeNull();
  });

  it('should return id if forcing to a current workspace', () => {
    const currentWorkspaceId = 'currentId';
    const func = askToImportIntoWorkspace(currentWorkspaceId, ForceToWorkspaceKeys.current);

    expect(func()).toBe(currentWorkspaceId);
  });

  it('should prompt the user if not forcing', () => {
    modals.showModal = jest.fn();

    const currentWorkspaceId = 'current';
    const func = askToImportIntoWorkspace(currentWorkspaceId);

    func();
    expect(modals.showModal).toHaveBeenCalledTimes(1);
  });
});

describe('ensureActivityIsForApp()', () => {
  const designerActivities = [ACTIVITY_SPEC, ACTIVITY_DEBUG, ACTIVITY_HOME];
  const insomniaActivities = [ACTIVITY_INSOMNIA];

  it.each([...designerActivities, ...insomniaActivities])(
    'should return ACTIVITY_INSOMNIA if default app id is insomnia: %o',
    activity => {
      jest.spyOn(constants, 'getDefaultAppId').mockReturnValue(APP_ID_INSOMNIA);
      expect(ensureActivityIsForApp(activity)).toBe(ACTIVITY_INSOMNIA);
    },
  );

  it.each(insomniaActivities)(
    'should return ACTIVITY_HOME if default app id is designer: %o',
    activity => {
      jest.spyOn(constants, 'getDefaultAppId').mockReturnValue(APP_ID_DESIGNER);
      expect(ensureActivityIsForApp(activity)).toBe(ACTIVITY_HOME);
    },
  );

  it.each(designerActivities)(
    'should return source activity if default app id is designer: %o',
    activity => {
      jest.spyOn(constants, 'getDefaultAppId').mockReturnValue(APP_ID_DESIGNER);
      expect(ensureActivityIsForApp(activity)).toBe(activity);
    },
  );
});
