import { DiagnosisAliasKind, DiagnosisRegistryStatus } from '@prisma/client';
import type { ImportedDiagnosisRecord } from '../diagnosis-registry-import.service.js';

export const diagnosisRegistrySeedRecords: ImportedDiagnosisRecord[] = [
  {
    canonicalName: 'Myocardial Infarction',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 90,
    category: 'Cardiology',
    specialty: 'Emergency Medicine',
    icd10Code: 'I21.9',
    aliases: [
      {
        alias: 'Heart attack',
        kind: DiagnosisAliasKind.SEARCH_ONLY,
        isAcceptedForGameplay: false,
      },
      {
        alias: 'MI',
        kind: DiagnosisAliasKind.ABBREVIATION,
      },
    ],
  },
  {
    canonicalName: 'Pulmonary Embolism',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 88,
    category: 'Pulmonology',
    specialty: 'Emergency Medicine',
    icd10Code: 'I26.99',
    aliases: [
      {
        alias: 'PE',
        kind: DiagnosisAliasKind.ABBREVIATION,
      },
    ],
  },
  {
    canonicalName: 'Diabetic Ketoacidosis',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 84,
    category: 'Endocrinology',
    specialty: 'Internal Medicine',
    icd10Code: 'E10.10',
    aliases: [
      {
        alias: 'DKA',
        kind: DiagnosisAliasKind.ABBREVIATION,
      },
    ],
  },
  {
    canonicalName: 'Appendicitis',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 74,
    category: 'Surgery',
    specialty: 'Emergency Medicine',
    icd10Code: 'K35.80',
    aliases: [
      {
        alias: 'Acute appendicitis',
        kind: DiagnosisAliasKind.ACCEPTED,
      },
    ],
  },
  {
    canonicalName: 'Community-Acquired Pneumonia',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 72,
    category: 'Infectious Disease',
    specialty: 'Internal Medicine',
    aliases: [
      {
        alias: 'Pneumonia',
        kind: DiagnosisAliasKind.ACCEPTED,
      },
      {
        alias: 'CAP',
        kind: DiagnosisAliasKind.ABBREVIATION,
      },
    ],
  },
  {
    canonicalName: 'Asthma Exacerbation',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 70,
    category: 'Pulmonology',
    specialty: 'Emergency Medicine',
    aliases: [
      {
        alias: 'Asthma attack',
        kind: DiagnosisAliasKind.ACCEPTED,
      },
    ],
  },
  {
    canonicalName: 'Ectopic Pregnancy',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 68,
    category: 'Obstetrics and Gynecology',
    specialty: 'Emergency Medicine',
    icd10Code: 'O00.90',
  },
  {
    canonicalName: 'Transient Ischemic Attack',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 66,
    category: 'Neurology',
    specialty: 'Emergency Medicine',
    aliases: [
      {
        alias: 'TIA',
        kind: DiagnosisAliasKind.ABBREVIATION,
      },
    ],
  },
  {
    canonicalName: 'Septic Shock',
    status: DiagnosisRegistryStatus.ACTIVE,
    searchPriority: 80,
    category: 'Infectious Disease',
    specialty: 'Critical Care',
    aliases: [
      {
        alias: 'Sepsis with shock',
        kind: DiagnosisAliasKind.SEARCH_ONLY,
        isAcceptedForGameplay: false,
      },
    ],
  },
];
