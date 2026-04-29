# Parent2Parent vs Yaga Playbook — Implementation Progress

**Last updated:** 29 April 2026

This document tracks what was implemented from the *Parent2Parent vs Yaga Practical Improvement Playbook*, and what was deferred. It's organised section by section so it can be reviewed alongside the original playbook.

---

## Section 1 — Buyer Protection Messaging

**Goal:** make protection promises concrete instead of generic.

### Done
- **Homepage hero copy** updated to *"Buy from other parents with confidence. We hold your payment until your item is delivered and the return window has passed."*
- **Homepage trust bar** updated from "7-day money-back guarantee" to "48-hour return window" (matches the actual escrow logic).
- **Product page** now shows a green "Protected purchase" trust box explaining buyer protection in plain English, immediately after the seller card.
- **Checkout page** copy updated to *"Your payment will not be released to the seller until delivery is confirmed and the 48-hour protection window has passed, unless you confirm receipt earlier."*
- **Order confirmation email** now includes a green "Your payment is protected" panel.
- **Sell page** shows a green "Accurate listings are protected" box for sellers.

### Not done
- Nothing outstanding.

---

## Section 2 — Condition Standards

**Goal:** enforce condition standards in the listing flow, not after a dispute.

### Step 1: Plain-English condition grades

#### Done
- Replaced generic labels ("New", "Like New") with full Yaga-style definitions:
  - **New with tags / unused** — Never used. Packaging or tags still attached where applicable.
  - **Like new** — Used lightly but looks almost new. No visible damage, stains, missing parts or functional issues.
  - **Good** — Clearly used but fully functional and clean. Minor wear only.
  - **Fair** — Usable but visibly worn. Buyer should expect obvious signs of use.
- When a seller picks a grade, an amber **"Disclose"** prompt appears below telling them exactly what they must mention (e.g. *"Disclose: scuffs, fading, minor marks, loose threads, small cosmetic defects"*).
- Layout changed from 2-column grid to single column so the longer descriptions fit cleanly.
- Same updates applied to the Edit Listing page.

#### Not done
- Nothing.

### Step 2: Mandatory photo requirements

#### Done
- **4-photo minimum** enforced both client-side (Continue button gates step 2) and server-side (`POST /api/listings` returns 400 if fewer than 4 photos).
- **Photo guidance box** above the upload field: *"What to photograph: front, back, close-up of the brand or size label, and a close-up of any wear, defect, or stain."*
- **Live counter** showing "X/4 minimum" — turns from amber to green when threshold met.
- **Accuracy confirmation checkbox** required before publishing: *"I confirm these photos show the actual item being sold and any flaws have been disclosed."*

#### Not done
- Category-specific photo requirements (e.g. "for prams: serial label photo, wheels/base/frame, folding mechanism") — currently we use a single 4-photo minimum across all categories.
- Automated image quality checks (sharpness, missing faces, etc.) — listed as "later upgrade" in playbook.

### Step 3: Category-specific disclosure prompts

#### Done
- When a seller picks a category, a blue checklist appears above the description field listing what to cover. Implemented for: clothing, prams/strollers, cots/beds, carriers/slings, toys/play, car seats, feeding, safety/monitors, bath/changing.
- Each prompt lists 3–6 specific items (e.g. for prams: brand/model, brakes, folding, wheels, accessories, faults).

#### Not done
- Disclosure answers are not stored as structured fields — the seller still types them into the free-text description. The prompts guide them, but we can't programmatically verify they answered each one.

### Step 4: Automated quality gates

#### Done
- **50-character minimum description** enforced client-side and server-side — cuts off "good condition" / "as new" one-liners.
- **Live counter** below the description showing how many more characters are needed.
- **Risky-word detector** — if the description mentions any of `broken, cracked, recalled, fake, replica, missing, no brakes, damaged, unsafe`, an amber warning appears asking the seller to explain or rephrase.
- Sellers must choose from the 4 structured condition grades — no free-text condition.

#### Not done
- **Manual review queue for high-risk categories before publishing** — listings still go live immediately. Building this would need a moderation status, an admin queue UI, and seller-facing "pending review" copy. Deferred.

---

