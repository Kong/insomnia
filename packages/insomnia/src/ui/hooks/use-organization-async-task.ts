import { useEffect, useMemo } from 'react';
import { useFetcher, useLocation } from 'react-router-dom';

import { findPersonalOrganization, Organization } from '../../models/organization';
import { UserSession } from '../../models/user-session';
import { AsyncTask } from '../routes/organization';

interface OrganizationSync {
  organizationId: string;
  organizations: Organization[];
  userSession: UserSession;
}

// this hook is used to run async task for organizations and projects (such as sync remote or migration)
// return status so that we can show loading or error message to user
export const useAsyncTask = ({
  organizationId,
  organizations,
  userSession,
}: OrganizationSync) => {
  const asyncTaskFetcher = useFetcher();
  const location = useLocation();
  console.log('location', location);

  const asyncTaskStatus = useMemo(() => {
    const data = asyncTaskFetcher.data;
    console.log('fetcherdata', data, asyncTaskFetcher.state);
    if (asyncTaskFetcher.state !== 'idle' && data?.error) {
      return 'error';
    }
    return asyncTaskFetcher.state;
  }, [asyncTaskFetcher.state, asyncTaskFetcher.data]);

  const personalOrganization = findPersonalOrganization(organizations, userSession.accountId);

  const asyncTaskList = location.state?.asyncTaskList as AsyncTask[];

  useEffect(() => {
    console.log('asyncTaskList', asyncTaskList);
    if (asyncTaskList?.length) {
      console.log('run async task in useEffect');
      const submit = asyncTaskFetcher.submit;
      submit({
        sessionId: userSession.id,
        accountId: userSession.accountId,
        personalOrganizationId: personalOrganization?.id || '',
        organizationId,
        asyncTaskList: asyncTaskList,
      }, {
        action: '/organization/asyncTask',
        method: 'POST',
        encType: 'application/json',
      });
    }
  }, [asyncTaskList, asyncTaskFetcher.submit, userSession.id, personalOrganization?.id, organizationId, userSession.accountId]);

  return asyncTaskStatus;
};
