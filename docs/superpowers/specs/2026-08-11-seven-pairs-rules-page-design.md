# Seven Pairs Rules Page — Design

**Date:** 2026-08-11
**Status:** Approved for implementation
**Target:** `blued/seven-pairs-rules`, based on latest `origin/master`

## Goal

Document Seven Pairs clearly in `mahjongleh-rules.html` as an optional, configurable add-on
house rule without implying that it is part of Singapore Classic or universally available.

## Placement and page corrections

Add a `Seven Pairs (七对子) — Optional House Rule` section after the Winning Hands list and
before Payout Calculation. Use the page's existing Bootstrap hierarchy:

- one `h4` section heading with `id="seven-pairs"`;
- `h5` subsections for Eligibility, Host Settings, Scoring, and Multiplayer Availability;
- a responsive Bootstrap table for the five host settings.

Make three adjacent corrections so the existing page does not contradict the new section:

1. Qualify both four-sets-and-one-pair statements with “For a standard winning hand”.
2. Clarify that Seven Pairs applies only when enabled for Local Play or a supported custom
   multiplayer lobby; Quick Match remains Singapore Classic.
3. Update the page's displayed revision date to 11 August 2026.

## Rule content

### Optional status

State prominently that Seven Pairs is disabled by default, is not part of Singapore Classic,
and must be enabled and configured by the host.

### Eligibility

Document all required conditions:

- exactly 14 non-bonus tiles;
- exactly seven counted pairs;
- no declared Chow, Pong, or Gang;
- Flowers and Animals remain separately revealed bonus tiles outside the 14-tile shape;
- every non-bonus tile occurs exactly two or four times;
- a pair of identical tiles contributes one pair;
- four identical undeclared tiles contribute one or two pairs according to the host setting and
  are never a declared Gang;
- the source must be permitted by the host;
- existing Sacred Discard, Missed Discard, and other legality gates still apply.

### Host settings

Document the exact defaults and choices:

| Setting | Default | Allowed values and effect |
|---|---|---|
| Winning source | Self-draw only | Self-draw only, or self-draw/discard. Robbing an added Gang uses discard-source scoring. |
| Four identical tiles | Count as 1 pair | Count as one or two pairs. The tiles remain undeclared. |
| Suit & honor stacking | Enabled | Add at most one of Mixed Suit (Half Suit) +2, Pure Suit +4, or Pure Honors +6. |
| Self-draw Tai | 2 | Independently configurable from 1 to 5. Genuine self-draw also receives the separate fixed Self-drawn Hand +1. |
| Discard Tai | 2 | Independently configurable from 1 to 5 and used only when discard wins are allowed. |

If Tai controls are hidden during staged rollout, explain that newly enabled rules use 2/2 and
the values displayed by the lobby remain authoritative.

### Scoring

- Default self-draw scores Seven Pairs 2 + Self-drawn Hand 1 = 3 Tai before other eligible
  awards.
- A permitted default discard or robbed-added-Gang win scores 2 Tai and does not receive the
  self-draw +1.
- Seven Pairs is exclusive of standard-decomposition awards such as Ping Hu, All Chow, All Pong,
  and Pure Suit Ping Hu.
- Suit/honor stacking adds at most one compatible color-family award.
- Four identical tiles used as pairs do not trigger a Gang payout or Dragon/Wind triplet bonus.
- Existing event and bonus awards, minimum and maximum Tai, Shooter mode, credit value, and
  payment calculation remain applicable.

### Multiplayer availability

State that every seated human player in a custom lobby must use a compatible app version. An
unsupported player cannot enable, start, join, or rejoin an active Seven Pairs lobby. Quick
Match remains Singapore Classic. Do not claim that the feature or backend is currently enabled
for every player or deployed environment.

## Terminology

All user-visible English uses **Gang**, never **Kong**. Stable internal identifiers are outside
the website scope. Use “added Gang” for a tile added to an exposed Pong and “robbing the Gang”
for that winning source. Bridge the existing suit terminology as “Mixed Suit (Half Suit)”.

## Verification

- Validate HTML structure and confirm there are no broken local links or malformed tables.
- Render the rules page at desktop and mobile widths and inspect heading hierarchy, table
  overflow, and readability.
- Search the changed user-visible copy for `Kong`.
- Cross-check every default, bound, source rule, and scoring example against the merged client
  Seven Pairs registry and canonical vectors.
- Keep the PR limited to the rules page, this design document, and directly required static-page
  corrections.
