(function() {
	//#region packages/site-modules/src/modules/github-sso/channel.ts
	/**
	* How the page's world asks the extension to fix the session.
	*
	* The interception has to run in the page's own world, because the page's `fetch` is the
	* one being replaced and an isolated world has a different one. Nothing in that world can
	* reach the extension, so the two halves talk over `postMessage`, the same way the picker's
	* React probe does.
	*
	* The page can see these messages and can answer them. That is inherent to running there,
	* and it is why a reply carries a boolean and nothing else: the worst a hostile page can do
	* with it is make its own request run twice.
	*
	* An injected script cannot be taken back out of a page, so the page side has to cope with
	* nobody listening — the module turned off, the extension reloaded. It waits for an
	* acknowledgement first and gives up in a second when none comes, rather than holding a
	* request open for the length of a whole sign-on that is never going to happen. Silence has
	* to be cheap, because a module that is switched off must cost the page nothing.
	*/
	const FROM_PAGE = "browser-tweaks/sso-renew-request";
	function isRenewAnswer(data) {
		return typeof data === "object" && data !== null && data.source === "browser-tweaks/sso-renew-answer";
	}
	const ASK_DEFAULTS = {
		ackMs: 1e3,
		replyMs: 4e4
	};
	let nextId = 1;
	/**
	* Page side: asks for a renewal and resolves to whether the request is worth repeating.
	*
	* Never rejects. The caller is holding a real response to a real request, and turning a
	* dead session into a thrown error would hand the page a failure it has never seen before.
	*/
	function askForRenewal(target, failed, options = ASK_DEFAULTS) {
		const id = nextId++;
		return new Promise((resolve) => {
			let settled = false;
			const finish = (renewed) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				target.removeEventListener("message", onMessage);
				resolve(renewed);
			};
			let timer = setTimeout(() => finish(false), options.ackMs);
			const onMessage = (event) => {
				if (event.source !== target) return;
				const data = event.data;
				if (!isRenewAnswer(data) || data.id !== id) return;
				if (data.kind === "ack") {
					clearTimeout(timer);
					timer = setTimeout(() => finish(false), options.replyMs);
					return;
				}
				finish(data.renewed);
			};
			target.addEventListener("message", onMessage);
			const request = {
				source: FROM_PAGE,
				id,
				failed
			};
			target.postMessage(request, target.location.origin);
		});
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
	//#endregion
	//#region packages/site-modules/src/modules/github-sso/interceptor.ts
	/** Where a request has to be going before its answer says anything about the session. */
	function isGitHub(url, base) {
		try {
			return new URL(url, base).hostname === "github.com";
		} catch {
			return false;
		}
	}
	function urlOf(input) {
		if (typeof input === "string") return input;
		if (input instanceof URL) return input.href;
		return input.url;
	}
	/**
	* The address as an absolute one.
	*
	* Resolved here because here is the only place the base is not in doubt. What a page passes
	* to `fetch` is usually a path, and the far side of the world boundary has no business
	* guessing what it was relative to — it takes an absolute URL or nothing.
	*/
	function absoluteUrl(input, base) {
		try {
			return new URL(urlOf(input), base).href;
		} catch {
			return null;
		}
	}
	function acceptOf(input, init) {
		const fromInit = init?.headers === void 0 ? null : new Headers(init.headers).get("accept");
		if (fromInit !== null) return fromInit;
		return input instanceof Request ? input.headers.get("accept") : null;
	}
	/**
	* Replaces `target.fetch`. Returns a teardown that puts the original back.
	*
	* `renew` resolves to whether the request is worth repeating. Everything it does — asking
	* the extension, waiting for a window nobody sees — happens on the other side of that
	* promise, so this file stays a decision about one response.
	*/
	function interceptFetch(target, renew) {
		const original = target.fetch;
		const call = original.bind(target);
		const patched = async (input, init) => {
			const replayable = input instanceof Request ? input.clone() : input;
			const response = await call(input, init);
			try {
				const url = absoluteUrl(input, target.location.href);
				const accept = acceptOf(input, init);
				if (url === null || !isGitHub(url, target.location.href)) return response;
				if (verdictFor(factsOf(response, accept)) !== "expired") return response;
				const method = input instanceof Request ? input.method : init?.method ?? "GET";
				if (!await renew({
					url,
					accept: accept ?? "application/json",
					method
				})) return response;
				return await call(replayable, init);
			} catch (error) {
				console.error("[browser-tweaks] session retry failed", error);
				return response;
			}
		};
		target.fetch = patched;
		return () => {
			if (target.fetch === patched) target.fetch = original;
		};
	}
	//#endregion
	//#region packages/site-modules/src/modules/github-sso/page-world.ts
	/**
	* Everything this module runs in the page's own world, and nothing else.
	*
	* Registered as a user script in the `MAIN` world at `document_start`, so the `fetch` it
	* replaces is the page's own and is replaced before the page's code has taken a reference
	* to it. The tweak build bundles it separately from the module, and it imports the two
	* pieces it needs directly: going through the package index would drag every module and
	* the storage layer into a script that runs on every GitHub page, which was once measured
	* at 37 kB for a few hundred bytes of behaviour.
	*/
	interceptFetch(window, (failed) => askForRenewal(window, failed));
	//#endregion
})();
