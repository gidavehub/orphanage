// pages.reportConcern (public-pages §3.7). Edited by the safeguarding officer and super admin only.
// The emergency notice itself is settings.safety.emergencyNotice. CLIENT [draft] where not [spec].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const reportConcernPage: PageSeed = {
  hero: {
    eyebrow: "Confidential",
    title: ["Report a Child-Protection", "Concern"],
    intro: "If you are worried about a child's safety or wellbeing, tell us here. Your report goes only to authorised safeguarding staff.",
  },
  seo: {
    title: "Report a Concern",
    description: "Tell Haven's safeguarding team, in confidence, if you are worried about a child's safety or wellbeing.",
  },
  sections: {
    quickExit: {
      body: [para("q1", "Need to leave quickly? Press Shift three times.")],
    },
    anonymous: {
      body: [para("a1", "Anonymous reports are taken seriously. We won't be able to contact you with questions or updates.")],
    },
    consent: {
      body: [
        para(
          "c1",
          "I understand that Haven may share this information with child-protection services or the authorities where needed to keep a child safe, and I have read the [Privacy Policy](/policies/privacy).",
        ),
      ],
    },
    whatHappens: {
      eyebrow: "What Happens Next",
      title: ["What Happens to", "Your Report"],
      items: items([
        ["Your report is sent securely."],
        ["Authorised safeguarding staff are alerted."],
        ["It is reviewed and given a risk level."],
        ["Urgent cases are escalated."],
        ["Services or authorities are contacted."],
        ["Every action is recorded."],
      ]),
      body: [para("w1", "Only approved safeguarding personnel can see reports.")],
    },
    success: {
      title: ["Thank You for", "Speaking Up."],
    },
  },
};
