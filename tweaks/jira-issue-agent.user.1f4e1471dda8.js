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
	//#region packages/site-modules/src/modules/github-pr-agent/ui.ts
	const PREFIX = "bt-pr";
	const STYLE_ID$1 = `${PREFIX}-style`;
	const CSS$1 = `
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
		if (doc.getElementById(STYLE_ID$1)) return;
		const style = doc.createElement("style");
		style.id = STYLE_ID$1;
		style.textContent = CSS$1;
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
			if (item.separated) button.dataset["separated"] = "true";
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
	* Runs an action with a busy toast, turning whatever comes back into one sentence.
	*
	* The bridge's errors are passed through rather than rewritten. Git's own messages say
	* what went wrong better than anything this layer could reconstruct from them.
	*/
	async function withProgress(doc, button, busy, run, done) {
		button.dataset["busy"] = "true";
		const dismiss = toast(doc, busy, "busy");
		try {
			const result = await run();
			dismiss();
			toast(doc, done(result), "ok");
		} catch (error) {
			dismiss();
			toast(doc, error instanceof Error ? error.message : String(error), "error");
		} finally {
			delete button.dataset["busy"];
		}
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
	//#region packages/site-modules/src/modules/jira-issue-agent/page.ts
	/** Where an issue's summary is, on the full issue view. Atlassian's own test hook. */
	const SUMMARY_SELECTOR = "[data-testid=\"issue.views.issue-base.foundation.summary.heading\"]";
	/**
	* The quick-add row under the summary: Jira's own "+", apps and summarise buttons, which is
	* where actions on the issue live. Apps first, so the button goes at the end of the group;
	* the "+" alone when a site has no apps installed.
	*
	* Not the summary heading itself, which looks closer and is wrong: it sits inside the
	* inline-edit form, React re-renders that on every hover, and a button put there was gone
	* again before the page could be captured.
	*/
	const QUICK_ADD_SELECTORS = ["[data-testid=\"issue-view-foundation.quick-add.quick-add-items-compact.apps-button-dropdown--trigger\"]", "[data-testid=\"issue-view-foundation.quick-add.quick-add-items-compact.add-button-dropdown--trigger\"]"];
	/** Where the button goes: after the trigger's wrapper, inside the row it shares with the others. */
	function findHost(doc) {
		for (const selector of QUICK_ADD_SELECTORS) {
			const trigger = doc.querySelector(selector);
			const wrapper = trigger?.closest("[role=\"presentation\"]") ?? trigger;
			if (wrapper?.parentElement) return {
				parent: wrapper.parentElement,
				before: wrapper.nextElementSibling
			};
		}
		return null;
	}
	const KEY = /^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/;
	/**
	* The issue a URL shows: `/browse/FIN-8712`, or a board or search with the issue open
	* beside it, which says so in `selectedIssue`.
	*/
	function issueKeyFromUrl(url) {
		let parsed;
		try {
			parsed = new URL(url);
		} catch {
			return null;
		}
		const candidate = /^\/browse\/([^/]+)\/?$/.exec(parsed.pathname)?.[1] ?? parsed.searchParams.get("selectedIssue");
		return candidate && KEY.test(candidate) ? candidate : null;
	}
	function projectOf(key) {
		return key.slice(0, key.lastIndexOf("-"));
	}
	/**
	* The summary, from the heading when it has rendered and from the tab title otherwise.
	*
	* Jira titles an issue tab `[FIN-8712] Summary - Jira`, which is there from the first byte
	* and survives a redesign of the view; the heading is preferred only because a title is
	* cut short by nothing but the browser and could in principle say something else.
	*/
	function readSummary(doc, key) {
		const heading = doc.querySelector(SUMMARY_SELECTOR)?.textContent?.trim();
		if (heading) return heading;
		const title = doc.title.trim();
		const prefix = `[${key}]`;
		if (!title.startsWith(prefix)) return "";
		return title.slice(prefix.length).replace(/\s+-\s+Jira$/, "").trim();
	}
	/**
	* The module's `projects` setting, one `KEY=owner/repo@base` per line.
	*
	* `@base` is optional, and so is a host in front of the owner (`github.example.com/team/x`)
	* for an Enterprise install. A line that does not parse is skipped rather than failing the
	* whole list: one typo should not take every other project's menu with it.
	*/
	function parseProjects(lines) {
		const out = /* @__PURE__ */ new Map();
		for (const line of lines) {
			const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(?:([^/\s@]+\.[^/\s@]+)\/)?([^/\s@]+)\/([^/\s@]+)(?:@(\S+))?\s*$/.exec(line);
			if (!match?.[1] || !match[3] || !match[4]) continue;
			out.set(match[1], {
				host: match[2] ?? "github.com",
				owner: match[3],
				repo: match[4],
				base: match[5] ?? null
			});
		}
		return out;
	}
	/** Everything the bridge needs about the issue on this page, or null when there is none. */
	function readIssue(doc, url, projects) {
		const key = issueKeyFromUrl(url);
		if (!key) return null;
		const project = projects.get(projectOf(key));
		if (!project) return null;
		const origin = new URL(url).origin;
		return {
			...project,
			key,
			summary: readSummary(doc, key),
			url: `${origin}/browse/${key}`
		};
	}
	//#endregion
	//#region packages/site-modules/src/modules/jira-issue-agent/index.ts
	var jira_issue_agent_exports = /* @__PURE__ */ __exportAll({ jiraIssueAgent: () => jiraIssueAgent });
	const MARK = "data-bt-issue-menu";
	const STYLE_ID = "bt-jira-style";
	/** Remembered so the button can name the agent without starting the native host to ask. */
	const AGENT_KEY = "agent";
	/** More than this and the menu is a list to scroll; the rest are a `git branch` away. */
	const MAX_BRANCHES = 6;
	const CONFIG = { projects: {
		kind: "string-list",
		label: "Repositories",
		description: "One line per Jira project: KEY=owner/repo@base. Base is the branch new work starts from, and is optional: without it, the repository's default branch.",
		default: ["FIN=innovadis-dev/Fincent@development"],
		placeholder: "FIN=innovadis-dev/Fincent@development"
	} };
	/**
	* Jira's own look, from the Atlassian Design System's CSS variables.
	*
	* The tokens are the stable surface: they are what Jira's own components are themed with,
	* so light and dark follow without a line here knowing which is on. The menu, toast and
	* dialog are the shared ones from the pull request menu, re-skinned: this sheet goes in
	* after theirs, so the same selectors win, and GitHub's variables are not defined here
	* anyway.
	*/
	const CSS = `
