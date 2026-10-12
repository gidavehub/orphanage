import "server-only";

// Receipt pages (admin-ux §6.6): the organisation details for the printed receipt, from Key
// information (contact) and the site settings (legal name and registration numbers).

import { getContact, getSiteSettings } from "@/lib/content/public";

export async function receiptOrg(): Promise<{ name: string; legalName: string; address: string; email: string; phone: string; registrations: Array<{ label: string; number: string }> }> {
  const [site, contact] = await Promise.all([getSiteSettings(), getContact()]);
  return {
    name: site.name,
    legalName: site.orgName,
    address: contact.address,
    email: contact.teamEmails.donations || contact.email,
    phone: contact.phone,
    registrations: site.registrations ?? [],
  };
}
