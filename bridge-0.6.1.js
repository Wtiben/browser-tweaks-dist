// @bun
// packages/bridge/src/core.ts
import { mkdir as mkdir8, writeFile as writeFile7 } from "fs/promises";
import { join as join9 } from "path";
import { tmpdir as tmpdir3 } from "os";

// packages/bridge/src/herdr.ts
import { execFile } from "child_process";
import { promisify } from "util";

// packages/bridge/src/agents.ts
import { readFileSync } from "fs";

// packages/bridge/src/paths.ts
import { join } from "path";
import { tmpdir } from "os";
function stateDir() {
  return join(process.env["LOCALAPPDATA"] || tmpdir(), "browser-tweaks");
}
function settingsFile() {
  return join(stateDir(), "settings.json");
}

// packages/bridge/src/agents.ts
var AGENTS = {
  claude: {
    label: "Claude Code",
    kind: "claude",
    prompt: ({ message, url, count, file }) => {
      const lines = [
        message || `I selected ${count === 1 ? "an element" : `${count} elements`} in the browser.`
      ];
      lines.push("", `Selected on ${url}.`);
      if (count) {
        lines.push(`Full context for the ${count === 1 ? "element" : `${count} elements`} above \u2014 selector, component ` + `chain, props, source hints, computed styles and a screenshot each \u2014 is in ${file}. Read it first.`);
      }
      return lines.join(`
`);
    },
    reviewPrompt: ({ owner, repo, number, title, url }) => [
      `I have a question about pull request ${owner}/${repo}#${number}, "${title}".`,
      "",
      `It is at ${url}. Load it as context: \`gh pr view ${number} --repo ${owner}/${repo}\` and`,
      `\`gh pr diff ${number} --repo ${owner}/${repo}\` are the quickest way in, and the current`,
      "checkout is the same repository at a different revision.",
      "",
      "Read it and then stop. Do not change any files and do not start work: the question is",
      "coming in my next message."
    ].join(`
`),
    buildPrompt: ({ url, organization, project, buildId, run, source, selected, file }) => [
      `Pipeline run ${run} failed and I want to know why: ${url}`,
      "",
      `It is build ${buildId} in Azure DevOps organisation ${organization}, project ${project}, and it built ${source}.`,
      ...selected ? [`I was looking at "${selected}" when I asked.`] : [],
      `The steps that failed, with their errors and the end of each log, are in ${file}. Read it first.`,
      "",
      "Use the Azure DevOps MCP for anything that file does not have: the full logs",
      "(`pipelines_build_log` with the log ids in the file), the build itself and its changes. The",
      "current checkout is the repository the pipeline built, possibly at a different revision.",
      "",
      "Find the root cause. Tell me what failed, why, and what would fix it, and whether it is the",
      "change being built or something flaky or environmental. Do not change any files: I'll decide",
      "what to do once I have read your diagnosis."
    ].join(`
`)
  },
  codex: {
    label: "Codex",
    kind: "codex",
    prompt: ({ message, url, count, file }) => {
      const lines = [
        message || `I selected ${count === 1 ? "an element" : `${count} elements`} in the browser.`
      ];
      lines.push("", `Selected on ${url}.`);
      if (count)
        lines.push(`Read ${file} for the full context of the ${count === 1 ? "element" : "elements"} above.`);
      return lines.join(`
`);
    },
    reviewPrompt: ({ owner, repo, number, title, url }) => [
      `Question coming about pull request ${owner}/${repo}#${number}, "${title}" (${url}).`,
      `Read it first with \`gh pr view ${number} --repo ${owner}/${repo}\` and`,
      `\`gh pr diff ${number} --repo ${owner}/${repo}\`, then wait. Change nothing yet.`
    ].join(`
`),
    buildPrompt: ({ url, organization, project, buildId, run, source, selected, file }) => [
      `Find out why pipeline run ${run} failed (${url}): build ${buildId} in Azure DevOps`,
      `${organization}/${project}, building ${source}.${selected ? ` I was looking at "${selected}".` : ""}`,
      `Read ${file} first for the failed steps and their log tails, then use the Azure DevOps MCP`,
      "for full logs. Report the root cause and a fix. Change nothing yet."
    ].join(`
`)
  }
};
function tokenize(line) {
  if (!line?.trim())
    return [];
  const out = [];
  for (const match of line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    out.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return out;
}
function launchFor(agent, stored = {}) {
  return {
    args: tokenize(process.env["INSPECT_AGENT_ARGS"] || stored.agentArgs),
    command: tokenize(process.env["INSPECT_AGENT_COMMAND"] || stored.agentCommand),
    worktreeDir: process.env["INSPECT_WORKTREE_DIR"] || stored.worktreeDir || `.${agent.kind}/worktrees`
  };
}
function resolveAgent(requested = process.env["INSPECT_AGENT"]) {
  if (requested) {
    const agent = AGENTS[requested];
    if (!agent) {
      throw new Error(`Unknown INSPECT_AGENT "${requested}". Known: ${Object.keys(AGENTS).join(", ")}`);
    }
    return agent;
  }
  return AGENTS[storedAgent()] ?? AGENTS["claude"];
}
function storedAgent() {
  try {
    const raw = JSON.parse(readFileSync(settingsFile(), "utf8"));
    const agent = typeof raw === "object" && raw !== null ? raw["agent"] : "";
    if (typeof agent !== "string" || !agent)
      return "claude";
    if (!AGENTS[agent]) {
      console.error(`[browser-tweaks] settings.json names an unknown agent "${agent}"; using claude.`);
      return "claude";
    }
    return agent;
  } catch {
    return "claude";
  }
}
var AGENT = resolveAgent();
function knownAgents() {
  return Object.entries(AGENTS).map(([kind, agent]) => ({ kind, label: agent.label }));
}

// packages/bridge/src/settings.ts
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
var ENV_KEYS = {
  agent: "INSPECT_AGENT",
  agentArgs: "INSPECT_AGENT_ARGS",
  agentCommand: "INSPECT_AGENT_COMMAND",
  worktreeDir: "INSPECT_WORKTREE_DIR"
};
var EMPTY = { agent: "", agentArgs: "", agentCommand: "", worktreeDir: "" };
function parseSettings(raw) {
  if (typeof raw !== "object" || raw === null)
    return { ...EMPTY };
  const source = raw;
  const text = (key) => typeof source[key] === "string" ? source[key] : "";
  return {
    agent: text("agent"),
    agentArgs: text("agentArgs"),
    agentCommand: text("agentCommand"),
    worktreeDir: text("worktreeDir")
  };
}
async function readSettings() {
  try {
    return parseSettings(JSON.parse(await readFile(settingsFile(), "utf8")));
  } catch {
    return { ...EMPTY };
  }
}
async function writeSettings(next) {
  const incoming = parseSettings(next);
  const merged = { ...await readSettings() };
  for (const key of Object.keys(next))
    merged[key] = incoming[key];
  const file = settingsFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(merged, null, 2)}
`, "utf8");
  return merged;
}
async function describeSettings() {
  const stored = await readSettings();
  const inForce = launchFor(AGENT, stored);
  return {
    stored,
    effective: {
      agent: AGENT.kind,
      agentArgs: inForce.args.join(" "),
      agentCommand: inForce.command.join(" "),
      worktreeDir: inForce.worktreeDir
    },
    agents: knownAgents(),
    overridden: Object.keys(ENV_KEYS).filter((key) => Boolean(process.env[ENV_KEYS[key]])),
    agent: AGENT.label
  };
}
async function launch() {
  return launchFor(AGENT, await readSettings());
}

// packages/bridge/src/herdr.ts
var execFileAsync = promisify(execFile);
var herdrBin = () => process.env["HERDR_BIN"] || "herdr";
var STATUSES = new Set(["idle", "working", "blocked", "done", "unknown"]);
function asStatus(value) {
  return value !== undefined && STATUSES.has(value) ? value : "unknown";
}
function command(args) {
  const bin = herdrBin();
  return bin.endsWith(".js") || bin.endsWith(".mjs") ? { bin: process.execPath, args: [bin, ...args] } : { bin, args };
}
async function run(args, { timeout = 30000 } = {}) {
  const resolved = command(args);
  const { stdout } = await execFileAsync(resolved.bin, resolved.args, {
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: 16 * 1024 * 1024
  });
  return stdout;
}
async function runJson(args, options) {
  const raw = await run(args, options);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`herdr ${args.join(" ")} did not return JSON: ${raw.slice(0, 200)}`);
  }
}
function pick(value, key) {
  return typeof value === "object" && value !== null ? value[key] : undefined;
}
function parseSessions(listed, kind) {
  const rows = pick(pick(listed, "result"), "agents") ?? pick(listed, "agents") ?? [];
  if (!Array.isArray(rows))
    return [];
  return rows.filter((row) => row?.agent === kind).map((row) => ({
    sessionId: row.agent_session?.value ?? null,
    paneId: row.pane_id ?? "",
    workspaceId: row.workspace_id ?? null,
    cwd: row.cwd ?? null,
    status: asStatus(row.agent_status),
    title: row.terminal_title_stripped || row.terminal_title || "(untitled)",
    focused: Boolean(row.focused),
    unread: row.tokens?.unread ?? null
  }));
}
function parsePaneId(created) {
  const result = pick(created, "result") ?? created;
  return pick(pick(result, "root_pane"), "pane_id") ?? pick(pick(pick(result, "tab"), "root_pane"), "pane_id") ?? pick(result, "pane_id");
}
async function sessions() {
  return parseSessions(await runJson(["agent", "list"]), AGENT.kind);
}
async function paneFor(sessionId) {
  const match = (await sessions()).find((session) => session.sessionId === sessionId);
  return match?.paneId ?? null;
}
async function prompt(paneId, text) {
  if (text.length > 6000)
    throw new Error(`prompt too long (${text.length} chars)`);
  await run(["agent", "prompt", paneId, text], { timeout: 60000 });
}
function isMissingAgent(error) {
  const stderr = pick(error, "stderr");
  return typeof stderr === "string" && stderr.includes("agent_not_found");
}
async function statusOf(paneId) {
  let got;
  try {
    got = await runJson(["agent", "get", paneId]);
  } catch (error) {
    if (!isMissingAgent(error))
      throw error;
    return "unknown";
  }
  const agent = pick(pick(got, "result"), "agent") ?? pick(got, "agent");
  return asStatus(pick(agent, "agent_status"));
}
async function whyNotPromptable(paneId, cwd, status) {
  if (status !== "unknown") {
    return `Started ${paneId}, but ${AGENT.label} is not accepting input in ${cwd} (it is ${status}). ` + `It is probably waiting on a prompt of its own, such as trusting the folder.`;
  }
  const launched = (await launch()).command;
  return launched.length ? `Started ${paneId}, but herdr sees a bare shell in ${cwd} rather than ${AGENT.label}. ` + `The pane was told to run \`${launched.join(" ")}\`, so check that command exists in your ` + `shell \u2014 it is the launch command under Agent on the options page.` : `Started ${paneId}, but herdr sees a bare shell in ${cwd}: ${AGENT.label} never came up.`;
}
async function createSession({
  cwd,
  label = "inspect"
}) {
  const created = await runJson(["tab", "create", "--cwd", cwd, "--label", label, "--no-focus"]);
  const paneId = parsePaneId(created);
  if (!paneId)
    throw new Error(`could not find pane id in: ${JSON.stringify(created).slice(0, 300)}`);
  return { paneId, status: await startAgent(paneId, label) };
}
async function focus(paneId) {
  try {
    await run(["agent", "focus", paneId]);
  } catch {}
}
async function health() {
  const out = await run(["status"], { timeout: 1e4 });
  return /status:\s*running/.test(out);
}
function parseWorkspaceId(created) {
  const result = pick(created, "result") ?? created;
  return pick(pick(result, "workspace"), "workspace_id") ?? pick(result, "workspace_id");
}
function parsePanes(listed) {
  const rows = pick(pick(listed, "result"), "panes") ?? pick(listed, "panes") ?? [];
  if (!Array.isArray(rows))
    return [];
  return rows.flatMap((row) => {
    const id = pick(row, "pane_id");
    if (typeof id !== "string" || !id)
      return [];
    const cwd = pick(row, "cwd");
    const workspaceId = pick(row, "workspace_id");
    const agent = pick(row, "agent");
    return [
      {
        paneId: id,
        workspaceId: typeof workspaceId === "string" ? workspaceId : null,
        cwd: typeof cwd === "string" ? cwd : null,
        agent: typeof agent === "string" && agent ? agent : null
      }
    ];
  });
}
function parseFirstPaneId(listed) {
  return parsePanes(listed)[0]?.paneId;
}
function samePath(a, b) {
  const left = normalisePath(a);
  return left !== null && left === normalisePath(b);
}
function normalisePath(value) {
  return value?.replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() ?? null;
}
async function firstPaneIn(workspaceId) {
  return parseFirstPaneId(await runJson(["pane", "list", "--workspace", workspaceId]));
}
async function panes() {
  return parsePanes(await runJson(["pane", "list"]));
}
async function workspaceAt(path) {
  const here = (await panes()).filter((pane) => samePath(pane.cwd, path) && pane.workspaceId);
  const match = here.find((pane) => pane.agent === AGENT.kind) ?? here[0];
  return match?.workspaceId ? { ...match, workspaceId: match.workspaceId } : null;
}
async function focusWorkspace(workspaceId) {
  try {
    await run(["workspace", "focus", workspaceId]);
  } catch {}
}
async function openWorktree({
  path,
  repoPath,
  label
}) {
  const opened = await runJson(["worktree", "open", "--cwd", repoPath, "--path", path, "--label", label, "--no-focus"], { timeout: 60000 });
  const workspaceId = parseWorkspaceId(opened);
  if (!workspaceId) {
    throw new Error(`could not find a workspace id in: ${JSON.stringify(opened).slice(0, 300)}`);
  }
  return workspaceId;
}
async function createWorkspace({ cwd, label }) {
  const created = await runJson(["workspace", "create", "--cwd", cwd, "--label", label, "--no-focus"], {
    timeout: 60000
  });
  const workspaceId = parseWorkspaceId(created);
  const paneId = parsePaneId(created);
  if (!workspaceId || !paneId) {
    throw new Error(`could not read the new workspace from: ${JSON.stringify(created).slice(0, 300)}`);
  }
  return { workspaceId, paneId };
}
async function createTabIn({
  workspaceId,
  cwd,
  label
}) {
  const created = await runJson([
    "tab",
    "create",
    "--workspace",
    workspaceId,
    "--cwd",
    cwd,
    "--label",
    label,
    "--no-focus"
  ]);
  const paneId = parsePaneId(created);
  if (!paneId)
    throw new Error(`could not find pane id in: ${JSON.stringify(created).slice(0, 300)}`);
  return paneId;
}
var AGENT_APPEARS_POLL_MS = 500;
var appearsMs = () => Number(process.env["HERDR_AGENT_APPEARS_MS"]) || 30000;
var AGENT_READY_MS = 120000;
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUntilPromptable(paneId) {
  const deadline = Date.now() + appearsMs();
  let status = await statusOf(paneId);
  while (status === "unknown" && Date.now() < deadline) {
    await delay(AGENT_APPEARS_POLL_MS);
    status = await statusOf(paneId);
  }
  if (status === "unknown")
    return status;
  try {
    const args = ["agent", "wait", paneId, "--until", "idle", "--until", "blocked"];
    await run([...args, "--timeout", String(AGENT_READY_MS)], { timeout: AGENT_READY_MS + 30000 });
  } catch {}
  return await statusOf(paneId);
}
async function startAgent(paneId, label) {
  const launch2 = await launch();
  if (launch2.command.length) {
    await run(["pane", "run", paneId, ...launch2.command], { timeout: 60000 });
    return await waitUntilPromptable(paneId);
  }
  const args = ["agent", "start", label, "--kind", AGENT.kind, "--pane", paneId, "--timeout", "60000"];
  if (launch2.args.length)
    args.push("--", ...launch2.args);
  try {
    await run(args, { timeout: 120000 });
  } catch {}
  return await statusOf(paneId);
}

