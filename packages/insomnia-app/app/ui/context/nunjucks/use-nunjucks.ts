import { useNunjucksEnabled } from './nunjucks-enabled-context';
import { useNunjucksRenderFuncs } from './nunjucks-render-function-context';

/**
 * Access functions useful for Nunjucks rendering
 */
export const useNunjucks = () => {
  return useNunjucksRenderFuncs();
};

const shouldEnableNunjucks = ({ enabledByReactContext, enabledByProp }: { enabledByReactContext: boolean; enabledByProp: boolean }) => {

  // context: disabled, prop: disabled -> should disable
  // context: disabled, prop: enabled  -> should disable
  // context: enabled,  prop: disabled -> should disable
  // context: enabled,  prop: enabled  -> should enable

  if (enabledByReactContext && enabledByProp) {
    return true;
  }

  return false;
};

/**
 * Gated access to functions useful for Nunjucks rendering. Access is only granted if the prop opts in, and Nunjucks is enabled via the React Context wrapper.
 */
export const useGatedNunjucks = ({ enabledByProp }: {enabledByProp?: boolean}): Partial<ReturnType<typeof useNunjucks>> => {
  const { enabled: enabledByReactContext } = useNunjucksEnabled();
  const funcs = useNunjucks();

  const shouldEnable = shouldEnableNunjucks({
    enabledByProp: Boolean(enabledByProp),
    enabledByReactContext,
  });

  if (shouldEnable) {
    return funcs;
  }

  return {};
};
