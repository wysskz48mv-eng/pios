# Citation Graph Bootstrap + Cron Operations Guide

Last updated: 2026-04-11

This runbook covers day-1 setup, scheduled runs, manual reruns, and troubleshooting for the citation graph pipeline.

## 1) What Runs in Production

- Scheduled endpoint: `GET /api/cron/citation-graph`
- Schedule: daily at `04:00 UTC` (configured in `vercel.json`)
- Auth mode: cron secret (`Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`)
- Runtime budget: `300s`

The pipeline performs:

1. Query-based ingestion from Crossref + OpenAlex.
2. Upsert of papers, authors, and author-paper links.
3. Influence score recomputation.
4. Trend row refresh for key fields.

## 2) Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Recommended:

- `CITATION_GRAPH_BOOTSTRAP_QUERIES` (comma-separated)
- `CITATION_GRAPH_QUERY_LIMIT` (10-50, default 30)
- `CITATION_GRAPH_CRON_ACTOR_USER_ID` (valid auth user UUID)

If `CITATION_GRAPH_CRON_ACTOR_USER_ID` is not set, event-history rows are not stored in `pios_ingestion_events`.

## 3) Manual Operator Rerun

Manual rerun is now supported via authenticated POST:

- Endpoint: `POST /api/cron/citation-graph`
- Auth mode: admin/seed secret
- Header options:
  - `Authorization: Bearer <ADMIN_SECRET>`
  - `x-admin-secret: <ADMIN_SECRET>`
  - `x-seed-secret: <SEED_SECRET>`

Example:

```bash
curl -X POST "https://<your-domain>/api/cron/citation-graph" \
  -H "x-admin-secret: $ADMIN_SECRET"
```

Response includes counters:

- `papers_ingested`
- `authors_upserted`
- `links_upserted`
- `papers_scored`
- `trend_rows_refreshed`
- `elapsed_s`
- `event_logging_enabled`

## 4) Monitoring

UI surface:

- Platform -> Academic -> Literature -> My Library
- Buttons:
  - `Graph Stats`
  - `Cron Status`

`Cron Status` reads from `/api/citation-graph/analytics` action `get_cron_status`.

Output includes:

- `last_run`
- `recent_runs`
- `success_count`
- `failure_count`
- `event_logging_enabled`

## 5) Failure Behavior

When the pipeline throws:

- Endpoint returns `500` with partial counters and error message.
- If `CITATION_GRAPH_CRON_ACTOR_USER_ID` is configured, a failed event row is written with status `failed`.

## 6) Quick Troubleshooting

1. `Unauthorized` on cron schedule:
- Verify `CRON_SECRET` in runtime environment.
- Ensure scheduler is sending bearer or `x-cron-secret`.

2. Manual rerun unauthorized:
- Verify `ADMIN_SECRET` or `SEED_SECRET` is present and passed in headers.

3. No run history in Cron Status:
- Set `CITATION_GRAPH_CRON_ACTOR_USER_ID` to a valid user UUID.

4. Low/no ingestion counts:
- Check query quality in `CITATION_GRAPH_BOOTSTRAP_QUERIES`.
- Increase `CITATION_GRAPH_QUERY_LIMIT` cautiously.

5. Slow runtime:
- Reduce query count or per-query limit.
- Consider splitting runs (morning/evening) if corpus grows.
