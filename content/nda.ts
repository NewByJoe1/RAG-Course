// The course's single running example: one NDA and one question. Every
// lesson and failure case quotes these clauses, so section numbers and wording
// stay consistent across modules.

export const RUNNING_QUESTION = "Can we share this with a subcontractor?";

export const NDA_TITLE = "Mutual Non-Disclosure Agreement (Acme Corp and Beta Ltd)";

export type NdaClause = { section: string; title: string; page: number; text: string };

export const NDA_CLAUSES: Record<string, NdaClause> = {
  definitions: {
    section: "§1.1",
    title: "Definitions",
    page: 1,
    text: '"Confidential Information" means all non-public information disclosed by either party, in any form, that is marked confidential or would reasonably be understood to be confidential.',
  },
  permittedRecipient: {
    section: "§1.4",
    title: "Permitted Recipient",
    page: 1,
    text: '"Permitted Recipient" means any employee, officer or professional adviser of the Receiving Party or of its Affiliates who needs to know the Confidential Information for the Purpose and is bound by written confidentiality obligations no less protective than this Agreement.',
  },
  permittedDisclosure: {
    section: "§4.2(b)",
    title: "Permitted Disclosure",
    page: 3,
    text: "The Receiving Party may disclose Confidential Information only: (a) with the Disclosing Party's prior written consent; or (b) to its Affiliates and Permitted Recipients, provided that each is bound by written confidentiality obligations no less protective than this Agreement.",
  },
  compelledDisclosure: {
    section: "§5",
    title: "Compelled Disclosure",
    page: 4,
    text: "If the Receiving Party is required by law, regulation or court order to disclose Confidential Information, it shall give the Disclosing Party prompt notice…",
  },
  term: { section: "§7", title: "Term", page: 5, text: "This Agreement shall remain in force for two (2) years from the Effective Date." },
  governingLaw: { section: "§9", title: "Governing Law", page: 6, text: "This Agreement shall be governed by the laws of the State of Delaware." },
  // Added by Amendment No. 1, signed after the course's first index was built.
  contractors: {
    section: "§4.5",
    title: "Contractors (Amendment No. 1)",
    page: 3,
    text: "Notwithstanding Section 4.2, no disclosure may be made to contractors without the Disclosing Party's prior written consent.",
  },
};

/** "§4.2(b) Permitted Disclosure, p.3" */
export const cite = (c: NdaClause) => `${c.section} ${c.title}, p.${c.page}`;

/**
 * The whole NDA as one document, for learners to put in their project as
 * data/nda.md (Module 1's hands-on). Each clause starts on its own line with
 * its section number, so it chunks cleanly one clause at a time.
 */
export const NDA_DOCUMENT = [
  `# ${NDA_TITLE}`,
  ...[
    NDA_CLAUSES.definitions,
    NDA_CLAUSES.permittedRecipient,
    NDA_CLAUSES.permittedDisclosure,
    NDA_CLAUSES.contractors,
    NDA_CLAUSES.compelledDisclosure,
    NDA_CLAUSES.term,
    NDA_CLAUSES.governingLaw,
  ].map((c) => `${c.section} ${c.title} (page ${c.page})\n${c.text}`),
  "Signature block (page 6)\nSigned for Acme Corp: ____________   Signed for Beta Ltd: ____________",
].join("\n\n");
