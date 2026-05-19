import config from "urodele.config";

export const DEFAULT_EDITOR_HOST = "https://glink25.github.io";

const cfgAny = config as any;

// True when the editor lives in this same site (an editor-host fork in prod,
// or any fork in local dev where the FS adapter writes via `/api/post/*`).
export const isEditorHost = Boolean(config.github.logInUrl);
export const treatAsEditor = isEditorHost || import.meta.env.DEV;

export const editorHost: string = treatAsEditor
  ? ""
  : (cfgAny.editorHost ?? DEFAULT_EDITOR_HOST).replace(/\/$/, "");

export const draftsEmbed: boolean = cfgAny.draftsEmbed !== false;

const targetParam = () => `repo=${config.github.login}/${config.github.repo}`;

export const newPostUrl = () =>
  treatAsEditor ? `/edit?new` : `${editorHost}/edit/?${targetParam()}&new`;

export const editPostUrl = (path: string) =>
  treatAsEditor
    ? `/edit?path=${encodeURIComponent(path)}`
    : `${editorHost}/edit/?${targetParam()}&path=${encodeURIComponent(path)}`;

export const draftsUrl = () =>
  treatAsEditor
    ? `/drafts/?${targetParam()}`
    : `${editorHost}/drafts/?${targetParam()}`;
