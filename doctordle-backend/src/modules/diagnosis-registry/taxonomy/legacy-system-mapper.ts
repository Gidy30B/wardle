export type LegacySystemTaxonomy = {
  specialty?: string;
  subspecialty?: string;
  bodySystem?: string;
  category?: string;
};

export type LegacySystemMappingResult =
  | {
      mapped: true;
      legacySystem: string;
      normalizedSystem: string;
      taxonomy: LegacySystemTaxonomy;
    }
  | {
      mapped: false;
      legacySystem: string | null;
      normalizedSystem: string | null;
    };

const LEGACY_SYSTEM_MAPPINGS: Record<string, LegacySystemTaxonomy> = {
  cardiology: {
    specialty: 'Cardiology',
    bodySystem: 'Cardiovascular',
  },
  cardiovascular: {
    specialty: 'Cardiology',
    bodySystem: 'Cardiovascular',
  },
  endocrine: {
    specialty: 'Endocrinology',
    bodySystem: 'Endocrine',
    category: 'Metabolic',
  },
  endocrinology: {
    specialty: 'Endocrinology',
    bodySystem: 'Endocrine',
    category: 'Metabolic',
  },
  gastroenterology: {
    specialty: 'Gastroenterology',
    bodySystem: 'Gastrointestinal',
  },
  gastrointestinal: {
    specialty: 'Gastroenterology',
    bodySystem: 'Gastrointestinal',
  },
  gi: {
    specialty: 'Gastroenterology',
    bodySystem: 'Gastrointestinal',
  },
  hematology: {
    specialty: 'Hematology',
    bodySystem: 'Hematologic',
  },
  infectious: {
    specialty: 'Infectious Disease',
    bodySystem: 'Multisystem',
    category: 'Infectious',
  },
  'infectious disease': {
    specialty: 'Infectious Disease',
    bodySystem: 'Multisystem',
    category: 'Infectious',
  },
  nephrology: {
    specialty: 'Nephrology',
    bodySystem: 'Renal',
  },
  renal: {
    specialty: 'Nephrology',
    bodySystem: 'Renal',
  },
  neurology: {
    specialty: 'Neurology',
    bodySystem: 'Nervous System',
  },
  neuro: {
    specialty: 'Neurology',
    bodySystem: 'Nervous System',
  },
  obstetrics: {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  gynecology: {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  'obstetrics & gynecology': {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  obgyn: {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  'ob/gyn': {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  psychiatry: {
    specialty: 'Psychiatry',
    bodySystem: 'Behavioral Health',
  },
  pulmonology: {
    specialty: 'Pulmonology',
    bodySystem: 'Respiratory',
  },
  respiratory: {
    specialty: 'Pulmonology',
    bodySystem: 'Respiratory',
  },
  rheumatology: {
    specialty: 'Rheumatology',
    bodySystem: 'Musculoskeletal',
    category: 'Autoimmune',
  },
  surgery: {
    specialty: 'Surgery',
    bodySystem: 'Multisystem',
  },
  trauma: {
    specialty: 'Emergency Medicine',
    bodySystem: 'Multisystem',
    category: 'Trauma',
  },
  urology: {
    specialty: 'Urology',
    bodySystem: 'Genitourinary',
  },
};

export function mapLegacySystemToRegistryTaxonomy(
  legacySystem: string | null | undefined,
): LegacySystemMappingResult {
  const normalizedSystem = normalizeLegacySystem(legacySystem);
  if (!normalizedSystem) {
    return {
      mapped: false,
      legacySystem: normalizeOriginalSystem(legacySystem),
      normalizedSystem: null,
    };
  }

  const taxonomy = LEGACY_SYSTEM_MAPPINGS[normalizedSystem];
  if (!taxonomy) {
    return {
      mapped: false,
      legacySystem: normalizeOriginalSystem(legacySystem),
      normalizedSystem,
    };
  }

  return {
    mapped: true,
    legacySystem: normalizeOriginalSystem(legacySystem) ?? normalizedSystem,
    normalizedSystem,
    taxonomy,
  };
}

export function getLegacySystemMappingKeys(): string[] {
  return Object.keys(LEGACY_SYSTEM_MAPPINGS).sort();
}

function normalizeLegacySystem(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeOriginalSystem(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/\band\b/g, '&')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOriginalSystem(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}
