// The seed aggregate: every singleton default and every collection's seed items (content-model §3.7).
// Imported only by lib/content/defaults.ts (and lib/server/public/resources.ts for the library), per
// the PLAN §4.2 import rule 3.

import "server-only";

import type { CollectionName, DocId } from "@/lib/content/ids";
import type { DocSeed, ItemSeed } from "@/lib/content/types";
import { allocationSeeds } from "./allocation";
import { causeSeeds } from "./causes";
import { donateConfigSeed } from "./donate";
import { faqSeeds } from "./faqs";
import {
  homeAboutSeed,
  homeAppealsSeed,
  homeDonateSeed,
  homeDoorsSeed,
  homeDuoSeed,
  homeFaqSeed,
  homeFinalCtaSeed,
  homeFocusSeed,
  homeFounderSeed,
  homeHeroSeed,
  homeImpactSeed,
  homeJoinSeed,
  homeJourneySeed,
  homeLayoutSeed,
  homeManifestoSeed,
  homeNewsSeed,
  homePartnersSeed,
  homeProgrammesSeed,
  homeProjectsSeed,
  homeRestoringSeed,
  homeStoriesSeed,
  homeTeamSeed,
  homeTestimonialsSeed,
  homeWorldSeed,
} from "./home";
import { mediaMeta } from "./media-meta";
import { pageSeeds } from "./pages";
import { partnerSeeds } from "./partners";
import { policySeeds } from "./policies";
import { postSeeds } from "./posts";
import { programmeSeeds } from "./programmes";
import { projectSeeds } from "./projects";
import { resourceSeeds } from "./resources";
import {
  announcementsSeed,
  chromeSeed,
  CONTACT_SEED_VALUES,
  contactSeed,
  editorialSeed,
  safetySeed,
  seoSeed,
  siteSeed,
} from "./site";
import { statSeeds } from "./stats";
import { storySeeds } from "./stories";
import { teamSeeds } from "./team";
import { testimonialSeeds } from "./testimonials";

export const docSeeds: { [K in DocId]: DocSeed<K> } = {
  "settings.site": siteSeed,
  "settings.contact": contactSeed,
  "settings.safety": safetySeed,
  "settings.announcements": announcementsSeed,
  "settings.chrome": chromeSeed,
  "settings.seo": seoSeed,
  "settings.editorial": editorialSeed,
  "home.layout": homeLayoutSeed,
  "home.hero": homeHeroSeed,
  "home.world": homeWorldSeed,
  "home.partners": homePartnersSeed,
  "home.programmes": homeProgrammesSeed,
  "home.about": homeAboutSeed,
  "home.duo": homeDuoSeed,
  "home.manifesto": homeManifestoSeed,
  "home.impact": homeImpactSeed,
  "home.focus": homeFocusSeed,
  "home.appeals": homeAppealsSeed,
  "home.donate": homeDonateSeed,
  "home.doors": homeDoorsSeed,
  "home.stories": homeStoriesSeed,
  "home.founder": homeFounderSeed,
  "home.team": homeTeamSeed,
  "home.restoring": homeRestoringSeed,
  "home.testimonials": homeTestimonialsSeed,
  "home.journey": homeJourneySeed,
  "home.projects": homeProjectsSeed,
  "home.faq": homeFaqSeed,
  "home.join": homeJoinSeed,
  "home.news": homeNewsSeed,
  "home.finalCta": homeFinalCtaSeed,
  "donate.config": donateConfigSeed,
  "pages.about": pageSeeds.about,
  "pages.programmes": pageSeeds.programmes,
  "pages.getSupport": pageSeeds.getSupport,
  "pages.requestSupport": pageSeeds.requestSupport,
  "pages.reportConcern": pageSeeds.reportConcern,
  "pages.contact": pageSeeds.contact,
  "pages.resources": pageSeeds.resources,
  "pages.requestReport": pageSeeds.requestReport,
  "pages.impact": pageSeeds.impact,
  "pages.projects": pageSeeds.projects,
  "pages.stories": pageSeeds.stories,
  "pages.shareStory": pageSeeds.shareStory,
  "pages.news": pageSeeds.news,
  "pages.getInvolved": pageSeeds.getInvolved,
  "pages.volunteer": pageSeeds.volunteer,
  "pages.partner": pageSeeds.partner,
  "pages.sponsor": pageSeeds.sponsor,
  "pages.donate": pageSeeds.donate,
  "pages.thankYou": pageSeeds.thankYou,
  "pages.faq": pageSeeds.faq,
  "pages.policies": pageSeeds.policies,
  "pages.search": pageSeeds.search,
  "pages.privacyRequest": pageSeeds.privacyRequest,
  "pages.notFound": pageSeeds.notFound,
};

/**
 * Singletons that still hold // CLIENT values (Before-launch checklist, D130). Every pages.* doc is
 * [draft] copy too, so all of them are listed.
 */
export const placeholderDocIds: readonly DocId[] = [
  "settings.site",
  "settings.contact",
  "settings.safety",
  "settings.editorial",
  "home.founder",
  ...(Object.keys(docSeeds) as DocId[]).filter((id) => id.startsWith("pages.")),
];

export const itemSeeds: { [C in CollectionName]: ItemSeed<C>[] } = {
  programmes: programmeSeeds,
  causes: causeSeeds,
  stats: statSeeds,
  stories: storySeeds,
  testimonials: testimonialSeeds,
  team: teamSeeds,
  faqs: faqSeeds,
  partners: partnerSeeds,
  projects: projectSeeds,
  posts: postSeeds,
  policies: policySeeds,
  // Pipeline assets come from lib/media/pipeline.ts, not from seeds.
  media: [],
  allocationSummaries: allocationSeeds,
};

export { CONTACT_SEED_VALUES, mediaMeta, resourceSeeds };
export type { ResourceSeed } from "./resources";
