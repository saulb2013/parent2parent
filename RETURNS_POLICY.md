# Parent2Parent Returns Policy & Process

**Last updated:** 22 April 2026

---

## 1. Return Eligibility

Returns are only accepted if the item **significantly differs from the listing**. Valid reasons:

1. Item significantly different from description or photos
2. Item arrived damaged
3. Wrong item received
4. Item is counterfeit / fake

**Not covered:** "I don't like it", "it doesn't fit", or buyer's remorse. The seller is not obligated to accept returns for these reasons.

---

## 2. Key Timeframes

| Phase | Duration | What happens if missed |
|-------|----------|----------------------|
| Buyer can raise a return | **48 hours** after delivery | Button disappears, buyer can no longer dispute |
| Seller must provide return address | **48 hours** after dispute opened | Auto-escalated to admin for review |
| Buyer must ship the return | **72 hours** after seller provides address | Auto-escalated to admin for review |
| Seller must confirm return received | No hard deadline | Admin should monitor |
| Admin must process refund | No hard deadline | Should act promptly |
| Escrow auto-releases to seller | **48 hours** after delivery (if no dispute) | Seller payout is created |

---

## 3. Step-by-Step Flow

### Step 1: Buyer Reports a Problem

**Who:** Buyer
**Where:** Order page > "Report a Problem" button
**When:** Within 48 hours of delivery, and before clicking "Confirm Receipt"

**What happens:**
- Buyer selects a reason from the 4 valid options and optionally describes the issue
- Escrow is **paused** immediately (seller cannot be paid while dispute is active)
- Dispute is created with status `awaiting_address`

**Automated notifications:**
- Seller receives email: *"A return has been requested"* with the reason, asking them to provide a return address within 48 hours. Links to order page.
- Admin receives email alert: *"Dispute opened for order #X"*

**What buyer sees:** "Waiting for the seller. We've asked the seller to provide their return address. You'll get an email as soon as it's ready."

**What seller sees:** A form to enter their return address with a "Submit Return Address" button.

---

### Step 2: Seller Provides Return Address

**Who:** Seller
**Where:** Order page > return address form
**When:** Within 48 hours of dispute being opened

**What happens:**
- Seller enters their full return address (street, suburb, city, postal code)
- Dispute status moves to `open`
- A 72-hour return shipping deadline is set

**Automated notifications:**
- Buyer receives email: *"Return address provided -- ship within 72 hours"*. Tells buyer to check the order page for the address and that return postage is paid by the buyer.

**What buyer sees:** The seller's return address, a warning about the 72-hour deadline, and a tracking number input field with "I've Shipped the Return" button.

**What seller sees:** "Waiting for the buyer to ship. Your return address has been shared. The buyer has 72 hours to ship the item back."

---

### Step 3: Buyer Ships the Return

**Who:** Buyer
**Where:** Order page > tracking number field + "I've Shipped the Return" button
**When:** Within 72 hours of seller providing the address

**What happens:**
- Buyer enters a tracking number (required) and marks the return as shipped
- Dispute status moves to `return_shipping`

**Automated notifications:**
- Seller receives email: *"Return shipped for [item]"* with the tracking number, asking them to confirm receipt when it arrives. Links to order page.

**Who pays return postage:** The buyer. This is stated in the dispute form, the email to the buyer, and the FAQs.

**What buyer sees:** "Return shipped. Waiting for the seller to confirm they received your return. Once confirmed, we'll process your refund."

**What seller sees:** "Return is on its way" with the tracking number displayed, and a "I've Received the Return" button.

---

### Step 4: Seller Confirms Return Received

**Who:** Seller
**Where:** Order page > "I've Received the Return" button (with confirmation dialog)
**When:** After the returned item arrives

**What happens:**
- Dispute status moves to `return_received`
- This signals the admin that a refund decision is needed

**Automated notifications:**
- Admin receives email alert: *"Return received -- dispute #X ready for review"*
- **Note:** The buyer is NOT emailed at this step (they see the status update on their order page)

**What buyer sees:** "Return received. The seller has confirmed receipt. Your refund will be processed shortly -- the money will go back to your original payment method."

**What seller sees:** Same message.

---

### Step 5: Admin Processes Refund (MANUAL)

**Who:** Admin (you)
**Where:** Admin panel > Disputes tab
**When:** After seller confirms return received (or after auto-escalation)

**Two options:**

#### Option A: Issue Full Refund
- Admin clicks "Issue Full Refund" and enters notes
- The system calls the **Yoco Refund API** which reverses the original card charge
- This is a **full refund** of the entire checkout amount (item price + courier fee + buyer protection fee)
- The money goes back to the **buyer's original payment card** (handled by Yoco)
- The listing is automatically re-activated so the seller can re-sell the item
- Escrow status: `refunded`
- Order status: `refunded`

#### Option B: No Refund
- Admin clicks "No Refund" and enters notes explaining the decision
- The escrow timer **resumes** with whatever time was remaining when the dispute was opened
- Once the timer expires, the seller gets paid as normal
- Escrow status returns to: `holding`

**Automated notifications:**
- **Refund:** Buyer receives email confirming refund to their card. Seller receives email that the return is resolved and their listing has been re-activated.
- **No refund:** Buyer receives email with the decision and admin notes. Seller receives email that the dispute was resolved in their favour and payment will release as normal.