// packages/bridge/src/repos.ts
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { dirname as dirname2, join as join2 } from "path";
import { tmpdir as tmpdir2 } from "os";
var FILE = join2(process.env["LOCALAPPDATA"] || tmpdir2(), "browser-tweaks", "repos.json");
function repoKey({ host, owner, repo }) {
  return `${host}/${owner}/${repo}`.toLowerCase();
}
function parseRepos(raw) {
  if (typeof raw !== "object" || raw === null)
    return [];
  const entries = raw.repos;
  if (!Array.isArray(entries))
    return [];
  const seen = new Set;
  const out = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const { host, owner, repo, path } = entry;
    if (typeof host !== "string" || typeof owner !== "string")
      continue;
    if (typeof repo !== "string" || typeof path !== "string")
      continue;
    if (!host || !owner || !repo || !path)
      continue;
    const mapping = { host, owner, repo, path };
    const key = repoKey(mapping);
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(mapping);
  }
  return out;
}
async function readRepos() {
  try {
    return parseRepos(JSON.parse(await readFile2(FILE, "utf8")));
  } catch {
    return [];
  }
}
async function writeRepos(repos) {
  await mkdir2(dirname2(FILE), { recursive: true });
  const sorted = repos.toSorted((a, b) => repoKey(a).localeCompare(repoKey(b)));
  await writeFile2(FILE, `${JSON.stringify({ repos: sorted }, null, 2)}
`, "utf8");
}
async function pathFor(ref) {
  const key = repoKey(ref);
  return (await readRepos()).find((entry) => repoKey(entry) === key)?.path ?? null;
}
async function link(mapping) {
  const key = repoKey(mapping);
  const next = [...(await readRepos()).filter((entry) => repoKey(entry) !== key), mapping];
  await writeRepos(next);
  return next;
}
async function unlink(ref) {
  const key = repoKey(ref);
  const next = (await readRepos()).filter((entry) => repoKey(entry) !== key);
  await writeRepos(next);
  return next;
}

