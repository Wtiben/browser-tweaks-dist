# browser-tweaks-dist

Signed builds of [browser-tweaks](https://github.com/Wtiben/browser-tweaks) and the update
manifest Firefox polls. Artifacts only — the source lives in the private repo.

This exists because AMO signs unlisted add-ons but does not serve update checks for them.
An installed copy finds new versions through `updates.json` here, which is why this repo is
public: Firefox fetches it unauthenticated, so a private repo would be unreachable to it.

Nothing here is written by hand. `pnpm release` in the source repo builds, signs through
AMO, drops the `.xpi` in and regenerates `updates.json` from the files present.

| | |
|---|---|
| update manifest | <https://wtiben.github.io/browser-tweaks-dist/updates.json> |
| latest install | see the newest `browser-tweaks-*.xpi` above |
