export const config = {
  github: {
    login: "glink25", // github login name, not user name
    repo: "test-for-anything", //"urodele",
    // Setting `logInUrl` (and `logInAuthUrl`) makes this fork act as an editor host:
    // it bundles /edit, /login and /drafts routes so other users can use it to edit their own blogs.
    // Leave them empty for a normal blog-only fork; "Edit" buttons will route to `editorHost` instead.
    logInUrl: "",
    logInAuthUrl: "",
  },
  // Default shared editor host used when `github.logInUrl` is empty (i.e. blog-only mode).
  // Override to point at a different deployment if you don't want to depend on glink25's.
  editorHost: "https://glink25.github.io",
  // Whether to embed the drafts iframe on the home page (blog-only mode only).
  draftsEmbed: true,
  head: {
    title: "Urodele",
    brand: "Urodele",
    description: "A self-owned full-static blog system",
  },
  footer: {
    copyright: "© Glink",
    copyrightUrl: "https://github.com/glink25",
  },
  pagination: {
    size: 10,
  },
  giscus: false as object | false,
} as const;

export default config;