---

## 4. Auto-Resolution Rules

The system runs a background check every **5 minutes** that handles:

| Scenario | Condition | Action |
|----------|-----------|--------|
| Seller didn't provide return address | Dispute in `awaiting_address` for 48+ hours | Escalated to `admin_review` |
| Buyer didn't ship the return | Dispute in `open` and `return_deadline` has passed | **Auto-closed** as `resolved_no_refund`, escrow timer resumes for seller, both parties emailed |

**Seller missed the address deadline:** dispute escalates to admin, who decides refund or no-refund.

**Buyer missed the return deadline:** the return is auto-closed with no refund. The buyer gets an email saying their deadline has passed; the seller gets an email saying the return was closed in their favour. The seller's escrow timer resumes from where it was paused.

**Why different handling?** When the seller is unresponsive, the buyer is stuck (they can't ship without an address) — admin involvement is fair. When the buyer is unresponsive, the seller is being held up unfairly through no fault of their own — closing automatically is fair.

---

## 5. Escrow & Payment Protection

### How escrow works:
1. Buyer pays via Yoco card payment. Money goes to the P2P Yoco/bank account.
2. An escrow record is created with a placeholder expiry (90 days out).
3. When delivery is confirmed (via courier tracking), the timer resets to **48 hours**.
4. If the buyer does nothing for 48 hours, escrow auto-releases and a seller payout is created.
5. If the buyer clicks "Confirm Receipt", escrow releases immediately.
6. If the buyer opens a dispute, escrow is paused until resolution.

### Confirm Receipt:
- The buyer can click "Confirm Receipt" at any time after payment (even before delivery)
- A confirmation warning is shown: "Once you confirm, the payment will be released to the seller immediately. This cannot be undone."
- This **immediately releases** escrow -- the seller's payout is created
- **Cannot be reversed** -- buyer cannot open a dispute after confirming
- If there's an active dispute, "Confirm Receipt" is blocked

### Seller payouts:
- When escrow is released (auto or manual), a `seller_payouts` row is created with `status = 'pending'`
- Admin sees pending payouts in the Admin panel > Payouts tab
- Admin manually EFTs the seller, then clicks "Mark as Paid"

---

## 6. Email Notifications Summary

| Event | Buyer | Seller | Admin |
|-------|-------|--------|-------|
| Dispute opened | -- | "Return requested" email | Alert email |
| Seller provides address | "Return address provided" email | -- | -- |
| Buyer ships return | -- | "Return shipped" email with tracking | -- |
| Seller confirms receipt | -- | -- | Alert email |
| Admin issues refund | "Refund issued" email | "Return resolved, listing re-activated" email | -- |
| Admin resolves (no refund) | "Return request resolved, no refund" email (with admin notes) | "Resolved in your favour" email | -- |

---

## 7. What the Buyer Sees at Each Stage

| Dispute Status | Buyer's Order Page |
|---|---|
| `awaiting_address` | "Waiting for the seller. We've asked the seller to provide their return address." |
| `open` | Seller's return address displayed + tracking input + "I've Shipped the Return" button + 72-hour deadline |
| `return_shipping` | "Return shipped. Waiting for the seller to confirm they received your return." |
| `return_received` | "Return received. Your refund will be processed shortly." |
| `admin_review` | "Under review. This return has been escalated to our team." |
| `refunded` | "Refund issued. A full refund has been processed to your original payment method." |
| `resolved_no_refund` | "Resolved. This return request has been reviewed and resolved. No refund was issued." |

---

## 8. What the Seller Sees at Each Stage

| Dispute Status | Seller's Order Page |
|---|---|
| `awaiting_address` | Return address form with "Submit Return Address" button |
| `open` | "Waiting for the buyer to ship. Your return address has been shared." |
| `return_shipping` | "Return is on its way" with tracking number + "I've Received the Return" button |
| `return_received` | "Return received. Your refund will be processed shortly." |
| `admin_review` | "Under review. This return has been escalated to our team." |
| `refunded` | "Refund issued." |
| `resolved_no_refund` | "Resolved. No refund was issued." |

---

## 9. Known Considerations

1. **`return_shipping` has no auto-escalation deadline:** If the seller never confirms receipt, the dispute stays in `return_shipping`. However, after 7 days the admin dashboard flags it red as "Action required" so the admin can follow up or decide.

2. **`return_received` has no auto-escalation deadline:** Once the seller confirms receipt, the admin must act. The admin dashboard flags it red as "Action required" with a day counter showing how long it's been waiting.

3. **Dispute reasons are client-only:** The 4 valid reasons are enforced in the UI dropdown, but the server only validates that a reason string is non-empty.

4. **Full refund only:** The Yoco refund always refunds the entire checkout amount. There is no partial refund option.

5. **Listing re-activation:** On refund, the listing is automatically set back to `active` so the seller can re-sell the item.

---

## 10. FAQ Alignment

The FAQs at `/faqs` cover:
- "What is Buyer Protection?" -- 48-hour hold after delivery
- "What if my item arrives damaged or is not as described?" -- full return flow described
- "What does Confirm Receipt do?" -- warns about irreversibility
- "When do I get paid?" (sellers) -- 48-hour window then payout
- "How does the escrow system work?" -- 48-hour protection window
