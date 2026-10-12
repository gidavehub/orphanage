// Settings › Giving: the payment half (settings/payment; PLAN D63, D71, D131). The display half
// (presets, minimums, frequencies, in-kind list) is the content doc `donate.config`.

import { z } from "zod";
import { CURRENCIES, LOCAL_PAYMENT_METHODS } from "@/lib/model/enums";

const text = (max: number) => z.string().trim().max(max, { error: `Please keep this to ${max} characters or fewer.` });
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), text(max).optional());

const BankSchema = z.object({
  bankName: text(80).min(1, { error: "Please give the bank's name." }),
  accountName: text(80).min(1, { error: "Please give the account name." }),
  accountNumber: text(40).min(1, { error: "Please give the account number." }),
  branch: optionalText(80),
  sortCode: optionalText(20),
  iban: optionalText(40),
  swift: optionalText(20),
  referenceHint: optionalText(120),
});

const InstructionSchema = z.object({
  methods: z.array(z.enum(LOCAL_PAYMENT_METHODS)).max(LOCAL_PAYMENT_METHODS.length),
  bank: BankSchema.nullable(),
  mobileMoney: z
    .array(
      z.object({
        provider: z.enum(["wave", "afrimoney", "qmoney"]),
        name: text(60).min(1, { error: "Please give the account name." }),
        number: text(30).regex(/^[+\d][\d\s-]{4,29}$/, { error: "Please give the number in digits." }),
      }),
    )
    .max(6),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), text(300).nullable()),
});

const perCurrency = <T extends z.ZodType>(s: T) => z.object({ GMD: s, USD: s, GBP: s, EUR: s });

export const PaymentSettingsInput = z.object({
  /** The `updatedAt` the form was loaded with (0 when the document was never written). */
  baseUpdatedAt: z.number().int().min(0),
  routes: perCurrency(z.enum(["stripe", "local"])),
  instructions: z.partialRecord(z.enum(CURRENCIES), InstructionSchema),
  fx: perCurrency(z.number({ error: "Please give a rate." }).positive({ error: "Rates must be above 0." }).max(1_000_000)),
  coverFeesPercent: z.number().min(0).max(20, { error: "Please keep this between 0 and 20%." }),
  maxOnline: perCurrency(z.number().positive({ error: "Please give an amount above 0." }).max(100_000_000)),
  receipt: z.object({
    legalName: text(120).min(1, { error: "Please give the organisation's legal name." }),
    registration: text(80),
    goodsServicesStatement: z.boolean(),
    signatory: text(80),
    footer: text(400),
    autoSend: z.boolean(),
  }),
});
export type PaymentSettingsInput = z.input<typeof PaymentSettingsInput>;
