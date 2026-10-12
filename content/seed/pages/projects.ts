// pages.projects (public-pages §3.13). CLIENT [draft].

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { para, type PageSeed } from "./_helpers";

export const projectsPage: PageSeed = {
  hero: {
    title: ["Our Projects"],
    intro: "Practical work on the ground: school drives, reading circles, health days and more.",
    media: ref("project-1"),
  },
  seo: {
    title: "Our Projects",
    description: "Haven's practical work on the ground: school drives, reading circles, health days and more.",
  },
  sections: {
    empty: {
      body: [para("e1", "No projects match these filters yet.")],
    },
    funding: {
      cta: { label: "Support This Project", to: "donate" },
    },
  },
};
