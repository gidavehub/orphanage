// pages.contact (public-pages §3.8). [spec §11] intro verbatim; CLIENT [draft] elsewhere.

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { para, type PageSeed } from "./_helpers";

export const contactPage: PageSeed = {
  hero: {
    eyebrow: "Contact Us",
    title: ["We'd Love to", "Hear From You"],
    intro:
      "Have a question, partnership proposal or request for general information? Send us a message and a member of the team will respond as soon as possible.",
    media: ref("journey-orphanage"),
  },
  seo: {
    title: "Contact Us",
    description: "Questions, partnership proposals or requests for information: send Haven a message and our team will reply.",
  },
  sections: {
    concernRedirect: {
      body: [
        para("c1", "Worried about a child's safety? Please don't use this form. Our confidential concern form goes straight to our safeguarding team."),
      ],
      cta: { label: "Report a Concern", to: "report" },
    },
    needHelp: {
      body: [para("n1", "Need help for a child?")],
      cta: { label: "Request Support", to: "support" },
    },
    questions: {
      eyebrow: "Questions",
      title: ["Common Questions"],
    },
  },
};
