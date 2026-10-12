// pages.privacyRequest (PLAN D104; data-model §11 privacy requests). CLIENT [draft].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const privacyRequestPage: PageSeed = {
  hero: {
    eyebrow: "Your Information",
    title: ["Correct or Delete", "Your Information"],
    intro: "Ask us to show you, correct or delete the information we hold about you. We'll confirm your email address first, then reply within 30 days.",
  },
  seo: {
    title: "Privacy request",
    description: "Ask Haven to show you, correct or delete the information we hold about you.",
  },
  sections: {
    steps: {
      eyebrow: "How It Works",
      items: items([
        ["Send your request"],
        ["Confirm your email", "We send a link to the address you give us."],
        ["We find your records"],
        ["We act and reply within 30 days"],
      ]),
    },
    checkEmail: {
      body: [para("c1", "Please check your email. Your request starts once you open the confirmation link we've sent you.")],
    },
    verified: {
      title: ["Thank You. Your Request", "Is Confirmed."],
      body: [para("v1", "Our team will reply within 30 days.")],
    },
    expired: {
      body: [para("x1", "This link has expired. Please send your request again.")],
    },
  },
};
