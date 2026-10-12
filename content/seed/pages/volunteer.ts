// pages.volunteer (public-pages §3.17). The lead is the landing Duo copy; the steps mirror the [spec §13]
// volunteer workflow in public words; the rest is CLIENT [draft].

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { items, para, type PageSeed } from "./_helpers";

export const volunteerPage: PageSeed = {
  hero: {
    title: ["Become a Volunteer"],
    intro:
      "Contribute professional skills, time or community support: outreach, education, counselling, medical, legal, fundraising and more.",
    media: ref("duo-volunteer"),
  },
  seo: {
    title: "Become a Volunteer",
    description: "Volunteer with Haven: outreach, education, counselling, medical, legal, fundraising, communications and more.",
  },
  sections: {
    expect: {
      eyebrow: "What to Expect",
      title: ["From Application", "to Your First Day"],
      items: items([["Apply"], ["Screening"], ["Interview"], ["Approval"], ["Onboarding"], ["Active"]]),
    },
    safeguarding: {
      body: [para("s1", "Volunteers who work with children complete safeguarding training and background checks before they begin.")],
    },
    under18: {
      body: [para("u1", "Thank you! Volunteering is for adults, but you can still help.")],
      cta: { label: "Ways to Help", to: "involved" },
    },
    success: {
      title: ["Thank You for Offering", "Your Time!"],
    },
  },
};
