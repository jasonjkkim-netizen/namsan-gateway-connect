# Public pages and member access review

## Public pages

| Page | Signed-out access |
| --- | --- |
| `/` | Company introduction |
| `/market-data` | Active market indices, market overview, viewpoints and weekly stock picks |
| `/news` | Active interest news |
| `/blog` | Active blog posts |
| `/login`, `/join`, `/forgot-password`, `/reset-password` | Account workflows, not access to member data |

All remaining application pages require sign-in. Products, research, flagship portfolios, stock-pick news, popup promotions, personal profiles, investments, distributions, commissions, roles and internal settings are not anonymous data sources. Public image buckets remain public media; this change does not alter their storage rules.

Anonymous table access is read-only and limited to six active-content sources: `blog_posts`, `interest_news`, `namsan_viewpoints`, `market_indices`, `market_overview_items`, `weekly_stock_picks`. Redundant deny policies were removed; private-table grants were revoked, remaining member policies were explicitly scoped to authenticated users, and application database functions no longer allow anonymous execution. Existing authenticated policy predicates were preserved.

## Actual member-session results before cleanup

- Administrator 김종국: 28 profiles, 7 investments, 6 products, 7 commission distributions; reads succeeded without permission errors.
- Manager 조영관: 1 own profile, 0 investments, 0 commission distributions; manager summaries returned 1 self profile and 0 investments. Admin page redirected to dashboard. This account has no downline, so the empty organization view matches stored data.
- Important defect: 조영관 could call the legacy generic hierarchy function with another manager identity and retrieve 14 organization members. Signed-in hierarchy authorization requires a separate repair; anonymous cleanup alone does not fix this.
- Customer 임현식: actual customer-session test was not authorized. Database has one investment for this customer; own-row investment policy was reviewed but customer UI isolation remains unverified.

## Post-cleanup verification

- All six anonymous content sources returned HTTP 200; profiles, investments, commissions, products and research returned HTTP 401.
- Browser visits to Home, Market Data, News and Blog completed without runtime errors. Market Data only requested the six allowlisted tables. Desktop and 440px mobile rendering were checked; a signed-out product-page visit redirected to login.
- Administrator customer-management tab opened successfully with four filters. Administrator reads still returned 28 profiles, 7 investments, 6 products and 7 commission distributions, all HTTP 200.
- Two automated access-boundary tests passed: private widgets are inactive while signed out and retained for signed-in members.

## Additional findings requiring separate remediation

The deep scan flagged investment/commission write authorization, research publishing, placeholder-account recovery, notification sending and email/log content handling. These were not silently changed during public-access cleanup. In particular, district-manager investment write policies lack an explicit subtree restriction, and the sales-role active-product policy includes customers, bypassing per-client product assignment. These prevent declaring all member permissions correct.