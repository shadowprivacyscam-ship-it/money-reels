# The Angeleno Ledger: daily edition

Live site: https://angeleno-ledger.pages.dev (Cloudflare Pages project `angeleno-ledger`).

The site's Cloudflare worker builds the page on every request from two files in this folder:

- `site/template.html`: layout, styles, live ticker, live charts and live news wire. Don't change it for a daily edition.
- `edition.json`: today's paper. **This is the only file a daily run changes.**

The site picks up a pushed `edition.json` within about 2-5 minutes. No Cloudflare redeploy is needed. `site/_worker.js` and `site/_headers` are reference copies of what is deployed on Cloudflare. Editing them here changes nothing live.

## edition.json format

```json
{
  "edition": {"paper": "The Angeleno Ledger", "date_long": "Monday, November 9, 2026", "date_short": "Nov. 9, 2026", "vol": "Vol. I", "no": "No. 3"},
  "sections": [ ...keep exactly as in the current file (keys biz, trade, world, law, ai, prog)... ],
  "lead": {"headline": "front-page banner headline tying the day's biggest money stories together", "deck": "1-2 sentence italic summary"},
  "board": [["Fed funds rate", "3.75-4.00%"], ["30-yr mortgage", "7.18%"], ...8 rows: label, value],
  "board_note": "Figures as of Nov. 8-9; sources in each story.",
  "frontCols": [["key", "key", "key"], ["key", "key"], ["key", "key", "key"]],
  "stories": [ ...sorted most urgent/valuable first... ]
}
```

Each story:

```json
{"key": "unique-slug", "sec": "biz|trade|world|law|ai|prog", "prio": 1, "num": 1,
 "when": "short timing tag, e.g. 'CPI Tue Nov 10'",
 "headline": "...", "deck": "one-sentence subhead",
 "summary": "one line for the read-in-this-order table",
 "paras": ["2-3 paragraphs of reporting, every fact from a source"],
 "money": ["3-4 bullets: HOW THIS CAN MAKE (OR SAVE) YOU MONEY"],
 "sources": [{"t": "Article title (Outlet)", "u": "https://real-url-you-read"}]}
```

Rules:

- `num` is 1..N in array order, and `prio` is ascending (ties are OK).
- Every `frontCols` key must exist in `stories`.
- Text is inserted as HTML, so write `&amp;` for "&" (S&amp;P, M&amp;A). `<b>` is allowed.
- `edition.no` goes up by 1 each day. `date_long` must start with the weekday, because the masthead reads it.

## What a daily edition covers (the reader is a Los Angeles resident)

About 25-30 stories across all six sections, each ending with concrete money angles:

1. **Business Day (biz):** markets (S&amp;P, Nasdaq, Fed, CPI), biggest stock movers, new IPOs, mergers, bankruptcies, crypto, commodities, a money calendar.
2. **Trade &amp; Tariffs (trade):** new or changed tariffs, deadlines, refunds, and who wins or loses.
3. **World &amp; Washington (world):** wars, diplomacy and politics, with how each moves oil, markets and prices.
4. **Law &amp; Your Wallet (law):** taxes, wages, housing, insurance, health and consumer rules, especially California and Los Angeles.
5. **Technology (ai):** AI industry news, who is making what, spending, regulation, the AI market.
6. **California Benefits (prog):** programs, credits, rebates, grants and deadlines Californians can use.

Only cover topics with real news. Facts and numbers must come from sources read during the run. Paraphrase, and never quote more than about 10 words from any source. Keep politics neutral. Money angles are general ideas, not personalized advice.
