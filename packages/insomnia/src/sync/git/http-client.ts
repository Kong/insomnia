import type { HttpClient } from 'isomorphic-git';
import { request } from 'isomorphic-git/http/web';

/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient: HttpClient = { request };
