// pages.getSupport (public-pages §3.5). [spec §6] copy verbatim; [draft] copy marked CLIENT.

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const getSupportPage: PageSeed = {
  hero: {
    eyebrow: "Get Support",
    title: ["You Do Not Have to Face It Alone"],
    intro:
      "Whether you are a child, parent, caregiver, teacher, community member or professional, you can ask for help or refer a vulnerable child through a confidential request.",
  },
  seo: {
    title: "Get Support",
    description: "Ask Haven for help or refer a vulnerable child through a confidential request. Every request is reviewed carefully.",
  },
  sections: {
    actions: {
      cta: { label: "Request Support", to: "support" },
    },
    helpTypes: {
      eyebrow: "Choose What You Need",
      title: ["What Kind of Help", "Do You Need?"],
      items: items([
        ["Child-protection concern", "Report a concern about a child, or ask for protection support for your family.", "protection"],
        ["Education or school fees", undefined, "education"],
        ["Medical", undefined, "medical"],
        ["Psychological or counselling", undefined, "psychological"],
        ["Legal", undefined, "legal"],
        ["Food or essential supplies", undefined, "food"],
        ["Family support", undefined, "family"],
        ["Other", undefined, "other"],
      ]),
    },
    whatHappens: {
      eyebrow: "What Happens Next",
      title: ["What Happens After You Ask"],
      items: items([
        ["Submit securely"],
        ["We confirm we've received it", "We contact you your preferred way."],
        ["We review and verify"],
        ["We may ask for more information"],
        ["We connect you with support or a referral"],
      ]),
      body: [
        para("r1", "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support."),
        para("r2", "Because of fraud, all information is checked and verified."),
      ],
    },
    whoCanAsk: {
      eyebrow: "Who Can Ask",
      title: ["Anyone Worried About a Child"],
      items: items([["Children and young people"], ["Parents"], ["Caregivers"], ["Teachers"], ["Community members"], ["Professionals"]]),
    },
    // CLIENT
    youngPeople: {
      title: ["A Note for Children", "and Young People"],
      body: [
        para(
          "y1",
          "You can ask for help yourself. If you can, ask a trusted adult to help you fill in the form. If you are in danger right now, tell a trusted adult or call the emergency number where you live.",
        ),
      ],
    },
    privacy: {
      eyebrow: "Your Privacy",
      title: ["Your Information Is Safe"],
      items: items([
        ["Only authorised staff can see your request."],
        ["We only ask for what we need."],
        ["You can ask us to correct or delete your information."],
      ]),
      body: [para("p1", "Read our [Privacy Policy](/policies/privacy) to see how your information is used and protected.")],
    },
    questions: {
      eyebrow: "Questions",
      title: ["Before You Ask"],
    },
    talkFirst: {
      title: ["Prefer to Talk First?"],
      body: [para("t1", "Call or email our team and we will talk it through with you, in confidence.")],
      cta: { label: "Request Support", to: "support" },
    },
  },
};
