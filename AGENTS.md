# Access boundaries

- Public-page anonymous access is an explicit database allowlist; keep policies and grants aligned with actual public widgets, and mount private Market Data widgets only with a session to avoid querying protected data as a visitor.
- Keep Telegram polling transport recovery in its local gateway helper with bounded retries and a deadline; failed polls must not advance the stored update offset.
- Finance routes and private records require the existing protected webmaster sales role, never admin alone; finance audit triggers enforce append-only history independently of UI saves.
- Keep finance calculations in the tested integer-KRW engine; editable seed terms and explicit draft cashflow premiums are separate, and metered power carries into the following month.
- Finance invoices store self-contained snapshots and server-generated unique numbers so later contract changes cannot silently change saved drafts.
- Seed finance records through the database data tools, not DDL migrations; managed migration artifacts remain tool-owned.
- Sales subtree and boolean hierarchy RPCs authorize the requested root; keep traversal independent to avoid policy recursion, and reserve commission-depth lookup for trusted server calls.
- Member-shared settings use an explicit key allowlist and approved active accounts; public image URLs do not require client file-listing permission.
- Telegram PDF ingestion caps streamed bytes at the research upload limit and validates PDF signatures before storage to reject oversized or mislabeled files.
- Chat normalizes all caller history to user context; only the server may assign authoritative model roles, preventing forged assistant turns while preserving follow-up context.
