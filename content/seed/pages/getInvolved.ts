// pages.getInvolved (public-pages §3.16). The ways to help are [spec §3]; descriptions are CLIENT [draft].

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { items, type PageSeed } from "./_helpers";

export const getInvolvedPage: PageSeed = {
  hero: {
    eyebrow: "Get Involved",
    title: ["There Are Many Ways", "to Help"],
    intro:
      "Donate once or every month, give in kind, volunteer your skills or partner with us. Every kind of help strengthens the world around a child.",
    media: ref("duo-volunteer"),
  },
  seo: {
    title: "Get Involved",
    description: "Donate, give in kind, volunteer, partner with Haven or sponsor a child's future.",
  },
  sections: {
    ways: {
      eyebrow: "Ways to Help",
      title: ["Choose How You Help"],
      items: items([
        ["Donate", "Give once or every month to where it's needed most, or to a cause you care about.", "heart"],
        ["Give in Kind", "School materials, clothing, bedding, food, medical supplies and more.", "gift"],
        ["Become a Volunteer", "Contribute professional skills, time or community support.", "users"],
        ["Partner With Us", "Support programmes through partnerships, sponsorship or expertise.", "handshake"],
        ["Sponsorship", "Give monthly to cover a child's assessed needs through our programmes.", "sponsor"],
      ]),
    },
    interests: {
      eyebrow: "Volunteer",
      title: ["Where You Could Help"],
      cta: { label: "Become a Volunteer", to: "volunteer" },
    },
    partnershipTypes: {
      eyebrow: "Partner",
      title: ["Ways to Partner"],
      cta: { label: "Partner With Us", to: "partner" },
    },
  },
};
