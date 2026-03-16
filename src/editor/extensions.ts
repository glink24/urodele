import { type JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html";
import Link from "@tiptap/extension-link";
import Document from "@tiptap/extension-document";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Heading from "./heading.ts";
import StarterKit from "@tiptap/starter-kit";
import { createLowlightCodeSSRPlugin, hydrate } from "./lowlight.tsx";
import { createPlaceholderPlugin } from "./placeholder";

const CustomLink = Link.extend({
  // 可以在这里添加或修改属性逻辑
  addAttributes() {
    return {
      ...this.parent?.(),
      target: {
        default: '_blank',
        // 关键点：动态渲染 target 属性
        renderHTML: attributes => {
          if (attributes.href?.startsWith('#')) {
            return {
              target: null, // 锚点链接不使用 target="_blank"
            }
          }

          return {
            target: attributes.target,
          }
        },
      },
    }
  },
})

export const getBasicExtensions = () => {
  const CustomDocument = Document.extend({
    content: "heading block*",
  });
  const displayExtension = [
    CustomDocument,
    StarterKit.configure({
      document: false,
      codeBlock: false,
      heading: false,
    }),
    Heading,
    Image,
    CustomLink.configure({
      autolink: false,
    }),
    Underline,
    TaskList,
    TaskItem,
    //   ssr ? createLowlightCodeSSRPlugin() : createLowlightCodePlugin(),
    createPlaceholderPlugin(),
  ];
  return displayExtension;
};

export const getSSRHTML = (json: JSONContent) => {
  const displayExtension = [...getBasicExtensions(), createLowlightCodeSSRPlugin()];
  const hydrateReactive = hydrate();
  return generateHTML(json, displayExtension) + hydrateReactive;
};
