import type { Cookie as AppCookie } from "insomnia-data";

export type Cookie = Pick<AppCookie, "key" | "value"> &
  Partial<Pick<AppCookie, "domain" | "path" | "expires" | "secure" | "httpOnly" | "hostOnly">> & {
    id?: string;
  };
