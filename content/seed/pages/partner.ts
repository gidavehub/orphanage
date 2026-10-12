// pages.partner (public-pages §3.18). Partnership types are [spec §10]; their one-line descriptions and
// the process are CLIENT [draft].

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { items, para, type PageSeed } from "./_helpers";

export const partnerPage: PageSeed = {
  hero: {
    title: ["Partner With Us"],
    intro: "Support programmes through institutional partnerships, corporate sponsorship, technical assistance or research collaboration.",
    media: ref("duo-partner"),
  },
  seo: {
    title: "Partner With Us",
    description: "Partner with Haven through programmes, sponsorship, technical assistance, referrals, research or awareness campaigns.",
  },
  sections: {
    types: {
      eyebrow: "Partnership Types",
      title: ["How We Can Work Together"],
      items: items([
        ["Programme partnership", "Run or co-fund a programme with us."],
        ["Corporate sponsorship", "Sponsor a programme, an appeal or school places."],
        ["Technical assistance", "Share professional skills, systems or training."],
        ["Institutional referral", "Refer children to us, or ask us to support your organisation."],
        ["Research collaboration", "Study what works for children and families, together."],
        ["Donation partnership", "Give regularly, or match your team's gifts."],
        ["Awareness campaign", "Help more people learn how to keep children safe."],
        ["Other", "Something else in mind? Tell us about it."],
      ]),
    },
    hint: {
      body: [
        para(
          "h1",
          "Run an orphanage, children's home or charity and need support? Choose 'Institutional referral'. We'll arrange a verification call or visit.",
        ),
      ],
    },
    process: {
      eyebrow: "How Partnership Works",
      title: ["From First Call", "to Working Together"],
      items: items([
        ["Enquiry"],
        ["Introductory call"],
        ["Due diligence", "Haven verifies every partner organisation before any agreement."],
        ["Agreement"],
        ["Work together and report"],
      ]),
    },
    success: {
      title: ["Thank You"],
      body: [para("s1", "Our partnerships team will be in touch.")],
    },
  },
};
