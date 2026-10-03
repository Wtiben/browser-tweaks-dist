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
	//#region packages/site-modules/src/modules/github-file-filter/patterns.ts
	/**
	* The decision-making half of the file filter: which paths count as generated, where the
	* count cache lives, and how to read a path out of GitHub's markup and payload.
	*
	* All pure, so it can be tested without a browser. That matters more here than usual: this
	* is the part that silently starts matching nothing when GitHub renames something.
	*/
	function globToRegExp(glob) {
		let out = "";
		for (let i = 0; i < glob.length; i++) {
			const char = glob[i];
			if (char !== "*") {
				out += (char ?? "").replace(/[.+?^${}()|[\]\\]/g, "\\$&");
				continue;
			}
			if (glob[i + 1] === "*") {
				i++;
				if (glob[i + 1] === "/") {
					i++;
					out += "(?:.*/)?";
				} else out += ".*";
			} else out += "[^/]*";
		}
		return new RegExp(`^${out}$`);
	}
	/** The label is the last meaningful segment, so `**‍/packages.lock.json` reads as itself. */
	function labelFor(pattern) {
		return pattern.split("/").filter((part) => part && part !== "**" && part !== "*").at(-1) ?? pattern;
	}
	function compile(patterns) {
		const compiled = [];
		for (const pattern of patterns) {
			const trimmed = pattern.trim();
			if (!trimmed) continue;
			try {
				const regex = globToRegExp(trimmed);
				compiled.push({
					pattern: trimmed,
					label: labelFor(trimmed),
					test: (path) => regex.test(path)
				});
			} catch {}
		}
		return compiled;
	}
	function patternFor(matchers, path) {
		return matchers.find((matcher) => matcher.test(path))?.pattern ?? null;
	}
	const onPullRequest = (pathname) => /^\/[^/]+\/[^/]+\/pull\/\d+/.test(pathname);
	const onPullRequestDiff = (pathname) => /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)\b/.test(pathname);
	/** Scoped to one PR. The recorded total doubles as the cache key, see `readCounts`. */
	function countCacheKey(pathname) {
		const match = pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)/);
		return match ? `generated-count:${match[1]}#${match[2]}` : null;
	}
	function parseCounts(value) {
		if (typeof value !== "object" || value === null) return null;
		const { total, generated } = value;
		return Number.isFinite(total) && Number.isFinite(generated) ? {
			total,
			generated
		} : null;
	}
	const LRM = String.fromCharCode(8206);
	/**
	* The first `<code>` in a diff entry is its header path. Later ones are the code lines of an
	* expanded diff, which is why a value containing a newline is rejected rather than used.
	*/
	function diffEntryPath(entry) {
		const code = entry.querySelector("code");
		if (!code) return null;
		const path = (code.textContent ?? "").replaceAll(LRM, "").trim();
		return path.includes("\n") ? null : path || null;
	}
	function findPathArray(value, depth) {
		if (!value || typeof value !== "object" || depth > 6) return null;
		if (Array.isArray(value)) {
			const first = value[0];
			return value.length && typeof first?.path === "string" ? value : null;
		}
		for (const inner of Object.values(value)) {
			const hit = findPathArray(inner, depth + 1);
			if (hit) return hit;
		}
		return null;
	}
	/**
	* Pulls the changed-file paths out of the diff page's embedded payload. The documented
	* shape is tried first and a search is the fallback, because this payload has moved before.
	*/
	function diffSummaryPaths(data) {
		const payload = data?.payload;
		const direct = (payload?.pullRequestsChangesRoute)?.diffSummaries;
		const list = Array.isArray(direct) ? direct : findPathArray(payload, 0);
		if (!Array.isArray(list)) return [];
		return list.map((entry) => entry?.path).filter((path) => typeof path === "string");
	}
	/**
	* The embedded payload sits in a ~2 MB document, and JSON cannot contain an unescaped
	* `<\/script>`, so it is sliced out rather than parsed with a DOM.
	*/
	function embeddedPayload(html) {
		const match = html.match(/<script[^>]+data-target="react-app\.embeddedData"[^>]*>([\s\S]*?)<\/script>/);
		if (!match?.[1]) return null;
		try {
			return JSON.parse(match[1]);
		} catch {
			return null;
		}
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-file-filter/index.ts
	/**
	* Hides generated files from a pull request diff.
	*
	* Central package management rewrites a packages.lock.json per project, so a small change
	* arrives as a wall of generated files. GitHub's own filter is a whitelist of extensions in
	* the `?file-filters[]` query parameter, so it can only offer "hide every .json", which
	* would take hand-written JSON with it. Matching on the path has to happen here.
	*
	* The two filters stay out of each other's way: GitHub unmounts the rows it excludes, while
	* this one only sets an attribute, so neither can undo the other. Counts are of rows
	* actually present, which is why they read 0 once GitHub has already removed the same files.
	*
	* Ported from the Tampermonkey userscript this repo grew out of, now only in git history.
	* Its own `turbo:load` handling and its
	* observer singleton are gone: the module runtime tears this down and sets it up again on
	* every soft navigation, which is also what makes a fresh diff start filtered.
	*/
	var github_file_filter_exports = /* @__PURE__ */ __exportAll({ githubFileFilter: () => githubFileFilter });
	const HIDDEN_ATTR = "data-bt-hidden";
	const GROUP_ATTR = "data-bt-group";
	const ITEM_ATTR = "data-bt-pattern";
	const ADJUSTED_ATTR = "data-bt-adjusted";
	const TOTAL_ATTR = "data-bt-total";
	const NOTICE_ID = "bt-generated-notice";
	const STYLE_ID = "bt-file-filter-css";
	const DIFF_LIST = "[data-testid=\"progressive-diffs-list\"]";
	const FILES_TAB_ID = "prs-files-anchor-tab";
	const githubFileFilter = defineSiteModule({
		id: "github-pr-file-filter",
		label: "Hide generated files in PR diffs",
		description: "Hides generated files from a pull request diff, adds a section to GitHub's own file filter menu, and corrects the Files changed tab count.",
		matches: ["https://github.com/*"],
		config: {
			generatedFiles: {
				kind: "string-list",
				label: "Generated file patterns",
				description: "One glob per line. ** spans directories, * stops at one. Files matching any of these are hidden from a PR diff.",
				default: ["**/packages.lock.json"],
				placeholder: "**/packages.lock.json"
			},
			sectionHeading: {
				kind: "string",
				label: "Menu section heading",
				description: "Heading of the section added to GitHub's own file filter menu.",
				default: "Generated files"
			},
			preloadCounts: {
				kind: "boolean",
				label: "Adjust the tab count before opening the diff",
				description: "Fetches the diff page in the background so the \"Files changed\" count is already corrected on the other tabs. That page is around 2 MB.",
				default: true
			}
		},
		setup(context) {
			if (!onPullRequest(location.pathname)) return;
			run(context);
		}
	});
	/**
	* Primer's class names are content-hashed and change between releases, so every node here
	* is cloned from the menu itself rather than hand-written. Only the data-component hooks
	* are relied on, which are part of its API.
	*/
	function filterMenu() {
		for (const menu of document.querySelectorAll("ul[role=\"menu\"]")) {
			const groups = [...menu.children].filter((child) => child.dataset["component"] === "ActionList.Group");
			if (!groups.some((group) => group.querySelector("[role=\"menuitemcheckbox\"]"))) continue;
			const template = groups.find((group) => group.querySelector("[data-component=\"GroupHeadingWrap\"]")) ?? groups[0];
			if (template) return {
				menu,
				template
			};
		}
		return null;
	}
	function run({ config, onCleanup, storage, active }) {
		const matchers = compile(config.generatedFiles);
		if (!matchers.length) return;
		let showGenerated = false;
		let cached = null;
		let preloading = false;
		function setHidden(element, hidden) {
			if (hidden === element.hasAttribute(HIDDEN_ATTR)) return;
			if (hidden) element.setAttribute(HIDDEN_ATTR, "");
			else element.removeAttribute(HIDDEN_ATTR);
		}
		/** Hides what matches and reports a pattern -> count map plus how many files were seen. */
		function applyFilter() {
			const matched = /* @__PURE__ */ new Map();
			const allPaths = /* @__PURE__ */ new Set();
			const list = document.querySelector(DIFF_LIST);
			if (list) for (const entry of list.children) {
				const path = diffEntryPath(entry);
				if (path) allPaths.add(path);
				const pattern = path && patternFor(matchers, path);
				if (pattern) matched.set(path, pattern);
				setHidden(entry, Boolean(pattern) && !showGenerated);
			}
			const rows = [...document.querySelectorAll("li[role=\"treeitem\"]")];
			const files = rows.filter((row) => !row.hasAttribute("aria-expanded"));
			for (const file of files) {
				allPaths.add(file.id);
				const pattern = patternFor(matchers, file.id);
				if (pattern) matched.set(file.id, pattern);
				setHidden(file, Boolean(pattern) && !showGenerated);
			}
			for (const folder of rows) {
				if (!folder.hasAttribute("aria-expanded")) continue;
				const inside = files.filter((file) => file.id.startsWith(`${folder.id}/`));
				setHidden(folder, inside.length > 0 && inside.every((file) => patternFor(matchers, file.id)) && !showGenerated);
			}
			const counts = new Map(matchers.map((matcher) => [matcher.pattern, 0]));
			for (const pattern of matched.values()) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
			return {
				counts,
				filesSeen: allPaths.size
			};
		}
		function buildMenuItem(template, matcher, index) {
			const item = template.cloneNode(true);
			const id = `bt-filter-${index}`;
			item.id = id;
			item.setAttribute("aria-labelledby", `${id}--label ${id}--trailing-visual`);
			item.setAttribute("tabindex", "-1");
			item.setAttribute(ITEM_ATTR, matcher.pattern);
			item.removeAttribute("aria-keyshortcuts");
			item.removeAttribute("data-focus-visible-added");
			item.classList.remove("focus-visible");
			const label = item.querySelector("[data-component=\"ActionList.Item.Label\"]");
			if (label) {
				label.id = `${id}--label`;
				label.textContent = matcher.label;
			}
			const trailing = item.querySelector("[data-component=\"ActionList.TrailingVisual\"]");
			if (trailing) trailing.id = `${id}--trailing-visual`;
			const toggle = (event) => {
				event.preventDefault();
				event.stopPropagation();
				setShowGenerated(!showGenerated);
			};
			item.addEventListener("click", toggle);
			item.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") toggle(event);
			});
			return item;
		}
		function injectMenuSection() {
			const found = filterMenu();
			if (!found) return;
			const { menu, template } = found;
			if (menu.querySelector(`[${GROUP_ATTR}]`)) return;
			const itemTemplate = template.querySelector("[role=\"menuitemcheckbox\"]");
			if (!itemTemplate) return;
			const group = template.cloneNode(true);
			group.setAttribute(GROUP_ATTR, "");
			const heading = group.querySelector("[data-component=\"GroupHeadingWrap\"] span");
			if (heading) {
				heading.textContent = config.sectionHeading;
				heading.removeAttribute("id");
			}
			const list = group.querySelector("[role=\"group\"]");
			if (!list) return;
			list.replaceChildren(...matchers.map((matcher, index) => buildMenuItem(itemTemplate, matcher, index)));
			const divider = menu.querySelector("[data-component=\"ActionList.Divider\"]");
			template.after(group);
			if (divider) group.before(divider.cloneNode(true));
		}
		function paintMenuItems(counts) {
			for (const item of document.querySelectorAll(`[${ITEM_ATTR}]`)) {
				const count = counts.get(item.getAttribute(ITEM_ATTR) ?? "") ?? 0;
				const checked = showGenerated ? "true" : "false";
				if (item.getAttribute("aria-checked") !== checked) item.setAttribute("aria-checked", checked);
				const trailing = item.querySelector("[data-component=\"ActionList.TrailingVisual\"]");
				if (!trailing) continue;
				const counter = trailing.querySelector("[data-component=\"CounterLabel\"]");
				if (counter && counter.textContent !== String(count)) counter.textContent = String(count);
				const spoken = counter?.nextElementSibling;
				const spokenText = ` (${count})`;
				if (spoken && spoken.textContent !== spokenText) spoken.textContent = spokenText;
			}
		}
		/**
		* GitHub's own counter keeps the true total: ours is inserted in front of it rather than
		* overwriting it, so React stays the only writer of that node.
		*/
		function githubCounter() {
			return document.getElementById(FILES_TAB_ID)?.querySelector(`[data-component="CounterLabel"]:not([${ADJUSTED_ATTR}])`) ?? null;
		}
		function githubTotal() {
			const text = githubCounter()?.textContent?.trim();
			return /^\d+$/.test(text ?? "") ? Number(text) : null;
		}
		function writeCounts(total, generated) {
			const key = countCacheKey(location.pathname);
			if (!key) return;
			cached = {
				total,
				generated
			};
			storage.set(key, cached);
		}
		function recordCounts(generated, filesSeen) {
			const total = githubTotal();
			if (total === null) return;
			if (filesSeen !== total) return;
			writeCounts(total, generated);
		}
		function renderFilesChangedCount() {
			const counter = githubCounter();
			if (!counter) return;
			const total = githubTotal();
			const generated = cached && cached.total === total ? cached.generated : 0;
			const parent = counter.parentElement;
			if (!parent) return;
			if (total === null || generated <= 0 || generated >= total) {
				for (const own of parent.querySelectorAll(`[${ADJUSTED_ATTR}]`)) own.remove();
				counter.removeAttribute(TOTAL_ATTR);
				return;
			}
			let ours = parent.querySelector(`[${ADJUSTED_ATTR}][data-component="CounterLabel"]`);
			if (!ours) {
				ours = counter.cloneNode(true);
				ours.setAttribute(ADJUSTED_ATTR, "");
				const spoken = counter.nextElementSibling;
				counter.before(ours);
				if (spoken) {
					const ourSpoken = spoken.cloneNode(true);
					ourSpoken.setAttribute(ADJUSTED_ATTR, "");
					ours.after(ourSpoken);
				}
			}
			const adjusted = String(total - generated);
			if (ours.textContent !== adjusted) ours.textContent = adjusted;
			const ourSpoken = parent.querySelector(`[${ADJUSTED_ATTR}]:not([data-component])`);
			const spokenText = ` (${adjusted} excluding ${generated} generated, ${total} total)`;
			if (ourSpoken && ourSpoken.textContent !== spokenText) ourSpoken.textContent = spokenText;
			if (!counter.hasAttribute(TOTAL_ATTR)) counter.setAttribute(TOTAL_ATTR, "");
		}
		/**
		* The tab count is worth adjusting from every tab, but only the diff knows which files are
		* generated. Its JSON endpoints sit behind a single-use fetch nonce and cannot be called
		* from elsewhere. The diff *document* embeds the whole file list and needs no nonce, so
		* the count comes from the diff page when it is open and from a background fetch when it
		* is not.
		*/
		async function preloadCounts() {
			if (preloading || !config.preloadCounts) return;
			if (onPullRequestDiff(location.pathname)) return;
			const total = githubTotal();
			if (total === null) return;
			if (cached && cached.total === total) return;
			preloading = true;
			try {
				const url = location.pathname.replace(/^(\/[^/]+\/[^/]+\/pull\/\d+).*$/, "$1/changes");
				const response = await fetch(url, { credentials: "same-origin" });
				if (!response.ok || !active) return;
				const paths = diffSummaryPaths(embeddedPayload(await response.text()));
				if (paths.length !== total || !active) return;
				writeCounts(total, paths.filter((path) => patternFor(matchers, path)).length);
				renderFilesChangedCount();
			} catch {} finally {
				preloading = false;
			}
		}
		function injectCss() {
			if (document.getElementById(STYLE_ID)) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = `
[${HIDDEN_ATTR}] { display: none !important; }
[${TOTAL_ATTR}] {
  opacity: .45;
  /* GitHub's own ml-2 utility would double the gap between the two counters. */
  margin-left: 4px !important;
}
#${NOTICE_ID} {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 8px; padding: 7px 12px;
  border: 1px solid var(--borderColor-default, #30363d);
  border-radius: 6px;
  background: var(--bgColor-muted, #161b22);
  color: var(--fgColor-muted, #848d97);
  font-size: 12px; line-height: 1.5;
}
#${NOTICE_ID} button {
  margin-left: auto; font: inherit; cursor: pointer;
  padding: 3px 10px;
  border: 1px solid var(--borderColor-default, #30363d);
  border-radius: 6px;
  background: var(--bgColor-default, #0d1117);
  color: var(--fgColor-default, #e6edf3);
}`;
			document.head.append(style);
		}
		function renderNotice(total) {
			const list = document.querySelector(DIFF_LIST);
			if (!list?.parentElement) return;
			let notice = document.getElementById(NOTICE_ID);
			if (!notice) {
				notice = document.createElement("div");
				notice.id = NOTICE_ID;
				const span = document.createElement("span");
				const button = document.createElement("button");
				button.type = "button";
				button.addEventListener("click", () => setShowGenerated(!showGenerated));
				notice.append(span, button);
			}
			if (notice.nextElementSibling !== list) list.parentElement.insertBefore(notice, list);
			const files = `${total} generated ${total === 1 ? "file" : "files"}`;
			const label = showGenerated ? `${files} shown` : `${files} hidden`;
			const action = showGenerated ? "Hide them" : "Show them";
			const span = notice.querySelector("span");
			const button = notice.querySelector("button");
			if (span && span.textContent !== label) span.textContent = label;
			if (button && button.textContent !== action) button.textContent = action;
			if (notice.hidden !== (total === 0)) notice.hidden = total === 0;
		}
		function setShowGenerated(next) {
			showGenerated = next;
			render();
		}
		function render() {
			if (onPullRequestDiff(location.pathname)) {
				injectMenuSection();
				const { counts, filesSeen } = applyFilter();
				let generated = 0;
				for (const count of counts.values()) generated += count;
				renderNotice(generated);
				paintMenuItems(counts);
				recordCounts(generated, filesSeen);
			}
			renderFilesChangedCount();
		}
		injectCss();
		const key = countCacheKey(location.pathname);
		if (key) storage.get(key, null).then((stored) => {
			if (!active) return void 0;
			cached = parseCounts(stored);
			if (cached) renderFilesChangedCount();
		});
		render();
		(globalThis.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500)))(() => void preloadCounts());
		let queued = false;
		const observer = new MutationObserver(() => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				try {
					if (!active || !onPullRequest(location.pathname)) return;
					render();
				} finally {
					queued = false;
				}
			});
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
		onCleanup(() => {
			observer.disconnect();
			document.getElementById(STYLE_ID)?.remove();
			document.getElementById(NOTICE_ID)?.remove();
			for (const node of document.querySelectorAll(`[${HIDDEN_ATTR}]`)) node.removeAttribute(HIDDEN_ATTR);
			for (const node of document.querySelectorAll(`[${ADJUSTED_ATTR}]`)) node.remove();
			for (const node of document.querySelectorAll(`[${TOTAL_ATTR}]`)) node.removeAttribute(TOTAL_ATTR);
			for (const node of document.querySelectorAll(`[${GROUP_ATTR}]`)) node.remove();
		});
	}
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
	//#region \0user:github-file-filter
	runTweak(pickModule(github_file_filter_exports));
	//#endregion
})();
