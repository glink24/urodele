import * as React from "jsx-dom";

import { createEditor } from "@/editor";
import adapter from "@/adapter";
import { listPosts, getTargetRepo } from "@/adapter/github";
import { getDocAssets, getLocalUploadImages, travelDoc } from "@/utils/doc";
import { parseTitle, toFilename, toUniqueFilename } from "@/shared/transform";
import { useAttrRef } from "@/utils/dom";
import { createTagEditor } from "@/components/TagEditor/TagEditor";
import { debounce, throttle } from "@/shared/debounce";
import { createSaver } from "@/utils/saver";
import type { PageData } from "@/shared/type";
import toast from "../Toast";
import { mount as mountOutline } from "@/components/Outline";
import { useDialog } from "../Dialog";

const { readPageByPath, writePage, deletePageByPath } = adapter;

export const mount = async (selector: string, operationSelector: string) => {
	const root = document.querySelector<HTMLElement>(selector);
	const opRoot = document.querySelector<HTMLElement>(operationSelector);

	if (!root || !opRoot) return;

	const url = new URL(location.href);
	const isCreate = url.searchParams.has("new");
	const pagePath = url.searchParams.get("path") ?? undefined;

	// Existing post filenames in the target repo (used for unique-name collision check on create).
	const existingNames = await (async () => {
		try {
			const entries = await listPosts();
			return new Set(
				entries.map((e) => (e.name as string).replace(/\.json$/, "")),
			);
		} catch {
			return new Set<string>();
		}
	})();

	const saver = createSaver();

	const { editor, tagEditor, initial } = await (async () => {
		const saved = await saver.read(pagePath);
		const { data: savedPageData } = saved ? await transformSaved(saved) : {};

		const pageDat = await (async () => {
			if (savedPageData) {
				return savedPageData as PageData;
			}
			if (pagePath) {
				return readPageByPath(pagePath);
			}
		})();

		const filed = (
			<div class="field-wrapper w-full flex flex-col"></div>
		) as HTMLDivElement;
		const wrapper = (
			<div class="editor-wrapper w-full max-w-[960px] flex justify-center">
				{filed}
			</div>
		) as HTMLDivElement;
		const tagEditor = await createTagEditor(filed, pageDat?.tags ?? []);
		const editor = createEditor(filed, pageDat?.content ?? "");
		wrapper.appendChild(<div class="outline-wrapper"></div>);
		root.appendChild(wrapper);
		const outlines = mountOutline(".outline-wrapper")!;
		editor.on("update", throttle(outlines, 200));
		return {
			tagEditor,
			editor,
			initial: pageDat,
		};
	})();

	root.removeAttribute("data-modal-loading");

	const getCurrentDoc = async () => {
		const newContent = editor.getJSON();
		const { assets } = await getLocalUploadImages(editor);
		const newTags: string[] = tagEditor.getValue();

		const title = parseTitle(newContent) ?? "";

		const path = (() => {
			if (!isCreate) return pagePath!;
			const filename = toFilename(title);
			if (existingNames.has(filename)) {
				return toUniqueFilename(title);
			}
			return filename;
		})();
		return {
			path,
			content: newContent,
			data: {
				content: JSON.stringify(newContent),
				title,
				tags: newTags,
				createTime: initial?.createTime ?? Date.now(),
			},
			assets,
		};
	};

	const Save = () => {
		const [saveButtonRef, setSaveStatus] = useAttrRef(
			{ disabled: false, "data-loading": false },
			true,
		);

		const toSave = async (draft = false) => {
			setSaveStatus((v) => {
				v.blur();
				return { disabled: true, "data-loading": true };
			});
			try {
				const { path, data, assets, content } = await getCurrentDoc();
				// 将本地上传的文件转为博客站点路径
				travelDoc(content, (node) => {
					if (node.type === "image") {
						const img = assets.find(
							(asset) => asset.url === (node.attrs?.src as string),
						);
						if (img && node.attrs) {
							node.attrs.src = `/post-assets/${img.file.name}`;
						}
					}
				});
				await writePage(
					path,
					{ ...data, content: JSON.stringify(content), draft },
					assets,
				);
				toast(`${draft ? "Save" : "Publish"} success`);
				await saver.clean(pagePath);
				if (isCreate) {
					const repoParam = url.searchParams.get("repo");
					const qs = new URLSearchParams();
					if (repoParam) qs.set("repo", repoParam);
					qs.set("path", path);
					location.replace(`/edit?${qs.toString()}`);
				}
			} catch (err) {
				toast(`${draft ? "Save" : "Publish"} error: ${err}`, "error");
				throw err;
			} finally {
				setSaveStatus({ disabled: false, "data-loading": false });
			}
		};

		const saveButton = (
			<div class="group relative" tabIndex={-1}>
				<button
					type="button"
					ref={saveButtonRef}
					class="buttoned bg-blue-200 dark:bg-blue"
					aria-label="to save"
				>
					<div class="i-ri:send-plane-fill"></div>
					<div class="i-ri:arrow-down-s-fill"></div>
				</button>
				<div
					class="absolute z-[50] top-full right-0 mt-1 transition-all transition-delay-[0.2s] whitespace-nowrap opacity-0 translate-y--2 pointer-events-none group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto
        flex flex-col gap-2 p-2 rounded bg-modal shadow text-sm"
				>
					<button
						type="button"
						ref={saveButtonRef}
						class="buttoned bg-blue-200 dark:bg-blue"
						onClick={() => toSave()}
					>
						<div>Publish</div>
					</button>
					<button
						type="button"
						ref={saveButtonRef}
						class="buttoned bg-yellow-200 dark:bg-yellow"
						onClick={() => toSave(true)}
					>
						Save as draft
					</button>
				</div>
			</div>
		);

		return saveButton;
	};

	const AutoSaveIndicator = () => {
		const localSaverRef = React.createRef();
		let changeSaved = true;
		const setChangeSaved = (v: boolean) => {
			changeSaved = v;
			(localSaverRef.current as HTMLElement).replaceChildren(render());
		};
		// auto save
		const saveToLocal = debounce(async () => {
			const { data, assets, content } = await getCurrentDoc();
			await saver.save(
				{ data: { ...data, content: undefined }, assets, content },
				pagePath,
			);
			setChangeSaved(true);
		});
		const toClearLocalSaved = async () => {
			await saver.clean(pagePath);
			location.reload();
		};
		const onUpdate = () => {
			setChangeSaved(false);
			saveToLocal();
		};
		editor.on("update", onUpdate);
		tagEditor.onChange(onUpdate);

		const render = () => (
			<div class="group relative text-lg" tabIndex={-1}>
				<button
					type="button"
					class={["text-button", changeSaved ? "text-green-500" : ""].join(" ")}
				>
					<div
						class={[
							changeSaved ? "i-ri:check-line" : "i-svg-spinners:pulse",
						].join(" ")}
					></div>
				</button>
				<div class="absolute text-sm top-full right-0 gap-2 p-2 mt-1 z-[50] bg-modal flex flex-col justify-center w-[200px] shadow rounded transition-all transition-delay-[0.2s] whitespace-nowrap opacity-0 translate-y--2 pointer-events-none group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto">
					{changeSaved ? (
						<div class="text-center">Changes saved</div>
					) : (
						<div class="text-center">Saving Changes to local</div>
					)}
					<button
						type="button"
						class="buttoned bg-red text-xs"
						onClick={toClearLocalSaved}
					>
						Clear
					</button>
					<div class="text-xs text-red text-center">
						saved doc will be cleared!
					</div>
				</div>
			</div>
		);

		return (
			<div ref={localSaverRef} class="">
				{render()}
			</div>
		);
	};

	const RawButton = () => {
		const target = getTargetRepo();
		return (
			<a
				class="text-button text-lg"
				href={`https://github.com/${target.owner}/${target.repo}/blob/main/posts/${pagePath?.replace(
					/\/$/,
					"",
				)}.json`}
				target="_blank"
				aria-label="goto raw file"
			>
				<div class="i-material-symbols:raw-on"></div>
			</a>
		);
	};

	const DeleteButton = () => {
		const checkRef = React.useRef<HTMLInputElement>(null);
		const [setRef, setAttar] = useAttrRef({
			"data-loading": false,
			disabled: false,
		});
		const confirmDelete = async () => {
			if (!pagePath) return;
			const recursive = Boolean(checkRef.current?.checked);
			const assets = getDocAssets(editor);
			try {
				setAttar({ "data-loading": true, disabled: true });
				await deletePageByPath(pagePath, recursive ? assets : []);
				await toast("Delete success!");
				location.replace("/");
			} catch (error) {
				toast(`delete failed: ${error}`);
			} finally {
				setAttar({ "data-loading": false, disabled: false });
			}
		};
		const { show, close } = useDialog(() => {
			const assets = getDocAssets(editor);
			return (
				<div class="flex-1 flex flex-col p-4 gap-2">
					<div class="font-bold">Are you sure to delete this post?</div>
					<div class="text-sm flex flex-col">
						<label>
							<input type="checkbox" ref={checkRef} checked />
							<span class="px-2">delete related assets</span>
						</label>
						<span class="text-xs opacity-60">
							Make sure no other posts are using these assets
						</span>
						<ul class="flex flex-col text-xs pt-2">
							{assets.map((asset) => (
								<a target="_blank" href={asset}>
									{asset}
								</a>
							))}
						</ul>
					</div>
					<div class="flex-1"></div>
					<div class="flex gap-2 justify-end text-sm">
						<button type="button" class="buttoned" onClick={() => close()}>
							Cancel
						</button>
						<button
							type="button"
							ref={setRef}
							class="buttoned bg-red"
							onClick={() => confirmDelete()}
						>
							Confirm
						</button>
					</div>
				</div>
			);
		});
		const toDelete = () => {
			show();
		};
		return (
			<button type="button" title="delete" class="text-red" onClick={toDelete}>
				<div class="i-ri:delete-bin-fill"></div>
			</button>
		);
	};
	opRoot.appendChild(AutoSaveIndicator());
	if (!isCreate) {
		opRoot.appendChild(DeleteButton());
	}
	opRoot.appendChild(RawButton());
	opRoot.appendChild(Save());
};

const transformSaved = async (saved: any) => {
	const { data, assets, content } = saved;
	travelDoc(content, (node) => {
		if (node.type === "image") {
			const img = (assets as any[]).find(
				(asset) => asset.url === (node.attrs?.src as string),
			);
			if (img && node.attrs) {
				const blobUrl = URL.createObjectURL(img.file);
				node.attrs.src = blobUrl;
			}
		}
	});

	data.content = JSON.stringify(content);

	return {
		data,
		assets,
		content,
	};
};
