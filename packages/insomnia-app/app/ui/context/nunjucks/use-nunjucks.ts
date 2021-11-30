import { useNunjucksEnabled } from './nunjucks-enabled-context';
import { useNunjucksRenderFuncs } from './nunjucks-render-function-context';

/**
 * Access functions useful for Nunjucks rendering
 */
export const useNunjucks = () => useNunjucksRenderFuncs();

/**
 * Gated access to functions useful for Nunjucks rendering. Access is only granted if:
 *  1. Nunjucks is not diabled via the hook props
 *  2. Nunjucks is not disabled by the last NunjucksEnabledProvider in the React tree
 *
 * For ungated access, use `useNunjucks` instead
 */
export const useGatedNunjucks = (props: { disabled?: boolean } = {}): Partial<ReturnType<typeof useNunjucks>> => {
  const { enabled } = useNunjucksEnabled();
  const funcs = useNunjucks();

  const shouldEnable = shouldEnableNunjucks({
    enabledByProp: !Boolean(props.disabled),
    enabledByProvider: enabled,
  });

  if (shouldEnable) {
    return funcs;
  }

  return {};
};

const shouldEnableNunjucks = ({ enabledByProvider, enabledByProp }: { enabledByProvider: boolean; enabledByProp: boolean }) => {
  // context: disabled, prop: disabled -> should disable
  // context: disabled, prop: enabled  -> should disable
  // context: enabled,  prop: disabled -> should disable
  // context: enabled,  prop: enabled  -> should enable

  if (enabledByProvider && enabledByProp) {
    return true;
  }

  return false;
};
