import * as React from "jsx-dom";
import { getTargetRepo, listPosts, readRawPost } from "@/adapter/github";
import { getUserInfo, login } from "@/components/Auth/auth";
import { formatSecond } from "@/shared/time";
import config from "urodele.config";

// Derive the deployed GitHub Pages URL for the target repo.
// Convention: <owner>.github.io is the user site (deployed at root);
// any other repo is a project site at <owner>.github.io/<repo>.
const ownerSiteUrl = (owner: string, repo: string) => {
  if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return `https://${owner}.github.io`;
  }
  return `https://${owner}.github.io/${repo}`;
};

const DraftCard = (item: {
  id: string;
  title: string;
  intro?: string;
  tags?: string[];
  createTime: number;
  cover?: { src: string; alt?: string };
  postHref: string;
}) => (
  <>
    <div data-page-draft="verified" class="pt-4 pb-2">
      <a
        href={item.postHref}
        target="_top"
        class="px-4 pb-4 flex justify-between items-center group">
        <div class="flex flex-col">
          <h2 class="page-title w-[fit-content] text-base transition-all font-semibold group-hover:underline">
            {item.title || item.id}
          </h2>
          {item.intro && <p class="text-text text-opacity-60 text-sm">{item.intro}</p>}
        </div>
        {item.cover && (
          <img class="w-12 h-12 rounded object-cover" src={item.cover.src} alt={item.cover.alt} />
        )}
      </a>
      {item.tags && item.tags.length > 0 && (
        <div class="flex pt-1 gap-2 px-4">
          {item.tags.map((tag) => (
            <span class="text-xs text-gray">#{tag}</span>
          ))}
        </div>
      )}
      <div class="text-end text-xs text-gray px-4">{formatSecond(item.createTime)}</div>
    </div>
    <hr />
  </>
);

const LoginPrompt = (target: { owner: string; repo: string }, onLoggedIn: () => void) => {
  const wrapper = (<div class="p-4 flex flex-col gap-3 text-sm" />) as HTMLDivElement;
  wrapper.appendChild(
    <div class="text-text">
      Sign in to view drafts of <span class="font-mono">{target.owner}/{target.repo}</span>
    </div>
  );

  const oauthUrl: string | undefined = config.github.logInUrl || undefined;
  if (oauthUrl) {
    wrapper.appendChild(
      <a href={oauthUrl} class="buttoned bg-[#202328] text-white text-sm" target="_top">
        <div class="i-ri:github-fill" /> Login with Github
      </a>
    );
  }

  const tokenInput = (
    <input
      type="text"
      placeholder="or paste a GitHub token"
      class="rounded border dark:border-gray px-2 py-1 text-sm bg-transparent"
    />
  ) as HTMLInputElement;
  const tokenButton = (
    <button class="buttoned bg-blue text-sm" type="button">
      Use token
    </button>
  ) as HTMLButtonElement;
  const errorEl = (<div class="text-xs text-red" />) as HTMLDivElement;

  tokenButton.addEventListener("click", async () => {
    const value = tokenInput.value.trim();
    if (!value) return;
    tokenButton.setAttribute("disabled", "true");
    errorEl.textContent = "";
    try {
      await login(value);
      onLoggedIn();
    } catch (err: any) {
      errorEl.textContent = err?.message ?? String(err);
    } finally {
      tokenButton.removeAttribute("disabled");
    }
  });

  wrapper.appendChild(tokenInput);
  wrapper.appendChild(tokenButton);
  wrapper.appendChild(errorEl);
  return wrapper;
};

export const mount = async (selector: string) => {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) return;
  root.replaceChildren();

  let target: { owner: string; repo: string };
  try {
    target = getTargetRepo();
  } catch {
    root.appendChild(<div class="p-4 text-sm text-red">Missing ?repo=owner/name in URL.</div>);
    return;
  }

  const render = async () => {
    const userInfo = getUserInfo();
    if (!userInfo) {
      root.replaceChildren(LoginPrompt(target, render));
      return;
    }
    if (
      userInfo.targetRepo &&
      (userInfo.targetRepo.owner !== target.owner || userInfo.targetRepo.repo !== target.repo)
    ) {
      root.replaceChildren(LoginPrompt(target, render));
      return;
    }

    root.replaceChildren(<div class="p-4 text-sm text-gray">Loading drafts…</div>);
    try {
      const entries = await listPosts();
      const posts = await Promise.all(entries.map((e) => readRawPost(e as any)));
      const drafts = posts
        .filter((p): p is NonNullable<typeof p> => Boolean(p && p.draft))
        .sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0));
      if (drafts.length === 0) {
        root.replaceChildren(<div class="p-4 text-sm text-gray">No drafts.</div>);
        return;
      }
      const siteBase = ownerSiteUrl(target.owner, target.repo);
      root.replaceChildren(
        <div class="content">
          {drafts.map((d) =>
            DraftCard({
              id: d.id,
              title: d.title,
              tags: d.tags,
              createTime: d.createTime,
              postHref: `${siteBase}/post/${d.id}`,
            })
          )}
        </div>
      );
    } catch (err: any) {
      root.replaceChildren(
        <div class="p-4 text-sm text-red">Failed to load drafts: {err?.message ?? String(err)}</div>
      );
    }
  };

  await render();
};
