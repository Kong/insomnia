import { useNunjucksEnabled } from './nunjucks-enabled-context';
import { useNunjucks } from './use-nunjucks';

/**
 * Gated access to functions useful for Nunjucks rendering. Access is only granted if:
 *  1. Nunjucks is not disabled via the hook props
 *  2. Nunjucks is not disabled by the last NunjucksEnabledProvider in the React tree
 *
 * For ungated access, use `useNunjucksRenderFunctions` instead
 */
export const useGatedNunjucks = (props: { disabled?: boolean } = {}): Partial<ReturnType<typeof useNunjucks>> => {
  const funcs = useNunjucks();

  const enabledByProvider = useNunjucksEnabled().enabled;
  const enabledByProp = !props.disabled;

  // provider: disabled, prop: disabled -> disable
  // provider: disabled, prop: enabled  -> disable
  // provider: enabled,  prop: disabled -> disable
  // provider: enabled,  prop: enabled  -> enable

  const isNunjucksTemplatingEnabled = enabledByProp && enabledByProvider;

  if (isNunjucksTemplatingEnabled) {
    return funcs;
  }

  return {};
};
