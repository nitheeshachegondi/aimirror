import { newProductId, newToken } from "./store";
import { locatePassage, newId } from "./text";
import { emptyShowcase } from "./types";
import type { Feature, Product } from "./types";

interface SampleDef {
  name: string;
  website: string;
  tagline: string;
  what: string;
  problem: string;
  differentiators: string[];
  whoFor: string[];
  notFor: string[];
  pricing: string;
  limitations: string[];
  docName: string;
  sentences: string[];
  /** [sentence index, title, description, category] */
  features: [number, string, string, string][];
}

const SAMPLES: SampleDef[] = [
  {
    name: "PathPilot",
    website: "https://example.com/pathpilot",
    tagline: "Turn your resume and a job description into a week-by-week interview roadmap.",
    what: "PathPilot is an interview-preparation platform that reads your resume and a target job description, finds the gaps, and builds a personal preparation plan with adaptive mock interviews.",
    problem: "Job seekers do not know which skills a role really needs, or whether their resume proves them, so their preparation is scattered.",
    differentiators: ["Roadmap is generated from your own resume and the specific job description, not a generic template", "Every mock-interview answer is scored and rewritten with a model answer"],
    whoFor: ["Freshers preparing for first jobs", "Professionals switching roles"],
    notFor: ["People looking for live human coaching"],
    pricing: "Free for the first three mock interviews each month; unlimited practice is Rs 499 per month.",
    limitations: ["Does not guarantee job offers", "English only for now"],
    docName: "PathPilot product overview",
    sentences: [
      "PathPilot reads your resume and a target job description and builds a week-by-week preparation roadmap.",
      "The skill gap report lists every requirement in the job description that your resume does not yet prove.",
      "Mock interviews adapt their questions to the role you are targeting and score each answer on structure, clarity and relevance.",
      "After every mock interview you get written feedback and a rewritten model answer for your weakest response.",
      "You can upload a resume as PDF or Word and PathPilot suggests line-by-line improvements for the target role.",
      "PathPilot is free for the first three mock interviews each month; unlimited practice is Rs 499 per month.",
      "PathPilot does not guarantee job offers and does not provide live human coaching.",
      "Progress tracking shows your score trend across mock interviews and the roadmap tasks you have completed.",
      "Everything is available in English only for now.",
    ],
    features: [
      [0, "Resume + job description roadmap", "Builds a week-by-week preparation roadmap from your resume and a target job description.", "Career roadmap"],
      [1, "Skill gap report", "Lists every job-description requirement your resume does not yet prove.", "Career roadmap"],
      [2, "Role-adaptive mock interviews", "Questions adapt to the targeted role and each answer is scored on structure, clarity and relevance.", "Interview practice"],
      [3, "Feedback with model answers", "Written feedback after each mock interview plus a rewritten model answer for the weakest response.", "Interview practice"],
      [4, "Resume improvement suggestions", "Upload a PDF or Word resume and get line-by-line improvements for the target role.", "Resume tools"],
      [7, "Progress tracking", "Shows score trend across mock interviews and completed roadmap tasks.", "Progress"],
    ],
  },
  {
    name: "ResumeForge",
    website: "https://example.com/resumeforge",
    tagline: "ATS-friendly resumes and cover letters, tailored to each job description.",
    what: "ResumeForge turns your work history into an ATS-friendly resume and tailors it to each job description, with matching cover letters.",
    problem: "Resumes get rejected by applicant tracking systems before a human reads them.",
    differentiators: ["Keyword gap highlighting against the pasted job description", "Templates tested to pass common ATS parsers"],
    whoFor: ["Active job applicants", "Career switchers updating their resume"],
    notFor: ["People who want interview practice or career advice"],
    pricing: "Free with two exports; Pro is Rs 299 per month.",
    limitations: ["No mock interviews or career advice"],
    docName: "ResumeForge feature sheet",
    sentences: [
      "ResumeForge turns your work history into an ATS-friendly resume in under ten minutes.",
      "Paste a job description and ResumeForge highlights the keywords your resume is missing.",
      "Choose from twelve single-column templates that pass common applicant tracking systems.",
      "Export your resume as PDF or Word, and keep multiple versions for different roles.",
      "A cover letter generator drafts a tailored letter from your resume and the job description.",
      "ResumeForge does not run mock interviews or give career advice.",
      "Plans start free with two exports; the Pro plan costs Rs 299 per month.",
    ],
    features: [
      [0, "ATS-friendly resume builder", "Turns your work history into an ATS-friendly resume in under ten minutes.", "Resume building"],
      [1, "Job-description keyword gap", "Paste a job description and see which keywords your resume is missing.", "Resume building"],
      [2, "Twelve ATS-safe templates", "Twelve single-column templates that pass common applicant tracking systems.", "Templates & export"],
      [3, "PDF and Word export, multiple versions", "Export as PDF or Word and keep different versions for different roles.", "Templates & export"],
      [4, "Cover letter generator", "Drafts a tailored cover letter from your resume and the job description.", "Cover letters"],
    ],
  },
  {
    name: "ClinicSkills Lab",
    website: "https://example.com/clinicskills",
    tagline: "Clinical communication and counselling skills for pharmacy and nursing students.",
    what: "ClinicSkills Lab offers short video courses and simulated-patient practice that build clinical communication skills for healthcare students.",
    problem: "Healthcare graduates know the theory but have little practice counselling real patients before their first job.",
    differentiators: ["Scenario quizzes where the student counsels a simulated patient", "Employer-verifiable completion certificates"],
    whoFor: ["Pharmacy students", "Nursing students"],
    notFor: ["Anyone preparing for clinical licensing exams"],
    pricing: "Rs 999 per course; Rs 4,999 for an annual pass.",
    limitations: ["No licensing exam preparation"],
    docName: "ClinicSkills Lab course catalogue",
    sentences: [
      "ClinicSkills Lab offers short video courses on clinical communication and patient counselling for pharmacy and nursing students.",
      "Each course ends with a scenario quiz where students counsel a simulated patient.",
      "A resume template is tailored for pharmacy graduates applying to hospital and community pharmacy roles.",
      "Students earn a completion certificate that employers can verify through a public link.",
      "Weekly live doubt-clearing sessions are held with practicing pharmacists.",
      "Courses are available in English and Telugu.",
      "ClinicSkills Lab does not offer clinical licensing exam preparation.",
      "Individual courses cost Rs 999; an annual pass is Rs 4,999.",
    ],
    features: [
      [0, "Clinical communication video courses", "Short video courses on clinical communication and patient counselling.", "Courses"],
      [1, "Simulated-patient scenario quizzes", "Each course ends with a quiz where the student counsels a simulated patient.", "Courses"],
      [2, "Pharmacy-graduate resume template", "Resume template tailored for hospital and community pharmacy roles.", "Career support"],
      [3, "Verifiable completion certificates", "Certificates employers can verify through a public link.", "Career support"],
      [4, "Weekly live doubt-clearing", "Weekly live sessions with practicing pharmacists.", "Live support"],
      [5, "English and Telugu courses", "Courses are available in English and Telugu.", "Languages"],
    ],
  },
];

