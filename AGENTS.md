This repository is `gornitsa-kit`, the shared CI kit of the «Горница» studio: composite actions and
reusable workflows (`workflow_call`) that the studio's games call instead of keeping copies —
RuStore upload, auto-merge by the `ревью: ок` label, Android signing key, signature and APK contents
checks. Documents are in Russian; this file is in English.

## Studio charter — read first

This project belongs to the «Горница» studio. Studio-wide rules live only in the public
charter repository `Nefeste/gornitsa` (https://github.com/Nefeste/gornitsa); this repository
keeps only what is specific to the project. Before changing anything — and after a context
reset — read the charter's `AGENTS.md`, then `docs/05-rules.md` (hard rules for every game)
and `docs/04-process.md` (how work is done). Raw files:
`https://raw.githubusercontent.com/Nefeste/gornitsa/main/<path>`.

Current state of this project: `STATUS.md` (it is not repeated here).

Precedence: the owner's recorded decision → the charter → this project's documents. A project
rule may narrow a charter rule, never weaken it. If a document here restates or contradicts
the charter, replace it with a link or report the contradiction to the owner.

## What lives here and why

Studio ADR 0002 (revised by the owner on 03.10.2026): code is still copied between games, but the
CI starts living here. What moves from copies into the kit, and when, is decided by studio ADRs.
`README.md` lists every action and workflow, its inputs and how a game calls it;
`docs/migration.md` — how each game switches from its copy.

## Hard rules of this repository

- **The repository is public** (studio ADR 0017): never put secrets, private repository details,
  internal hostnames or player data into code, tests, examples or PRs. Secrets reach the kit only as
  inputs or `secrets:` of the caller.
- **Everything here is an owner path** (`.github/CODEOWNERS` is `*`): only the owner merges, and a
  change here changes CI of every game. Never merge, never label `ревью: ок`, never create or move
  tags — tags are the owner's.
- **Compatibility within a major version.** Games call `@v1`. Inside `v1` an input may be added only
  with a default that keeps the old behaviour; renaming or removing an input, changing a default or
  an output is `v2`. Reusable workflows call the kit's own actions at the same major tag.
- **Security of auto-merge** stays as in Votchina: the caller runs on `pull_request_target` and
  `workflow_run`, only `.github` of the default branch is checked out, the label approves a commit
  (`--match-head-commit`), CODEOWNERS is parsed by `actions/automerge/owned.mjs`. Never check out
  or run PR code in it.
- Scripts are plain Node 22 ESM without dependencies; logic that can be tested lives in `.mjs` files
  with exported functions and tests in `test/` (`node --test test/*.test.mjs`), shell stays thin.

## Commands

```bash
node --test test/*.test.mjs                 # tests of the scripts (no network)
shellcheck -S warning actions/automerge/automerge.sh
docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:1.7.7   # what CI runs on workflows
```

Run the tests and shellcheck before every push; CI (`.github/workflows/ci.yml`) also runs actionlint.
