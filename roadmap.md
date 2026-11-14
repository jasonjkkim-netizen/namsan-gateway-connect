# Access review

## Landing-page brand contrast
- [x] Improve logo and name contrast with champagne gold, keeping the original font style and exact logo lettering.
- [x] Verify the logo loads and both screen layouts remain readable.

## Telegram polling repair
- [x] Confirm gateway error handling: parsing occurred before status checking and no transient retry existed.
- [x] Add bounded transient retries and safe response parsing without advancing offset on failed polls.
- [x] Pass 7 transport tests, deploy and verify new error handling in live logs; resolve the cited parsing/retry defect.
- [ ] Verify a newly received Telegram message/PDF: blocked by live Telegram 409 conflict with another getUpdates consumer; identify the competing bot instance before another real poll.

- [x] Verify administrator data reads and customer-management UI, including after cleanup.
- [x] Verify 조영관 manager session and record the foreign-hierarchy exposure.
- [ ] Verify 임현식 customer session: blocked because login approval was declined; user sign-in is required.
- [x] Define existing public pages and remove unrelated anonymous policies/grants without widening sensitive data.
- [x] Verify signed-out public pages and denied private data after policy cleanup.
- [x] Record and report confirmed access defects separately from public-access cleanup.
## Internal finance portal
- [x] Add webmaster-only routes and database protection without changing existing permissions.
- [x] Build cashflow, projects, receivables, staff, deadlines, documents, invoices, history and company screens.
- [x] Populate supplied projects, tasks and company defaults.
- [x] Verify cashflow/deposit/gate tests and signed-in save/read flows; do not publish.
