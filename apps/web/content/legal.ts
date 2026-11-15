/**
 * Facts the legal pages need about the company (decisions §16, §33.8). Values
 * that are still null show on the pages as clearly marked gaps; the owner
 * fills them in before launch, and the pages are reviewed once by our lawyer.
 */
export const COMPANY = {
  /** Trading name; the registered legal name goes in `legalName`. */
  name: "Ecotechcore",
  legalName: null as string | null,
  registrationNumber: null as string | null,
  vatNumber: null as string | null,
  address: null as string | null,
  country: "Romania",
  website: "https://titan117.com",
  emails: {
    support: "support@titan117.com",
    privacy: "privacy@titan117.com",
    security: "security@titan117.com",
    /** Reports of illegal content on shared links (EU Digital Services Act, decisions §30). */
    abuse: "abuse@titan117.com",
  },
  /** Romania's data protection authority, for complaints. */
  authority: { name: "ANSPDCP (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal)", url: "https://www.dataprotection.ro" },
} as const;

/** When the legal pages last changed. */
export const LEGAL_UPDATED = "15 November 2026";

/** Days between asking to delete an account and the deletion (account deletion, phase 2). */
export const DELETION_GRACE_DAYS = 30;
