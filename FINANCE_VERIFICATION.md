# Finance portal verification

- New `/finance/*` pages use a webmaster-only guard; admin alone is insufficient. Existing routes are unchanged.
- Ten new finance tables have four explicit authenticated webmaster policies each, zero anonymous grants, and an immutable trigger-written audit log. Private files have dedicated webmaster-only policies.
- Supplied three projects, ten tasks and company row were seeded using the database data tool. Schema migrations live in the managed `drizzle/migrations` tree; seed DML is not submitted as a migration, per platform restrictions.
- 19 focused tests passed: exact deposit schedule, cashflow, annual rent escalation, first 12 service-fee months, next-month metered power, integer KRW, deposit progress and webmaster gate.
- Real requesting-user webmaster browser session: all twelve deep links loaded; temporary task create, refresh read and delete passed; monthly actual paid/deposit read-back passed; two-line English invoice saved and print layout rendered without page chrome; audit mutation was rejected. Temporary financial records were deleted; their audit entries intentionally remain.
- Desktop 1280x1800 and mobile 390x844 reviewed. Mobile document width equals viewport width.
- Non-webmaster browser behavior is covered by gate tests and database policy inspection. Live impersonated SQL check was unavailable because the query service cannot switch database roles. No other user's session was minted.
- Company address, business registration and Korean legal name remain blank pending confirmation. Silver River unsigned draft and conflicting dates remain flagged.
- Nothing was published. Database additions are already applied to the shared backend.
