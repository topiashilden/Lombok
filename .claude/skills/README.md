# Claude Code skills for Solvo

Design and UX skills that Claude loads automatically when it works in this repo. They are tooling for Claude, not app code, and are not part of the build.

| Skill | Use it for | Source | Licence |
|---|---|---|---|
| `ui-ux-pro-max` | Design system, colours, type, mobile touch and accessibility rules, fintech/banking guidance. Core skill only. | github.com/nextlevelbuilder/ui-ux-pro-max-skill (v2.15.0) | MIT |
| `frontend-design` | A distinct visual direction instead of the default template look | github.com/anthropics/skills | Apache 2.0 |
| `web-design-guidelines` | Reviewing screens against Vercel's Web Interface Guidelines (fetches the rules from GitHub) | github.com/vercel-labs/agent-skills | MIT |
| `react-view-transitions` | Smooth native-feeling screen and state animations in Next.js | github.com/vercel-labs/agent-skills | MIT |

Local changes: `ui-ux-pro-max` calls its search script by a repo-relative path (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py ...`, run from the repo root) instead of `${CLAUDE_PLUGIN_ROOT}`, and its test folder is left out.
