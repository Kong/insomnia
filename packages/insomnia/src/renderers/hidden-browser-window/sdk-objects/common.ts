// basically it is 'SettingsUsedHere' in 'main/network/libcurl-promise'
// but it could be extended for other cases
export interface Settings {
    preferredHttpVersion: string;
    maxRedirects: number;
    proxyEnabled: boolean;
    timeout: number;
    validateSSL: boolean;
    followRedirects: boolean;
    maxTimelineDataSizeKB: number;
    httpProxy: string;
    httpsProxy: string;
    noProxy: string;
}
