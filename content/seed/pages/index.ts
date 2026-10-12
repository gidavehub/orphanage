// Every pages.* doc seed, keyed by page key (PLAN D52).

import "server-only";

import type { PageKey } from "@/lib/content/ids";
import type { PageSeed } from "./_helpers";
import { aboutPage } from "./about";
import { contactPage } from "./contact";
import { donatePage } from "./donate";
import { faqPage } from "./faq";
import { getInvolvedPage } from "./getInvolved";
import { getSupportPage } from "./getSupport";
import { impactPage } from "./impact";
import { newsPage } from "./news";
import { notFoundPage } from "./notFound";
import { partnerPage } from "./partner";
import { policiesPage } from "./policies";
import { privacyRequestPage } from "./privacyRequest";
import { programmesPage } from "./programmes";
import { projectsPage } from "./projects";
import { reportConcernPage } from "./reportConcern";
import { requestReportPage } from "./requestReport";
import { requestSupportPage } from "./requestSupport";
import { resourcesPage } from "./resources";
import { searchPage } from "./search";
import { shareStoryPage } from "./shareStory";
import { sponsorPage } from "./sponsor";
import { storiesPage } from "./stories";
import { thankYouPage } from "./thankYou";
import { volunteerPage } from "./volunteer";

export const pageSeeds: Record<PageKey, PageSeed> = {
  about: aboutPage,
  programmes: programmesPage,
  getSupport: getSupportPage,
  requestSupport: requestSupportPage,
  reportConcern: reportConcernPage,
  contact: contactPage,
  resources: resourcesPage,
  requestReport: requestReportPage,
  impact: impactPage,
  projects: projectsPage,
  stories: storiesPage,
  shareStory: shareStoryPage,
  news: newsPage,
  getInvolved: getInvolvedPage,
  volunteer: volunteerPage,
  partner: partnerPage,
  sponsor: sponsorPage,
  donate: donatePage,
  thankYou: thankYouPage,
  faq: faqPage,
  policies: policiesPage,
  search: searchPage,
  privacyRequest: privacyRequestPage,
  notFound: notFoundPage,
};
