import { fetch } from './fetch';

export const runVcsGraphQL = <T>({
  name,
  query,
  variables,
  sessionId,
}: {
  name: string;
  query: string;
  variables?: Record<string, any>;
  sessionId: string;
}) => {
  return fetch<{ data: T; errors: [{ message: string }] }>({
    method: 'POST',
    path: '/graphql?' + name,
    data: { query, variables },
    sessionId,
  });
};
