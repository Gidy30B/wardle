import type { ClinicalClue, PublishTrack } from "../../game.types";
import type { LearnConfidence, LearnFilters } from "./learn.types";
export const LEARN_REVIEW_STORAGE_KEY = "wardle.learn.review.v1";

export const ALL_FILTERS: LearnFilters = {
  specialty: "all",
  track: "all",
  result: "all",
  difficulty: "all",
};

export const TRACK_COPY: Record<PublishTrack, { label: string; tone: string }> = {
  DAILY: {
    label: "Daily",
    tone: "border-[rgba(0,180,166,0.32)] bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]",
  },
  PREMIUM: {
    label: "Premium",
    tone: "border-[rgba(244,162,97,0.32)] bg-[rgba(244,162,97,0.14)] text-[var(--wardle-color-amber)]",
  },
  PRACTICE: {
    label: "Practice",
    tone: "border-white/[0.12] bg-white/[0.06] text-white/60",
  },
};

export const DIFFICULTY_TONES: Record<string, string> = {
  easy: "border border-[rgba(0,180,166,0.25)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-teal)]",
  medium:
    "border border-[rgba(244,162,97,0.25)] bg-[rgba(244,162,97,0.13)] text-[var(--wardle-color-amber)]",
  hard: "border border-rose-400/[0.25] bg-rose-400/[0.13] text-rose-300",
};

export const DIFFICULTY_ACTIVE_STYLES: Record<string, { bg: string; text: string }> = {
  easy: { bg: "rgba(0,180,166,0.18)", text: "var(--wardle-color-teal)" },
  medium: { bg: "rgba(244,162,97,0.18)", text: "var(--wardle-color-amber)" },
  hard: { bg: "rgba(248,113,113,0.14)", text: "rgb(252,165,165)" },
};

export const CLUE_TYPE_COPY: Record<
  ClinicalClue["type"],
  { label: string; abbr: string; tone: string }
> = {
  history: {
    label: "History",
    abbr: "Hx",
    tone: "border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  symptom: {
    label: "Symptom",
    abbr: "Sx",
    tone: "border-[rgba(244,162,97,0.3)] bg-[rgba(244,162,97,0.15)] text-[var(--wardle-color-amber)]",
  },
  vital: {
    label: "Vitals",
    abbr: "Vt",
    tone: "border-violet-400/[0.3] bg-violet-400/[0.15] text-violet-300",
  },
  exam: {
    label: "Exam",
    abbr: "Ex",
    tone: "border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  lab: {
    label: "Lab",
    abbr: "Lb",
    tone: "border-rose-400/[0.3] bg-rose-400/[0.15] text-rose-300",
  },
  imaging: {
    label: "Imaging",
    abbr: "Im",
    tone: "border-emerald-400/[0.3] bg-emerald-400/[0.15] text-emerald-300",
  },
};

export const CLUE_TYPE_TEXT_TONES: Record<ClinicalClue["type"], string> = {
  history: "text-[var(--wardle-color-teal)]",
  symptom: "text-[var(--wardle-color-amber)]",
  vital: "text-violet-300",
  exam: "text-[var(--wardle-color-teal)]",
  lab: "text-rose-300",
  imaging: "text-emerald-300",
};

export const CONFIDENCE_REVIEW_DAYS: Record<LearnConfidence, number> = {
  again: 1,
  hard: 3,
  good: 10,
  easy: 30,
};

export const CONFIDENCE_COPY: Record<
  LearnConfidence,
  {
    label: string;
    sublabel: string;
    tone: "rose" | "amber" | "teal" | "blue";
    marker: string;
  }
> = {
  again: {
    label: "Again",
    sublabel: "Forgot completely",
    tone: "rose",
    marker: "↺",
  },
  hard: { label: "Hard", sublabel: "Took effort", tone: "amber", marker: "!" },
  good: { label: "Good", sublabel: "Recalled ok", tone: "teal", marker: "✓" },
  easy: {
    label: "Easy",
    sublabel: "Instant recall",
    tone: "blue",
    marker: "★",
  },
};

export const TRACK_LABEL: Record<string, string> = {
  DAILY: "Daily",
  PREMIUM: "Premium",
  PRACTICE: "Practice",
};

export const MOBILE_SPECIALTY_ICONS: Record<string, { icon: string; tone: string }> = {
  cardiology: { icon: "❤️", tone: "bg-rose-400/[0.15] text-rose-300" },
  rheumatology: { icon: "🦴", tone: "bg-violet-400/[0.15] text-violet-300" },
  surgery: {
    icon: "🔪",
    tone: "bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  "general-surgery": {
    icon: "🔪",
    tone: "bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  respiratory: { icon: "🫁", tone: "bg-blue-400/[0.15] text-blue-300" },
  neurology: { icon: "🧠", tone: "bg-orange-400/[0.15] text-orange-300" },
  gastroenterology: {
    icon: "🫀",
    tone: "bg-emerald-400/[0.15] text-emerald-300",
  },
  gi: { icon: "🫀", tone: "bg-emerald-400/[0.15] text-emerald-300" },
  endocrinology: { icon: "⚗️", tone: "bg-amber-400/[0.15] text-amber-300" },
  haematology: { icon: "🩸", tone: "bg-red-400/[0.15] text-red-300" },
  hematology: { icon: "🩸", tone: "bg-red-400/[0.15] text-red-300" },
  oncology: { icon: "🔬", tone: "bg-fuchsia-400/[0.15] text-fuchsia-300" },
  infectious: { icon: "🦠", tone: "bg-lime-400/[0.15] text-lime-300" },
  "general-medicine": { icon: "🩺", tone: "bg-white/[0.08] text-white/70" },
};


