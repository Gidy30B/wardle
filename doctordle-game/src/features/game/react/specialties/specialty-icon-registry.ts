import {
  Activity,
  Baby,
  Bean,
  Bone,
  Brain,
  CircleDot,
  Ear,
  Eye,
  Hand,
  Heart,
  Microscope,
  Pill,
  Scan,
  Scissors,
  Shield,
  Stethoscope,
  Venus,
  Wind,
  type LucideIcon,
} from "lucide-react";

export type SpecialtyIconKey =
  | "activity"
  | "baby"
  | "bone"
  | "brain"
  | "circle-dot"
  | "ear"
  | "eye"
  | "female"
  | "heart"
  | "kidney"
  | "lungs"
  | "microscope"
  | "pill"
  | "scan"
  | "scissors"
  | "shield"
  | "skin"
  | "stethoscope";

export const specialtyIconRegistry: Record<SpecialtyIconKey, LucideIcon> = {
  activity: Activity,
  baby: Baby,
  bone: Bone,
  brain: Brain,
  "circle-dot": CircleDot,
  ear: Ear,
  eye: Eye,
  female: Venus,
  heart: Heart,
  kidney: Bean,
  lungs: Wind,
  microscope: Microscope,
  pill: Pill,
  scan: Scan,
  scissors: Scissors,
  shield: Shield,
  skin: Hand,
  stethoscope: Stethoscope,
};

export const specialtyIconByName: Record<string, SpecialtyIconKey> = {
  cardiology: "heart",
  neurology: "brain",
  neurosurgery: "brain",
  orthopedic: "bone",
  orthopedics: "bone",
  orthopaedic: "bone",
  orthopaedics: "bone",
  rheumatology: "activity",
  pulmonology: "lungs",
  respiratory: "lungs",
  "respiratory medicine": "lungs",
  pediatrics: "baby",
  paediatrics: "baby",
  "emergency medicine": "activity",
  surgery: "scissors",
  "general surgery": "scissors",
  "general-surgery": "scissors",
  obstetrics: "female",
  gynecology: "female",
  gynaecology: "female",
  "obstetrics gynecology": "female",
  "obstetrics and gynecology": "female",
  "obstetrics gynaecology": "female",
  "obstetrics and gynaecology": "female",
  "ob gyn": "female",
  obgyn: "female",
  dermatology: "skin",
  ophthalmology: "eye",
  ent: "ear",
  otolaryngology: "ear",
  nephrology: "kidney",
  urology: "kidney",
  infectious: "shield",
  "infectious disease": "shield",
  "infectious diseases": "shield",
  hematology: "microscope",
  haematology: "microscope",
  oncology: "scan",
  endocrinology: "activity",
  gastroenterology: "pill",
  gi: "pill",
  psychiatry: "brain",
  "general medicine": "stethoscope",
  "general-medicine": "stethoscope",
  "internal medicine": "stethoscope",
};

export const specialtyIconToneByKey: Record<SpecialtyIconKey, string> = {
  activity: "bg-amber-400/[0.15] text-amber-300",
  baby: "bg-pink-400/[0.15] text-pink-300",
  bone: "bg-violet-400/[0.15] text-violet-300",
  brain: "bg-orange-400/[0.15] text-orange-300",
  "circle-dot": "bg-white/[0.08] text-white/70",
  ear: "bg-sky-400/[0.15] text-sky-300",
  eye: "bg-cyan-400/[0.15] text-cyan-300",
  female: "bg-pink-400/[0.15] text-pink-300",
  heart: "bg-rose-400/[0.15] text-rose-300",
  kidney: "bg-indigo-400/[0.15] text-indigo-300",
  lungs: "bg-blue-400/[0.15] text-blue-300",
  microscope: "bg-red-400/[0.15] text-red-300",
  pill: "bg-emerald-400/[0.15] text-emerald-300",
  scan: "bg-fuchsia-400/[0.15] text-fuchsia-300",
  scissors: "bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  shield: "bg-lime-400/[0.15] text-lime-300",
  skin: "bg-yellow-400/[0.15] text-yellow-300",
  stethoscope: "bg-white/[0.08] text-white/70",
};

export function normalizeSpecialtyName(specialty?: string | null) {
  return (specialty ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " and ")
    .replace(/\//g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeSpecialtyLabel(specialty?: string | null) {
  const normalized = normalizeSpecialtyName(specialty);
  if (
    normalized === "orthopedics" ||
    normalized === "orthopedic" ||
    normalized === "orthopaedics" ||
    normalized === "orthopaedic"
  ) {
    return "Orthopaedics";
  }

  const trimmed = specialty?.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

export function getSpecialtyIconKey(
  specialty?: string | null,
): SpecialtyIconKey {
  const normalized = normalizeSpecialtyName(specialty);
  return specialtyIconByName[normalized] ?? "stethoscope";
}

export function getSpecialtyIconTone(specialty?: string | null) {
  return specialtyIconToneByKey[getSpecialtyIconKey(specialty)];
}
