import "server-only";

// The public read façade (PLAN D21, §4.2): public pages import data from here and nowhere else.
// It re-exports the cached content readers (lib/content/read.ts), the cached system readers
// (lib/server/public/*: payment settings, cause totals, resources, sponsor profiles) and site search.

export {
  getAdjacentPosts,
  getAllocationSummary,
  getAnyIllustrativeInUse,
  getAppealCards,
  getCause,
  getCauses,
  getCollection,
  getContact,
  getContent,
  getDonateConfig,
  getEditorialSettings,
  getFaqs,
  getHomeContent,
  getLatestPosts,
  getLiveMediaUsage,
  getPage,
  getPartners,
  getPolicies,
  getPolicy,
  getPost,
  getPosts,
  getProgramme,
  getProgrammes,
  getProject,
  getProjects,
  getPublishedPostSlugs,
  getSafety,
  getSiteChrome,
  getSiteSettings,
  getStatList,
  getStats,
  getStories,
  getTeam,
  getTestimonials,
  postCategoryLabel,
} from "./read";
export { searchSite } from "./search";
export type { SearchHit, SearchHitType } from "./search";
export { getCauseTotals } from "@/lib/server/public/totals";
export { getPaymentSettings } from "@/lib/server/public/settings";
export { getResource, getResources } from "@/lib/server/public/resources";
export { getSponsorProfiles } from "@/lib/server/public/sponsors";

export type {
  AllocationSummaryView,
  CauseCard,
  CauseView,
  ContactView,
  CtaView,
  DonateConfigView,
  FaqView,
  HomeView,
  PageView,
  PartnerView,
  PolicyView,
  PostCard,
  ProgrammeCard,
  ProjectCard,
  ProjectView,
  ResolvedImage,
  ResolvedMedia,
  ResolvedPost,
  ResolvedProgramme,
  ResolvedStat,
  ResolvedStory,
  ResolvedVideo,
  SafetyView,
  SiteChrome,
  SiteSettingsView,
  StoryView,
  TeamMemberView,
  TestimonialView,
} from "./types";
