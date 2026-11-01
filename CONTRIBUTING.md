# Contributing to Doodhwala

Doodhwala is built collaboratively by the project owner (Mahin Patel), teammates (Vaidik Patel), and coding agents.

## Start here

1. Read [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md), [TASK_BOARD.md](./TASK_BOARD.md), and [CODING_AGENT_GUIDE.md](./CODING_AGENT_GUIDE.md).
2. Check open GitHub Issues and Pull Requests before starting. Avoid duplicate or overlapping work.
3. Select one task, confirm its acceptance criteria, and agree on one owner.
4. Claim it in the GitHub Issue (assignee/status/branch) and update the task board summary if needed.
5. Create a branch from the latest `main`; do not commit feature work directly to `main`.

## Suggested workflow

```bash
git switch main
git pull --ff-only
git switch -c feat/short-task-name
# make one focused change
git diff --check
# inspect package/config files and run the real project checks
git add <specific-files>
git commit -m "feat: describe the change"
git push -u origin feat/short-task-name
```

Open a pull request and use the repository PR template. Link the task issue in the PR body (for example, `Closes #123` when the PR fully completes that issue). Request a review from the other teammate.

## Shared task tracking

- GitHub Issues are the live source for each task's assignee, discussion, checklists, and status.
- `TASK_BOARD.md` is the human-readable overview and starter queue. Keep it aligned with important task changes, but do not use simultaneous edits to the Markdown file as the only way to coordinate.
- `PROJECT_CONTEXT.md` records architecture, important decisions, current verification boundaries, and session handoff.
- `CODING_AGENT_GUIDE.md` sets the required rules for all coding agents.

## Done means verified

A task is done only when its acceptance criteria are satisfied, relevant checks are recorded, the change is reviewed/merged or explicitly accepted, and the task issue is updated. A successful static build alone does not prove real authentication, database permissions, Realtime, payment, GPS, or physical-device behavior.

## Security

Never commit secrets, service-role keys, credentials, OTPs, banking information, or customer personal data. Do not deploy migrations or change production configuration without explicit authorization and a rollback plan.
