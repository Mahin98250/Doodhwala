# Pinned billing fixture — not migrations

These six unmodified SQL files are a **test-only snapshot** of [PR #71](https://github.com/Mahin98250/Doodhwala/pull/71) at commit `18fc96802e001d5b4d98b84ffe400cca2a5fbc70`. They are kept outside `supabase/migrations/` because that PR is unmerged/conflicting and staging already contains earlier billing objects with different recorded history. Do not apply these fixture copies to staging or production.

`scripts/sql-tests/test-pr71-plan-integration.sh` checks every file's SHA-256 against the reviewed commit before using them in a new disposable database. The tests reproduce the existing ledger and exercise the deferred follow-ups; they do not deploy billing, establish real Supabase grants, confirm a bank transfer, or approve the pilot.