// packages/bridge/src/version.g.ts
var VERSION = "0.6.1";

// packages/bridge/src/build.ts
import { mkdir as mkdir5, writeFile as writeFile4 } from "fs/promises";
import { join as join6 } from "path";

// packages/bridge/src/pr.ts
import { mkdir as mkdir4 } from "fs/promises";
import { join as join5, resolve } from "path";

// packages/bridge/src/git.ts
import { execFile as execFile2 } from "child_process";
import { promisify as promisify2 } from "util";
import { basename, isAbsolute, join as join3 } from "path";
var execFileAsync2 = promisify2(execFile2);
function parseWorktrees(porcelain) {
  const out = [];
  let current = null;
  for (const line of porcelain.split(`
`)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current)
        out.push(current);
      current = null;
      continue;
    }
    if (trimmed.startsWith("worktree ")) {
      current = { path: trimmed.slice("worktree ".length), branch: null, bare: false, detached: false };
      continue;
    }
    if (!current)
      continue;
    if (trimmed === "bare")
      current.bare = true;
    else if (trimmed === "detached")
      current.detached = true;
    else if (trimmed.startsWith("branch ")) {
      current.branch = trimmed.slice("branch ".length).replace(/^refs\/heads\//, "");
    }
  }
  if (current)
    out.push(current);
  return out;
}
function mainCheckout(trees, branch) {
  return trees.filter((tree) => !tree.bare).find((tree) => tree.branch === branch)?.path ?? null;
}
function worktreeFor(trees, branch) {
  return trees.find((tree) => !tree.bare && tree.branch === branch);
}
function parseDefaultBranch(symref, branches) {
  const named = symref.trim().replace(/^refs\/remotes\//, "").replace(/^origin\//, "");
  if (named && named !== "HEAD")
    return named;
  for (const candidate of ["development", "main", "master", "develop"]) {
    if (branches.includes(candidate) || branches.includes(`origin/${candidate}`))
      return candidate;
  }
  return "main";
}
function worktreeDirName(number, branch) {
  return branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48).replace(/^-+|-+$/g, "") || `pr-${number}`;
}
function fetchPlan(pr) {
  const headOwner = pr.headOwner ?? null;
  const headRepo = pr.headRepo ?? pr.repo;
  const branch = pr.headBranch ?? null;
  if (!branch) {
    const local2 = `pr-${pr.number}`;
    return {
      args: ["fetch", "origin", `+refs/pull/${pr.number}/head:refs/heads/${local2}`],
      branch: local2,
      tracking: false
    };
  }
  const isFork = headOwner !== null && headOwner.toLowerCase() !== pr.owner.toLowerCase();
  if (!isFork) {
    return { args: ["fetch", "origin", branch], branch, tracking: true };
  }
  const local = `pr-${pr.number}-${branch}`.replace(/\/+/g, "-");
  const url = `https://${pr.host}/${headOwner}/${headRepo}.git`;
  return { args: ["fetch", url, `+${branch}:refs/heads/${local}`], branch: local, tracking: false };
}

