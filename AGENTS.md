# Repository AI Agent Guidelines & Skills Integration

This repository is configured with **Superpowers**, **Ponytail**, and **Caveman** methodologies and skills. All agents operating in this codebase must adhere to these principles.

---

## 1. Skill Invocations & Workflow Lifecycle (Superpowers)

Always check and invoke relevant skills in `.agents/skills/` before executing actions:

- **Ideation & Features (`brainstorming`)**: Discuss requirements and explore design in digestible chunks before writing plans or code.
- **Planning (`writing-plans`)**: Break features and refactors into bite-sized, independently testable steps with verification criteria. Track progress with task checklists.
- **Execution & TDD (`test-driven-development` / `subagent-driven-development` / `executing-plans`)**: Write failing checks/tests first, write minimal passing implementation, refactor cleanly.
- **Debugging & Error Fixing (`systematic-debugging`)**: Perform thorough 4-phase root cause analysis before making code edits. Never guess or apply speculative hotfixes.
- **Completion Verification (`verification-before-completion`)**: Run tests and build checks (`npm run build`, linters) and verify clean results before declaring done.

---

## 2. Engineering Standards (Ponytail - Lazy Senior Dev)

- **Stop at the first rung that holds**:
  1. *YAGNI*: Does this need to be built?
  2. *Codebase Reuse*: Does a utility or component already exist in this repo? Reuse it.
  3. *Standard Library*: Can standard JS/TS/Web APIs do it natively?
  4. *Platform Features*: Can React/Vite/Tailwind built-in features handle it?
  5. *Existing Deps*: Avoid new dependencies if installed packages can solve it.
  6. *Minimal Diff*: Shortest working diff wins once the problem is understood.
- **Root cause over symptom**: Fix shared functions rather than scattering patches across call sites.
- **No unrequested complexity or boilerplate**.

---

## 3. Communication & Tone (Caveman High-Signal)

- **Answer first**: State solutions and key results upfront.
- **Zero fluff**: Omit conversational filler, sycophantic greetings, and redundant closers.
- **Payload verbatim**: Keep code, commands, diffs, paths, and errors 100% precise.
- Support `/caveman`, `/ultracave`, `/ponytail`, `/ponytail-review` on demand.

---

## Available Workspace Skills

All 43 modular skills are available under `.agents/skills/`:
- **Superpowers**: `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `dispatching-parallel-agents`, `writing-skills`, `diagnosing-superpowers`, `using-superpowers`.
- **Caveman**: `caveman`, `ultracave`, `megacave`, `caveman-commit`, `caveman-review`, `caveman-compress`, `caveman-discover`, `caveman-evidence-review`, `caveman-explore`, `caveman-help`, `caveman-learn`, `caveman-manage`, `caveman-optimize`, `caveman-setup`, `caveman-stats`, `cavecrew`, `investigate-first`, `lean-build`, `migration`, `safe-refactor`, `surgical-patch`, `verify-and-stop`.
- **Ponytail**: `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review`.
