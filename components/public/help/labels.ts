// Form microcopy for the help forms' option lists whose values live in lib/schemas/forms/* (record
// enums without an admin label of their own). Enum labels that exist in lib/model/labels.ts are used
// from there.

import type { DayPeriod, Weekday } from "@/lib/model/domain/support";

export const EDUCATION_LEVEL_LABEL = {
  pre_school: "Pre-school or nursery",
  primary: "Primary school",
  secondary: "Secondary school",
  vocational: "Vocational or technical training",
  other: "Other",
} as const;

export const EDUCATION_NEED_LABEL = {
  fees: "School fees",
  uniform: "Uniform and shoes",
  materials: "Books and materials",
  hygiene: "Hygiene items",
  nutrition: "School meals",
  bedding: "Bedding",
  devices: "A device for learning",
} as const;

export const MEDICAL_NEED_LABEL = {
  referral: "A referral to a clinic or doctor",
  treatment_cost: "Help with treatment costs",
  supplies: "Medicine or medical supplies",
  information: "Health information",
} as const;

export const LEGAL_MATTER_LABEL = {
  custody_guardianship: "Guardianship or custody",
  documentation: "Documents (birth certificate, ID)",
  inheritance: "Inheritance",
  abuse_proceedings: "Abuse or violence",
  other: "Something else",
} as const;

export const COUNSELLING_FOR_LABEL = {
  child: "A child",
  parent_or_caregiver: "A parent or caregiver",
  family: "The family",
} as const;

export const WEEKDAY_LABEL: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export const DAY_PERIOD_LABEL: Record<DayPeriod, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

export const VIDEO_COMFORT_LABEL = { yes: "Yes", no: "No, phone is better", unsure: "Not sure" } as const;

export const SAFE_TO_CONTACT_LABEL = { yes: "Yes", careful: "No, please be careful" } as const;

/** One line under each "type of support" choice (hub cards and the request form's first step). */
export const SUPPORT_CATEGORY_DESCRIPTION = {
  child_protection: "A child is being harmed or is at risk, or your family needs protection support.",
  education: "School fees, uniforms, books and staying in school.",
  medical: "Treatment costs, referrals, medicine or health information.",
  counselling: "Talking to a counsellor, for a child, a caregiver or the family.",
  legal: "Guardianship, birth certificates, inheritance or abuse cases.",
  food_supplies: "Food, hygiene items and other essentials at home.",
  family_support: "Help for a family going through a hard time.",
  other: "Anything else you need help with.",
} as const;
