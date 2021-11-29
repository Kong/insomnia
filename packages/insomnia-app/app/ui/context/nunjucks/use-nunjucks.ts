import { useNunjucksEnabled } from './nunjucks-enabled-context';
import { useNunjucksRenderFuncs } from './nunjucks-render-function-context';

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

export const useNunjucksConfigured = (disabled = false): Partial<ReturnType<typeof useNunjucks>> => {
  const { enabled } = useNunjucksEnabled();
  const funcs = useNunjucks();

  const isEnabled = shouldEnableNunjucks({
    enabledByProp: !Boolean(disabled),
    enabledByReactContext: enabled,
  });

  if (isEnabled) {
    return funcs;
  }

  return {};
};
