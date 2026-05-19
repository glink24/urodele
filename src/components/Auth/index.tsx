import * as React from "jsx-dom";
import { useDialog } from "../Dialog";
import { cn, useAttrRef } from "@/utils/dom";
import { getUserInfo, login, logout } from "./auth.js";
import { getGlobalData } from "@/utils/data.js";
import { formatSecond } from "@/shared/time.js";
import styles from "./style.module.scss";
import config from "urodele.config";
import { newPostUrl, editPostUrl } from "@/utils/editorLinks";
import type { UserInfo } from "@/shared/storage.js";

const Login = () => {
	const createModal = () => {
		const [buttonRef, setButtonRef] = useAttrRef({
			disabled: true,
			"data-loading": false,
		});
		const inputRef = React.useRef<HTMLInputElement>();
		const onInput = () => {
			setButtonRef({
				disabled: !inputRef.current?.value.length,
			});
		};
		const toConfirm = async () => {
			const value = inputRef.current?.value;
			if (!value) return;
			setButtonRef({ "data-loading": true });
			try {
				await login(value);
				location.reload();
			} catch (error: any) {
				alert(error.message);
			} finally {
				setButtonRef({ "data-loading": false });
			}
		};
		const showOAuthLogin = Boolean(config.github.logInUrl);
		return (
			<div class={cn("flex flex-col p-4", styles.tabset)}>
				<input
					type="radio"
					name="tabset"
					id="tab1"
					data-tab-name="direct"
					checked={!showOAuthLogin}
				/>
				<input
					type="radio"
					name="tabset"
					id="tab2"
					data-tab-name="app"
					checked={showOAuthLogin}
				/>
				<div
					class={cn(
						"flex gap-4 justify-center pb-4",
						styles["tab-labels"],
						!showOAuthLogin && "hidden!",
					)}
				>
					<label data-tab-name="direct" htmlFor="tab1" class="cursor-pointer">
						Direct
					</label>
					<label data-tab-name="app" htmlFor="tab2" class="cursor-pointer">
						App
					</label>
				</div>
				<div class={cn(styles["tab-panels"])}>
					<div
						class={cn("panel-direct", styles["tab-panel"])}
						data-tab-name="direct"
					>
						<div class="flex flex-col gap-4">
							<div>Enter your github token:</div>
							<p class="text-red text-sm font-bold">
								Don't enter your Github token if you are not owner of this site
								!!!
							</p>
							<a
								href="https://github.com/settings/personal-access-tokens/new"
								target="_blank"
								class="text-xs underline text-blue"
								rel="noopener"
							>
								learn here
							</a>
							<input
								ref={inputRef as any}
								type="text"
								placeholder="paste your token here"
								class="rounded border dark:border-gray px-2 py-1 text-sm bg-transparent"
								onInput={onInput}
								onChange={toConfirm}
							/>
							<button
								type="button"
								class="buttoned bg-blue"
								ref={buttonRef}
								onClick={toConfirm}
							>
								confirm
							</button>
						</div>
					</div>
					<div
						class={cn("panel-app w-full h-full", styles["tab-panel"])}
						data-tab-name="app"
					>
						<div class="w-full h-full flex justify-center p-2">
							<a
								href={config.github.logInUrl}
								class="buttoned bg-[#202328] text-white text-sm"
							>
								<div class="i-ri:github-fill"></div> Login with Github
							</a>
						</div>
					</div>
				</div>
			</div>
		);
	};
	const dialog = useDialog(createModal);

	const toLogin = () => {
		dialog.show();
	};
	const LoginButton = () => (
		<button type="button" class="text-sm" onClick={toLogin} title="login">
			<div class="i-ri:triangle-line"></div>
		</button>
	);

	return LoginButton();
};

const Profile = (user: UserInfo) => {
	const toLogout = () => {
		logout();
		location.reload();
	};
	const createModal = () => (
		<div class="w-full flex-1 flex flex-col gap-2 p-4 justify-between">
			<div>
				<div class="text-lg">Are you sure to log out?</div>
				<div class="text-gray text-sm">
					Token will be clear, make sure you saved it elsewhere
				</div>
			</div>
			<button type="button" class="buttoned bg-red" onClick={toLogout}>
				log out
			</button>
		</div>
	);
	const dialog = useDialog(createModal);
	const toShowProfile = () => {
		dialog.show();
	};
	const canEdit = Boolean(user.permissions?.push);
	const isHome = location.pathname === "/";
	const isIndex = isHome || /^\/\d+$/.test(location.pathname);
	const isPage = location.pathname.startsWith("/post");
	const pageId = location.pathname.replace("/post/", "");
	if (canEdit && isHome) {
		handleDraft();
	}
	return (
		<div class="flex gap-2">
			{canEdit && isIndex && (
				<a href={newPostUrl()} class="text-button" aria-label="create new post">
					<div class="i-ri:add-large-line"></div>
				</a>
			)}
			{canEdit && isPage && (
				<a
					href={editPostUrl(pageId)}
					class="text-button"
					aria-label="edit current post"
				>
					<div class="i-ri:quill-pen-fill"></div>
				</a>
			)}

			<button
				type="button"
				class="w-6 h-6 rounded-full cursor-pointer"
				onClick={toShowProfile}
			>
				<img src={user.avatar} alt="" class="rounded-full" />
			</button>
		</div>
	);
};

// In dev mode the FS adapter writes locally without needing a real GitHub token,
// so synthesize a permission-bearing identity to surface edit/new buttons without
// forcing the developer to paste a token first.
const DEV_USER: UserInfo = {
	name: "dev",
	avatar: "",
	token: "",
	login: "dev",
	permissions: { push: true },
};

const Auth = () => {
	const wrapper = () => {
		if (import.meta.env.DEV) return Profile(DEV_USER);
		const userInfo = getUserInfo();
		if (!userInfo) return Login();
		return Profile(userInfo);
	};
	return wrapper();
};

export const mount = (select: string) => {
	const root = document.querySelector<HTMLDivElement>(select);
	if (!root) return;
	root.appendChild(Auth());
};

// Surface unpublished drafts to the owner on the home page.
// Used in editor-host mode (post-login) and in local dev (where /api/post/list serves from FS).
const handleDraft = async () => {
	const allPost = await getGlobalData();
	const drafts = allPost.filter((v) => v.draft);
	const listWrapper = document.querySelector(".content");
	drafts.forEach((item) => {
		const dom = (
			<>
				<div data-page-draft="verified" class="pt-8 pb-2">
					<a
						href={`/post/${item.id}`}
						class="px-4 pb-4 flex justify-between items-center group"
					>
						<div class="flex flex-col">
							<h1 class="page-title w-[fit-content] text-lg transition-all font-semibold group-hover:underline">
								{item.title}
							</h1>
							<p class="text-text text-opacity-60 text-sm">{item.intro}</p>
						</div>
						{item.cover && (
							<img
								class="w-16 h-16 rounded object-cover"
								src={item.cover.src}
								alt={item.cover.alt}
							/>
						)}
					</a>
					<div class="flex pt-2 gap-2 px-4">
						{item.tags.map((tag) => (
							<a
								href={`/tag/${encodeURIComponent(tag)}`}
								class="text-sm text-gray hover:text-black"
							>
								#{tag}
							</a>
						))}
					</div>
					<div
						data-acc-time={item.createTime}
						class="text-end text-xs text-gray"
					>
						{formatSecond(item.createTime)}
					</div>
				</div>
				<hr />
			</>
		);
		listWrapper?.insertBefore(dom, listWrapper.firstChild);
	});
};
