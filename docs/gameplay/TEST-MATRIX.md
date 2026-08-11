# Participation Policy Test Matrix

## Status

Executable verification matrix for the participation-policy runtime task.
This file describes expected tests; it does not implement them.

| ID | Scenario | Expected |
| --- | --- | --- |
| P01 | Current `DAILY` correct completion | XP, Daily streak, and leaderboard entry are applied. |
| P02 | Archived `DAILY` correct completion | XP is awarded; Daily streak and leaderboard are not changed. |
| P03 | `PREMIUM` correct completion | XP is awarded; Daily streak and leaderboard are not changed. |
| P04 | Archive completion reprocessed | No duplicate XP, no streak mutation, no leaderboard row. |
| P05 | Premium completion reprocessed | No duplicate XP, no streak mutation, no leaderboard row. |
| P06 | Premium played without current Daily | Daily streak remains unchanged. |
| P07 | Archive played without current Daily | Daily streak remains unchanged. |
| P08 | Weekly leaderboard after Premium completion | Premium completion is absent from weekly competition. |
| P09 | Weekly leaderboard after Archive completion | Archive completion is absent from weekly competition. |
| P10 | Current `DAILY` path | Existing current-daily reward and leaderboard behavior is preserved. |
| P11 | Future `DailyCase` ID | Start is rejected server-side. |
| P12 | Free user starts `PREMIUM` | Start is forbidden. |
| P13 | Premium user starts `PREMIUM` | Start is allowed. |
| P14 | Same `Case` in two assignments | Progress remains independent by `dailyCaseId`. |
| P15 | Archive completion | Learn/review remains available after completion. |
| P16 | Premium completion | Learn/review remains available after completion. |
| P17 | Current Daily near Wardle-day boundary | Current-day eligibility uses the shared Wardle-day helper. |
| P18 | Archive release near Africa/Nairobi/UTC boundary | Released historical assignment is playable; future assignment is not leaked. |
| P19 | Current Daily completion reprocessed | `xpAwardedAt`, streak same-day idempotency, and leaderboard upsert prevent duplicate effects. |
| P20 | Client submits forged eligibility flags | Server ignores/rejects them and derives participation context from assignment data. |
| P21 | `PRACTICE` completion after policy decision | Applies configured XP policy; never mutates Daily streak or leaderboard. |
| P22 | Incorrect completion or exhausted attempts | Behavior is explicitly characterized for XP and Learn without affecting Daily streak or leaderboard unless policy says otherwise. |

## Required Evidence

Later implementation should include focused assertions for:

- Resolver context derivation from `DailyCase.date`, `track`, release state, and
  authenticated user tier.
- XP idempotency through `GameSession.xpAwardedAt`.
- Streak mutation only for `CURRENT_DAILY`.
- Leaderboard writes only for `CURRENT_DAILY`.
- Weekly leaderboard exclusion for Archive, Premium, and Practice contexts.
- Learn visibility after completed non-competitive sessions.
- Server-side rejection of future/unreleased assignments.
- No client-controlled eligibility fields.
