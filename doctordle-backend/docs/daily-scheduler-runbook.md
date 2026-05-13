# Daily Case Scheduler Runbook

Wardle daily scheduling is explicit. Gameplay reads do not create `DailyCase`
rows. Scheduling happens through API startup catch-up, API cron, or the guarded
manual endpoint.

## Production Configuration

Set these on the API process:

```env
APP_PROCESS_ROLE=api
DAILY_SCHEDULER_ENABLED=true
DAILY_SCHEDULE_WINDOW_DAYS=7
DAILY_SCHEDULE_TIMEZONE=Africa/Nairobi
DAILY_SCHEDULE_CRON=5 0 * * *
```

Set this on worker process types:

```env
APP_PROCESS_ROLE=worker
```

Only `APP_PROCESS_ROLE=api` is eligible to run scheduling. Workers may load the
scheduler module through shared imports, but startup catch-up and cron stay
disabled there.

## Expected Logs

API boot:

```txt
daily_case.schedule.startup_catchup.started
daily_case.schedule.lock.acquired
daily_case.schedule.window.started
daily_case.schedule.window.completed
daily_case.schedule.startup_catchup.completed
```

Daily cron:

```txt
daily_case.schedule.cron.started
daily_case.schedule.cron.completed
```

Worker/runtime disabled:

```txt
daily_case.schedule.runtime_disabled
daily_case.schedule.cron.disabled
daily_case.schedule.startup_catchup.disabled
```

Lock contention:

```txt
daily_case.schedule.lock.busy
daily_case.schedule.lock.skipped
```

Redis unavailable fallback:

```txt
daily_case.schedule.lock.unavailable
```

The database transaction still uses the Postgres advisory lock as the final
duplicate-scheduling guard.

## Production Smoke Check

Use the same internal API key configured in env as `INTERNAL_API_KEY`. Do not
paste the literal secret into this document.

PowerShell:

```powershell
$env:INTERNAL_API_KEY = (Select-String -Path .env -Pattern '^INTERNAL_API_KEY=').Line.Split('=', 2)[1]
```

Bash:

```bash
set -a
. ./.env
set +a
```

```bash
curl -sS \
  -H "x-internal-key: $INTERNAL_API_KEY" \
  "$API_BASE_URL/api/internal/daily-cases/scheduler/status"
```

Confirm:

```json
{
  "configuredEnabled": true,
  "enabled": true,
  "processRole": "api",
  "eligibleProcessRole": "api",
  "windowDays": 7,
  "timezone": "Africa/Nairobi",
  "lockKey": "daily_case:scheduler:ensure_window"
}
```

Trigger a repair run:

```bash
curl -sS -X POST \
  -H "content-type: application/json" \
  -H "x-internal-key: $INTERNAL_API_KEY" \
  -d '{"days":7}' \
  "$API_BASE_URL/api/internal/daily-cases/ensure-window"
```

Expected result:

- Existing slots are preserved.
- Missing future DAILY slots are created when eligible inventory exists.
- Re-running the command does not duplicate slots.
- If another scheduler run is active, the response reports `skipped_locked`.

Then verify gameplay remains read-only:

```bash
curl -sS "$API_BASE_URL/api/game/today"
```

If no slot exists, this endpoint should not create one. Use the manual endpoint
above to repair scheduling.

## Triage

If no case appears for today:

1. Check `/api/internal/daily-cases/scheduler/status`.
2. Confirm the API process has `APP_PROCESS_ROLE=api`.
3. Confirm workers have `APP_PROCESS_ROLE=worker`.
4. Look for `daily_case.schedule.window.completed` and inspect `missingDates`.
5. Look for `daily_case.schedule.case.excluded` reasons:
   - `already_scheduled`
   - `invalid_clues`
   - `missing_diagnosis`
   - `missing_explanation`
   - `invalid_status`
6. Trigger the manual repair endpoint.

Do not repair by adding scheduling back to gameplay reads.
