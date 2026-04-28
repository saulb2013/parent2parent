import { useState } from 'react';
import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'For Buyers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    ),
    faqs: [
      {
        q: 'How do I buy something on Parent2Parent?',
        a: `Browse or search for what you need, then click on a listing to see photos, condition, and the seller's details. When you're ready, hit "Buy Now" and you'll be taken to checkout where you enter your delivery address, choose a courier option, and pay securely via card.

Your payment is processed by Yoco, South Africa's trusted payment gateway. Once payment is confirmed, The Courier Guy collects the item from the seller and delivers it to your door. You'll get a tracking number so you can follow the parcel every step of the way.`
      },
      {
        q: 'What is Buyer Protection and how does it work?',
        a: `Buyer Protection is how we keep your money safe. When you pay for an item, your payment is held securely by Parent2Parent for 48 hours after delivery. The seller does not receive your money until you confirm you're happy with the item, or until the 48-hour protection window closes.

If something is wrong with what you received (it doesn't match the description, it's damaged, or it's the wrong item), you have 48 hours after delivery to raise a dispute. We'll pause the payment to the seller and work with both of you to resolve it. If the item needs to go back, you ship it to the seller and once they confirm receipt, we issue a full refund to your card.

This means you can shop with confidence. Your money is protected from the moment you pay until you're satisfied with what you received.`
      },
      {
        q: 'What does the Buyer Protection fee cover?',
        a: `The Buyer Protection fee is a small percentage added at checkout. It covers the cost of holding your payment securely, our dispute resolution service, refund processing, and secure payment handling.

Think of it as insurance for your purchase. If the item arrives damaged, doesn't match the listing, or never shows up at all, you're covered. Without it, you'd be sending money directly to a stranger with no recourse if things go wrong.

The fee is calculated based on the item price and courier cost, and is shown clearly at checkout before you pay. There are no hidden charges.`
      },
      {
        q: 'How does delivery work?',
        a: `All deliveries are handled by The Courier Guy, one of South Africa's most trusted courier services. At checkout, you enter your delivery address and we'll show you available delivery options with prices and estimated arrival dates.

Once you pay, The Courier Guy collects the item from the seller's address and delivers it to yours. You'll receive a waybill number that lets you track your parcel in real time on The Courier Guy's website.

Delivery typically takes 1 to 5 business days depending on the route and service level you choose. Options range from economy (cheapest, a few days) to same-day express for local deliveries.

Please note that courier cut-off times may push orders placed late in the day to the next business day for collection.`
      },
      {
        q: 'What if my item arrives damaged or is not as described?',
        a: `You have 48 hours after delivery to raise a dispute if the item is significantly different from the listing, arrived damaged, is counterfeit, or is the wrong item entirely. Do not confirm receipt if something is wrong.

To open a dispute, go to your order page and click "Report a Problem". Select the reason, upload photos showing the issue, and describe what's wrong. We'll pause the seller's payment immediately.

The seller will provide their return address, and you ship the item back (return postage is paid by the buyer, just like in a shop). Once the seller confirms they've received the return, we issue a full refund to your card, including the original delivery fee and the Buyer Protection fee.

If you and the seller can't reach agreement, our team steps in within 48 hours to review the case and make a decision.`
      },
      {
        q: 'Who pays for return shipping?',
        a: `If you raise a return, you pay for the return postage upfront — the same way you would in any shop. We recommend using a tracked courier service so there's a record the parcel left your hands.

If your return is approved because the seller was at fault (item arrived damaged, wrong item, counterfeit, or materially different from the listing), you'll receive a full refund of what you paid at checkout, including the original delivery fee and Buyer Protection fee. If you'd like the return postage reimbursed too, contact us with your courier receipt and we'll review case by case.

If your return is not approved (you missed a deadline, didn't supply evidence, or the issue is just buyer's remorse / it doesn't fit), you carry the cost of the return postage.

If the return parcel is lost in transit and you used tracked shipping, we'll work with the courier to resolve it. If you didn't use tracked shipping, the risk of loss is on you.

We don't charge any return admin fee.`
      },
      {
        q: 'What if my item never arrives?',
        a: `If your item was never shipped by the seller, or if The Courier Guy loses the parcel, contact us and we'll issue a full refund. You won't need to ship anything back because nothing arrived.

You can track your parcel using the waybill number on your order page. If tracking shows no movement for several days, reach out to us and we'll investigate with The Courier Guy on your behalf.`
      },
      {
        q: 'Can I change my delivery address or cancel after paying?',
        a: `Once you've paid and the order has been placed, the delivery address cannot be changed because The Courier Guy uses it to generate the shipment immediately.

If you need to cancel, and the item hasn't been collected by the courier yet, contact us as soon as possible. If the courier has already picked up the item, cancellation is not possible, but you can raise a dispute after delivery if there's a genuine problem with the item.

Buyer's remorse (simply changing your mind) is not covered by Buyer Protection. We encourage you to read listings carefully and check all photos before purchasing.`
      },
      {
        q: 'How do I pay?',
        a: `All payments are processed securely through Yoco, South Africa's leading payment provider. You can pay with any Visa or Mastercard, including debit and credit cards. The payment page is hosted by Yoco directly, so your card details never touch our servers.

After payment, you'll be redirected back to Parent2Parent where you can track your order. If your payment is interrupted (browser closes, connection drops), your order is saved and you can complete payment from your order page.`
      },
      {
        q: 'What does "Confirm Receipt" do?',
        a: `When you click "Confirm Receipt" on your order page, you're telling us that you've received the item and you're happy with it. This releases the payment to the seller immediately, rather than waiting for the full 48-hour protection window to expire.

Only click this button once you've inspected the item and are satisfied. Once confirmed, the payment is released and you can no longer raise a dispute through the platform. If you do nothing, the payment releases automatically 48 hours after delivery.`
      },
      {
        q: 'Why buy here instead of Facebook Marketplace?',
        a: `On Parent2Parent your money is protected from the moment you pay. Sellers don't get paid until the item is delivered and the 48-hour protection window has passed (or you confirm receipt earlier). On Facebook, you typically pay cash or EFT directly to the seller before you've even seen the item — there's no recourse if something goes wrong.

A few other reasons parents prefer it:

• Items must follow listing standards — clear condition grades, mandatory photos, and category-specific disclosures (e.g. for prams: brakes, folding, accessories). On Facebook, you're at the mercy of whatever the seller writes.
• No no-shows or cancelled meetups — every order is collected and delivered by The Courier Guy, with full tracking.
• Payment protection: if the item arrives damaged, fake, wrong, or significantly different from the listing, you can raise a return within 48 hours and we pause the seller's payment immediately.
• Unsafe and high-risk items (used helmets, recalled products, broken safety gear) are not allowed — we tell sellers what they can't list.
• You don't share your home address with strangers — only your delivery city is visible to the seller.
• Disputes follow clear deadlines and default outcomes, so you don't get stuck arguing with a seller who's gone silent.`
      },
    ],
  },
  {
    title: 'For Sellers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    faqs: [
      {
        q: 'How do I list an item for sale?',
        a: `Click "List Item" in the top menu, and you'll be guided through a simple three-step process. First, upload clear photos of your item (up to 5). Second, fill in the details: title, description, category, condition, age range, and suggested parcel size. Third, set your price and publish.

Before you can list, you'll need to complete your profile with a delivery address and phone number. This is so The Courier Guy knows where to collect from when your item sells. You only need to do this once.

Listings go live immediately. You can edit or remove them at any time from your profile page.`
      },
      {
        q: 'What can I not sell on Parent2Parent?',
        a: `Because this is a marketplace for parents and children, some items carry safety or hygiene risks and are not allowed:

• Anything subject to a known safety recall — please check the brand's website if you're unsure.
• Items that are broken, cracked, or missing parts where it would affect safe use (e.g. a pram with broken brakes, a cot with missing screws).
• Used helmets, bike seats, or impact safety gear — prior impacts can cause invisible damage that compromises the next user's safety.
• Used mattresses or items that have hygiene concerns we can't reasonably verify.
• Used breast pump parts that contact milk (bottles, valves, membranes) — feeding equipment may only be sold with these parts replaced by the buyer.
• Car seats — for now, we recommend not listing used car seats. Expiry dates, accident history, and missing parts are difficult to verify and the safety risk is too high. We're working on a stricter framework before allowing these.

If you list something that falls into one of these categories, the listing may be removed and your account flagged. When in doubt, it's safer not to list it.

Sellers must also confirm at listing time that their item is not subject to a known recall and that any flaws have been disclosed in the photos and description.`
      },
      {
        q: 'How much does it cost to sell?',
        a: `Listing items on Parent2Parent is completely free. There is no monthly subscription, no listing fee, and no commission taken from the seller. You keep 100% of your listed price.

The Buyer Protection fee is paid entirely by the buyer at checkout. It does not come out of your earnings. When your item sells and the protection period ends, you receive exactly the amount you listed the item for.`
      },
      {
        q: 'When do I get paid?',
        a: `After a buyer purchases your item and The Courier Guy delivers it, the buyer has 48 hours to confirm they're happy. Once the buyer clicks "Confirm Receipt", or once the 48-hour protection window closes (whichever comes first), your payment is released.

Payouts are processed via EFT (electronic funds transfer) to your bank account. You'll receive the full item price you listed. Delivery times for the EFT depend on banking processing but are typically 1 to 3 business days after release.

You can track the status of your payouts in your profile under the "Selling" tab.`
      },
      {
        q: 'How does shipping work for sellers?',
        a: `You don't need to arrange or pay for shipping. When your item sells, The Courier Guy is automatically booked to collect from the address on your profile. You'll receive a notification with collection details.

Make sure your item is packed and ready for collection. The Courier Guy will arrive at your address during business hours. If you live in a complex or apartment, make sure the building name and unit number are on your profile so the driver can find you.

The buyer pays for delivery at checkout. The courier fee is based on the parcel size and the route between your address and the buyer's address.`
      },
      {
        q: 'What parcel size should I choose?',
        a: `When listing your item, you'll be asked to suggest a parcel size. This helps us quote accurate delivery rates to the buyer. The options are:

Small box: shoes, bottles, small toys (up to 2 kg). Medium box: car seats, disassembled chairs (up to 5 kg). Large box: folded prams, play mats (up to 10 kg). Oversized: cots, changing tables (10+ kg).

Pick the size that fits your item when reasonably packed. The buyer can adjust this at checkout if they think a different size is more appropriate. Choosing an incorrect size may result in a surcharge from the courier.`
      },
      {
        q: 'What happens if a buyer raises a dispute?',
        a: `If a buyer reports a problem with your item within 48 hours of delivery, your payment will be paused while the dispute is resolved. You'll receive a notification explaining the issue.

If the buyer is returning the item, they'll ship it back to you at their expense. Once you receive the returned item and confirm it in the app, our team will process the refund to the buyer and re-activate your listing so you can sell it again.

If you believe the buyer's claim is not valid (for example, they're claiming damage that doesn't exist), you can respond through the platform. If you and the buyer can't agree, our team reviews the evidence and makes a final decision.

Being honest and accurate in your listings is the best way to avoid disputes. Include clear photos of any wear and describe the condition accurately.`
      },
      {
        q: 'Can I set my own delivery price?',
        a: `No. Delivery prices are calculated automatically by The Courier Guy based on the route and parcel size. This ensures buyers see accurate, real-time quotes and prevents overcharging. The buyer pays the courier fee directly at checkout.`
      },
      {
        q: 'What should I include in my listing description?',
        a: `Good descriptions sell items faster and prevent disputes. Include the brand and model if applicable, the age and condition (be honest about any wear, stains, or missing parts), whether it comes with original packaging or accessories, and the reason for selling.

For clothing, mention the size on the label, not just the age range. For gear like prams or car seats, mention the weight and whether it folds. For bundles, list what's included.

The more detail you provide, the more confident buyers feel about purchasing. Listings with vague descriptions and poor photos tend to sit unsold.`
      },
      {
        q: 'How am I protected as a seller?',
        a: `Selling on Parent2Parent is safer than selling on Facebook or Gumtree. Here's how:

• You get paid as long as you describe the item accurately. Buyers can only return for specific reasons (item significantly different from the listing, damaged, wrong item, or counterfeit) — and they have to upload photos as evidence. "I changed my mind" or "it doesn't fit" are not valid reasons.
• If the buyer doesn't raise a valid issue within 48 hours of delivery, your payment releases automatically. You don't have to chase anyone.
• If the buyer opens a return but then doesn't ship the item back within 72 hours, the return is auto-closed and your payment releases as normal.
• No no-shows, no cash, no awkward meetups. Buyers pay upfront and The Courier Guy collects from your address.
• Your home address is only shared with the courier driver, never with the buyer.
• Accurate listings are protected. If your photos and condition description are clear, you can defend against a frivolous return.
• If a return is genuine (item really was damaged or misrepresented), the buyer ships it back to you at their expense before any refund is processed.

Bottom line: be honest in your listings, take clear photos, and you have very little to worry about.`
      },
    ],
  },
  {
    title: 'General',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    faqs: [
      {
        q: 'What is Parent2Parent?',
        a: `Parent2Parent is South Africa's marketplace for quality second-hand baby and kids products. We connect parents who have outgrown items with parents who need them, making it easy to buy and sell everything from prams and car seats to clothing bundles and toys.

Every transaction is protected by our Buyer Protection system, and all deliveries are handled by The Courier Guy so you never have to meet a stranger or arrange logistics yourself. Our mission is simple: save families money, reduce waste, and give every item a second home.`
      },
      {
        q: 'Is Parent2Parent safe to use?',
        a: `Safety is built into every part of the platform. Your payment is held in escrow and only released to the seller after you've had time to inspect the item. All card payments are processed by Yoco, a PCI-compliant payment provider, and your card details never touch our servers.

Deliveries are handled by The Courier Guy with full tracking, so there's no need to meet strangers or share your home address with other users. The seller only sees your delivery city, not your full address.

If anything goes wrong with a purchase, our dispute resolution process ensures you're not left out of pocket. You have 48 hours after delivery to raise a concern, and your money stays protected until it's resolved.`
      },
      {
        q: 'How is my personal information protected?',
        a: `We take your privacy seriously. Your profile information (name, email, phone, address) is used only to facilitate transactions and courier collections. We do not sell your data to third parties.

Your full delivery address is shared only with The Courier Guy for the purpose of collection and delivery. Buyers see only the seller's city and province on listings, not their street address. Similarly, sellers see only the buyer's delivery city until a purchase is confirmed.

Passwords are stored using industry-standard hashing (bcrypt) and are never stored in plain text. Payment card details are handled entirely by Yoco and never pass through our systems.`
      },
      {
        q: 'What items can I sell on Parent2Parent?',
        a: `You can sell almost anything baby and kids related: clothing, shoes, toys, books, prams, strollers, car seats, cots, high chairs, carriers, monitors, nursery decor, maternity wear, and more. We have categories for everything from newborn to 6+ years, plus maternity and parent items.

Items must be in working condition and accurately described. We do not allow items that have been recalled by the manufacturer, items with known safety defects, counterfeit or replica branded goods, or any items that are not related to babies, kids, or parenting.

If you're unsure whether your item is allowed, list it and our team will review if any concerns are raised.`
      },
      {
        q: 'What are the fees on Parent2Parent?',
        a: `Selling is free. There are no listing fees, no monthly subscriptions, and no commission taken from the seller. The seller receives 100% of their listed price.

Buyers pay three things at checkout: the item price (set by the seller), a courier fee (set by The Courier Guy based on parcel size and delivery route), and a Buyer Protection fee. The Buyer Protection fee is a small percentage that covers secure payment handling, the 7-day escrow hold, dispute resolution, and refund processing.

All fees are shown clearly at checkout before you confirm your purchase. There are no hidden charges. You can hover over the information icons next to each line item to see exactly what each fee covers.`
      },
      {
        q: 'How does the escrow system work?',
        a: `When a buyer pays for an item, the money does not go directly to the seller. Instead, it's held securely by Parent2Parent. The seller's item is collected and delivered by The Courier Guy.

Once the item is delivered, a 48-hour protection window begins. During this time, the buyer can inspect the item and raise a dispute if something is wrong. If the buyer is happy, they can click "Confirm Receipt" to release the payment to the seller immediately. If they do nothing, the payment releases automatically after 48 hours.

If a dispute is raised, the timer pauses and the money stays held until the dispute is resolved. This system protects both buyers (who might receive something different from what was described) and sellers (who are guaranteed payment once the protection period ends).`
      },
      {
        q: 'Which areas do you deliver to?',
        a: `The Courier Guy delivers to all major cities and towns across South Africa. At checkout, you enter your delivery address and we'll show you available delivery options. If The Courier Guy services your area, you'll see quotes with prices and estimated delivery dates.

Rural or remote areas may have limited delivery options or longer delivery times. In rare cases, The Courier Guy may not be able to service a particular address. If this happens, you'll see a message at checkout and can try an alternative delivery address.`
      },
      {
        q: 'Do I need an account to browse?',
        a: `No. You can browse all listings, search by category, and view item details without creating an account. You only need to sign up when you want to buy something, sell something, or save items to your wishlist.

Creating an account takes less than a minute. You'll need an email address and a password. If you want to sell, you'll also need to add your delivery address and phone number so The Courier Guy knows where to collect from.`
      },
      {
        q: 'Can I use Parent2Parent on my phone?',
        a: `Yes. Parent2Parent is fully responsive and works on any device with a web browser. The entire experience, from browsing and buying to listing and selling, is designed to work smoothly on mobile phones, tablets, and desktop computers.

There is no separate app to download. Just visit parent2parent.co.za in your phone's browser and you're ready to go.`
      },
      {
        q: 'How do I contact support?',
        a: `If you have a question that's not answered here, or if you need help with an order or dispute, you can reach us through the Contact page on the website. We aim to respond to all enquiries within 24 hours during business days.

For urgent issues related to an active order or dispute, use the dispute system on your order page. This ensures your concern is logged, tracked, and resolved as quickly as possible.`
      },
      {
        q: 'Is Parent2Parent only for babies?',
        a: `Not at all. While many of our categories focus on baby gear and clothing, we cover the full range from newborn through to kids aged 6 and beyond. We also have categories for maternity items (pregnancy pillows, nursing wear, maternity bags) and general parent items.

If a child has outgrown it, it belongs on Parent2Parent.`
      },
    ],
  },
];

