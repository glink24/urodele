import { parseMeta, toMeta } from "@/shared/transform";
import config from "@/../urodele.config";
import { Octokit } from "octokit";
import type { DeletePageByPath, ReadPageByPath, WritePage } from "../helper";
import { getLocalUser } from "@/shared/storage";

export type TargetRepo = { owner: string; repo: string };

// Resolve the target repo for adapter calls.
// Priority: ?repo=owner/name URL query > config.github (legacy / editor-host self-edit).
export const getTargetRepo = (): TargetRepo => {
  if (typeof window !== "undefined") {
    const fromUrl = new URL(window.location.href).searchParams.get("repo");
    if (fromUrl) {
      const [owner, repo] = fromUrl.split("/");
      if (owner && repo) return { owner, repo };
    }
  }
  return { owner: config.github.login, repo: config.github.repo };
};

let _oc: Octokit | undefined;
const getOc = () => {
  if (_oc) return _oc;
  const token = getLocalUser()?.token;
  const octokit = new Octokit({ auth: token });
  return octokit;
};

export const readPageByPath: ReadPageByPath = async (_id) => {
  const id = _id.replace(/\/$/, "");
  const path = `posts/${id}.json`;
  const { owner, repo } = getTargetRepo();
  const octokit = getOc();
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: path,
  });
  // fix github base64
  const content = decodeURIComponent(escape(window.atob((data as any).content.replace(/\s/g, ""))));
  const json = JSON.parse(content);
  const meta = parseMeta(json);
  return {
    content: content,
    ...meta,
    id,
    path,
  };
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Data = (reader.result as string).split(",")[1]; // 移除 Data URI 的前缀
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
}

export const writePage: WritePage = async (_path, data, assets) => {
  const path = _path.replace(/\/$/, "");
  const { owner, repo } = getTargetRepo();
  const octokit = getOc();
  const main = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
    owner,
    ref: "heads/main",
    repo,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const meta = toMeta({ ...data, updateTime: Date.now() });
  const rawString = JSON.stringify({ ...meta, ...JSON.parse(data.content) });
  const textFile = new File([new Blob([rawString], { type: "application/json" })], path.replace(/^\//, ""));
  const tree = await Promise.all(
    [
      ...assets.map(({ file }) => ({
        path: `public/post-assets/${file.name}`,
        file,
      })),
      {
        path: `posts/${path}.json`,
        file: textFile,
      },
    ].map(async ({ file, path }) => {
      const fileURI = typeof file === "string" ? btoa(file) : await fileToBase64(file);
      const blob = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
        owner,
        repo,
        content: fileURI,
        encoding: "base64",
      });
      return {
        path,
        sha: blob.data.sha,
        mode: "100644",
        type: "blob",
      } as const;
    })
  );
  const newTree = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
    owner,
    repo,
    tree,
    base_tree: main.data.object.sha,
  });

  const commit = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
    owner,
    repo,
    message: `update by urodele`,
    tree: newTree.data.sha,
    parents: [main.data.object.sha],
  });

  await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
    owner,
    repo,
    ref: main.data.ref.replace(/^refs\//, ""),
    sha: commit.data.sha,
  });
};

export const deletePageByPath: DeletePageByPath = async (_path, assets) => {
  const path = _path.replace(/\/$/, "");
  const { owner, repo } = getTargetRepo();
  const octokit = getOc();
  const main = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
    owner,
    ref: "heads/main",
    repo,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const tree = [
    ...assets.map((p) => ({
      path: p.replace("/post-assets", "public/post-assets"),
      mode: "100644" as const,
      sha: null,
    })),
    {
      path: `posts/${path}.json`,
      mode: "100644" as const,
      sha: null,
    },
  ];
  const newTree = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
    owner,
    repo,
    base_tree: main.data.object.sha,
    tree: tree,
  });

  const commit = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
    owner,
    repo,
    message: `deleted by urodele`,
    tree: newTree.data.sha,
    parents: [main.data.object.sha],
  });

  await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
    owner,
    repo,
    ref: main.data.ref.replace(/^refs\//, ""),
    sha: commit.data.sha,
  });
};

// List `posts/*.json` entries in the target repo via the Contents API.
// Returns the raw entries; callers should fetch each `download_url` to read content.
export const listPosts = async () => {
  const { owner, repo } = getTargetRepo();
  const octokit = getOc();
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: "posts",
  });
  if (!Array.isArray(data)) return [];
  return (data as any[]).filter((f) => f.type === "file" && f.name.endsWith(".json"));
};

export const readRawPost = async (entry: { download_url?: string | null; name: string }) => {
  if (!entry.download_url) return undefined;
  const res = await fetch(entry.download_url);
  if (!res.ok) return undefined;
  const json = await res.json();
  const meta = parseMeta(json);
  const id = entry.name.replace(/\.json$/, "");
  return {
    id,
    path: `posts/${entry.name}`,
    ...meta,
  };
};