## Section 3 — Parent-Specific Safety Rules

**Goal:** restrict unsafe categories where Parent2Parent should be stricter than a generic resale marketplace.

### Done
- New FAQ entry **"What can I not sell on Parent2Parent?"** under the For Sellers section, covering:
  - Recalled products
  - Broken / incomplete safety-critical gear (prams with broken brakes, cots with missing screws)
  - Used helmets / impact safety gear
  - Used mattresses
  - Used breast pump milk-contact parts (bottles, valves, membranes)
  - Car seats — soft policy: *"we recommend not listing used car seats"*

### Not done
- **No technical enforcement.** Sellers can still list any of these items today; the rules only exist as a policy statement in the FAQ.
- **No prohibited-keyword check** at listing time (e.g. blocking titles containing "helmet").
- **No recall-database integration** to automatically reject known recalled products.
- **No category-specific extra checks** for car seats (expiry date field, accident-history checkbox, mandatory model-label photo).

This section was scoped down at the user's request — the policy was added to the FAQ but enforcement was deemed too broad for V1.

---

## Section 4 — Returns Automatic Outcomes

**Goal:** define automatic outcomes so admin doesn't have to mediate every dispute.

### Done — Rule 1: Buyer doesn't ship within 72 hours
Previously the dispute auto-escalated to admin. Per the playbook, the seller shouldn't be held up indefinitely if the buyer doesn't follow through.

Now: when the 72-hour `return_deadline` passes without a tracking number being submitted, the dispute is **auto-closed** as `resolved_no_refund`, the escrow timer resumes for the seller, and both parties receive an email:
- Buyer: *"Your return deadline has passed"*
- Seller: *"Return closed in your favour, payment will release as normal"*

The seller-missed-address path was deliberately left as admin escalation, since the buyer is stuck without the address and can't be at fault.

### Done — Rule 3: No evidence
The playbook recommends a 24-hour evidence window if the buyer reports an issue with no photos. We went stricter: **photos are required at the moment the dispute is opened** (server returns 400 if no photos uploaded). No 24-hour grace window needed.

### Not done — Rule 2: Tracking shows delivered, seller doesn't confirm
Playbook recommends auto-confirming receipt after 48 hours if courier tracking shows delivered. **This requires courier-tracking integration on return shipments**, which we don't have today. The buyer enters a tracking number, but we don't poll The Courier Guy's API for it. Deferred until that integration exists.

### Not done — Rule 5: Seller claims wrong item was returned
Playbook recommends manual review with seller photos within 24 hours. **Not built.** No way for a seller to dispute a return after they've confirmed receipt.

### Not done — Rule 6: Buyer changes mind / doesn't fit
Playbook says "no return unless seller voluntarily accepts." **Already handled** by the strict reason list (`Item significantly different from description or photos`, `Item arrived damaged`, `Wrong item received`, `Item is counterfeit / fake`) — there's no "I changed my mind" option.

---

## Section 5 — Evidence Requirements

**Goal:** ask for specific evidence based on the return reason.

### Done
- **Photo upload is mandatory** when opening a dispute (1–6 photos, max 5MB each).
- **Reason-specific prompts** appear in the dispute form telling the buyer exactly what to photograph:
  - Significantly different from listing → *"Upload photos comparing what you received to the listing photos."*
  - Arrived damaged → *"Upload photos of the damage and the packaging it arrived in."*
  - Wrong item → *"Upload a clear photo of the item you received."*
  - Counterfeit / fake → *"Upload close-up photos of brand labels, tags, stitching."*
- Evidence photos display:
  - In the **admin dispute panel** as a clickable thumbnail grid
  - On the **buyer and seller order pages** so both parties can see what was submitted
- Dispute reasons tightened to the playbook's 4 valid options. *"Item never arrived"* and *"Other"* removed.

### Done — Resolution emails (pre-existing gap)
- Admin issues refund → buyer gets *"Your refund has been processed"*, seller gets *"Return resolved, listing re-activated"*
- Admin resolves no-refund → buyer gets *"Return request resolved"* with admin notes, seller gets *"Resolved in your favour"*

### Not done
- Nothing outstanding.

---

## Section 6 — Return Shipping & Fees Policy

