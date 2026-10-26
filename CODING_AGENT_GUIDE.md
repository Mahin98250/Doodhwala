# Coding Agent Guide — Doodhwala

Read this before making any change. These instructions apply to every coding agent and human contributor.

## Before you start

1. Read `PROJECT_CONTEXT.md`, `TASK_BOARD.md`, and `README.md`.
2. For Supabase work, also read `SUPABASE_SETUP.md` and the relevant security/payment docs.
3. Inspect the current branch, `git status`, recent commits, open PRs, and the actual code paths. The documentation may be stale; source code and merged commits are the evidence.
4. Select one task from `TASK_BOARD.md`. If none fits, propose a task and acceptance criteria before making a broad change.
5. Confirm no one else is already changing the same files. Claim the task by setting its status to `IN PROGRESS`, recording the owner and branch, and updating the task issue/PR when one exists.

## Branch and pull request workflow

- Never commit feature work directly to `main`.
- Use a small branch such as `fix/mobile-checkout`, `feat/delivery-summary`, or `docs/task-board`.
- Keep each PR focused on one task. Avoid unrelated refactors.
- Before requesting review: inspect `git diff`, run `git diff --check`, discover the real test/build commands from repository configuration, and run relevant checks.
- In the PR description include: task ID, purpose, changed files, test commands and actual results, manual test steps, screenshots for UI changes, migration/deployment notes, and known limitations.
- Request review from another teammate. Do not merge your own work unless the project owner explicitly authorizes that workflow.
- After merge, update `TASK_BOARD.md` and, for meaningful architecture or status changes, `PROJECT_CONTEXT.md` with factual evidence.

## Collaboration and conflict prevention

- Do not overwrite, reset, force-push, or discard another person's work.
- Do not edit files another owner has claimed without coordinating first.
- Keep commits small and use descriptive messages.
- If a task becomes larger than expected, stop and split it into smaller tasks rather than making a risky all-at-once change.
- If network access or a coding session stops, preserve changes. On resume, inspect branch/status and remote updates before continuing.

## Product and security guardrails

- Doodhwala serves independent neighbourhood milk providers, not large packaged dairy brands.
- Keep the experience mobile-first and responsive on desktop; aim for polished, clear interactions without sacrificing existing working behavior.
- Never present demo listings as real providers.
- Never claim a feature is production-ready, deployed, tested, compliant, or successful without evidence.
- The current payment foundation is not a live automated payment gateway. Do not enable real-money collection or claim bank-verified success. Direct UPI seller confirmation is seller-attested only.
- Never expose Supabase service-role keys or other secrets in browser code, commits, issues, screenshots, logs, or docs. Do not collect card details, CVV, UPI PINs, OTPs, or banking passwords.
- Treat database/RLS/Edge Function changes as security-sensitive. Use staging and test authorization for customer, provider, and admin roles.
- Do not deploy migrations or change production configuration without explicit approval and a rollback plan.

## Required end-of-task report

Report these items clearly:
1. **Task ID and status**
2. **What changed** (file paths)
3. **Branch and PR link**
4. **Checks run** (commands + pass/fail; say “not run” when applicable)
5. **Manual testing still needed**
6. **Risks, blockers, and next step**
7. **Docs/task board updated:** yes/no

A generated patch is not automatically a completed task. Mark a task DONE only when acceptance criteria are met, the change is reviewed/merged or explicitly accepted, and evidence is recorded.
## Team roles and task delegation

- **Project lead / final decision-maker: Mahin Patel (@Mahin98250).** The project lead sets priorities, assigns tasks, approves scope changes, and makes final product decisions.
- **Assistant contributor: Vaidik Patel (@vaidikpatel22112010-tech).** Work on the task explicitly assigned by the project lead, follow its acceptance criteria, and keep implementation aligned with the project context and coding standards.
- The assistant contributor may recommend improvements, identify risks, and propose follow-up tasks, but must not silently expand scope or override the project lead's decisions.
- Before starting, acknowledge the task, summarize the intended approach, identify dependencies, and create/use a dedicated branch. If a requirement is unclear or conflicts with existing behavior, ask before making a high-impact assumption.
- Send concise progress updates at meaningful checkpoints: investigation complete, implementation complete, checks complete, and blockers. Do not claim work is complete until evidence and test results are reported.
- If blocked, report the exact blocker, what was tried, and the smallest decision or access needed. Do not work around permissions, expose secrets, or change production systems to bypass a blocker.
- The project lead reviews the result through a pull request. Follow review feedback, make requested corrections, and wait for explicit approval before merging or deploying.
- Be respectful and professional. Task ownership defines decision authority for the project; it does not remove the responsibility to raise security, reliability, or data-loss concerns.
