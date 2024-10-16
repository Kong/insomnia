import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useSafeState } from '../../hooks/use-safe-state';

interface GloballyCachedImage {
  value: string;
  version: string;
  fetching: boolean;
}

const globalImageCache = new Map<string, GloballyCachedImage>();

const GlobalImageCacheContext = createContext<{
  lastChanged: number;
  invalidateImage: (imageUrl: string) => void;
}>({
  lastChanged: 0,
  invalidateImage: () => {},
});

export const useGlobalImageContext = () => useContext(GlobalImageCacheContext);

async function fetchAndCacheImage(
  imageUrl: string,
  tryBrowserCache: boolean,
  callback: (img: GloballyCachedImage) => void
) {
  const [imageUrlSansParams, version] = withQueryParamsRemoved(imageUrl);
  const cache = tryBrowserCache ? 'force-cache' : 'reload';
  const originalCachedImage = globalImageCache.get(imageUrlSansParams);
  let fetching = true;
  if (originalCachedImage?.fetching) {
    return;
  }
  // set fetching state to true
  globalImageCache.set(imageUrlSansParams, {
    ...(originalCachedImage ?? {
      value: imageUrl,
      version,
    }),
    fetching,
  });

  const initialFetch = await fetch(imageUrl, { cache, redirect: 'follow' });
  fetching = false;
  if (!initialFetch.ok) {
    // updates fetching state to false
    globalImageCache.set(imageUrlSansParams, {
      value: imageUrl,
      version,
      fetching,
    });
    // if the image fails to load, return the original url
    callback({ value: imageUrl, version, fetching });
    return;
  }
  const value = URL.createObjectURL(await initialFetch.blob());
  const cachedImage = { value, version, fetching };
  globalImageCache.set(imageUrlSansParams, cachedImage);
  callback(cachedImage);
}

export const GlobalImageCacheProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [lastChanged, setLastChanged] = useState(0);
  const invalidateImage = useCallback((imageUrl: string) => {
    const [imageUrlSansParams, version] = withQueryParamsRemoved(imageUrl);
    if (globalImageCache.has(imageUrlSansParams)) {
      const cachedImage = globalImageCache.get(imageUrlSansParams);
      if (!cachedImage || cachedImage.version !== version) {
        fetchAndCacheImage(imageUrl, true, () => {
          setLastChanged(Date.now());
        });
      }
    }
  }, []);

  return (
    <GlobalImageCacheContext.Provider value={{ lastChanged, invalidateImage }}>
      {children}
    </GlobalImageCacheContext.Provider>
  );
};

export const useGloballyCachedImage = (imageUrlWithParams: string) => {
  const { lastChanged: globalImageCacheLastChanged } = useContext(
    GlobalImageCacheContext
  );
  const [cachedImage, setCachedImage] = useSafeState<GloballyCachedImage>({
    value: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', // 1x1 transparent gif
    version: '0',
    fetching: false,
  });

  useEffect(() => {
    const [imageUrlSansParams, version] =
      withQueryParamsRemoved(imageUrlWithParams);
    const tryBrowserCache = globalImageCacheLastChanged === 0;
    if (tryBrowserCache) {
      setCachedImage({ value: imageUrlWithParams, version, fetching: false });
    }
    if (globalImageCache.has(imageUrlSansParams)) {
      setCachedImage(globalImageCache.get(imageUrlSansParams)!);
      return;
    }
    fetchAndCacheImage(imageUrlWithParams, tryBrowserCache, setCachedImage);
  }, [imageUrlWithParams, globalImageCacheLastChanged, setCachedImage]);

  return { url: cachedImage.value, version: cachedImage.version };
};

const withQueryParamsRemoved = (url: string) => {
  const parts = url.split('?');
  return parts.length === 1 ? [url, 'none'] : parts;
};