class GitError extends Error {
  constructor(args, stderr, cause) {
    super(stderr.trim() || `git ${args.join(" ")} failed${cause ? `: ${cause}` : ""}`);
    this.name = "GitError";
  }
}
async function git(cwd, args, timeout = 120000) {
  try {
    const { stdout } = await execFileAsync2("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout,
      maxBuffer: 16 * 1024 * 1024
    });
    return stdout;
  } catch (error) {
    const failure = error;
    throw new GitError(args, failure.stderr ?? "", failure.message ?? String(error));
  }
}
async function repoRoot(path) {
  try {
    const common = (await git(path, ["rev-parse", "--path-format=absolute", "--git-common-dir"], 1e4)).trim();
    return common ? common.replace(/[/\\]\.git[/\\]?$/, "").replace(/[/\\]$/, "") || common : null;
  } catch {
    return null;
  }
}
async function isBare(cwd) {
  return (await git(cwd, ["rev-parse", "--is-bare-repository"], 1e4)).trim() === "true";
}
async function remoteUrl(cwd, remote = "origin") {
  try {
    return (await git(cwd, ["remote", "get-url", remote], 1e4)).trim() || null;
  } catch {
    return null;
  }
}
async function defaultBranch(cwd) {
  let symref = "";
  try {
    symref = await git(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], 1e4);
  } catch {}
  const branches = (await git(cwd, ["branch", "-a", "--format=%(refname:short)"], 15000)).split(`
`).map((line) => line.trim()).filter(Boolean);
  return parseDefaultBranch(symref, branches);
}
async function worktrees(cwd) {
  return parseWorktrees(await git(cwd, ["worktree", "list", "--porcelain"], 15000));
}
function remoteMatches(url, owner, repo) {
  if (!url)
    return false;
  let normalised = url.replace(/\.git$/, "").replace(/\\/g, "/").replace(/^([^/]+@[^/:]+):/, "$1/").replace("/_git/", "/").toLowerCase();
  try {
    normalised = decodeURIComponent(normalised);
  } catch {}
  return normalised.endsWith(`/${owner.toLowerCase()}/${repo.toLowerCase()}`);
}
function worktreeParent(repoPath, bare, dir) {
  if (isAbsolute(dir))
    return join3(dir, basename(repoPath));
  return bare ? repoPath : join3(repoPath, dir);
}

// packages/bridge/src/panes.ts
import { mkdir as mkdir3, readFile as readFile3, rename, writeFile as writeFile3 } from "fs/promises";
import { join as join4 } from "path";
var file = () => join4(stateDir(), "issued-panes.json");
var KEEP = 200;
async function read() {
  try {
    const parsed = JSON.parse(await readFile3(file(), "utf8"));
    if (!Array.isArray(parsed))
      return [];
    return parsed.filter((entry) => typeof entry === "object" && entry !== null && typeof entry.id === "string" && typeof entry.at === "number");
  } catch {
    return [];
  }
}
async function remember(paneId) {
  const kept = (await read()).filter((entry) => entry.id !== paneId);
  kept.push({ id: paneId, at: Date.now() });
  await mkdir3(stateDir(), { recursive: true });
  const staged = `${file()}.${process.pid}.tmp`;
  await writeFile3(staged, JSON.stringify(kept.slice(-KEEP)), "utf8");
  await rename(staged, file());
}
async function wasIssued(paneId) {
  return (await read()).some((entry) => entry.id === paneId);
}

