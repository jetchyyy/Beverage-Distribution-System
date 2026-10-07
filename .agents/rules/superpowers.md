# Superpowers Methodology Rule

Superpowers is an agentic software development methodology that enforces disciplined engineering workflows.

## Mandatory Skill Invocation

- **Check and invoke relevant skills BEFORE any response or action** (including clarifying questions, exploring the codebase, or checking files).
- When a skill applies, announce: `Using [skill-name] to [purpose]` and strictly adhere to its workflow.

## Core Process Lifecycles

1. **Creative & Feature Work → `brainstorming`**
   - For new features, components, architectural changes, or UX behaviors: explore user intent, requirements, and design first.
   - Present designs in digestible, bite-sized sections. Do not jump straight to coding.

2. **Planning → `writing-plans`**
   - Create comprehensive implementation plans with bite-sized tasks, exact file paths, test criteria, and verification commands.
   - Track progress using a markdown task artifact (`write_to_file` with `IsArtifact: true`, updating steps as completed).

3. **Implementation & Execution → `test-driven-development` / `subagent-driven-development` / `executing-plans`**
   - Follow strict Red-Green-Refactor TDD: write a failing test or assertion check first, implement the minimal passing code, then refactor.
   - Keep tasks isolated and verify each task before moving to the next.

4. **Bugs & Failures → `systematic-debugging`**
   - When encountering a bug, error, or test failure: perform root-cause investigation across 4 phases before proposing or writing fixes. Never guess or apply speculative patches.

5. **Completion → `verification-before-completion`**
   - Before claiming any task or fix is complete, execute automated tests, build commands, or typecheck (`npm run build`, `npm test`, linters) and verify clean output. Evidence before assertions always.
