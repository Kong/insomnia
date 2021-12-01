import { useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { useDebounce } from 'react-use';
import { selectSettings } from "../redux/selectors"

const updateFontThing = (key: string, value: string | null) => document?.querySelector('html')?.style.setProperty(key, value);

export const useFontMutations = () => {
  const settings = useSelector(selectSettings);

  useLayoutEffect(() => {
    updateFontThing('--font-default', settings.fontInterface);
  }, [settings.fontInterface]);

  useLayoutEffect(() => {
    updateFontThing('--font-monospace', settings.fontMonospace);
  }, [settings.fontMonospace]);

  useLayoutEffect(() => {
    updateFontThing('--font-ligatures', settings.fontVariantLigatures ? 'normal' : 'none');
  }, [settings.fontVariantLigatures]);

  useDebounce(() => {
    updateFontThing('font-size', `${settings.fontSize}px`);
  }, 100, [settings.fontSize]);
};
