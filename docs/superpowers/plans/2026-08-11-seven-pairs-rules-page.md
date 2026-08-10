# Seven Pairs Rules Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear, accurate Seven Pairs section to `mahjongleh-rules.html` that presents it as an optional configurable house rule and removes nearby Classic-rule contradictions.

**Architecture:** Keep the static Bootstrap page and its existing visual hierarchy, insert one anchored section before payout calculation, use a responsive settings table, and verify every default/edge case against the merged Seven Pairs client contract without adding JavaScript or new assets.

**Tech Stack:** Static HTML5, Bootstrap 4, `tidy`, ripgrep, local browser responsive inspection.

**Design:** `docs/superpowers/specs/2026-08-11-seven-pairs-rules-page-design.md`

## Global Constraints

- Work only on `blued/seven-pairs-rules`, the branch behind draft playleh.com PR #26 and based on current `origin/master`.
- Limit implementation changes to `mahjongleh-rules.html`; do not redesign the site or add unrelated pages/assets.
- Seven Pairs is disabled by default, not part of Singapore Classic, and must never be described as universally enabled or deployed.
- Quick Match remains Singapore Classic.
- User-visible English uses **Gang**, never **Kong**.
- Do not invent behavior beyond the merged client registry/canonical vectors and backend PR #161 contract.
- Preserve existing Bootstrap classes, external links, analytics snippet, and page navigation behavior.

---

### Task 1: Implement the Seven Pairs rules section test-first

**Files:**

- Modify: `mahjongleh-rules.html`

**Interfaces:** Static anchor `#seven-pairs` and user-visible page copy.

- [ ] **Step 1: Capture the current HTML-validator baseline**

```bash
tidy -errors -quiet mahjongleh-rules.html
```

Record the existing legacy warnings around the analytics/footer markup. The implementation may preserve those known warnings but must introduce no new structural error.

- [ ] **Step 2: Run the RED contract checks**

```bash
rg -n 'id="seven-pairs"|Seven Pairs \(七对子\)|disabled by default|Quick Match remains Singapore Classic' mahjongleh-rules.html
rg -n '\bKong\b' mahjongleh-rules.html
```

Expected: the Seven Pairs anchor/content search is incomplete or empty, while the Kong search reports existing user-visible terminology.

- [ ] **Step 3: Record the source-of-truth values before editing**

Cross-check the merged client registry and `docs/testing/seven-pairs-v1-vectors.json` in MahjongLeh for:

- default win policy `self_draw_only`;
- default quad policy `one_pair`;
- suit/honor stacking enabled;
- self-draw Tai 2 and discard Tai 2, each bounded 1–5;
- default self-draw total 3 after the separate +1 Self-drawn Hand;
- discard/robbed-added-Gang source behavior;
- exclusivity of standard-decomposition awards;
- maximum-Tai and Shooter settlement behavior.

Do not proceed if the live merged values differ from the approved design; update the design/plan first.

- [ ] **Step 4: Apply the adjacent corrections**

Make these exact semantic changes:

- revision date becomes `11 August 2026`;
- page scope says the rules cover Singapore Classic and identifies Seven Pairs as an optional Local Play/custom-lobby add-on;
- both unconditional “To win, form four sets and one pair” statements become “For a standard winning hand, form four sets and one pair”;
- `Gang/Kong` becomes `Gang`;
- the duplicate second `Exposed Gang (明槓)` heading becomes `Added Gang (加槓)` because it describes adding the fourth tile to an exposed Pong;
- the robbing explanation names an **added Gang**, not a generic or concealed Gang.

- [ ] **Step 5: Verify the local corrections**

```bash
rg -n 'For a standard winning hand|Added Gang \(加槓\)|added Gang|11 August 2026' mahjongleh-rules.html
! rg -n '\bKong\b' mahjongleh-rules.html
```

Expected: every required phrase is present and no user-visible `Kong` remains.

The new public anchor is:

```html
<h4 id="seven-pairs">Seven Pairs (七对子) — Optional House Rule</h4>
```

- [ ] **Step 6: Insert the section before Payout Calculation**

Use the existing heading/card spacing and this content structure:

```html
<h4 id="seven-pairs">Seven Pairs (七对子) — Optional House Rule</h4>
<p><strong>Seven Pairs is disabled by default and is not part of Singapore Classic.</strong>
The host must enable and configure it for Local Play or a supported custom multiplayer lobby.
Quick Match remains Singapore Classic.</p>

<h5>Eligibility</h5>
<ul>
  <li>The winning shape contains exactly 14 non-bonus tiles counted as exactly seven pairs.</li>
  <li>No Chow, Pong, or Gang may have been declared.</li>
  <li>Flowers and Animals remain separately revealed bonus tiles outside the 14-tile shape.</li>
  <li>Every non-bonus tile appears exactly two or four times. Two identical tiles count as one pair.</li>
  <li>Four identical undeclared tiles count as one or two pairs according to the host setting; they are not a declared Gang.</li>
  <li>The winning source must be allowed by the host. Sacred Discard, Missed Discard, and all other normal legality gates still apply.</li>
</ul>
```

