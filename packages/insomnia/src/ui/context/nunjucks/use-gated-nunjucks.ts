import { useNunjucks } from './use-nunjucks';

/**
 * Gated access to functions useful for Nunjucks rendering. Access is only granted if:
 *  1. Nunjucks is not disabled via the hook props
 *
 * For ungated access, use `useNunjucksRenderFunctions` instead
 */
export const useGatedNunjucks = (props: { disabled?: boolean } = {}): Partial<ReturnType<typeof useNunjucks>> => {
  const funcs = useNunjucks();

  const isNunjucksTemplatingEnabled = !props.disabled;

  if (isNunjucksTemplatingEnabled) {
    return funcs;
  }

  return {};
};
