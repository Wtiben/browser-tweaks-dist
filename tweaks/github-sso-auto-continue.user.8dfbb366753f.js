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
	const FROM_CONTENT = "browser-tweaks/sso-renew-answer";
	function isRenewRequest(data) {
		return typeof data === "object" && data !== null && data.source === "browser-tweaks/sso-renew-request";
	}
	/** Content-script side: answers renewal requests until the returned teardown is called. */
	function answerRenewals(target, renew) {
		const onMessage = (event) => {
			if (event.source !== target) return;
			const data = event.data;
			if (!isRenewRequest(data)) return;
			const answer = (kind, renewed) => {
				target.postMessage({
					source: FROM_CONTENT,
					id: data.id,
					kind,
					renewed
				}, target.location.origin);
			};
			answer("ack", false);
			(async () => {
				let renewed = false;
				try {
					renewed = await renew(data.failed);
				} catch (error) {
					console.error("[browser-tweaks] could not renew the GitHub session", error);
				}
				answer("reply", renewed);
			})();
		};
		target.addEventListener("message", onMessage);
		return () => target.removeEventListener("message", onMessage);
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-sso/interstitial.ts
	/**
	* GitHub's sign-on interstitial: recognising it, and submitting it.
	*
	* Ported from the Tampermonkey userscript this repo grew out of, which used to sit in
	* docs/ and is now only in git history. That userscript marked this `once: true` so it
	* could not re-run on a soft navigation. It needs no equivalent here: the interstitial
	* always arrives as a real page load, and a re-run on some later navigation finds no form
	* and returns. The cooldown is the real guard either way.
	*/
	const STAMP_KEY = "gh-tweaks:sso:last-submit";
	const SSO_FORM_SELECTOR = "form[action*=\"/oidc/initiate\"], form[action*=\"/saml/initiate\"]";
	function hasInterstitial(doc) {
		return doc.querySelector(SSO_FORM_SELECTOR) !== null;
	}
	/**
	* Split out so it can be tested against a fixture without a browser extension around it.
	* Returns what it decided, which is what the test asserts on.
	*/
	function autoContinue(doc, storage, now, cooldownMs) {
		const form = doc.querySelector(SSO_FORM_SELECTOR);
		const submit = form?.querySelector("button[type=\"submit\"]");
		if (!form || !submit) return "no-form";
		const last = Number(storage.getItem(STAMP_KEY));
		if (Number.isFinite(last) && last > 0 && now - last < cooldownMs) return "cooling-down";
		storage.setItem(STAMP_KEY, String(now));
		form.requestSubmit(submit);
		return "submitted";
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-sso/renew.ts
	/** Everything but the address, which has no sensible default. */
	const DEFAULTS = {
		timeoutMs: 25e3,
		pollMs: 700,
		revealWhenStuck: true
	};
	async function waitForSession(deps, deadline, pollMs) {
		while (deps.now() < deadline) {
			await deps.wait(pollMs);
			if (await deps.probe() === "alive") return true;
		}
		return false;
	}
	async function renewSession(deps, options) {
		if (await deps.probe() === "alive") return "already-alive";
		const deadline = deps.now() + options.timeoutMs;
		const hidden = await deps.loadHidden(options.url);
		try {
			if (await waitForSession(deps, deadline, options.pollMs)) {
				await hidden.close();
				return "renewed";
			}
		} catch (error) {
			await hidden.close();
			throw error;
		}
		if (!options.revealWhenStuck) {
			await hidden.close();
			return "failed";
		}
		await hidden.reveal();
		return "needs-you";
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-sso/session.ts
	/**
	* Paths GitHub sends you to when it wants you to sign in again.
	*
	* `/orgs/<name>/sso` is the SAML one, kept because an account can be in both kinds of
	* organisation. An enterprise-managed account gets `/enterprises/<slug>/oidc/initiate` and
	* comes back through `/auth/oidc/callback`, both measured on the real round trip.
	*
	* Every alternative has to end at a path segment. Without that, a repository called
	* `logins` reads as a sign-on page and every response from it opens a window.
	*/
	const SIGN_ON_PATH = /^\/(?:login|sessions?|oidc|auth\/oidc|orgs\/[^/]+\/(?:sso|saml)|enterprises\/[^/]+\/(?:sso|oidc|saml))(?:\/|$)/;
	function isSignOnUrl(url) {
		try {
			const parsed = new URL(url);
			if (parsed.hostname !== "github.com") return false;
			return SIGN_ON_PATH.test(parsed.pathname);
		} catch {
			return false;
		}
	}
	function wantsJson(accept) {
		return accept !== null && accept.includes("application/json");
	}
	function isHtml(contentType) {
		return contentType !== null && contentType.includes("text/html");
	}
	function verdictFor(facts) {
		if (facts.type === "opaqueredirect") return "expired";
		if (isSignOnUrl(facts.url)) return "expired";
		if (facts.status === 401) return "expired";
		if (facts.status === 200 && wantsJson(facts.accept) && isHtml(facts.contentType)) return "expired";
		if (facts.status >= 200 && facts.status < 300) return "alive";
		return "unknown";
	}
	/**
	* Reads the facts off a real `Response`, given what the request asked for.
	*
	* Deliberately touches nothing but headers: the body belongs to whoever made the request,
	* and reading it here would consume it out from under them.
	*/
	function factsOf(response, accept) {
		return {
			url: response.url,
			status: response.status,
			contentType: response.headers.get("content-type"),
			accept,
			type: response.type
		};
	}
	/**
	* The sign-on page, recognised in a body rather than in a DOM.
	*
	* The same thing `SSO_FORM_SELECTOR` looks for, against text, because a probe has a string
	* and not a document. It matters where the content type cannot decide: asking a page for
	* HTML and getting HTML is not news, and the only thing that separates the page you wanted
	* from the sign-on page is what is in it.
	*/
	const SIGN_ON_IN_BODY = /<form[^>]+action="[^"]*\/(?:oidc|saml)\/initiate/i;
	function bodyLooksLikeSignOn(body) {
		return SIGN_ON_IN_BODY.test(body);
	}
	/**
	* Asks whether that request would work now.
	*
	* Follows redirects rather than refusing them, because the interstitial does not redirect —
	* it is served in place — and a redirect that does happen is readable at `Response.url`.
	*/
	async function probeUrl(target, fetcher = fetch) {
		try {
			const response = await fetcher(target.url, {
				credentials: "include",
				headers: { accept: target.accept },
				cache: "no-store"
			});
			const verdict = verdictFor(factsOf(response, target.accept));
			if (verdict !== "alive") return verdict;
			if (!isHtml(response.headers.get("content-type"))) return verdict;
			return bodyLooksLikeSignOn(await response.text()) ? "expired" : "alive";
		} catch {
			return "unknown";
		}
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-sso/index.ts
	/**
	* Keeps a GitHub session usable without ever taking the page away from you.
	*
	* It started as one thing: submitting the sign-on interstitial so you did not have to click
	* Continue. That only ever helped on the way in. The session still expired while you were
	* reading — an enterprise-managed account lasts as long as the IdP's ID token, an hour by
	* default — and a pull request you had been sitting on would quietly stop working. Posting
	* a comment failed. Switching to Files changed failed. The only fix was a manual reload,
	* which threw away whatever you had typed and then showed you the sign-on screen anyway.
	*
	* So there are three parts now, and they cover the three ways a dead session reaches you:
	*
	* | the page loads on it        | `autoContinue` submits it                  |
	* | a request comes back dead   | `interceptFetch` renews and repeats it     |
	* | you come back to the tab    | a probe renews before you touch anything   |
	*
	* All three end in the same place: the sign-on round trip happens on a page nobody sees, and
	* the page you were reading is never reloaded.
	*/
	var github_sso_exports = /* @__PURE__ */ __exportAll({
		githubSso: () => githubSso,
		probeTargetFor: () => probeTargetFor
	});
	const CONFIG = {
		cooldownMs: {
			kind: "number",
			label: "Cooldown (ms)",
			description: "How long to wait before submitting the interstitial again after bouncing back to it.",
			default: 1e4,
			min: 1e3,
			max: 12e4
		},
		renewSilently: {
			kind: "boolean",
			label: "Renew the session in the background",
			description: "When a request fails because the session expired, sign in again where you cannot see it and repeat the request. The page you are on is left alone.",
			default: true
		},
		revealWhenStuck: {
			kind: "boolean",
			label: "Show the sign-on when it needs you",
			description: "If signing in cannot finish on its own, because the IdP is asking for a code or a new password, bring that sign-on to the front instead of failing quietly.",
			default: true
		}
	};
	/** How long a tab has to have been out of sight before coming back to it is worth a check. */
	const AWAY_BEFORE_PROBE_MS = 6e4;
	/**
	* What to ask GitHub about to find out whether the session has come back.
	*
	* It has to be organisation-scoped or it answers "fine" forever: with the enterprise
	* session expired, `/notifications/indicator` and the other account-level endpoints still
	* return real JSON, and only URLs under the organisation are served the sign-on page.
	*
	* The request that just failed is therefore the best possible target, since the page was
	* already using it. It is only usable when it was a GET — repeating a POST as a liveness
	* check is not something to do to somebody's pull request — so anything else falls back to
	* the address of the page itself, which is under the same organisation by construction.
	*
	* A URL from the page is not trusted beyond this origin. Everything here is a request the
	* page could already make for itself; what it must not become is a way to have the
	* extension fetch somewhere else.
	*/
	function probeTargetFor(failed, pageUrl) {
		const pageTarget = {
			url: pageUrl,
			accept: "text/html"
		};
		if (!failed || failed.method.toUpperCase() !== "GET") return pageTarget;
		try {
			if (new URL(failed.url).origin !== new URL(pageUrl).origin) return pageTarget;
		} catch {
			return pageTarget;
		}
		return {
			url: failed.url,
			accept: failed.accept
		};
	}
	/**
	* One renewal per document, however many requests notice at the same moment.
	*
	* A soft navigation tears the module down and sets it up again, so this deliberately lives
	* outside `setup`: the six requests a tab switch fires all arrive after that, and they must
	* queue behind one window rather than open six.
	*
	* Across tabs, `renewSession` probes before it opens anything, so a second tab that notices
	* a moment later usually finds the session already back. Two tabs noticing in the same
	* instant can still open two windows; both close themselves, and nothing else comes of it.
	*/
	let inFlight = null;
	function renewOnce(context, failed) {
		if (!inFlight) {
			const target = probeTargetFor(failed, location.href);
			const started = renewSession({
				probe: () => probeUrl(target),
				loadHidden: (url) => context.loadHidden(url),
				wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
				now: () => Date.now()
			}, {
				...DEFAULTS,
				url: location.href,
				revealWhenStuck: context.config.revealWhenStuck
			});
			inFlight = started;
			started.catch(() => void 0).finally(() => {
				if (inFlight === started) inFlight = null;
			});
		}
		return inFlight;
	}
	/** Whether a request that failed on a dead session is worth sending again. */
	function worthRetrying(outcome) {
		return outcome === "renewed" || outcome === "already-alive";
	}
	const githubSso = defineSiteModule({
		id: "github-sso-auto-continue",
		label: "Keep the GitHub session alive",
		description: "Submits the single sign-on interstitial for you, and when the session expires under an open page, signs in again in the background and repeats whatever failed.",
		matches: ["https://github.com/*"],
		pageWorld: true,
		config: CONFIG,
		setup(context) {
			const { config, onCleanup } = context;
			if (hasInterstitial(document)) {
				autoContinue(document, sessionStorage, Date.now(), config.cooldownMs);
				return;
			}
			if (!config.renewSilently) return;
			onCleanup(answerRenewals(window, async (failed) => worthRetrying(await renewOnce(context, failed))));
			let hiddenAt = 0;
			const onVisibilityChange = () => {
				if (document.visibilityState !== "visible") {
					hiddenAt = Date.now();
					return;
				}
				const away = Date.now() - hiddenAt;
				if (hiddenAt === 0 || away < AWAY_BEFORE_PROBE_MS) return;
				(async () => {
					if (await probeUrl(probeTargetFor(void 0, location.href)) !== "expired") return;
					if (!context.active) return;
					await renewOnce(context);
				})();
			};
			document.addEventListener("visibilitychange", onVisibilityChange);
			onCleanup(() => document.removeEventListener("visibilitychange", onVisibilityChange));
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
	//#region \0user:github-sso
	runTweak(pickModule(github_sso_exports));
	//#endregion
})();
