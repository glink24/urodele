// @ts-check
import { defineConfig } from "astro/config";
import { fileURLToPath } from "url";
import UnoCSS from "unocss/astro";
import config from "./urodele.config.ts";

const isEditorHost = Boolean(config.github.logInUrl);

/** @type {import('astro').AstroIntegration} */
const editorHostRoutes = {
  name: "urodele:editor-host-routes",
  hooks: {
    "astro:config:setup": ({ injectRoute, command }) => {
      // Inject when this is an editor host, OR when running locally in dev
      // (FS adapter needs the in-tree /edit, /login and /api/post/* routes).
      const isDev = command === "dev";
      if (!isEditorHost && !isDev) return;
      injectRoute({
        pattern: "/edit",
        entrypoint: "./src/editor-pages/edit/index.astro",
      });
      injectRoute({
        pattern: "/login",
        entrypoint: "./src/editor-pages/login/index.astro",
      });
      injectRoute({
        pattern: "/drafts",
        entrypoint: "./src/editor-pages/drafts/index.astro",
      });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  output: import.meta.env.DEV ? "server" : "static",
  integrations: [UnoCSS({ injectReset: true }), editorHostRoutes],
  server: {
    host: true,
  },
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "urodele.config": fileURLToPath(new URL("./urodele.config.ts", import.meta.url)),
      },
    },
  },
});
