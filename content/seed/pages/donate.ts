// pages.donate (public-pages §4.3–4.5). The general cause's lead is [spec §8] verbatim; the rest is
// CLIENT [draft]. Amounts, currencies and the breakdown come from donate.config and the causes; the
// payment details come from settings/payment. Section keys are read by app/(site)/donate/(give).

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const donatePage: PageSeed = {
  hero: {
    eyebrow: "Where it’s needed most",
    title: ["Give Hope, Create", "Opportunity"],
    intro:
      "Your contribution will help a vulnerable child return to school, gain economic empowerment, live with dignity, access medical care, receive counselling and obtain essential protection and family support.",
  },
  seo: {
    title: "Donate",
    description:
      "Give once or every month, to where it's needed most or to a cause you care about, and see exactly where your money goes.",
  },
  sections: {
    chooseCause: {
      eyebrow: "Choose a Cause",
      title: ["Where Would You Like", "to Give?"],
      body: [para("cc1", "Every programme and appeal has its own page, its own breakdown and its own link to share. Pick the one closest to your heart.")],
    },
    whereItGoes: {
      eyebrow: "See Exactly Where It Goes",
      title: ["Where Your Money Goes"],
      body: [para("w1", "Percentages are illustrative until confirmed by our finance team.")],
    },
    examples: {
      eyebrow: "Real Things, Real Children",
      title: ["What Your Gift Can Do"],
      body: [para("e1", "Tap an example to set that amount in the donation card.")],
    },
    reachChild: {
      eyebrow: "Verified Before We Give",
      title: ["How We Make Sure It", "Reaches a Child"],
      body: [
        para(
          "r1",
          "We visit, verify and plan with every orphanage, family and partner before any support is given, then follow up so we can show you what changed.",
        ),
      ],
    },
    trust: {
      eyebrow: "Trust and Transparency",
      title: ["Your Gift Is Safe With Us"],
      items: items([
        ["We never store card details on this site", "Card payments happen on Stripe's secure page.", "lock"],
        ["Payments processed by Stripe", "A global payment provider trusted by millions of charities and businesses.", "card"],
        ["Every gift is acknowledged and receipted", "You'll hear from us by email, with your reference and a receipt.", "receipt"],
        ["Reported openly", "Our impact page and annual report show where the money went.", "chart"],
      ]),
    },
    otherWays: {
      eyebrow: "Other Ways to Give",
      title: ["Other Ways to Give"],
      body: [para("o1", "Prefer a bank transfer or mobile money? Our team will send you the details for your currency.")],
      items: items([
        ["Bank transfer or mobile money", "Choose “Confirm my pledge” and we'll email you the account details and your reference."],
        ["Give in kind", "School materials, clothing, bedding, food, medical supplies, learning devices and more."],
        ["Corporate and partner giving", "Match your staff's gifts, sponsor a programme or give through your foundation."],
      ]),
    },
    zakat: {
      title: ["Zakat"],
      body: [para("z1", "This appeal can receive Zakat. Our team will make sure your Zakat reaches eligible families.")],
    },
    cancelled: {
      body: [para("c1", "Your payment was cancelled and nothing was charged. Your choices are saved below.")],
    },
    closed: {
      body: [para("cl1", "This appeal has closed, thank you! Your gift below will go where it's needed most.")],
    },
    questions: {
      eyebrow: "Questions",
      title: ["About Giving"],
      items: items([
        ["Is my donation secure?", "Yes. Card payments are handled on Stripe's secure page and we never see or store card details. Pledges are paid by bank transfer or mobile money using the reference we email you."],
        ["Will I get a receipt?", "Yes. Every gift is acknowledged by email with its reference, and a receipt follows once your gift is received."],
        ["How do I change or cancel a monthly gift?", "Card gifts can be changed or stopped at any time from the secure link in your receipt, or from Manage my gift. For pledges, reply to our email and we'll update it for you."],
        ["Can I give anonymously?", "Yes. Tick “Keep my gift anonymous” and your name will never appear in any public thank-you or report. We still need your details to send your receipt."],
        ["Which currencies can I use?", "Dalasi, US dollars, pounds and euros. Each gift stays in the currency you chose; we never add up different currencies."],
        // CLIENT: confirm tax status per country before launch.
        ["Is my gift tax-deductible?", "We're confirming the tax position for each country we raise funds in. Our team will tell you what applies to your gift on request."],
      ]),
    },
    share: {
      title: ["Share This Appeal"],
      body: [para("s1", "One message to a friend can double what reaches a child.")],
    },
    closing: {
      eyebrow: "Every Gift Is a Promise Kept",
      title: ["Your Support Will Positively", "Impact a Child's Welfare", "and Future"],
      body: [para("cl2", "Whatever you give, we'll tell you where it went and what it changed.")],
    },
  },
};
