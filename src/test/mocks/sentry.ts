export const init = jest.fn();
export const setUser = jest.fn();
export const wrap = <T>(c: T) => c;
export type Breadcrumb = { category?: string; message?: string; data?: Record<string, unknown> };
export type ErrorEvent = {
  message?: string;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: Breadcrumb[];
  [k: string]: unknown;
};
