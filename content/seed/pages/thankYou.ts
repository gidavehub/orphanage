// pages.thankYou (public-pages §4.9, PLAN D70). Personal details (first name, amount, reference) are
// filled in by the page; this doc holds the words around them. CLIENT [draft].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const thankYouPage: PageSeed = {
  hero: {
    title: ["Thank You"],
    intro: "Thank you for supporting Haven.",
  },
  seo: {
    title: "Thank You",
    noindex: true,
  },
  sections: {
    paid: {
      body: [para("pd1", "Your gift is on its way to a child. We've emailed your receipt, and we'll let you know where it goes.")],
    },
    processing: {
      body: [para("p1", "Your payment is being confirmed. We'll email your receipt shortly.")],
    },
    pledge: {
      eyebrow: "How to Pay",
      title: ["Complete Your Gift"],
      body: [para("l1", "Here is how to complete your gift. Please quote your reference so we can match your payment.")],
    },
    pledgeNoInstructions: {
      body: [para("l2", "Our team will email you payment details within 2 working days.")],
    },
    inKind: {
      body: [para("k1", "Our team will contact you within 3 working days to arrange drop-off, collection or shipping of your items.")],
    },
    generic: {
      body: [para("g1", "Every gift, every share and every kind word helps a child feel seen. We're so glad you're here.")],
    },
    whatNext: {
      eyebrow: "What Happens Next",
      items: items([["Received"], ["Acknowledged"], ["Allocated to your cause"], ["You'll receive impact updates", "If you asked for them."]]),
    },
    recurring: {
      body: [para("r1", "To change or cancel your gift at any time, use the secure link in your receipt email, or visit Manage my gift.")],
    },
    recurringPledge: {
      body: [para("r2", "To change or cancel your regular gift, reply to your email or write to our donations team.")],
    },
    share: {
      title: ["Ask a Friend to", "Stand With You"],
      body: [para("s1", "Share the cause you chose. One message can double what reaches a child.")],
    },
    updates: {
      eyebrow: "Stay Close",
      title: ["Hear What Your", "Gift Changed"],
      body: [para("u1", "A short, warm email now and then, with stories, photos and figures. Unsubscribe any time.")],
    },
  },
};