// packages/bridge/src/pr.ts
class UnknownRepoError extends Error {
  code = "unknown-repo";
  constructor(ref) {
    super(`No local checkout is mapped for ${ref.host}/${ref.owner}/${ref.repo}.`);
    this.name = "UnknownRepoError";
  }
}
async function validate({ host, owner, repo, path }) {
  const root = await repoRoot(path);
  if (!root)
    throw new Error(`${path} is not inside a git repository.`);
  const url = await remoteUrl(path);
  if (!remoteMatches(url, owner, repo)) {
    throw new Error(url ? `${path} has origin ${url}, which is not ${owner}/${repo}.` : `${path} has no origin remote, so it cannot be matched to ${owner}/${repo}.`);
  }
  return { host, owner, repo, path };
}
async function resolvePath(ref) {
  const path = await pathFor(ref);
  if (!path)
    throw new UnknownRepoError(ref);
  return path;
}
async function mainWorkingTree(repoPath) {
  if (!await isBare(repoPath))
    return repoPath;
  const branch = await defaultBranch(repoPath);
  const existing = mainCheckout(await worktrees(repoPath), branch);
  if (existing)
    return existing;
  const target = join5(repoPath, "..", branch);
  await git(repoPath, ["worktree", "add", target, branch]);
  return target;
}
async function openWorktree2(pr) {
  const repoPath = await resolvePath(pr);
  const plan = fetchPlan(pr);
  const existing = worktreeFor(await worktrees(repoPath), plan.branch);
  if (existing) {
    const open = await workspaceAt(existing.path);
    const workspaceId2 = open?.workspaceId ?? await openWorktree({ path: existing.path, repoPath, ...label(pr) });
    const paneId2 = open?.paneId ?? await firstPaneIn(workspaceId2) ?? null;
    const note2 = paneId2 && !open?.agent ? await start(paneId2, existing.path, pr) : undefined;
    if (paneId2)
      await remember(paneId2);
    await focusWorkspace(workspaceId2);
    return {
      path: resolve(existing.path),
      branch: plan.branch,
      workspaceId: workspaceId2,
      paneId: paneId2,
      reused: true,
      ...note2 ? { agentNote: note2 } : {}
    };
  }
  await git(repoPath, plan.args);
  const root = worktreeParent(repoPath, await isBare(repoPath), (await launch()).worktreeDir);
  await mkdir4(root, { recursive: true });
  const path = join5(root, worktreeDirName(pr.number, plan.branch));
  await git(repoPath, ["worktree", "add", path, plan.branch]);
  if (plan.tracking) {
    try {
      await git(path, ["branch", `--set-upstream-to=origin/${plan.branch}`, plan.branch], 15000);
    } catch {}
  }
  const workspaceId = await openWorktree({ path, repoPath, ...label(pr) });
  const paneId = await firstPaneIn(workspaceId) ?? null;
  const note = paneId ? await start(paneId, path, pr) : undefined;
  if (paneId)
    await remember(paneId);
  await focusWorkspace(workspaceId);
  return {
    path: resolve(path),
    branch: plan.branch,
    workspaceId,
    paneId,
    reused: false,
    ...note ? { agentNote: note } : {}
  };
}
async function start(paneId, cwd, pr) {
  const status = await startAgent(paneId, `pr-${pr.number}`);
  return status === "idle" ? undefined : await whyNotPromptable(paneId, cwd, status);
}
function label(pr) {
  return { label: pr.title.trim() || `${pr.repo} #${pr.number}` };
}
async function openSession(pr) {
  const cwd = await mainWorkingTree(await resolvePath(pr));
  const paneId = await promptInCheckout({
    cwd,
    name: label(pr).label,
    agentLabel: `pr-${pr.number}`,
    text: AGENT.reviewPrompt(pr)
  });
  return { paneId, cwd };
}
async function checkoutFor(ref) {
  return await mainWorkingTree(await resolvePath(ref));
}
async function promptInCheckout({
  cwd,
  name,
  agentLabel,
  text
}) {
  const open = await workspaceAt(cwd);
  const paneId = open ? await createTabIn({ workspaceId: open.workspaceId, cwd, label: name }) : (await createWorkspace({ cwd, label: name })).paneId;
  await remember(paneId);
  const status = await startAgent(paneId, agentLabel);
  if (status !== "idle") {
    await focus(paneId);
    throw new Error(await whyNotPromptable(paneId, cwd, status));
  }
  await prompt(paneId, text);
  await focus(paneId);
  return paneId;
}

// packages/bridge/src/build.ts
function describeSource(build) {
  const commit = build.sourceVersion ? ` at commit ${build.sourceVersion.slice(0, 12)}` : "";
  if (build.pullRequest) {
    const title = build.pullRequest.title ? ` "${build.pullRequest.title}"` : "";
    return `pull request #${build.pullRequest.number}${title}${commit}`;
  }
  const branch = build.sourceBranch?.replace(/^refs\/heads\//, "");
  return branch ? `branch ${branch}${commit}` : `an unknown source${commit}`;
}
function renderBuildContext(build) {
  const lines = [
    `# ${build.pipeline} ${build.buildNumber}`,
    "",
    `- Run: ${build.url}`,
    `- Organisation: ${build.organization}`,
    `- Project: ${build.project}`,
    `- Build id: ${build.buildId}`,
    `- Status: ${build.status}${build.result ? `, ${build.result}` : ""}`,
    `- Built: ${describeSource(build)}`
  ];
  if (build.sourceBranch)
    lines.push(`- Source branch: ${build.sourceBranch}`);
  if (build.sourceVersion)
    lines.push(`- Source version: ${build.sourceVersion}`);
  if (build.repository) {
    lines.push(`- Repository: ${build.repository.host}/${build.repository.owner}/${build.repository.repo}`);
  }
  lines.push("", `## Failed steps (${build.failures.length})`);
  for (const failure of build.failures) {
    lines.push("", `### ${failure.path.join(" \u203A ")}${failure.selected ? " (open on the page)" : ""}`, "");
    lines.push(`- Type: ${failure.type}`);
    lines.push(`- Log id: ${failure.logId ?? "none"}`);
    for (const error of failure.errors)
      lines.push(`- Error: ${error}`);
    if (failure.logTail) {
      lines.push("", "End of the log:", "", "`````text", failure.logTail.trimEnd(), "`````");
    }
  }
  return `${lines.join(`
`)}
`;
}
function contextFile(build) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return join6(stateDir(), "context", `${stamp}-build-${build.buildId}.md`);
}
async function investigateBuild(build) {
  if (!build.repository) {
    throw new Error(`${build.pipeline} builds a repository this cannot map to a checkout. Only GitHub and Azure Repos are supported.`);
  }
  const cwd = await checkoutFor(build.repository);
  const file2 = contextFile(build);
  await mkdir5(join6(stateDir(), "context"), { recursive: true });
  await writeFile4(file2, renderBuildContext(build), "utf8");
  const selected = build.failures.find((failure) => failure.selected);
  const paneId = await promptInCheckout({
    cwd,
    name: `${build.pipeline} #${build.buildId}`,
    agentLabel: `build-${build.buildId}`,
    text: AGENT.buildPrompt({
      url: build.url,
      organization: build.organization,
      project: build.project,
      buildId: build.buildId,
      run: `${build.pipeline} ${build.buildNumber}`,
      source: describeSource(build),
      selected: selected ? selected.path.join(" \u203A ") : null,
      file: file2
    })
  });
  return { paneId, cwd, file: file2 };
}