Add a responsive Bootstrap table under `Host Settings`:

```html
<div class="table-responsive">
  <table class="table table-bordered table-sm">
    <thead>
      <tr><th>Setting</th><th>Default</th><th>Choices and effect</th></tr>
    </thead>
    <tbody>
      <tr><td>Winning source</td><td>Self-draw only</td><td>Self-draw only, or self-draw/discard. Robbing an added Gang uses discard-source scoring.</td></tr>
      <tr><td>Four identical tiles</td><td>Count as 1 pair</td><td>Count as one or two pairs. The four tiles remain undeclared.</td></tr>
      <tr><td>Suit &amp; honor stacking</td><td>Enabled</td><td>Add at most one of Mixed Suit (Half Suit) +2, Pure Suit +4, or Pure Honors +6.</td></tr>
      <tr><td>Self-draw Tai</td><td>2</td><td>Choose 1–5 independently. A genuine self-draw also receives Self-drawn Hand +1.</td></tr>
      <tr><td>Discard Tai</td><td>2</td><td>Choose 1–5 independently; used only when discard wins are allowed.</td></tr>
    </tbody>
  </table>
</div>
```

Immediately after the table, include the staged-rollout note: if Tai controls are hidden, newly enabled rules use 2/2 and the values displayed in the lobby are authoritative.

- [ ] **Step 7: Add the scoring subsection**

State all of the following without implying award stacking beyond the implementation:

- default self-draw: Seven Pairs 2 + Self-drawn Hand 1 = 3 Tai before other eligible awards;
- permitted default discard or robbed-added-Gang: 2 Tai and no self-draw +1;
- no Ping Hu, All Chow, All Pong, or Pure Suit Ping Hu award;
- at most one compatible color-family award when stacking is enabled;
- four identical tiles used as pairs trigger neither Gang payout nor Dragon/Wind triplet bonus;
- event/bonus awards, minimum/maximum Tai, Shooter mode, credit value, and normal payment calculation still apply.

- [ ] **Step 8: Add multiplayer availability**

State that every seated human in a custom lobby needs a compatible app version and that unsupported members cannot enable, start, join, or rejoin an active Seven Pairs lobby. Repeat that Quick Match remains Singapore Classic. Do not claim current rollout/deployment status.

- [ ] **Step 9: Run the content contract checks**

```bash
rg -n 'id="seven-pairs"|disabled by default|exactly 14 non-bonus tiles|Count as 1 pair|Self-draw Tai|Discard Tai|1–5|Seven Pairs 2.*Self-drawn Hand 1.*3 Tai|Quick Match remains Singapore Classic|compatible app version' mahjongleh-rules.html
! rg -n '\bKong\b' mahjongleh-rules.html
```

Expected: every contract phrase is represented and the terminology check stays clean.

- [ ] **Step 10: Commit the content**

```bash
git add mahjongleh-rules.html
git commit -m "docs: document optional Seven Pairs house rule"
```

---

### Task 2: Validate structure and responsive rendering

**Files:** Verification only unless a directly related markup correction is required.

- [ ] **Step 1: Run HTML validation and compare to baseline**

```bash
tidy -errors -quiet mahjongleh-rules.html
git diff --check origin/master...HEAD
```

Expected: no new `tidy` error/warning category beyond the captured legacy baseline; diff check passes.

- [ ] **Step 2: Serve and inspect the exact anchor**

```bash
python3 -m http.server 8123 --directory .
```

Open `http://127.0.0.1:8123/mahjongleh-rules.html#seven-pairs` and inspect at:

- desktop: 1440×900;
- mobile: 390×844.

Confirm the anchor lands below the fixed header, `h4`/`h5` hierarchy is visually clear, the table scrolls inside its responsive wrapper without widening the page, and all bullets remain readable.

- [ ] **Step 3: Check local references and scope**

Use the browser network/console view to confirm the existing CSS/JS/image requests still resolve. Verify the branch diff contains only the approved design, implementation plan, and `mahjongleh-rules.html`.

- [ ] **Step 4: Reconcile against all three Seven Pairs implementations**

Compare the final prose with:

- merged MahjongLeh client PR #1353/current client `main`;
- merged MahjongLehBackend PR #161 validation/admission contract;
- canonical Seven Pairs vectors.

Treat the client as the rule/default authority and backend #161 as the wire-validation/admission authority. Record any deployment uncertainty rather than implying availability.

- [ ] **Step 5: Push the branch**

```bash
git push origin blued/seven-pairs-rules
```
