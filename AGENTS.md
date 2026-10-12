# Writing rules for real players

This repository contains the public playleh.com website. Write its Mahjong rules
for humans who want to adopt them at a real table. A new player should be able to
understand the rules and play without knowing the app, its settings or its code.

## Audience and language

- Use plain language and short, concrete explanations. Define a term before its
  first use, including natural tile, wildcard, eye, concealed/exposed meld, Tai
  and payment units. A glossary supplements those definitions; it does not replace
  them.
- Explain what happens at the table: the condition, the player's choices, the
  resulting action, and its scoring or payment consequences. Explain the order of
  reveals, replacements, claims and win checks whenever that order matters.
- Use consistent action names: **Chi**, **Pong**, **Gang**, **Hu**, **Zimo**,
  **Dun** and **Qi Fei**. Avoid all-capital action names such as DUN or QI FEI.
  Keep distinct scoring-award names, such as All Chow, consistent too.
- Describe configurable rules as agreements made before play. Keep app controls,
  lobby instructions, implementation identifiers, version requirements and
  supported settings ranges out of the public rules. Do not write instructions
  such as "choose 1–6 independently" when the reader only needs to agree on an
  award or payment amount.

## Main rules and optional rules

- Explain Singapore Classic first. Clearly label each optional house rule and
  say what changes when the table adopts it.
- Make exceptions visible at the main rule's point of use, with a link to the
  optional rule. Check both sections after changing either one.
- Explain relevant interactions between optional rules. State whether they can
  be combined and which rule determines the score, payer or action priority.
  Avoid unconditional statements that an optional rule overrides.
- Describe eligibility and stopping conditions concretely. When relevant,
  distinguish original dealt tiles from the dealer's extra tile and replacements,
  revealed tiles from tiles still in hand, and a continuing replacement sequence
  from one whose responsibility has ended.

## Scoring and who pays

- Separate Tai, winning-hand payments and immediate Gang/bonus-tile payments.
  State which awards add together, which are alternatives and which a special
  win excludes. Explain the minimum-Tai check and the payment cap in their actual
  order.
- For every payment route, identify the winner or collector, every payer, each
  payer's share and the total received. Distinguish discard wins, self-draw,
  robbery and instant wins where their settlement differs. A clear reference to
  an already explained payment table is sufficient; avoid repeating whole tables.
- Name the responsible player when a variation redirects payment. Distinguish
  the winning-tile discarder, Gang declarer, original Gang discarder and Flower
  seat owner. Explain when that responsibility begins and ends.
- State whether an amount replaces or adds to another amount. For refunds, say
  which payment is returned and under what condition; do not imply a refund when
  no payment was collected.
- Use small worked examples with named seats or players. State the assumptions:
  adopted house rules, relevant tile source, Tai, cap and payment scale. Check
  the arithmetic and that all payer shares sum to the collector's total.
- Keep table labels explicit and payment amounts visible on phones. Use the
  rules page's scoped styles for wrapping long descriptions and column headings.

## Verify the ruling and the explanation

- Check intended rulings against current iOS/backend source and relevant
  regression tests when available. Explicit user decisions take precedence. If
  an engine disagrees with the intended rule, report the mismatch separately;
  do not silently turn an implementation bug into a public rule.
  Flag unsettled rulings or conflicting sources rather than inventing a rule.
- Preserve existing section IDs, internal links, tile assets and useful examples.
  Validate links and numerical payment examples after rules edits. Check the
  rendered page on mobile and desktop when HTML or styling changes affect layout.
  Choose further tests according to the behavior being changed.
- Before finishing, read the affected main and optional sections as a new player.
  Walk through an ordinary case and a relevant exception or combination. Can the
  players determine **what they may do, whether they can win, how many Tai count,
  who pays how much, and what happens next** without consulting the app or code?
  Fix any remaining ambiguity before calling the rules clear.
