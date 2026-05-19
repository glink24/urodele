export const USER_KEY = "user_github";

export type UserInfo = {
  name: string;
  avatar: string;
  token: string;
  login: string;
  permissions?: { push?: boolean };
  targetRepo?: { owner: string; repo: string };
};

export const getLocalUser = () => {
  if (typeof window == "undefined") return undefined;
  const info = localStorage.getItem(USER_KEY) ?? undefined;
  return info ? (JSON.parse(info) as UserInfo) : undefined;
};

export const setLocalUser = (v: UserInfo) => {
  localStorage.setItem(USER_KEY, JSON.stringify(v));
  return v;
};
