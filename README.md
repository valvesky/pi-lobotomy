# Pi Lobotomy

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js: 22.19+](https://img.shields.io/badge/Node.js-22.19%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Pi: 0.99.1+](https://img.shields.io/badge/Pi-0.99.1%2B-purple)](https://pi.dev)

[![BongBong dancing from Lobotomy Corporation](https://media1.tenor.com/m/c8WDVFXXQlMAAAAC/bongbong-lobotomy-corp.gif)](https://tenor.com/view/bongbong-lobotomy-corp-lobotomy-corporation-gif-26193236)

Lobotomy Corporation inspired coding subagents for [Pi](https://pi.dev).

This plugin is **tmux only!**

## Install

```sh
git clone https://github.com/valvesky/pi-lobotomy
pi install pi-lobotomy
```

## Use

Ask Pi to delegate by name, or request a team member directly (names are case-insensitive):

```text
/subagent Gebura Map the authentication code and report the important files.
```

| Name | Team alias | Focus |
|---|---|---|
| Angela | Parent session | Coordination: scope, integration, reporting |
| Yesod | `information` | Research and evidence |
| Gebura | `disciplinary` | Fast codebase scouting |
| Netzach | `safety` | Safety and failure paths |
| Hod | `training` | Tests and verification |
| Chesed | `welfare` | Documentation and workflows |
| Binah | `extraction` | Code review |

Results arrive automatically. The parent can steer agents with `subagent_message`; children can ask the parent questions. Writers require explicit file ownership (`write_scope`), and overlapping sibling assignments are rejected. Three assignments can run at once by default.

Bundled roles currently use `openai-codex/gpt-6-luna`; that model must be available to child sessions. Override profiles in `.pi/agents/` or `~/.pi/agent/agents/` to use your own models and tools. Ownership and tool restrictions are coordination aids, **not a sandbox**.

See [usage and configuration](docs/usage.md) for tool examples, custom profiles, concurrency, and lifecycle details. This package does not include or select a theme.

## Credits

Fork of [amosblomqvist/pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents), derived from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents). MIT licensed.