**Goal:** state the policy clearly upfront, don't make returns a revenue source.

### Done
- New FAQ entry **"Who pays for return shipping?"** under For Buyers covering:
  - Buyer pays return postage upfront
  - Tracked shipping recommended (loss risk is theirs without it)
  - Approved seller-fault returns get a full checkout refund (item + courier + buyer protection fee)
  - Postage reimbursement reviewed case-by-case if buyer contacts support with the receipt
  - No return admin fee
- The buyer's **return-shipping panel on the order page** now explicitly states tracking is required (lost-without-tracking risk is theirs) and explains reimbursement rules.

### Not done
- **Automated postage reimbursement workflow.** Today this is handled manually — buyer contacts support with their courier receipt, admin EFTs them. Building a structured flow (receipt upload, admin approval, EFT tracking) was deferred as an edge-case workflow.

---

## Sections 7 & 8 — Seller & Buyer Propositions

**Goal:** consolidate "what's in it for me?" answers in one place.

### Done
- New FAQ entry **"How am I protected as a seller?"** under For Sellers — pulls together: accurate listings are protected, auto-release after 48 hours, auto-close if buyer misses ship deadline, buyer pays return shipping, no no-shows, home address private.
- New FAQ entry **"Why buy here instead of Facebook Marketplace?"** under For Buyers — pulls together: payment held until delivery, listing standards enforced, no cash risk, unsafe items restricted, courier delivery, address kept private, clear dispute deadlines.

### Not done
- Nothing outstanding from these sections.

---

## Section 9 — Product Build Checklist

The playbook's "Later upgrade" column. None of these are done — they were always V2:

- Automated image checks and risk scoring on listings
- Dynamic protection badge by category
- Automated rule engine for default outcomes (we have manual rule logic in cron, not a configurable engine)
- Seller performance score and response-rate penalties
- Push / WhatsApp reminders to buyers and sellers
- Recall database checks for certain products
- Automated partial refunds and fee allocation
- Integrated courier labels and door-to-door pickup for returns

---

## Section 10 — V1 Policy Decisions

| Recommendation | Status |
|---|---|
| Hold seller funds until delivery + 48-hour window | ✅ Done |
| Pause payout immediately if dispute opened | ✅ Done |
| Require evidence for all buyer disputes | ✅ Done (Section 5) |
| Require tracking for all returns | ✅ Done (tracking number required, no-tracking risk is buyer's) |
| Seller non-response → admin escalation in V1 | ✅ Done (auto-escalates after 48hrs in `awaiting_address`) |
| Buyer non-response → close dispute, resume payout | ✅ Done (Section 4 Rule 1) |
| No return admin fee in V1 | ✅ Done (stated in FAQ) |
| Resolution emails for both buyer and seller | ✅ Done (Section 5) |
| **Zero seller fees early** | ❌ **Open business decision** — currently 5% platform fee on sellers |

---

## Open Business Decisions

These were flagged but not actioned because they're business / policy calls rather than build tasks:

1. **Drop the 5% seller fee?** Playbook recommends zero seller fees early to grow supply, charging only the buyer protection fee. Currently both fees are charged.
2. **Car seats — prohibit, allow with strict rules, or leave as soft policy?** Currently soft FAQ policy (*"we recommend not listing"*). Building strict rules would mean expiry-date field, accident-history checkbox, mandatory model-label photo.
3. **Postage reimbursement workflow** — currently manual via support contact. Could be automated (receipt upload, admin approval, EFT) but is a low-volume edge case.

---

## Deferred Until Courier Integration

These are blocked on having courier-tracking integration on **return shipments** (we currently only track outbound shipments via The Courier Guy):

- Auto-confirm receipt 48 hours after tracking shows delivered (Section 4 Rule 2)
- Investigating lost return parcels via tracking when reported

---

## Summary

Of 11 sections in the playbook (1–10 plus a sources section), **8 are fully implemented** and **3 are partially implemented with documented gaps**. All gaps are either:

- Deferred V2 features (Section 9)
- Blocked on a missing courier integration
- Open business decisions (zero seller fees, car seats policy)
- Edge-case manual workflows that are handled by support today
