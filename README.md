# Pi Lobotomy

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js: 22.19+](https://img.shields.io/badge/Node.js-22.19%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Pi: 0.99.1+](https://img.shields.io/badge/Pi-0.99.1%2B-purple)](https://pi.dev)

[![BongBong dancing from Lobotomy Corporation](https://media1.tenor.com/m/c8WDVFXXQlMAAAAC/bongbong-lobotomy-corp.gif)](https://tenor.com/view/bongbong-lobotomy-corp-lobotomy-corporation-gif-26193236)

Angela-coordinated coding teams for [Pi](https://pi.dev), with asynchronous subagents in tmux panes. Bundled roles cover research, scouting, testing, documentation, safety, and review.

## Install

Requires **Pi 0.99.1+**, **Node.js 22.19+**, and **tmux**. Run Pi inside a tmux session to launch subagents.

From a checkout:

```sh
pi install /absolute/path/to/pi-lobotomy
```

Restart Pi, then start working from your target project's directory. No build step, profile copying, or theme setup is needed. Local installs load the checkout directly; `npm ci` is only needed for development checks.

To install only for one project, run `pi install --local /absolute/path/to/pi-lobotomy` from that project.

Do not load this alongside `pi-interactive-subagents`: they register the same tools. Remove the old package first with `pi remove <old-source>`. If you installed this checkout before it was renamed, replace its old `pi-angela` path in your Pi package settings.

## Use

Ask Pi to delegate, or request a team member directly using their profile ID:

```text
/subagent gebura Map the authentication code and report the important files.
```

| Name | Profile ID | Focus |
|---|---|---|
| Angela | Parent session | Coordination: scope, integration, reporting |
| Yesod | `yesod` | Research and evidence |
| Gebura | `gebura` | Fast codebase scouting |
| Netzach | `netzach` | Safety and failure paths |
| Hod | `hod` | Tests and verification |
| Chesed | `chesed` | Documentation and workflows |
| Binah | `binah` | Code review |

Results arrive automatically. The parent can steer agents with `subagent_message`; children can ask the parent questions. Writers require explicit file ownership (`write_scope`), and overlapping sibling assignments are rejected. Three assignments can run at once by default.

Bundled roles currently use `openai-codex/gpt-6-luna`; that model must be available to child sessions. Override profiles in `.pi/agents/` or `~/.pi/agent/agents/` to use your own models and tools. Ownership and tool restrictions are coordination aids, **not a sandbox**.

See [usage and configuration](docs/usage.md) for tool examples, custom profiles, concurrency, and lifecycle details. This package does not include or select a theme.

## Credits

Fork of [amosblomqvist/pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents), derived from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents). MIT licensed.
