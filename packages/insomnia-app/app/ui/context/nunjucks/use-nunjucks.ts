import {  useNunjucksEnabled } from './nunjucks-enabled-context';
import {  useNunjucksRenderFuncs } from './nunjucks-render-function-context';

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

export const useNunjucks = (disabled = false) => {
  const { enabled } = useNunjucksEnabled();
  const { handleRender, handleGetRenderContext } = useNunjucksRenderFuncs();

  const isEnabled = shouldEnableNunjucks({
    enabledByProp: !Boolean(disabled),
    enabledByReactContext: enabled,
  });

  return {
    handleRender: isEnabled ? handleRender : undefined,
    handleGetRenderContext: isEnabled ? handleGetRenderContext : undefined,
  };
};
