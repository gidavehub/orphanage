// Testimonials (content-model §3.5). Verbatim from content/people.ts → testimonials, in today's order
// (donors lead, client brief). CLIENT: testimonials must be published with permission (ToR §4); these
// are placeholders with illustrative portraits, so consent is "not_required" with `placeholder: true`.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";
import { ref } from "@/lib/media/pipeline";

const ILLUSTRATIVE = { state: "not_required" } as const;

export const testimonialSeeds: ItemSeed<"testimonials">[] = [
  {
    id: "testimonial-denise",
    placeholder: true,
    order: 1,
    name: "Denise W.",
    kind: "donor",
    role: "Monthly Donor, California, USA",
    quote:
      "I wanted to help children I may never meet, and Haven shows me exactly how. The monthly updates are honest, and I can see my gift at work across the ocean.",
    image: ref("testimonial-5"),
    consent: ILLUSTRATIVE,
  },
  {
    id: "testimonial-priya",
    placeholder: true,
    order: 2,
    name: "Priya S.",
    kind: "donor",
    role: "Monthly Donor, India",
    quote:
      "I give monthly because I can see exactly where it goes. The updates are honest, the programmes are practical, and the children’s privacy is always respected.",
    image: ref("testimonial-2"),
    consent: ILLUSTRATIVE,
  },
  {
    id: "testimonial-omar",
    placeholder: true,
    order: 3,
    name: "Omar H.",
    kind: "donor",
    role: "Donor, London, UK",
    quote:
      "Giving my Zakat through Haven gives me peace of mind. They visit and verify the homes they support, and they tell us plainly what our money did.",
    image: ref("testimonial-6"),
    consent: ILLUSTRATIVE,
  },
  {
    id: "testimonial-parent",
    placeholder: true,
    order: 4,
    name: "Parent",
    kind: "beneficiary",
    role: "Supported through the education programme",
    quote:
      "The support helped my child return to school and gave our family hope again. We were treated with dignity from the very first conversation, and every promise was kept.",
    image: ref("testimonial-1"),
    consent: ILLUSTRATIVE,
  },
  {
    id: "testimonial-paolo",
    placeholder: true,
    order: 5,
    name: "Paolo R.",
    kind: "volunteer",
    role: "Volunteer, the Philippines",
    quote:
      "Volunteering with Haven showed me how much a community can do when it works together. The training and safeguarding standards are taken seriously.",
    image: ref("testimonial-3"),
    consent: ILLUSTRATIVE,
  },
  {
    id: "testimonial-sana",
    placeholder: true,
    order: 6,
    name: "Dr. Sana A.",
    kind: "professional",
    role: "Healthcare Partner, Pakistan",
    quote:
      "Referrals from Haven arrive well prepared and well followed up. It is a partnership that genuinely puts the child’s best interests first.",
    image: ref("testimonial-4"),
    consent: ILLUSTRATIVE,
  },
];
