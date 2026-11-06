import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

interface NotFoundRedirectOptions {
  /** Whether the resource query has settled (success or error). */
  isSettled: boolean;
  /** Whether the resource the URL points at is missing or does not match the URL. */
  isMissing: boolean;
  /** Where to go instead, usually the closest surviving parent. */
  to: string;
  /** Toast title, e.g. `Example not found: exp_123`. */
  message: string;
  /**
   * Skip the toast: the resource disappeared because this session deleted it,
   * not because the URL is stale.
   */
  silent?: boolean;
}

/**
 * Query-driven routes have no loader to reject a stale URL, so the miss is
 * detected after the query settles. This mirrors the loader-based convention
 * (`showResourceNotFoundToast` + redirect) and replaces the history entry so
 * Back does not bounce into the missing resource again.
 */
export const useNotFoundRedirect = ({ isSettled, isMissing, to, message, silent }: NotFoundRedirectOptions) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSettled || !isMissing) {
      return;
    }
    if (!silent) {
      showResourceNotFoundToast(message);
    }
    navigate(to, { replace: true });
  }, [isSettled, isMissing, message, navigate, silent, to]);
};