// packages/bridge/src/tweaks.ts
import { createHash as createHash2 } from "crypto";
import { watch } from "fs";
import { mkdir as mkdir7, readFile as readFile5, rename as rename3, writeFile as writeFile6 } from "fs/promises";
import { join as join8 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// packages/bridge/src/update.ts
import { spawn } from "child_process";
import { createHash, createPublicKey, verify } from "crypto";
import { mkdir as mkdir6, readFile as readFile4, readdir, rename as rename2, rm, stat, writeFile as writeFile5 } from "fs/promises";
import { join as join7 } from "path";
import { fileURLToPath } from "url";
var distBase = () => process.env["BROWSER_TWEAKS_DIST"] || "https://wtiben.github.io/browser-tweaks-dist";
var versionsDir = () => join7(stateDir(), "versions");
var publicKeyFile = () => join7(stateDir(), "bin", "bridge-signing.pub");
async function publicKey() {
  const key = await readFile4(publicKeyFile(), "utf8").catch(() => null);
  return key?.trim() || null;
}
var lastCheckFile = () => join7(stateDir(), "versions", ".last-check");
var CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
var URGENT_EVERY_MS = 10 * 60 * 1000;
function isNewer(candidate, current) {
  const left = candidate.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = current.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0;index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0)
      return difference > 0;
  }
  return false;
}
function pickRelease(manifest, current) {
  const bridges = manifest?.bridges;
  if (!Array.isArray(bridges))
    return null;
  let best = null;
  for (const entry of bridges) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const { version, url, sha256, signature } = entry;
    if (typeof version !== "string" || typeof url !== "string")
      continue;
    if (typeof sha256 !== "string" || typeof signature !== "string")
      continue;
    if (!url.startsWith(`${distBase()}/`))
      continue;
    if (!isNewer(version, current))
      continue;
    if (best && !isNewer(version, best.version))
      continue;
    best = { version, url, sha256, signature };
  }
  return best;
}
function normalise(value) {
  return value.replace(/\\/g, "/").toLowerCase();
}
function isPublishedInstall(entry = process.argv[1]) {
  const root = `${normalise(stateDir())}/`;
  const here = fileURLToPath(import.meta.url);
  return [entry, here].some((path) => path !== undefined && normalise(path).startsWith(root));
}
async function stagedVersion({ entry } = {}) {
  if (!isPublishedInstall(entry ?? process.argv[1]))
    return null;
  const entries = await readdir(versionsDir(), { withFileTypes: true }).catch(() => []);
  let best = null;
  for (const installed of entries) {
    if (!installed.isDirectory() || !/^\d+\.\d+\.\d+$/.test(installed.name))
      continue;
    if (!isNewer(installed.name, VERSION))
      continue;
    if (best && !isNewer(installed.name, best))
      continue;
    best = installed.name;
  }
  return best;
}
async function dueForCheck(within) {
  try {
    const { mtimeMs } = await stat(lastCheckFile());
    return Date.now() - mtimeMs > within;
  } catch {
    return true;
  }
}
async function selfTest(bundle) {
  return await new Promise((resolve2) => {
    const child = spawn(process.execPath, [bundle, "--selftest"], { windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      resolve2(false);
    }, 30000);
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString("utf8");
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve2(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve2(code === 0 && out.includes("bridge ok"));
    });
  });
}
async function maybeUpdate({
  entry,
  urgent
} = {}) {
  try {
    if (!isPublishedInstall(entry ?? process.argv[1]))
      return;
    if (!await dueForCheck(urgent ? URGENT_EVERY_MS : CHECK_EVERY_MS))
      return;
    await mkdir6(versionsDir(), { recursive: true });
    await writeFile5(lastCheckFile(), new Date().toISOString(), "utf8");
    const key = await publicKey();
    if (!key)
      return;
    const response = await fetch(`${distBase()}/bridge.json?t=${Date.now()}`, {
      redirect: "error",
      cache: "no-store"
    });
    if (!response.ok)
      return;
    const release = pickRelease(await response.json(), VERSION);
    if (!release)
      return;
    const downloaded = await fetch(release.url, { redirect: "error" });
    if (!downloaded.ok)
      return;
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== release.sha256)
      return;
    if (!verifySignature(bytes, release.signature, key))
      return;
    const staging = join7(versionsDir(), `.staging-${release.version}`);
    await rm(staging, { recursive: true, force: true });
    await mkdir6(staging, { recursive: true });
    const staged = join7(staging, "bridge.js");
    await writeFile5(staged, bytes);
    if (!await selfTest(staged)) {
      await rm(staging, { recursive: true, force: true });
      return;
    }
    await rename2(staging, join7(versionsDir(), release.version));
    await prune(release.version);
  } catch {}
}
function verifySignature(bytes, signature, publicKeyBase64) {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki"
    });
    return verify(null, bytes, key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
async function prune(installed) {
  const keep = new Set([installed, VERSION]);
  const entries = await readdir(versionsDir(), { withFileTypes: true }).catch(() => []);
  const versions = entries.filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name)).map((entry) => entry.name).toSorted((a, b) => isNewer(a, b) ? -1 : 1);
  for (const version of versions.slice(2)) {
    if (keep.has(version))
      continue;
    await rm(join7(versionsDir(), version), { recursive: true, force: true }).catch(() => {
      return;
    });
  }
}