export default function FAQs() {
  const [activeSection, setActiveSection] = useState(0);
  const [open, setOpen] = useState(null);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-green-100 text-lg max-w-lg mx-auto">
            Everything you need to know about buying, selling, and staying safe on Parent2Parent.
          </p>
        </div>
      </section>

      {/* Section Tabs */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        <div className="flex gap-2 justify-center">
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => { setActiveSection(i); setOpen(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeSection === i
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.icon}
              {s.title}
            </button>
          ))}
        </div>
      </section>

      {/* Accordion */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="space-y-3">
          {sections[activeSection].faqs.map((faq, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-display font-semibold text-gray-900 pr-4">{faq.q}</span>
                <svg
                  className={`w-5 h-5 text-accent flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open === i && (
                <div className="px-5 pb-5 border-t border-border pt-4">
                  {faq.a.split('\n\n').map((para, j) => (
                    <p key={j} className="text-gray-600 leading-relaxed text-sm mb-3 last:mb-0">{para}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Still have questions */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="card p-8 text-center bg-primary/5 border-primary/10">
          <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">Still have a question?</h2>
          <p className="text-gray-600 text-sm mb-4">We're here to help. Reach out and we'll get back to you within 24 hours.</p>
          <Link to="/contact" className="btn-primary inline-block">Contact Us</Link>
        </div>
      </section>
    </div>
  );
}
