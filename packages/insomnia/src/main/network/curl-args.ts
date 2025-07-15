import type { CurlRequestOptions } from './libcurl-promise';
// todo:
// escape injection
// certs
// auth
// suppress user agent
// body types

export const jsonToCurl = (options: CurlRequestOptions) => {
  const { req, settings } = options;
  const { url, headers, cookieJar, parameters, method } = req;
  // Start building the curl command as an array
  const curlCommandParts: string[] = ['curl'];
  if (method && method !== 'GET') {
    curlCommandParts.push(`-X ${method}`);
  }
  const followRedirects =
    {
      off: false,
      on: true,
      global: settings?.followRedirects || true,
    }[req.settingFollowRedirects] ?? true;
  if (followRedirects) {
    curlCommandParts.push('--location');
  }
  // Add headers
  if (headers && headers.length > 0) {
    headers.forEach(header => {
      curlCommandParts.push(`-H '${header.name}: ${header.value}'`);
    });
  }

  // Add cookies
  if (cookieJar && cookieJar.cookies && cookieJar.cookies.length > 0) {
    cookieJar.cookies.forEach(cookie => {
      curlCommandParts.push(`--cookie '${cookie.key}=${cookie.value}'`);
    });
  }

  // Add URL and parameters
  const fullUrl = new URL(url, 'http://localhost');
  parameters?.forEach(param => {
    if (param.name && param.value) {
      fullUrl.searchParams.append(param.name, param.value);
    }
  });
  const bodyText = req.body?.text;
  if (bodyText && method !== 'GET') {
    curlCommandParts.push('--data-raw', bodyText);
  }
  curlCommandParts.push(`'${fullUrl.toString()}'`);

  return curlCommandParts;
};