// packages/bridge/src/tweaks.ts
var sha256 = (data) => createHash2("sha256").update(data).digest("hex");
function checkoutDir() {
  return process.env["BROWSER_TWEAKS_TWEAKS_DIR"] || fileURLToPath2(new URL("../../site-modules/dist/tweaks/", import.meta.url));
}
var cacheDir = () => join8(stateDir(), "tweaks");
var cachedFile = (hash) => join8(cacheDir(), "files", `${hash}.js`);
var HASH = /^[0-9a-f]{64}$/;
var FILE_NAME = /^[\w.-]+\.js$/;
function parseFile(value) {
  if (typeof value !== "object" || value === null)
    return null;
  const { name, sha256: hash } = value;
  if (typeof name !== "string" || !FILE_NAME.test(name))
    return null;
  if (typeof hash !== "string" || !HASH.test(hash))
    return null;
  return { name, sha256: hash };
}
function parseCatalog(raw, source) {
  if (typeof raw !== "object" || raw === null)
    return null;
  const { version, builtAt, tweaks: listed } = raw;
  if (typeof version !== "string" || !Array.isArray(listed))
    return null;
  const entries = [];
  for (const item of listed) {
    if (typeof item !== "object" || item === null)
      continue;
    const { id, label: label2, description, matches, config, requires, user, page } = item;
    if (typeof id !== "string" || !id || typeof label2 !== "string")
      continue;
    if (!Array.isArray(matches) || !matches.every((match) => typeof match === "string") || !matches.length) {
      continue;
    }
    const userFile = parseFile(user);
    if (!userFile)
      continue;
    const pageFile = page === undefined ? undefined : parseFile(page);
    if (pageFile === null)
      continue;
    entries.push({
      id,
      label: label2,
      description: typeof description === "string" ? description : "",
      matches,
      config: typeof config === "object" && config !== null ? config : {},
      ...typeof requires === "string" ? { requires } : {},
      user: userFile,
      ...pageFile ? { page: pageFile } : {}
    });
  }
  return {
    version,
    source,
    builtAt: typeof builtAt === "string" ? builtAt : "",
    tweaks: entries
  };
}
async function checkoutCatalog() {
  let raw;
  try {
    raw = await readFile5(join8(checkoutDir(), "catalog.json"), "utf8");
  } catch {
    throw new Error("This checkout has no tweaks built. Run `pnpm --filter @browser-tweaks/site-modules build`, or `pnpm dev`, which keeps them built.");
  }
  const catalog = parseCatalog(JSON.parse(raw), "checkout");
  if (!catalog)
    throw new Error(`${join8(checkoutDir(), "catalog.json")} is not a tweak catalog.`);
  return catalog;
}
async function watchCheckout(onChange) {
  const dir = checkoutDir();
  await mkdir7(dir, { recursive: true });
  let timer;
  return watch(dir, (_event, name) => {
    if (name !== "catalog.json")
      return;
    clearTimeout(timer);
    timer = setTimeout(onChange, 100);
  });
}
async function fetchVerified(key) {
  const response = await fetch(`${distBase()}/tweaks/tweaks.json?t=${Date.now()}`, {
    redirect: "error",
    cache: "no-store"
  });
  if (response.status === 404) {
    return { version: "none", source: "dist", builtAt: "", tweaks: [] };
  }
  if (!response.ok)
    throw new Error(`The tweak catalog answered ${response.status}.`);
  const signed = await response.json();
  if (typeof signed.manifest !== "string" || typeof signed.signature !== "string") {
    throw new Error("The tweak catalog is not signed.");
  }
  if (!verifySignature(Buffer.from(signed.manifest, "utf8"), signed.signature, key)) {
    throw new Error("The tweak catalog signature does not verify. Nothing was changed.");
  }
  const catalog = parseCatalog(JSON.parse(signed.manifest), "dist");
  if (!catalog)
    throw new Error("The signed tweak catalog could not be read.");
  for (const entry of catalog.tweaks) {
    for (const file2 of [entry.user, entry.page]) {
      if (!file2)
        continue;
      if (await readFile5(cachedFile(file2.sha256), "utf8").then(() => true, () => false))
        continue;
      const downloaded = await fetch(`${distBase()}/tweaks/${file2.name}`, { redirect: "error" });
      if (!downloaded.ok)
        throw new Error(`${file2.name} answered ${downloaded.status}.`);
      const bytes = Buffer.from(await downloaded.arrayBuffer());
      if (sha256(bytes) !== file2.sha256)
        throw new Error(`${file2.name} does not match its catalog entry.`);
      await mkdir7(join8(cacheDir(), "files"), { recursive: true });
      await writeFile6(cachedFile(file2.sha256), bytes);
    }
  }
  const staged = join8(cacheDir(), `.catalog-${process.pid}.json`);
  await writeFile6(staged, JSON.stringify(catalog), "utf8");
  await rename3(staged, join8(cacheDir(), "catalog.json"));
  return catalog;
}
async function cachedCatalog() {
  try {
    return parseCatalog(JSON.parse(await readFile5(join8(cacheDir(), "catalog.json"), "utf8")), "dist");
  } catch {
    return null;
  }
}
async function publishedCatalog(refresh) {
  const cached = await cachedCatalog();
  if (cached && !refresh)
    return cached;
  maybeUpdate({ urgent: true });
  const key = await publicKey();
  if (!key)
    throw new Error("No signing key is installed, so no tweak can be verified. Re-run the installer.");
  try {
    return await fetchVerified(key);
  } catch (error) {
    if (cached)
      return cached;
    throw error;
  }
}
async function tweaks({ refresh = false } = {}) {
  if (!isPublishedInstall())
    return await checkoutCatalog();
  const catalog = await publishedCatalog(refresh);
  const staged = await stagedVersion();
  return staged ? { ...catalog, staged } : catalog;
}
async function tweakFile(file2) {
  return isPublishedInstall() ? await publishedFile(file2) : await checkoutFile(file2);
}
async function publishedFile({ name, sha256: hash }) {
  if (!HASH.test(hash))
    throw new Error("Not a tweak file hash.");
  const code = await readFile5(cachedFile(hash), "utf8").catch(() => null);
  if (code === null)
    throw new Error(`${name} is not in the tweak cache. Check for updates again.`);
  return { code };
}
async function checkoutFile({ name, sha256: hash }) {
  if (!HASH.test(hash))
    throw new Error("Not a tweak file hash.");
  if (!FILE_NAME.test(name))
    throw new Error("Not a tweak file name.");
  const code = await readFile5(join8(checkoutDir(), name), "utf8").catch(() => null);
  if (code === null)
    throw new Error(`${name} is not in this checkout's tweak build.`);
  if (sha256(code) !== hash)
    throw new Error(`${name} changed while it was being read. Try again.`);
  return { code };
}

// packages/bridge/src/primitives.ts
async function issued(paneId) {
  if (typeof paneId !== "string" || !paneId)
    throw new Error("No pane given.");
  if (!await wasIssued(paneId)) {
    throw new Error(`Pane ${paneId} was not opened by Browser Tweaks, so it is left alone.`);
  }
  return paneId;
}
async function agentPrompt({
  paneId,
  text,
  focus: focus2 = false
}) {
  const pane = await issued(paneId);
  if (typeof text !== "string" || !text.trim())
    throw new Error("Nothing to type.");
  const status = await statusOf(pane);
  if (status !== "idle")
    return { prompted: false, status };
  await prompt(pane, text);
  if (focus2)
    await focus(pane);
  return { prompted: true, status };
}
async function agentStatus({ paneId }) {
  return { status: await statusOf(await issued(paneId)) };
}
async function paneFocus({ paneId }) {
  await focus(await issued(paneId));
  return { ok: true };
}

// packages/bridge/src/render.ts
function fence(lang, body) {
  return ["```" + lang, body, "```"].join(`
`);
}
function kv(rows) {
  return rows.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([key, value]) => `- **${key}**: ${value}`).join(`
`);
}
function renderMessage(parts) {
  if (!parts?.length)
    return "";
  return parts.map((part) => part.type === "text" ? part.value : `[element ${part.ref}: ${part.label}]`).join("").replace(/[ \t]+\n/g, `
`).replace(/\n{3,}/g, `

`).trim();
}
function renderElement(el, screenshotPath) {
  const parts = [`## Element ${el.ref} \u2014 \`${el.tagName}\``];
  parts.push(kv([
    ["selector", el.selector && `\`${el.selector}\``],
    ["text", el.text && `"${el.text}"`],
    [
      "position",
      el.rect && `${Math.round(el.rect.width)}\xD7${Math.round(el.rect.height)} at (${Math.round(el.rect.x)}, ${Math.round(el.rect.y)})`
    ],
    ["screenshot", screenshotPath && `\`${screenshotPath}\` \u2014 read it as an image`]
  ]));
  if (el.componentChain?.length) {
    parts.push("", "### React components (innermost first)", el.componentChain.map((name) => `- \`<${name}>\``).join(`
`));
  }
  if (el.sourceHints?.length) {
    parts.push("", "### Source hints", "_Derived from React dev-build stacks \u2014 the file path is reliable, the line number is post-transform and may be a little off._", el.sourceHints.map((hint) => `- \`${hint}\``).join(`
`));
  }
  if (el.props && Object.keys(el.props).length) {
    parts.push("", "### Props of the nearest component", fence("json", JSON.stringify(el.props, null, 2)));
  }
  if (el.attributes && Object.keys(el.attributes).length) {
    parts.push("", "### Attributes", fence("json", JSON.stringify(el.attributes, null, 2)));
  }
  if (el.ancestors?.length) {
    parts.push("", "### DOM ancestors", fence("text", el.ancestors.join(`
`)));
  }
  if (el.outerHTML) {
    parts.push("", "### Markup", fence("html", el.outerHTML));
  }
  if (el.styles && Object.keys(el.styles).length) {
    const body = Object.entries(el.styles).map(([prop, value]) => `${prop}: ${value};`).join(`
`);
    parts.push("", "### Computed styles (non-default)", fence("css", body));
  }
  return parts.join(`
`);
}
function renderContext(payload, screenshots = new Map) {
  const { url, title, viewport, userAgent, react, elements, message, capturedAt } = payload;
  const head = ["# Browser selection", ""];
  const body = renderMessage(message);
  if (body)
    head.push("## Message", "", body, "");
  head.push("## Page", kv([
    ["url", url],
    ["title", title],
    ["viewport", viewport && `${viewport.width}\xD7${viewport.height} @ ${viewport.dpr}x`],
    [
      "react",
      react?.version ? `${react.version}${react.devBuild ? " (dev build)" : ""}` : react?.detected ? "detected, version unknown" : "not detected"
    ],
    ["captured", capturedAt],
    ["user agent", userAgent]
  ]));
  const sections = (elements ?? []).map((el) => renderElement(el, screenshots.get(el.ref)));
  return [...head, "", sections.join(`

`), ""].join(`
`);
}

