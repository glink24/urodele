import { getLocalUser, setLocalUser, USER_KEY } from "@/shared/storage";
import { Octokit } from "octokit";
import { getTargetRepo } from "@/adapter/github";

export const getUserInfo = () => {
  const userInfo = getLocalUser();
  if (!userInfo) {
    return undefined;
  }
  // If the cached identity was authorized for a different repo than the
  // current URL is targeting, drop the cache and force re-validation.
  const target = getTargetRepo();
  if (
    userInfo.targetRepo &&
    (userInfo.targetRepo.owner !== target.owner || userInfo.targetRepo.repo !== target.repo)
  ) {
    localStorage.removeItem(USER_KEY);
    return undefined;
  }
  login(userInfo.token);
  return userInfo;
};

export const login = async (token: string) => {
  const { owner, repo } = getTargetRepo();
  const oc = new Octokit({ auth: token });
  const { data } = await oc.request("GET /user");
  const { data: repoData } = await oc
    .request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    })
    .catch((error) => {
      console.error(error);
      return {
        data: {
          permissions: {},
        },
      };
    });
  if (!(repoData.permissions as any)?.push) {
    throw new Error("login user has no permission to push to current repo");
  }
  setLocalUser({
    name: data.name ?? "",
    avatar: data.avatar_url,
    login: data.login,
    token: token,
    permissions: repoData.permissions,
    targetRepo: { owner, repo },
  });
};

export const logout = () => {
  localStorage.removeItem(USER_KEY);
};
