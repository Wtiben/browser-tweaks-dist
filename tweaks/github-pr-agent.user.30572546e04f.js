(function() {
	//#region \0rolldown/runtime.js
	var __defProp = Object.defineProperty;
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	//#endregion
	//#region packages/site-modules/src/define.ts
	function defineSiteModule(module) {
		return {
			...module,
			config: module.config ?? {}
		};
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-pr-agent/page.ts
	const PR_PATH = /^\/([^/]+)\/([^/]+)\/(pulls?)(?:\/(\d+))?/;
	/** Which of the two surfaces a URL is, or null when it is neither. */
	function surfaceOf(url) {
		let path;
		try {
			path = new URL(url).pathname;
		} catch {
			return null;
		}
		const match = PR_PATH.exec(path);
		if (!match) return null;
		if (match[3] === "pulls") return "list";
		return match[4] ? "detail" : null;
	}
	function repoFromUrl(url) {
		let parsed;
		try {
			parsed = new URL(url);
		} catch {
			return null;
		}
		const match = PR_PATH.exec(parsed.pathname);
		if (!match?.[1] || !match[2]) return null;
		return {
			host: parsed.host,
			owner: match[1],
			repo: match[2]
		};
	}
	/** `issue_64349` is the row id on the list, and the only place the number appears verbatim. */
	function prNumberFromRowId(id) {
		const match = /^issue_(\d+)$/.exec(id);
		if (!match?.[1]) return null;
		const parsed = Number(match[1]);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
	}
	/**
	* Wrapped in `:is()` rather than left as a comma list, so callers can safely append to it.
	* `a, b .child` parses as "a, or b's child", which silently matches every row.
	*/
	const ROW_SELECTOR = `:is(.js-issue-row[id^="issue_"], ul[data-listview-component="items-list"] > li)`;
	/** Where the button goes in a row, per list. Both are `data-` hooks or module prefixes. */
	const ROW_HOST_SELECTORS = [".text-right.no-wrap", "[class*=\"MetadataContainer-module__container\"]"];
	/** The number out of `/owner/repo/pull/4325`, which is the only place the React list has it. */
	function prNumberFromHref(href) {
		if (!href) return null;
		const match = /\/pull\/(\d+)(?:[/?#]|$)/.exec(href);
		if (!match?.[1]) return null;
		const parsed = Number(match[1]);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
	}
	/**
	* Pull requests on the list page.
	*
	* The head branch is deliberately absent: GitHub does not put it in the list DOM at all,
	* for either the head or the base, and finding out would cost a request per row. The
	* bridge falls back to the pull ref, which needs no branch name.
	*/
	function readRow(row) {
		const link = row.querySelector("a[id$=\"_link\"], a[data-testid=\"listitem-title-link\"]");
		const href = link?.getAttribute("href");
		const number = prNumberFromRowId(row.id) ?? prNumberFromHref(href);
		if (number === null) return null;
		return {
			number,
			title: link?.textContent?.trim() || `#${number}`,
			url: href ? new URL(href, "https://github.com").toString() : ""
		};
	}
	const text = (value) => typeof value === "string" && value ? value : void 0;
	/**
	* The React payload the detail page ships its own data in.
	*
	* It carries the head branch and the fork owner, which is everything the bridge needs to
	* fetch without guessing. It is an internal payload with no stability contract, so a miss
	* here falls through to the branch chips rather than failing.
	*/
	function parseEmbedded(json) {
		let payload;
		try {
			payload = JSON.parse(json);
		} catch {
			return null;
		}
		const route = payload?.payload?.pullRequestsLayoutRoute?.pullRequest;
		if (!route || typeof route.number !== "number") return null;
		return {
			number: route.number,
			title: text(route.title),
			headBranch: text(route.headBranch) ?? null,
			headOwner: text(route.headRepositoryOwnerLogin) ?? null,
			headRepo: text(route.headRepositoryName) ?? null
		};
	}
	/**
	* The head branch from the branch chips, for when the payload is not there.
	*
	* The visible text changes shape between a same-repo pull request (`main`) and a fork
	* (`owner:branch`), so the tooltip is read instead. It is always `owner/repo:branch`.
	*/
	function parseHeadTooltip(tooltip) {
		const match = /^([^/\s]+)\/([^:\s]+):(.+)$/.exec(tooltip.trim());
		if (!match?.[1] || !match[2] || !match[3]) return null;
		return {
			headOwner: match[1],
			headRepo: match[2],
			headBranch: match[3]
		};
	}
	/** The real header, not the sticky duplicate that sits in the DOM at zero size until you scroll. */
	const HEADER_SELECTOR = "[data-component=\"PageHeader\"]:not([class*=\"stickyHeader\"])";
	function readDetail(doc, url) {
		const repo = repoFromUrl(url);
		if (!repo || surfaceOf(url) !== "detail") return null;
		const number = Number(/\/pull\/(\d+)/.exec(new URL(url).pathname)?.[1]);
		if (!Number.isSafeInteger(number) || number <= 0) return null;
		const base = {
			...repo,
			number,
			title: doc.querySelector(`[data-component="PageHeader"]:not([class*="stickyHeader"]) h1`)?.textContent?.trim() || `#${number}`,
			url
		};
		for (const script of doc.querySelectorAll("script[data-target=\"react-app.embeddedData\"]")) {
			const parsed = parseEmbedded(script.textContent ?? "");
			if (parsed && parsed.number === number) return {
				...base,
				...parsed,
				...repo,
				number,
				url,
				title: parsed.title || base.title
			};
		}
		const tooltip = doc.querySelectorAll("[class*=\"PullRequestHeaderBranches-module__branches\"] [data-component=\"BranchName\"]")[1]?.getAttribute("aria-describedby");
		const described = tooltip ? doc.getElementById(tooltip)?.textContent?.trim() : null;
		const parsed = described ? parseHeadTooltip(described) : null;
		return parsed ? {
			...base,
			...parsed
		} : base;
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-pr-agent/ui.ts
	const PREFIX = "bt-pr";
	const STYLE_ID = `${PREFIX}-style`;
	/** Octicon `kebab-horizontal`, inline so it inherits colour instead of shipping an asset. */
	const KEBAB = "<svg aria-hidden=\"true\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"currentColor\"><path d=\"M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z\"></path></svg>";
	const CSS = `
.${PREFIX}-button {
  display: inline-flex; align-items: center; justify-content: center;
  /* The list row's container stretches its children, and a fixed-height item in a
     stretch container lands at the top. Without this the kebab floats above the row. */
  align-self: center;
  width: 28px; height: 28px; padding: 0; margin-left: 4px;
  border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px;
  background: var(--bgColor-default, #fff); color: var(--fgColor-muted, #59636e);
  cursor: pointer; vertical-align: middle;
}
.${PREFIX}-button:hover { background: var(--bgColor-neutral-muted, #818b981f); }
.${PREFIX}-button[aria-expanded="true"] { background: var(--bgColor-neutral-muted, #818b981f); }
/* Primer's medium control is 32px. Next to Code and the merge button, 28 looks undersized. */
.${PREFIX}-button[data-size="medium"] { width: 32px; height: 32px; }
.${PREFIX}-button[data-busy="true"] { cursor: progress; }
.${PREFIX}-button[data-busy="true"] svg { animation: ${PREFIX}-spin 1s linear infinite; }
@keyframes ${PREFIX}-spin { to { transform: rotate(360deg); } }

.${PREFIX}-menu {
  position: absolute; z-index: 2147483000; min-width: 272px; padding: 6px;
  border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 12px;
  background: var(--overlay-bgColor, var(--bgColor-default, #fff));
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.2);
  font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--fgColor-default, #1f2328);
}
.${PREFIX}-item {
  display: flex; align-items: flex-start; gap: 10px;
  width: 100%; padding: 8px 10px; border: 0; border-radius: 8px;
  background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.${PREFIX}-item + .${PREFIX}-item { margin-top: 2px; }
.${PREFIX}-icon { flex: 0 0 16px; margin-top: 2px; color: var(--fgColor-muted, #59636e); }
.${PREFIX}-item:hover:not(:disabled) .${PREFIX}-icon { color: inherit; }
.${PREFIX}-item-text { min-width: 0; }
.${PREFIX}-item:hover:not(:disabled) { background: var(--bgColor-neutral-muted, #818b981f); }
.${PREFIX}-item:disabled { color: var(--fgColor-muted, #59636e); cursor: default; }
.${PREFIX}-item-note { display: block; margin-top: 2px; font-size: 12px; color: var(--fgColor-muted, #59636e); }

.${PREFIX}-toast {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483001;
  max-width: 420px; padding: 12px 14px; border-radius: 8px;
  border: 1px solid var(--borderColor-default, #d1d9e0);
  background: var(--bgColor-default, #fff); color: var(--fgColor-default, #1f2328);
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.2);
  font: 400 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  white-space: pre-wrap;
}
.${PREFIX}-toast[data-kind="error"] { border-color: var(--borderColor-danger-emphasis, #cf222e); }
.${PREFIX}-toast[data-kind="ok"] { border-color: var(--borderColor-success-emphasis, #1a7f37); }

.${PREFIX}-backdrop {
  position: fixed; inset: 0; z-index: 2147483002;
  display: flex; align-items: center; justify-content: center;
  background: rgba(31, 35, 40, 0.4);
}
.${PREFIX}-dialog {
  width: min(520px, calc(100vw - 32px)); padding: 16px; border-radius: 12px;
  border: 1px solid var(--borderColor-default, #d1d9e0);
  background: var(--bgColor-default, #fff); color: var(--fgColor-default, #1f2328);
  font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.${PREFIX}-dialog h2 { margin: 0 0 8px; font-size: 16px; }
.${PREFIX}-dialog p { margin: 0 0 12px; color: var(--fgColor-muted, #59636e); font-size: 13px; }
.${PREFIX}-dialog input {
  width: 100%; padding: 6px 10px; margin-bottom: 12px; box-sizing: border-box;
  border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px;
  background: var(--bgColor-inset, #f6f8fa); color: inherit; font: inherit;
}
.${PREFIX}-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.${PREFIX}-dialog button {
  padding: 5px 12px; border-radius: 6px; font: inherit; cursor: pointer;
  border: 1px solid var(--borderColor-default, #d1d9e0);
  background: var(--bgColor-default, #fff); color: inherit;
}
.${PREFIX}-dialog button[data-primary] {
  border-color: var(--borderColor-success-emphasis, #1f883d);
  background: var(--bgColor-success-emphasis, #1f883d); color: #fff;
}
.${PREFIX}-dialog-error { margin: 0 0 12px; color: var(--fgColor-danger, #d1242f); font-size: 13px; }
`;
	function ensureStyle(doc) {
		if (doc.getElementById(STYLE_ID)) return;
		const style = doc.createElement("style");
		style.id = STYLE_ID;
		style.textContent = CSS;
		(doc.head ?? doc.documentElement).append(style);
	}
	/**
	* A glyph per agent, chosen by the `kind` the bridge reports.
	*
	* Drawn here rather than sent over from the bridge, because the alternative is the native
	* host handing the page markup to inject. Deliberately suggestive rather than official: a
	* burst for Claude, a chevron for Codex, a dot for anything we have not met. Swapping in a
	* real logo is one path here, with whatever licence that implies.
	*/
	const AGENT_ICONS = {
		claude: "<path d=\"M8 1.2 9.1 5.2 12.8 3.2 10.8 6.9 14.8 8 10.8 9.1 12.8 12.8 9.1 10.8 8 14.8 6.9 10.8 3.2 12.8 5.2 9.1 1.2 8 5.2 6.9 3.2 3.2 6.9 5.2Z\"></path>",
		codex: "<path d=\"M5.7 3.3 1 8l4.7 4.7 1.1-1.1L3.2 8l3.6-3.6Zm4.6 0L9.2 4.4 12.8 8l-3.6 3.6 1.1 1.1L15 8Z\"></path>",
		generic: "<circle cx=\"8\" cy=\"8\" r=\"3.2\"></circle>"
	};
	function agentIcon(doc, kind) {
		const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("class", `${PREFIX}-icon`);
		svg.setAttribute("aria-hidden", "true");
		svg.setAttribute("viewBox", "0 0 16 16");
		svg.setAttribute("width", "16");
		svg.setAttribute("height", "16");
		svg.setAttribute("fill", "currentColor");
		svg.innerHTML = AGENT_ICONS[kind ?? ""] ?? AGENT_ICONS["generic"];
		return svg;
	}
	function createButton(doc, title) {
		const button = doc.createElement("button");
		button.type = "button";
		button.className = `${PREFIX}-button`;
		button.title = title;
		button.setAttribute("aria-label", title);
		button.setAttribute("aria-expanded", "false");
		button.innerHTML = KEBAB;
		return button;
	}
	/**
	* Opens a menu anchored under a button, and returns how to close it.
	*
	* Appended to `body` rather than beside the button: on the list the button lives inside a
	* row with `overflow` of its own, and a popover clipped by its own row is worse than one
	* positioned by hand.
	*/
	function openMenu(doc, anchor, items) {
		ensureStyle(doc);
		const menu = doc.createElement("div");
		menu.className = `${PREFIX}-menu`;
		menu.setAttribute("role", "menu");
		let closed = false;
		const close = () => {
			if (closed) return;
			closed = true;
			menu.remove();
			anchor.setAttribute("aria-expanded", "false");
			doc.removeEventListener("click", onDocumentClick, true);
			doc.removeEventListener("keydown", onKeyDown, true);
		};
		function onDocumentClick(event) {
			const target = event.target;
			if (target && (menu.contains(target) || anchor.contains(target))) return;
			close();
		}
		function onKeyDown(event) {
			if (event.key === "Escape") close();
		}
		for (const item of items) {
			const button = doc.createElement("button");
			button.type = "button";
			button.className = `${PREFIX}-item`;
			button.setAttribute("role", "menuitem");
			const text = doc.createElement("span");
			text.className = `${PREFIX}-item-text`;
			text.append(doc.createTextNode(item.label));
			if (item.note) {
				const note = doc.createElement("span");
				note.className = `${PREFIX}-item-note`;
				note.textContent = item.note;
				text.append(note);
			}
			button.append(agentIcon(doc, item.icon), text);
			button.addEventListener("click", () => {
				close();
				item.onSelect();
			});
			menu.append(button);
		}
		doc.body.append(menu);
		anchor.setAttribute("aria-expanded", "true");
		const rect = anchor.getBoundingClientRect();
		const view = doc.defaultView;
		const scrollY = view?.scrollY ?? 0;
		const scrollX = view?.scrollX ?? 0;
		const width = menu.offsetWidth || 240;
		const right = Math.max(8, Math.min(rect.right, (view?.innerWidth ?? width) - 8));
		menu.style.top = `${rect.bottom + scrollY + 4}px`;
		menu.style.left = `${Math.max(8, right - width) + scrollX}px`;
		setTimeout(() => {
			if (closed) return;
			doc.addEventListener("click", onDocumentClick, true);
			doc.addEventListener("keydown", onKeyDown, true);
		}, 0);
		return close;
	}
	function toast(doc, text, kind) {
		ensureStyle(doc);
		const element = doc.createElement("div");
		element.className = `${PREFIX}-toast`;
		element.dataset["kind"] = kind;
		element.setAttribute("role", kind === "error" ? "alert" : "status");
		element.textContent = text;
		doc.body.append(element);
		const timer = kind === "busy" ? null : setTimeout(() => element.remove(), kind === "error" ? 12e3 : 6e3);
		return () => {
			if (timer !== null) clearTimeout(timer);
			element.remove();
		};
	}
	/**
	* Asks for a filesystem path, validating before it closes.
	*
	* Validation happens here rather than after the dialog is gone because the whole point is
	* to catch a typo while the user still has the field in front of them. There is no
	* directory picker to offer: `showDirectoryPicker` is Chromium-only and hands back a
	* handle, not a path.
	*/
	function promptForPath(doc, options) {
		ensureStyle(doc);
		return new Promise((resolve) => {
			const backdrop = doc.createElement("div");
			backdrop.className = `${PREFIX}-backdrop`;
			const dialog = doc.createElement("form");
			dialog.className = `${PREFIX}-dialog`;
			dialog.setAttribute("role", "dialog");
			dialog.setAttribute("aria-modal", "true");
			const heading = doc.createElement("h2");
			heading.textContent = options.title;
			const description = doc.createElement("p");
			description.textContent = options.description;
			const error = doc.createElement("p");
			error.className = `${PREFIX}-dialog-error`;
			error.hidden = true;
			const input = doc.createElement("input");
			input.type = "text";
			input.placeholder = options.placeholder;
			input.value = options.initial ?? "";
			input.spellcheck = false;
			const actions = doc.createElement("div");
			actions.className = `${PREFIX}-dialog-actions`;
			const cancel = doc.createElement("button");
			cancel.type = "button";
			cancel.textContent = "Cancel";
			const save = doc.createElement("button");
			save.type = "submit";
			save.dataset["primary"] = "true";
			save.textContent = "Save";
			actions.append(cancel, save);
			const finish = (value) => {
				backdrop.remove();
				doc.removeEventListener("keydown", onKeyDown, true);
				resolve(value);
			};
			function onKeyDown(event) {
				if (event.key === "Escape") finish(null);
			}
			cancel.addEventListener("click", () => finish(null));
			backdrop.addEventListener("click", (event) => {
				if (event.target === backdrop) finish(null);
			});
			dialog.addEventListener("submit", (event) => {
				event.preventDefault();
				const value = input.value.trim();
				if (!value) return;
				save.disabled = true;
				save.textContent = "Checking…";
				options.validate(value).then(() => finish(value), (reason) => {
					error.textContent = reason instanceof Error ? reason.message : String(reason);
					error.hidden = false;
					save.disabled = false;
					save.textContent = "Save";
				});
			});
			dialog.append(heading, description, error, input, actions);
			backdrop.append(dialog);
			doc.body.append(backdrop);
			doc.addEventListener("keydown", onKeyDown, true);
			input.focus();
		});
	}
	/**
	* Makes sure the repository is mapped, asking once if it is not.
	*
	* A pre-flight rather than catching a failure from the action itself: an error crossing
	* native messaging is only a string, and matching on its text to decide whether to open a
	* dialog is the kind of thing that breaks when someone rewords a message.
	*
	* Here rather than in either module because both ask the same question: a pipeline run
	* that built a GitHub repository is answered by the mapping its pull requests already made.
	*/
	async function ensureMapped(doc, bridge, repo) {
		if ((await bridge("repo-path", repo)).path) return true;
		return await promptForPath(doc, {
			title: `Where is ${repo.owner}/${repo.repo} checked out?`,
			description: "The full path to your local clone. Any path inside it will do, including a worktree. Asked once per repository, then remembered on this machine.",
			placeholder: "C:\\Projects\\Fincent",
			validate: async (value) => {
				await bridge("repo-link", {
					...repo,
					path: value
				});
			}
		}) !== null;
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-pr-agent/index.ts
	var github_pr_agent_exports = /* @__PURE__ */ __exportAll({ githubPrAgent: () => githubPrAgent });
	const MARK = "data-bt-pr-menu";
	/** GitHub replaces this frame's children on every soft navigation on the list page. */
	const FRAME_SELECTOR = "turbo-frame#repo-content-turbo-frame";
	/**
	* Runs an action with a busy toast, turning whatever comes back into one sentence.
	*
	* The bridge's errors are passed through rather than rewritten. Git's own messages say
	* what went wrong better than anything this layer could reconstruct from them.
	*/
	async function withProgress(deps, button, busy, run, done) {
		button.dataset["busy"] = "true";
		const dismiss = toast(deps.doc, busy, "busy");
		try {
			const result = await run();
			dismiss();
			const { skew } = await deps.agent();
			toast(deps.doc, skew ? `${done(result)} ${skew}` : done(result), "ok");
		} catch (error) {
			dismiss();
			toast(deps.doc, error instanceof Error ? error.message : String(error), "error");
		} finally {
			delete button.dataset["busy"];
		}
	}
	async function onWorktree(deps, button, pr) {
		if (!await ensureMapped(deps.doc, deps.bridge, pr)) return;
		await withProgress(deps, button, `Checking out #${pr.number}…`, () => deps.bridge("pr-worktree", pr), (result) => {
			const checkout = result.reused ? `#${pr.number} was already checked out at ${result.path}.` : `#${pr.number} checked out on ${result.branch} at ${result.path}.`;
			return result.agentNote ? `${checkout} ${result.agentNote}` : checkout;
		});
	}
	async function onSession(deps, button, pr) {
		if (!await ensureMapped(deps.doc, deps.bridge, pr)) return;
		await withProgress(deps, button, `Starting a session for #${pr.number}…`, () => deps.bridge("pr-session", pr), (result) => `Asked about #${pr.number} in ${result.cwd}.`);
	}
	/**
	* The menu items, built when the menu opens rather than when the row renders.
	*
	* The agent's name comes from the bridge, and asking for it starts the native host. Doing
	* that for every row of a list nobody has clicked would mean browsing pull requests spawns
	* a process, so the label is resolved on open and remembered for the rest of the page.
	*/
	function attach(deps, host, size, pr) {
		if (host.querySelector(`[${MARK}]`)) return;
		const button = createButton(deps.doc, "Open this pull request in an agent");
		button.setAttribute(MARK, "");
		if (size === "medium") button.dataset["size"] = "medium";
		let close = null;
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (close) {
				close();
				close = null;
				return;
			}
			const target = pr();
			if (!target) return;
			(async () => {
				const agent = await deps.agent();
				close = openMenu(deps.doc, button, [{
					label: `Open in ${agent.label}`,
					note: "Checks the branch out as a worktree",
					icon: agent.kind,
					onSelect: () => void onWorktree(deps, button, target)
				}, {
					label: `Ask ${agent.label} about this PR`,
					note: "Uses the checkout you already have",
					icon: agent.kind,
					onSelect: () => void onSession(deps, button, target)
				}]);
			})();
		});
		host.append(button);
	}
	/** The trailing slot on a list row, per list shape, falling back to the row itself. */
	function rowHost(row) {
		for (const selector of ROW_HOST_SELECTORS) {
			const host = row.querySelector(selector);
			if (host) return host;
		}
		return row;
	}
	/**
	* The Primer actions slot on the detail header.
	*
	* Signed out it is empty and carries `d-none`, which has to come off or the button is
	* invisible. Signed in it holds Edit and Code, so appending has to tolerate siblings.
	*/
	function detailHost(doc) {
		const header = doc.querySelector(HEADER_SELECTOR);
		if (!header) return null;
		const actions = header.querySelector("[data-component=\"PH_Actions\"]");
		if (actions) {
			actions.classList.remove("d-none");
			return actions;
		}
		return header.querySelector("[data-component=\"TitleArea\"]");
	}
	function inject(deps) {
		const url = deps.doc.defaultView?.location.href ?? "";
		const surface = surfaceOf(url);
		if (!surface) return;
		const repo = repoFromUrl(url);
		if (!repo) return;
		ensureStyle(deps.doc);
		if (surface === "list") {
			for (const row of deps.doc.querySelectorAll(ROW_SELECTOR)) attach(deps, rowHost(row), "small", () => {
				const read = readRow(row);
				return read ? {
					...repo,
					...read
				} : null;
			});
			return;
		}
		const host = detailHost(deps.doc);
		if (host) attach(deps, host, "medium", () => readDetail(deps.doc, deps.doc.defaultView?.location.href ?? url));
	}
	/**
	* Re-injects when GitHub swaps the page under us.
	*
	* The runtime already tears modules down and restarts them on a URL change, which covers
	* filters and pagination. This covers what it cannot see: a Turbo frame replacing its
	* children at the same URL, and the React detail header mounting after the frame arrives.
	*/
	function watch(deps) {
		const target = deps.doc.querySelector(FRAME_SELECTOR) ?? deps.doc.body;
		if (!target) return () => {};
		let queued = false;
		const observer = new MutationObserver(() => {
			if (queued) return;
			queued = true;
			setTimeout(() => {
				queued = false;
				inject(deps);
			}, 0);
		});
		observer.observe(target, {
			childList: true,
			subtree: true
		});
		return () => observer.disconnect();
	}
	const githubPrAgent = defineSiteModule({
		id: "github-pr-agent",
		label: "Open pull requests in an agent",
		description: "Adds a menu to every pull request that checks its branch out as a worktree and opens it in your coding agent, or starts a session to ask about it without checking anything out.",
		matches: ["https://github.com/*"],
		config: {},
		setup(context) {
			const doc = document;
			let agent = null;
			const deps = {
				doc,
				bridge: context.bridge,
				agent: async () => {
					agent ??= context.bridge("health").then((result) => ({
						label: result.agent,
						kind: result.kind,
						skew: result.version === context.extensionVersion ? null : `Bridge is ${result.version}, add-on is ${context.extensionVersion}.`
					}), () => ({
						label: "agent",
						kind: "generic",
						skew: null
					}));
					return await agent;
				}
			};
			inject(deps);
			const stopWatching = watch(deps);
			context.onCleanup(() => {
				stopWatching();
				for (const button of doc.querySelectorAll(`[${MARK}]`)) button.remove();
				for (const node of doc.querySelectorAll(".bt-pr-menu, .bt-pr-toast, .bt-pr-backdrop")) node.remove();
			});
		}
	});
	//#endregion
	//#region node_modules/.pnpm/@webext-core+match-patterns@2.0.0/node_modules/@webext-core/match-patterns/dist/index.mjs
	/**
	* Class for parsing and performing operations on match patterns.
	*
	* @example
	*   const pattern = new MatchPattern('*://google.com/*');
	*
	*   pattern.includes('https://google.com'); // true
	*   pattern.includes('http://youtube.com/watch?v=123'); // false
	*/
	var MatchPattern = class MatchPattern {
		static {
			this.PROTOCOLS = [
				"http",
				"https",
				"file",
				"ftp",
				"urn",
				"ws",
				"wss"
			];
		}
		/**
		* Parse a match pattern string. If it is invalid, the constructor will throw an
		* `InvalidMatchPattern` error.
		*
		* @param matchPattern The match pattern to parse.
		*/
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [...MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		/** Check if a URL is included in a pattern. */
		includes(url) {
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			if (this.isAllUrls) return !this.isUnknownProtocol(u);
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isUnknownProtocol(url) {
			return !this.protocolMatches.includes(url.protocol.slice(0, -1));
		}
		isPathMatch(url) {
			if (!this.pathnameMatch) return false;
			return this.convertPatternToRegex(this.pathnameMatch).test(url.pathname);
		}
		isFileMatch(url) {
			return url.protocol === "file:" && this.isPathMatch(url);
		}
		isFtpMatch(_url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(_url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	//#endregion
	//#region packages/site-modules/src/runtime.ts
	/**
	* Runs modules on a page and keeps them running across soft navigation.
	*
	* Two bugs get rediscovered in every module written without this, so they are solved once
	* here: the script running twice on the same page, and the script doing nothing after the
	* site swaps the document under it without a real page load.
	*
	* Detecting that second one from a content script is awkward. Patching `history.pushState`
	* does not work, because the isolated world has its own wrapper and the page's calls go
	* through its own. What does cross the boundary is DOM events, so this listens for the
	* ones sites actually fire and keeps a slow poll as the backstop.
	*/
	const POLL_MS = 400;
	function matchesUrl(module, url) {
		return module.matches.some((pattern) => {
			try {
				return new MatchPattern(pattern).includes(url);
			} catch {
				return false;
			}
		});
	}
	/** Calls `onChange` whenever the URL changes without a full document load. */
	function onUrlChange(onChange) {
		let last = location.href;
		const check = () => {
			if (location.href === last) return;
			last = location.href;
			onChange(last);
		};
		const events = [
			"turbo:load",
			"turbo:render",
			"pjax:end",
			"popstate",
			"hashchange"
		];
		for (const name of events) globalThis.addEventListener(name, check, true);
		const timer = setInterval(check, POLL_MS);
		return () => {
			for (const name of events) globalThis.removeEventListener(name, check, true);
			clearInterval(timer);
		};
	}
	/**
	* Activates every enabled module that matches the current URL, and re-activates them when
	* the URL changes. Returns a teardown for the whole set.
	*/
	function runModules(modules, isEnabled, capabilities) {
		const live = /* @__PURE__ */ new Map();
		const stop = (id) => {
			const activation = live.get(id);
			if (!activation) return;
			activation.active = false;
			for (const cleanup of activation.cleanups.toReversed()) try {
				cleanup();
			} catch (error) {
				console.error(`[browser-tweaks] cleanup failed for "${id}"`, error);
			}
			live.delete(id);
		};
		const start = (module) => {
			const activation = {
				cleanups: [],
				active: true
			};
			live.set(module.id, activation);
			(async () => {
				let config;
				try {
					config = await capabilities.readConfig(module);
				} catch (error) {
					console.error(`[browser-tweaks] could not read config for "${module.id}"`, error);
					return;
				}
				if (!activation.active) return;
				try {
					await module.setup({
						config,
						onCleanup: (fn) => activation.cleanups.push(fn),
						get active() {
							return activation.active;
						},
						storage: capabilities.storageFor(module.id),
						bridge: capabilities.bridge,
						loadHidden: capabilities.loadHidden,
						extensionVersion: capabilities.extensionVersion
					});
				} catch (error) {
					console.error(`[browser-tweaks] "${module.id}" failed`, error);
				}
			})();
		};
		const sync = () => {
			for (const module of modules) {
				const wanted = isEnabled(module.id) && matchesUrl(module, location.href);
				const running = live.has(module.id);
				if (wanted && !running) start(module);
				else if (!wanted && running) stop(module.id);
			}
		};
		const stopWatching = onUrlChange(() => {
			const running = [...live.keys()];
			for (const id of running) stop(id);
			sync();
		});
		sync();
		return () => {
			stopWatching();
			const running = [...live.keys()];
			for (const id of running) stop(id);
		};
	}
	//#endregion
	//#region packages/site-modules/src/schema.ts
	/**
	* Stored values come from `storage.sync`, which means they were written by an older build
	* of this module and can be any shape at all. Anything that does not match the declared
	* kind falls back to the default rather than reaching the module.
	*/
	function coerce(schema, stored) {
		const source = typeof stored === "object" && stored !== null ? stored : {};
		const out = {};
		for (const [key, field] of Object.entries(schema)) {
			const value = source[key];
			switch (field.kind) {
				case "boolean":
					out[key] = typeof value === "boolean" ? value : field.default;
					break;
				case "string":
					out[key] = typeof value === "string" ? value : field.default;
					break;
				case "number":
					out[key] = typeof value === "number" && Number.isFinite(value) ? value : field.default;
					break;
				case "string-list": out[key] = Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [...field.default];
			}
		}
		return out;
	}
	//#endregion
	//#region packages/site-modules/src/tweak/messages.ts
	const TWEAK_CHANNEL = "browser-tweaks/tweak";
	//#endregion
	//#region packages/site-modules/src/tweak/client.ts
	/**
	* The messaging half of the extension API, which is all a user script world has.
	*
	* Firefox names it `browser`, Chromium `chrome`. Both return a promise when given no
	* callback.
	*/
	function runtime() {
		const scope = globalThis;
		const found = scope.browser?.runtime ?? scope.chrome?.runtime;
		if (typeof found?.sendMessage !== "function") throw new Error("This tweak cannot reach the extension: its world was not configured for messaging.");
		return found;
	}
	async function call(request) {
		const answer = await runtime().sendMessage({
			channel: TWEAK_CHANNEL,
			...request
		});
		if (!answer) throw new Error("The extension did not answer. It may have been updated or switched off; reload the page.");
		if (!answer.ok) throw new Error(answer.error);
		return answer.value;
	}
	function storageFor(id) {
		return {
			get: async (key, fallback) => await call({
				op: "cache-get",
				id,
				key
			}) ?? fallback,
			set: async (key, value) => {
				await call({
					op: "cache-set",
					id,
					key,
					value
				});
			},
			remove: async (key) => {
				await call({
					op: "cache-remove",
					id,
					key
				});
			}
		};
	}
	async function loadHidden(url) {
		const { handle } = await call({
			op: "load-hidden",
			url
		});
		return {
			reveal: async () => {
				await call({
					op: "reveal-hidden",
					handle
				});
			},
			close: async () => {
				await call({
					op: "close-hidden",
					handle
				});
			}
		};
	}
	function capabilitiesFor(extensionVersion) {
		return {
			bridge: async (type, body) => await call({
				op: "bridge",
				type,
				body
			}),
			loadHidden,
			extensionVersion,
			readConfig: async (module) => coerce(module.config, await call({
				op: "config",
				id: module.id
			})),
			storageFor
		};
	}
	/** A module directory's exports, whatever it named its module. */
	function pickModule(exports) {
		const found = Object.values(exports).find((value) => typeof value === "object" && value !== null && typeof value.id === "string" && typeof value.setup === "function");
		if (!found) throw new Error("This module directory exports no site module.");
		return found;
	}
	function running() {
		const scope = globalThis;
		scope.__browserTweaks ??= {};
		return scope.__browserTweaks;
	}
	/**
	* Runs a module on this page, replacing any copy of it that is already running.
	*
	* Enablement is not checked here: the extension only registers a tweak while its module is
	* on, so being run at all is the answer.
	*/
	function runTweak(module) {
		(async () => {
			let version = "0.0.0";
			try {
				version = await call({ op: "version" });
			} catch (error) {
				console.error(`[browser-tweaks] "${module.id}" cannot reach the extension`, error);
				return;
			}
			const registry = running();
			registry[module.id]?.();
			registry[module.id] = runModules([module], () => true, capabilitiesFor(version));
		})();
	}
	//#endregion
	//#region \0user:github-pr-agent
	runTweak(pickModule(github_pr_agent_exports));
	//#endregion
})();