// packages/bridge/src/core.ts
var DROP_DIR = join9(process.env["LOCALAPPDATA"] || tmpdir3(), "browser-tweaks", "context");
function clamp(text, limit) {
  return text.length <= limit ? text : `${text.slice(0, limit)}
\u2026 (truncated, the rest is in the context file)`;
}
function dropPath(payload) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const first = payload?.elements?.[0];
  const slug = (first?.componentChain?.[0] || first?.tagName || "element").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "element";
  return join9(DROP_DIR, `${stamp}-${slug}.md`);
}
async function send({ sessionId, newSession, cwd, payload }) {
  const elements = payload?.elements ?? [];
  const written = renderMessage(payload?.message);
  if (!elements.length && !written)
    throw new Error("nothing to send");
  await mkdir8(DROP_DIR, { recursive: true });
  const file2 = dropPath(payload);
  const screenshots = new Map;
  for (const element of elements) {
    if (!element.screenshot?.startsWith("data:image/png;base64,"))
      continue;
    const shot = file2.replace(/\.md$/, `-${element.ref}.png`);
    await writeFile7(shot, Buffer.from(element.screenshot.split(",")[1] ?? "", "base64"));
    screenshots.set(element.ref, shot);
  }
  await writeFile7(file2, renderContext(payload, screenshots), "utf8");
  let paneId;
  if (newSession) {
    if (!cwd)
      throw new Error("a new session needs a working directory");
    const started = await createSession({ cwd });
    paneId = started.paneId;
    if (started.status !== "idle") {
      await focus(paneId);
      throw new Error(`${await whyNotPromptable(paneId, cwd, started.status)} ` + `Sort that out and send again; the capture is saved at ${file2}.`);
    }
  } else {
    const resolved = await paneFor(sessionId);
    if (!resolved)
      throw new Error(`That session is no longer running. The capture is saved at ${file2}.`);
    paneId = resolved;
  }
  await prompt(paneId, AGENT.prompt({ message: clamp(written, 3000), url: payload.url, count: elements.length, file: file2 }));
  await focus(paneId);
  return { ok: true, paneId, file: file2 };
}
var handlers = {
  health: async () => {
    const staged = await stagedVersion();
    return {
      ok: true,
      herdr: await health(),
      agent: AGENT.label,
      kind: AGENT.kind,
      version: VERSION,
      selfUpdating: isPublishedInstall(),
      ...staged ? { staged } : {}
    };
  },
  sessions: async () => ({ sessions: await sessions(), agent: AGENT.label }),
  send,
  "repo-path": async (ref) => ({ path: await pathFor(ref) }),
  "repo-link": async (mapping) => {
    const validated = await validate(mapping);
    await link(validated);
    return validated;
  },
  "repo-unlink": async (ref) => ({ repos: await unlink(ref) }),
  repos: async () => ({ repos: await readRepos() }),
  settings: describeSettings,
  "settings-save": async (next) => {
    await writeSettings(next);
    return await describeSettings();
  },
  "pr-worktree": openWorktree2,
  "pr-session": openSession,
  "agent-prompt": agentPrompt,
  "agent-status": agentStatus,
  "pane-focus": paneFocus,
  "build-investigate": investigateBuild,
  tweaks,
  "tweak-file": tweakFile
};
async function handle(type, body) {
  const handler = handlers[type];
  if (!handler)
    throw new Error(`unknown request "${type}"`);
  return await handler(body ?? {});
}

// packages/bridge/src/host.ts
var HEADER = 4;
var MAX_REPLY = 1024 * 1024;
if (process.argv.includes("--selftest")) {
  process.stdout.write(`bridge ok
`);
  process.exit(0);
}
function write(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_REPLY) {
    write({
      id: "id" in message ? message.id : null,
      error: `reply of ${body.length} bytes exceeds the 1 MB native messaging limit`
    });
    return;
  }
  const header = Buffer.alloc(HEADER);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}
var buffer = Buffer.alloc(0);
var askedOnVersion = false;
function noticeAddonVersion(request) {
  const wanted = request.minBridge ?? request.version;
  if (askedOnVersion || !wanted || !isNewer(wanted, VERSION))
    return;
  askedOnVersion = true;
  maybeUpdate({ urgent: true });
}
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= HEADER) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < HEADER + length)
      break;
    const body = buffer.subarray(HEADER, HEADER + length);
    buffer = buffer.subarray(HEADER + length);
    let request;
    try {
      request = JSON.parse(body.toString("utf8"));
    } catch (error) {
      write({ id: null, error: `could not parse request: ${error.message}` });
      continue;
    }
    noticeAddonVersion(request);
    handle(request.type, request.body).then((result) => write({ id: request.id, result })).catch((error) => write({ id: request.id, error: error.message }));
  }
});
process.stdin.on("end", () => process.exit(0));
maybeUpdate();
if (!isPublishedInstall()) {
  watchCheckout(() => write({ event: "tweaks-changed" })).catch((error) => {
    console.error("[browser-tweaks host] cannot watch the tweak build", error);
  });
}
process.on("uncaughtException", (error) => {
  console.error("[browser-tweaks host]", error);
});
