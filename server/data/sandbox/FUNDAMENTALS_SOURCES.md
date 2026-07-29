# Sandbox fundamentals - sourcing notes

`fundamentals.json` is real, live-fetched data as of `asOfDate` (currently
2026-07-26) - not point-in-time for the `covid-crash-recovery-2020` price
window it's served alongside. This file records what was tried to close that
gap, and what's still missing.

## Gap 1 - point-in-time (early 2020) fundamentals

**Attempted:** re-sourcing P/E, P/B, ROE, market cap, dividend yield,
debt-to-equity, beta, and the 52-week range as of ~January 2020 for all 20
companies, to bind the fundamentals to the same period as the price window.

**Not completed, and why:** this is ~140 individual historical data points
(20 companies x 7 fields), each requiring a reliable point-in-time source.
General web search surfaces aggregator sites (screener.in, moneycontrol,
tickertape, valueinvesting.io, etc.) whose *current* figures for the same
company routinely disagree by double-digit percentages depending on
methodology (trailing-twelve-month vs. latest-annual, consolidated vs.
standalone) - see the "Gap 3" section below for a concrete example of that
spread. Historical (2020) snapshots are less commonly cited directly and
harder to cross-check than current ones, so the risk of quietly presenting an
uncertain or wrong number as fact was judged too high without a licensed,
point-in-time financial data terminal. Per the task's own instructions, the
fallback taken instead: keep the current, real, clearly-dated fundamentals,
make the mismatch explicit in the data model (`windowId` binding, asserted at
server startup - see `loadSandboxData.ts`), and disclose it directly in the
UI (the sandbox trade ticket and the stock detail modal both state it, not
just this file).

**What would close this properly:** a licensed point-in-time fundamentals
feed (e.g. Bloomberg, Refinitiv, or a paid Screener.in export with historical
ratio snapshots) queried for each of the 20 symbols as of a date at or before
2020-01-01, replacing the values in `fundamentals.json` and updating
`asOfDate` to that date. No code change would be needed - `loadSandboxData.ts`
already treats fundamentals purely as a JSON fixture.

## Gap 3 - null `roePercent` for RELIANCE.NS, KOTAKBANK.NS, NTPC.NS, ULTRACEMCO.NS

**Attempted:** sourcing current (asOfDate-consistent) ROE for these four,
since none of them are banks (Kotak Mahindra Bank is a bank, but ROE - unlike
debt-to-equity - is still a meaningful figure for a bank, so its null isn't
the "not applicable" case debt-to-equity is for banks).

**Not completed, and why:** live search results disagreed too widely to
attribute a single figure with confidence, e.g. UltraTech Cement's ROE was
reported as anywhere from ~9.2% to ~15.6% across reputable-looking sources
(screener.in, gurufocus, smart-investing.in) in the same session - a ~70%
relative spread. Reliance (8.3%-10%) and Kotak Mahindra Bank (11.9%-15.3%)
showed smaller but still material spreads. Rather than pick one, these four
remain `null` and render honestly in the sandbox stat cards ("Not available
for this period" - see `web/src/lib/formatSandboxStat.ts`), per the hard
constraint against inventing a plausible-looking number.

**What would close this properly:** the same single, consistent, licensed
data source used for the rest of the fixture's non-null figures (whatever
that was for the original live fetch), queried again for these four symbols.