export function buildSampleProducts(): Product[] {
  const now = new Date().toISOString();
  return SAMPLES.map((s, i) => {
    const docId = newId("d");
    const text = s.sentences.join("\n");
    const features: Feature[] = s.features.map(([idx, title, description, category]) => {
      const loc = locatePassage(text, s.sentences[idx]);
      return {
        id: newId("f"),
        title,
        description,
        category,
        status: "included",
        approved: true,
        origin: "ai",
        source: loc
          ? { docId, docName: s.docName, passage: text.slice(loc.start, loc.end), start: loc.start, end: loc.end, verified: loc.verified }
          : null,
        original: { title, description, category },
        note: "",
      };
    });
    const at = new Date(Date.now() - i * 60_000).toISOString();
    return {
      id: newProductId(s.name),
      token: newToken(),
      name: s.name,
      website: s.website,
      showcase: {
        ...emptyShowcase(),
        tagline: s.tagline,
        what: s.what,
        problem: s.problem,
        differentiators: s.differentiators,
        whoFor: s.whoFor,
        notFor: s.notFor,
        pricing: s.pricing,
        limitations: s.limitations,
      },
      features,
      documents: [{ id: docId, name: s.docName, text, isPublic: true, processed: true, truncated: false, addedAt: now }],
      dismissed: [],
      status: "published",
      createdAt: now,
      updatedAt: now,
      publishedAt: at,
    };
  });
}