.bt-jira-button {
  display: inline-flex; align-items: center; gap: 6px; flex: none;
  height: 32px; padding: 0 10px; margin: 0 4px;
  border: 0; border-radius: var(--ds-border-radius, 3px);
  background: var(--ds-background-neutral, #091e420f); color: var(--ds-text, #172b4d);
  font: var(--ds-font-body, 400 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-weight: var(--ds-font-weight-medium, 500);
  cursor: pointer; white-space: nowrap; vertical-align: middle;
}
.bt-jira-button:hover { background: var(--ds-background-neutral-hovered, #091e4224); }
.bt-jira-button:active, .bt-jira-button[aria-expanded="true"] {
  background: var(--ds-background-selected, #e9f2ff); color: var(--ds-text-selected, #0c66e4);
}
.bt-jira-button:focus-visible { outline: 2px solid var(--ds-border-focused, #388bff); outline-offset: 2px; }
.bt-jira-button[data-busy="true"] { cursor: progress; }
.bt-jira-button[data-busy="true"] svg:first-child { animation: bt-jira-spin 1s linear infinite; }
@keyframes bt-jira-spin { to { transform: rotate(360deg); } }

html .bt-pr-menu {
  min-width: 300px; max-width: 420px; padding: 6px 0;
  border: 0; border-radius: var(--ds-border-radius-100, 4px);
  background: var(--ds-surface-overlay, #fff); color: var(--ds-text, #172b4d);
  box-shadow: var(--ds-shadow-overlay, 0 8px 12px #091e4226, 0 0 1px #091e424f);
  font: var(--ds-font-body, 400 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
html .bt-pr-item { border-radius: 0; padding: 8px 16px; }
html .bt-pr-item + .bt-pr-item { margin-top: 0; }
html .bt-pr-item:hover:not(:disabled) { background: var(--ds-background-neutral-subtle-hovered, #091e420f); }
html .bt-pr-item:active:not(:disabled) { background: var(--ds-background-neutral-subtle-pressed, #091e4224); }
html .bt-pr-icon, html .bt-pr-item-note { color: var(--ds-text-subtlest, #626f86); }
html .bt-pr-item-note { font-size: 12px; line-height: 16px; overflow-wrap: anywhere; }
html .bt-pr-item[data-separated] { border-top: 1px solid var(--ds-border, #091e4224); margin-top: 6px; padding-top: 12px; }

html .bt-pr-toast {
  border: 0; border-radius: var(--ds-border-radius-100, 4px);
  background: var(--ds-surface-overlay, #fff); color: var(--ds-text, #172b4d);
  box-shadow: var(--ds-shadow-overlay, 0 8px 12px #091e4226, 0 0 1px #091e424f);
  border-left: 4px solid var(--ds-border-information, #1d7afc);
  font: var(--ds-font-body, 400 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
html .bt-pr-toast[data-kind="ok"] { border-left-color: var(--ds-border-success, #22a06b); }
html .bt-pr-toast[data-kind="error"] { border-left-color: var(--ds-border-danger, #e2483d); }

html .bt-pr-backdrop { background: var(--ds-blanket, #091e427d); }
html .bt-pr-dialog {
  border: 0; border-radius: var(--ds-border-radius-200, 8px); padding: 24px;
  background: var(--ds-surface-overlay, #fff); color: var(--ds-text, #172b4d);
  box-shadow: var(--ds-shadow-overlay, 0 8px 12px #091e4226, 0 0 1px #091e424f);
  font: var(--ds-font-body, 400 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
html .bt-pr-dialog h2 { font-size: 20px; line-height: 24px; font-weight: var(--ds-font-weight-medium, 500); }
html .bt-pr-dialog p { color: var(--ds-text-subtle, #44546f); }
html .bt-pr-dialog input {
  border: 2px solid var(--ds-border-input, #8590a2); border-radius: var(--ds-border-radius, 3px);
  background: var(--ds-background-input, #fff); padding: 6px 8px;
}
html .bt-pr-dialog input:focus { border-color: var(--ds-border-focused, #388bff); outline: none; }
html .bt-pr-dialog button {
  border: 0; border-radius: var(--ds-border-radius, 3px); padding: 6px 12px;
  background: var(--ds-background-neutral-subtle, transparent); color: var(--ds-text-subtle, #44546f);
  font-weight: var(--ds-font-weight-medium, 500);
}
html .bt-pr-dialog button[data-primary] {
  background: var(--ds-background-brand-bold, #0c66e4); color: var(--ds-text-inverse, #fff); border: 0;
}
html .bt-pr-dialog-error { color: var(--ds-text-danger, #ae2e24); }
`;
	/** A terminal prompt, for "this opens something in your agent" without naming a vendor. */
	const GLYPH = "<svg aria-hidden=\"true\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"currentColor\"><path d=\"M2.2 3.5 6.7 8l-4.5 4.5-1-1L4.7 8 1.2 4.5Zm5.3 8h7v1.5h-7Z\"></path></svg>";
	/** Atlassian's chevron-down, which is what every Jira dropdown trigger ends in. */
	const CHEVRON = "<svg aria-hidden=\"true\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"currentColor\"><path d=\"M4.3 6.3a1 1 0 0 1 1.4 0L8 8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0l-3-3a1 1 0 0 1 0-1.4Z\"></path></svg>";
	function ensureJiraStyle(doc) {
		ensureStyle(doc);
		if (doc.getElementById(STYLE_ID)) return;
		const style = doc.createElement("style");
		style.id = STYLE_ID;
		style.textContent = CSS;
		(doc.head ?? doc.documentElement).append(style);
	}
	function createButton(doc, label) {
		const button = doc.createElement("button");
		button.type = "button";
		button.className = "bt-jira-button";
		button.setAttribute(MARK, "");
		button.setAttribute("aria-haspopup", "menu");
		button.setAttribute("aria-expanded", "false");
		button.title = "Open this issue in a coding agent";
		const text = doc.createElement("span");
		text.textContent = label;
		button.insertAdjacentHTML("afterbegin", GLYPH);
		button.append(text);
		button.insertAdjacentHTML("beforeend", CHEVRON);
		return button;
	}
	function describeBranch(branch) {
		if (branch.worktree) return `Already checked out at ${branch.worktree}`;
		if (branch.remoteOnly) return "On origin only: checks it out as a worktree, tracking it";
		return "Checks it out as a worktree";
	}
	async function onWorktree(deps, button, issue, branch) {
		await withProgress(deps.doc, button, branch ? `Checking out ${branch}…` : `Starting a branch for ${issue.key}…`, () => deps.bridge("issue-worktree", {
			...issue,
			branch
		}), (result) => {
			const checkout = result.reused ? `${result.branch} was already checked out at ${result.path}.` : result.created ? `Started ${result.branch} from ${issue.base ?? "the default branch"} at ${result.path}.` : `${result.branch} checked out at ${result.path}.`;
			return result.agentNote ? `${checkout} ${result.agentNote}` : checkout;
		});
	}
	async function onSession(deps, button, issue) {
		await withProgress(deps.doc, button, `Starting a session for ${issue.key}…`, () => deps.bridge("issue-session", issue), (result) => `Asked about ${issue.key} in ${result.cwd}.`);
	}
	/**
	* The items, from what the repository holds right now.
	*
	* Built on the click, not on render: listing branches starts the native host and runs git,
	* and doing that on every issue anyone glances at would make reading Jira spawn processes.
	*/
	function menuItems(deps, button, issue, agent, listed) {
		const items = listed.branches.slice(0, MAX_BRANCHES).map((branch) => ({
			label: branch.worktree ? `Open ${branch.name}` : `Check out ${branch.name}`,
			note: describeBranch(branch),
			icon: agent.kind,
			onSelect: () => void onWorktree(deps, button, issue, branch.name)
		}));
		if (!listed.branches.some((branch) => branch.name.toLowerCase() === listed.suggested.toLowerCase())) items.push({
			label: `Start ${listed.suggested}`,
			note: `New branch from ${issue.base ?? "the default branch"}, as a worktree with ${agent.label}`,
			icon: agent.kind,
			onSelect: () => void onWorktree(deps, button, issue, null)
		});
		items.push({
			label: `Ask ${agent.label} about ${issue.key}`,
			note: "Uses the checkout you already have",
			icon: agent.kind,
			separated: true,
			onSelect: () => void onSession(deps, button, issue)
		});
		return items;
	}
	function attach(deps) {
		if (deps.doc.querySelector(`[${MARK}]`)) return;
		const url = deps.doc.defaultView?.location.href ?? "";
		if (!readIssue(deps.doc, url, deps.projects)) return;
		const host = findHost(deps.doc);
		if (!host) return;
		ensureJiraStyle(deps.doc);
		const button = createButton(deps.doc, deps.remembered?.label ?? "Agent");
		let close = null;
		let opening = false;
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (close) {
				close();
				close = null;
				return;
			}
			if (opening) return;
			const issue = readIssue(deps.doc, deps.doc.defaultView?.location.href ?? url, deps.projects);
			if (!issue) return;
			opening = true;
			(async () => {
				try {
					if (!await ensureMapped(deps.doc, deps.bridge, issue)) return;
					const [agent, listed] = await Promise.all([deps.agent(), deps.bridge("issue-branches", issue)]);
					const label = button.querySelector("span");
					if (label) label.textContent = agent.label;
					close = openMenu(deps.doc, button, menuItems(deps, button, issue, agent, listed));
				} catch (error) {
					toast(deps.doc, error instanceof Error ? error.message : String(error), "error");
				} finally {
					opening = false;
				}
			})();
		});
		host.parent.insertBefore(button, host.before);
	}
	/**
	* Jira is one long-lived application: the issue view renders well after the document,
	* and moving between issues replaces it without a navigation the runtime would see.
	*/
	function watch(deps) {
		let queued = false;
		const observer = new MutationObserver(() => {
			if (queued) return;
			queued = true;
			setTimeout(() => {
				queued = false;
				attach(deps);
			}, 0);
		});
		observer.observe(deps.doc.body, {
			childList: true,
			subtree: true
		});
		return () => observer.disconnect();
	}
	const jiraIssueAgent = defineSiteModule({
		id: "jira-issue-agent",
		label: "Open Jira issues in an agent",
		description: "Adds a menu to a Jira issue that checks out one of the issue's branches as a worktree, or starts a new one, and opens it in your coding agent. It can also start a session to ask about the issue without checking anything out.",
		matches: ["https://*.atlassian.net/*"],
		config: CONFIG,
		async setup(context) {
			const doc = document;
			const remembered = await context.storage.get(AGENT_KEY, null);
			if (!context.active) return;
			let agent = null;
			const deps = {
				doc,
				bridge: context.bridge,
				projects: parseProjects(context.config.projects),
				remembered,
				agent: async () => {
					agent ??= context.bridge("health").then(async (result) => {
						const found = {
							label: result.agent,
							kind: result.kind
						};
						await context.storage.set(AGENT_KEY, found);
						return found;
					}, () => remembered ?? {
						label: "agent",
						kind: "generic"
					});
					return await agent;
				}
			};
			attach(deps);
			const stopWatching = watch(deps);
			context.onCleanup(() => {
				stopWatching();
				for (const node of doc.querySelectorAll(`[${MARK}], .bt-pr-menu, .bt-pr-toast, .bt-pr-backdrop`)) node.remove();
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
	//#region \0user:jira-issue-agent
	runTweak(pickModule(jira_issue_agent_exports));
	//#endregion
})();
