# Access boundaries

- Public-page anonymous access is an explicit database allowlist; keep policies and grants aligned with actual public widgets, and mount private Market Data widgets only with a session to avoid querying protected data as a visitor.
- Keep Telegram polling transport recovery in its local gateway helper with bounded retries and a deadline; failed polls must not advance the stored update offset.