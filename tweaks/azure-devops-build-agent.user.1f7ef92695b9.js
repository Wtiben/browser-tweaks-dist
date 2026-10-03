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
	const STYLE_ID = `${PREFIX}-style`;
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
	//#region packages/site-modules/src/modules/azure-devops-build-agent/page.ts
	function runFromUrl(url) {
		let parsed;
		try {
			parsed = new URL(url);
		} catch {
			return null;
		}
		if (parsed.hostname !== "dev.azure.com") return null;
		const match = /^\/([^/]+)\/([^/]+)\/_build\/results\/?$/.exec(parsed.pathname);
		const buildId = Number(parsed.searchParams.get("buildId"));
		if (!match || !Number.isInteger(buildId) || buildId <= 0) return null;
		return {
			organization: match[1],
			project: match[2],
			buildId,
			jobId: parsed.searchParams.get("j"),
			taskId: parsed.searchParams.get("t")
		};
	}
	function apiBase(run) {
		return `https://dev.azure.com/${run.organization}/${run.project}/_apis/build/builds/${run.buildId}`;
	}
	const failed = (record) => record.result === "failed";
	/**
	* The steps worth an agent's attention, in timeline order.
	*
	* Failed tasks, because a task is where the log with the error is. A job counts only when
	* none of its tasks failed, which is what a timeout or a lost agent looks like: the job is
	* the only record that knows. Stages and phases never count on their own, they fail
	* because something inside them did.
	*
	* `selected` marks the step the logs view has open, so the agent can start there.
	*/
	function failuresFrom(timeline, run) {
		const records = timeline.records ?? [];
		const byId = new Map(records.map((record) => [record.id, record]));
		const jobsWithFailedTask = new Set(records.filter((record) => record.type === "Task" && failed(record)).map((record) => record.parentId));
		const picked = records.filter((record) => failed(record) && (record.type === "Task" || record.type === "Job" && !jobsWithFailedTask.has(record.id)));
		let marked = false;
		return picked.map((record) => {
			const isOpen = run.taskId ? record.id === run.taskId : record.id === run.jobId || record.parentId === run.jobId;
			const selected = !marked && Boolean(run.taskId ?? run.jobId) && isOpen;
			if (selected) marked = true;
			return {
				path: pathOf(record, byId),
				type: record.type ?? "Task",
				logId: record.log?.id ?? null,
				errors: (record.issues ?? []).filter((issue) => issue.type === "error" && issue.message).map((issue) => issue.message),
				logTail: null,
				selected
			};
		});
	}
	/**
	* Stage, job and task, top down.
	*
	* Phases are left out: a phase is the YAML's `jobs:` block and almost always carries the
	* same name as its only job, so including it reads as a stutter.
	*/
	function pathOf(record, byId) {
		const names = [];
		const seen = /* @__PURE__ */ new Set();
		let current = record;
		while (current && !seen.has(current.id)) {
			seen.add(current.id);
			if (current.type !== "Phase" && current.name) names.unshift(current.name);
			current = current.parentId ? byId.get(current.parentId) : void 0;
		}
		return names;
	}
	/**
	* Where the code that was built is mapped, in the same terms the GitHub modules use.
	*
	* A GitHub repository is keyed exactly as its pull request pages are, so a checkout mapped
	* there is found here without asking again. An Azure Repos one has the organisation and
	* project as its owner, which is how its remote URL spells it. Anything else has no
	* checkout this can find.
	*/
	function repositoryOf(build, organization) {
		const repository = build.repository;
		if (repository?.type === "GitHub" && repository.id) {
			const [owner, repo] = repository.id.split("/");
			return owner && repo ? {
				host: "github.com",
				owner,
				repo
			} : null;
		}
		if (repository?.type === "TfsGit" && repository.name && build.project?.name) return {
			host: "dev.azure.com",
			owner: `${organization}/${build.project.name}`,
			repo: repository.name
		};
		return null;
	}
	function buildRefFrom(url, run, build, timeline) {
		const trigger = build.triggerInfo ?? {};
		const prNumber = Number(trigger["pr.number"]);
		return {
			url,
			organization: run.organization,
			project: build.project?.name ?? decodeURIComponent(run.project),
			buildId: run.buildId,
			buildNumber: build.buildNumber ?? String(run.buildId),
			pipeline: build.definition?.name ?? "Pipeline",
			result: build.result ?? null,
			status: build.status ?? "unknown",
			repository: repositoryOf(build, run.organization),
			sourceBranch: build.sourceBranch ?? null,
			sourceVersion: build.sourceVersion ?? null,
			pullRequest: Number.isInteger(prNumber) && prNumber > 0 ? {
				number: prNumber,
				title: trigger["pr.title"] ?? null
			} : null,
			failures: failuresFrom(timeline, run)
		};
	}
	const TAIL_CHARS = 2e4;
	/**
	* The end of a log, which is where the error is.
	*
	* Azure DevOps prefixes every line with an ISO timestamp, which is a quarter of each line
	* and says nothing the agent needs. It goes.
	*/
	function tailOf(log, lines = 150, chars = TAIL_CHARS) {
		const kept = log.replace(/\r\n/g, "\n").trimEnd().split("\n").slice(-lines).map((line) => line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, "")).join("\n");
		return kept.length <= chars ? kept : kept.slice(-chars);
	}
	/**
	* Where the button goes, in order of preference.
	*
	* The logs view's header first, since that is where someone reading a failure is looking;
	* the run summary's otherwise, beside "Rerun failed jobs". Both are Bolt command bars, and
	* a button carrying Bolt's own classes inside one looks native in either theme.
	*/
	const HOST_SELECTORS = [".log-header .bolt-header-commandbar-button-group", ".run-view-header .bolt-header-commandbar-button-group"];
	function hostIn(doc) {
		for (const selector of HOST_SELECTORS) {
			const host = doc.querySelector(selector);
			if (host) return host;
		}
		return null;
	}
	//#endregion
	//#region packages/site-modules/src/modules/azure-devops-build-agent/index.ts
	/**
	* A button on a failed Azure DevOps pipeline run that asks the coding agent why it failed.
	*
	* The page does the reading, because it is the only side holding the user's Azure DevOps
	* session: the run, its timeline and, on the click, the end of every failed step's log, all
	* from the REST API the page itself uses. The bridge writes that to a file and starts an
	* agent in the checkout of the repository that was built, pointed at the file and told the
	* Azure DevOps MCP is there for anything else.
	*/
	var azure_devops_build_agent_exports = /* @__PURE__ */ __exportAll({ azureDevopsBuildAgent: () => azureDevopsBuildAgent });
	const MARK = "data-bt-build-agent";
	/** Remembered so the button can name the agent without starting the native host to ask. */
	const LABEL_KEY = "agent-label";
	/** More failed steps than this is a broken pipeline rather than a bug, and five logs say so. */
	const MAX_LOGS = 5;
	async function get(url, accept) {
		const response = await fetch(url, {
			credentials: "include",
			headers: {
				accept,
				"X-TFS-FedAuthRedirect": "Suppress"
			}
		});
		if (!response.ok) throw new Error(`Azure DevOps answered ${response.status} for ${url}`);
		return response;
	}
	async function getJson(url) {
		return await (await get(url, "application/json")).json();
	}
	/**
	* A finished run, per document.
	*
	* Every task clicked in the logs view is a navigation, and the runtime sets this module up
	* again for each one. A finished run cannot change, so it is fetched once. A running one is
	* fetched again every time, since that is how a failure that has only just happened shows up.
	*/
	let finished = null;
	async function load(run) {
		if (finished?.buildId === run.buildId) return await finished.loaded;
		const base = apiBase(run);
		const loading = Promise.all([getJson(`${base}?api-version=7.1`), getJson(`${base}/timeline?api-version=7.1`)]).then(([build, timeline]) => ({
			build,
			timeline
		}));
		const loaded = await loading;
		if (loaded.build.status === "completed") finished = {
			buildId: run.buildId,
			loaded: loading
		};
		return loaded;
	}
	/** The end of each failed step's log, fetched on the click rather than on every page view. */
	async function withTails(run, failures) {
		const base = apiBase(run);
		return await Promise.all(failures.map(async (failure, index) => {
			if (failure.logId === null || index >= MAX_LOGS) return failure;
			try {
				const log = await (await get(`${base}/logs/${failure.logId}?api-version=7.1`, "text/plain")).text();
				return {
					...failure,
					logTail: tailOf(log)
				};
			} catch {
				return failure;
			}
		}));
	}
	function buttonText(label) {
		return label ? `Investigate with ${label}` : "Investigate failure";
	}
	async function investigate(context, loaded, buttons) {
		const run = runFromUrl(location.href);
		if (!run) return;
		let label = "agent";
		try {
			label = (await context.bridge("health")).agent;
			await context.storage.set(LABEL_KEY, label);
			for (const button of buttons()) {
				const text = button.querySelector("span");
				if (text) text.textContent = buttonText(label);
			}
		} catch {}
		const build = buildRefFrom(location.href, run, loaded.build, loaded.timeline);
		if (!build.repository) {
			toast(document, `${build.pipeline} builds a repository that cannot be mapped to a checkout.`, "error");
			return;
		}
		if (!await ensureMapped(document, context.bridge, build.repository)) return;
		const dismiss = toast(document, `Reading the failed logs and starting ${label}…`, "busy");
		try {
			const result = await context.bridge("build-investigate", {
				...build,
				failures: await withTails(run, build.failures)
			});
			dismiss();
			toast(document, `${label} is looking into ${build.pipeline} #${build.buildId} in ${result.cwd}.`, "ok");
		} catch (error) {
			dismiss();
			toast(document, error instanceof Error ? error.message : String(error), "error");
		}
	}
	const azureDevopsBuildAgent = defineSiteModule({
		id: "azure-devops-build-agent",
		label: "Investigate failed pipeline runs with an agent",
		description: "Adds a button to a failed Azure DevOps pipeline run that starts your coding agent in the checkout of the repository it built, hands it the failed steps and the end of their logs, and asks it to find out why.",
		matches: ["https://dev.azure.com/*"],
		config: {},
		async setup(context) {
			const run = runFromUrl(location.href);
			if (!run) return;
			let loaded;
			try {
				loaded = await load(run);
			} catch (error) {
				console.warn("[browser-tweaks] could not read the pipeline run", error);
				return;
			}
			if (!context.active) return;
			if (failuresFrom(loaded.timeline, run).length === 0) return;
			const remembered = await context.storage.get(LABEL_KEY, null);
			if (!context.active) return;
			ensureStyle(document);
			const buttons = () => [...document.querySelectorAll(`[${MARK}]`)];
			let busy = false;
			const inject = () => {
				const host = hostIn(document);
				if (!host || host.querySelector(`[${MARK}]`)) return;
				const sibling = host.querySelector("button.bolt-button:not(.icon-only):not(.primary)");
				const button = document.createElement("button");
				button.type = "button";
				button.className = sibling?.className ?? "bolt-header-command-item-button bolt-button enabled bolt-focus-treatment";
				button.setAttribute(MARK, "");
				button.setAttribute("role", "menuitem");
				const text = document.createElement("span");
				text.className = "bolt-button-text body-m";
				text.textContent = buttonText(remembered);
				button.append(text);
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (busy) return;
					busy = true;
					investigate(context, loaded, buttons).finally(() => {
						busy = false;
					});
				});
				host.prepend(button);
			};
			let queued = false;
			const observer = new MutationObserver(() => {
				if (queued) return;
				queued = true;
				setTimeout(() => {
					queued = false;
					if (context.active) inject();
				}, 0);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			inject();
			context.onCleanup(() => {
				observer.disconnect();
				for (const button of buttons()) button.remove();
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
	//#region \0user:azure-devops-build-agent
	runTweak(pickModule(azure_devops_build_agent_exports));
	//#endregion
})();
