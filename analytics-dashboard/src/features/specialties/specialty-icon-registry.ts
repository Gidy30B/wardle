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
} from 'lucide-react';

export type SpecialtyIconKey =
  | 'activity'
  | 'baby'
  | 'bone'
  | 'brain'
  | 'circle-dot'
  | 'ear'
  | 'eye'
  | 'female'
  | 'heart'
  | 'kidney'
  | 'lungs'
  | 'microscope'
  | 'pill'
  | 'scan'
  | 'scissors'
  | 'shield'
  | 'skin'
  | 'stethoscope';

export const specialtyIconRegistry: Record<SpecialtyIconKey, LucideIcon> = {
  activity: Activity,
  baby: Baby,
  bone: Bone,
  brain: Brain,
  'circle-dot': CircleDot,
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
  cardiology: 'heart',
  neurology: 'brain',
  neurosurgery: 'brain',
  orthopedic: 'bone',
  orthopedics: 'bone',
  orthopaedic: 'bone',
  orthopaedics: 'bone',
  pulmonology: 'lungs',
  respiratory: 'lungs',
  'respiratory medicine': 'lungs',
  pediatrics: 'baby',
  paediatrics: 'baby',
  'emergency medicine': 'activity',
  surgery: 'scissors',
  'general surgery': 'scissors',
  obstetrics: 'female',
  gynecology: 'female',
  gynaecology: 'female',
  'obstetrics gynecology': 'female',
  'obstetrics and gynecology': 'female',
  'obstetrics gynaecology': 'female',
  'obstetrics and gynaecology': 'female',
  'ob gyn': 'female',
  obgyn: 'female',
  dermatology: 'skin',
  ophthalmology: 'eye',
  ent: 'ear',
  otolaryngology: 'ear',
  nephrology: 'kidney',
  urology: 'kidney',
  'infectious disease': 'shield',
  'infectious diseases': 'shield',
  hematology: 'microscope',
  haematology: 'microscope',
  oncology: 'scan',
  endocrinology: 'activity',
  gastroenterology: 'pill',
  psychiatry: 'brain',
  rheumatology: 'activity',
  'general medicine': 'stethoscope',
  'internal medicine': 'stethoscope',
};

export function normalizeSpecialtyName(specialty?: string | null) {
  return (specialty ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' and ')
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeSpecialtyLabel(specialty?: string | null) {
  const normalized = normalizeSpecialtyName(specialty);
  if (
    normalized === 'orthopedics' ||
    normalized === 'orthopedic' ||
    normalized === 'orthopaedics' ||
    normalized === 'orthopaedic'
  ) {
    return 'Orthopaedics';
  }

  const trimmed = specialty?.replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

export function getSpecialtyIconKey(
  specialty?: string | null,
): SpecialtyIconKey {
  const normalized = normalizeSpecialtyName(specialty);
  return specialtyIconByName[normalized] ?? 'stethoscope';
}
