import type {
  DiagnosisEducation,
  TypedEducationPearl,
} from "../../../../game.types";

export type HighYieldFact = {
  id: string;
  label: string;
  value: string;
  sourceSection: string;
};

export type ClassicSign = {
  id: string;
  title: string;
  finding?: string;
  description?: string;
  significance?: string;
  whyItMatters?: string;
  diagnosticImpact?: string;
  discriminator?: string;
  trapAvoided?: string;
  action?: string;
  sourceSection: string;
};

export type InvestigationCard = {
  id: string;
  test: string;
  significance: string;
  interpretation?: string;
  discriminator?: string;
  trap?: string;
  sourceSection: string;
};

export type ManagementCard = {
  id: string;
  step: string;
  content?: string;
  rationale?: string;
  urgency?: string;
  trap?: string;
  sourceSection: string;
};

export type DifferentialCard = {
  id: string;
  diagnosis: string;
  keySeparator?: string;
  whyConfused?: string;
  classicTrap?: string;
  sourceSection: string;
};

export type ScoringSystemCard = {
  id: string;
  name: string;
  use?: string;
  components?: string[];
  caution?: string;
  sourceSection: string;
};

export type MnemonicCard = {
  id: string;
  name: string;
  expansion: Array<{
    letter?: string;
    meaning: string;
    note?: string;
  }>;
  useCase?: string;
  sourceSection: string;
};

export type TeachingObjects = {
  highYieldFacts: HighYieldFact[];
  classicSigns: ClassicSign[];
  investigations: InvestigationCard[];
  management: ManagementCard[];
  differentials: DifferentialCard[];
  scoringSystems: ScoringSystemCard[];
  mnemonics: MnemonicCard[];
  references: string[];
};

type DedupeCandidate = {
  id?: string;
  stableKey?: string;
  title?: string;
  name?: string;
  content?: string;
  value?: string;
  finding?: string;
  test?: string;
  step?: string;
  diagnosis?: string;
  meaning?: string;
};

const MAX_HIGH_YIELD_FACTS = 5;

export function buildTeachingObjects(
  education: DiagnosisEducation,
): TeachingObjects {
  const classicSigns = dedupeTeachingObjects([
    ...(education.keySigns ?? [])
      .map(keySignToClassicSign)
      .filter((item): item is ClassicSign => Boolean(item)),
    ...toClassicSigns(education.examPearls, "examPearls"),
  ]);
  const scoringSystems = dedupeTeachingObjects(
    toScoringSystems(education.scoringSystems),
  );
  const mnemonics = dedupeTeachingObjects([
    ...toStandaloneMnemonicCards(education.mnemonics, "mnemonics"),
    ...toMnemonicCardsFromScoringSystems(education.scoringSystems),
    ...toMnemonicCardsFromPearls(education.examPearls, "examPearls"),
    ...toMnemonicCardsFromPearls(education.recognitionPattern, "clinicalPattern"),
  ]);
  const investigations = dedupeTeachingObjects(
    toInvestigations(education.investigations),
  );
  const management = dedupeTeachingObjects(
    toManagementCards(education.managementOverview),
  );
  const differentials = dedupeTeachingObjects(
    toDifferentialCards(education.differentialDistinguishers),
  );

  return {
    highYieldFacts: buildHighYieldFacts({
      education,
      classicSigns,
      scoringSystems,
    }),
    classicSigns,
    investigations,
    management,
    differentials,
    scoringSystems,
    mnemonics,
    references: normalizeReferences(education.references),
  };
}

export function dedupeTeachingObjects<T extends DedupeCandidate>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getDedupeKey(item);
    if (!key) {
      result.push(item);
      continue;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function keySignToClassicSign(
  item: unknown,
  index: number,
): ClassicSign | null {
  const id = `key-sign-${index}`;

  if (typeof item === "string") {
    const text = cleanString(item);
    return text
      ? {
          id,
          title: text,
          finding: text,
          sourceSection: "keySigns",
        }
      : null;
  }

  if (!isRecord(item)) return null;

  const finding = cleanString(item.finding);
  if (!finding) return null;

  const description =
    cleanString(item.description) ??
    cleanString(item.significance) ??
    cleanString(item.whyItMatters) ??
    cleanString(item.diagnosticImpact) ??
    undefined;

  return {
    id: cleanString(item.id) ?? id,
    title: finding,
    finding,
    description,
    significance: cleanString(item.significance) ?? undefined,
    whyItMatters: cleanString(item.whyItMatters) ?? undefined,
    diagnosticImpact: cleanString(item.diagnosticImpact) ?? undefined,
    discriminator: cleanString(item.discriminator) ?? undefined,
    trapAvoided: cleanString(item.trapAvoided) ?? undefined,
    action:
      cleanString(item.managementImplication) ??
      cleanString(item.urgency) ??
      undefined,
    sourceSection: "keySigns",
  };
}

function buildHighYieldFacts({
  education,
  classicSigns,
  scoringSystems,
}: {
  education: DiagnosisEducation;
  classicSigns: ClassicSign[];
  scoringSystems: ScoringSystemCard[];
}) {
  const facts: HighYieldFact[] = [];
  const summary = getSummaryTakeaway(education);

  if (summary) {
    facts.push({
      id: "summary-high-yield",
      label: "Takeaway",
      value: summary,
      sourceSection: "summary",
    });
  }

  const pattern = firstTeachingText(education.recognitionPattern);
  if (pattern) {
    facts.push({
      id: "clinical-pattern",
      label: "Pattern",
      value: pattern,
      sourceSection: "clinicalPattern",
    });
  }

  for (const sign of classicSigns.slice(0, 2)) {
    facts.push({
      id: `${sign.id}-fact`,
      label: "Key sign",
      value: sign.title,
      sourceSection: sign.sourceSection,
    });
  }

  for (const score of scoringSystems.slice(0, 2)) {
    facts.push({
      id: `${score.id}-fact`,
      label: "Score",
      value: score.name,
      sourceSection: score.sourceSection,
    });
  }

  return dedupeTeachingObjects(facts).slice(0, MAX_HIGH_YIELD_FACTS);
}

function toClassicSigns(
  items: Array<unknown> | null | undefined,
  sourceSection: string,
): ClassicSign[] {
  return (items ?? [])
    .map<ClassicSign | null>((item, index) => {
      const id = makeId(sourceSection, item, index);

      if (typeof item === "string") {
        const text = cleanString(item);
        return text
          ? {
              id,
              title: text,
              finding: text,
              sourceSection,
            }
          : null;
      }

      if (isTypedPearl(item)) {
        if (item.type === "MNEMONIC") return null;
        return {
          id: cleanString(item.id) ?? id,
          title: item.title ?? pearlTypeLabel(item.type),
          finding: item.content,
          description: item.content,
          whyItMatters: item.whyItMatters,
          discriminator: item.discriminator,
          trapAvoided: item.trapAvoided,
          action: item.managementImplication ?? item.escalationImplication,
          sourceSection,
        };
      }

      if (!isRecord(item)) return null;

      const finding =
        cleanString(item.finding) ??
        cleanString(item.label) ??
        cleanString(item.title) ??
        cleanString(item.content);
      const whyItMatters =
        cleanString(item.whyItMatters) ??
        cleanString(item.explanation) ??
        cleanString(item.diagnosticImpact);

      return finding
        ? {
            id,
            title: cleanString(item.title) ?? cleanString(item.label) ?? finding,
            finding,
            description:
              cleanString(item.description) ??
              cleanString(item.significance) ??
              whyItMatters ??
              cleanString(item.diagnosticImpact) ??
              undefined,
            significance: cleanString(item.significance) ?? undefined,
            whyItMatters: whyItMatters ?? undefined,
            diagnosticImpact: cleanString(item.diagnosticImpact) ?? undefined,
            discriminator: cleanString(item.discriminator) ?? undefined,
            trapAvoided:
              cleanString(item.trapAvoided) ??
              cleanString(item.classicTrap) ??
              undefined,
            action:
              cleanString(item.managementImplication) ??
              cleanString(item.escalationImplication) ??
              undefined,
            sourceSection,
          }
        : null;
    })
    .filter((item): item is ClassicSign => Boolean(item));
}

function toInvestigations(
  items: Array<unknown> | null | undefined,
): InvestigationCard[] {
  return (items ?? [])
    .map((item, index) => {
      const id = makeId("investigations", item, index);

      if (typeof item === "string") {
        const text = cleanString(item);
        return text
          ? {
              id,
              test: text,
              significance: text,
              sourceSection: "investigations",
            }
          : null;
      }

      if (isTypedPearl(item)) {
        return {
          id: cleanString(item.id) ?? id,
          test: item.title ?? pearlTypeLabel(item.type),
          significance: item.content,
          interpretation: item.whyItMatters,
          discriminator: item.discriminator,
          trap: item.trapAvoided,
          sourceSection: "investigations",
        };
      }

      if (!isRecord(item)) return null;

      const test =
        cleanString(item.test) ??
        cleanString(item.title) ??
        cleanString(item.label);
      const significance =
        cleanString(item.significance) ??
        cleanString(item.content) ??
        cleanString(item.whyItMatters) ??
        cleanString(item.interpretation);

      return test && significance
        ? {
            id,
            test,
            significance,
            interpretation: cleanString(item.interpretation) ?? undefined,
            discriminator: cleanString(item.discriminator) ?? undefined,
            trap:
              cleanString(item.trap) ??
              cleanString(item.trapAvoided) ??
              undefined,
            sourceSection: "investigations",
          }
        : null;
    })
    .filter((item): item is InvestigationCard => Boolean(item));
}

function toManagementCards(
  items: Array<unknown> | null | undefined,
): ManagementCard[] {
  return (items ?? [])
    .map((item, index) => {
      const id = makeId("management", item, index);

      if (typeof item === "string") {
        const text = cleanString(item);
        return text
          ? {
              id,
              step: text,
              sourceSection: "management",
            }
          : null;
      }

      if (isTypedPearl(item)) {
        return {
          id: cleanString(item.id) ?? id,
          step: item.title ?? item.content,
          content: item.content,
          rationale: item.whyItMatters ?? item.content,
          urgency: item.managementImplication ?? item.escalationImplication,
          trap: item.trapAvoided,
          sourceSection: "management",
        };
      }

      if (!isRecord(item)) return null;

      const step =
        cleanString(item.step) ??
        cleanString(item.action) ??
        cleanString(item.title) ??
        cleanString(item.content);

      return step
        ? {
            id,
            step,
            content: cleanString(item.content) ?? undefined,
            rationale:
              cleanString(item.rationale) ??
              cleanString(item.whyItMatters) ??
              undefined,
            urgency:
              cleanString(item.urgency) ??
              cleanString(item.managementImplication) ??
              cleanString(item.escalationImplication) ??
              undefined,
            trap:
              cleanString(item.trap) ??
              cleanString(item.trapAvoided) ??
              undefined,
            sourceSection: "management",
          }
        : null;
    })
    .filter((item): item is ManagementCard => Boolean(item));
}

function toDifferentialCards(
  items: Array<unknown> | null | undefined,
): DifferentialCard[] {
  return (items ?? [])
    .map((item, index) => {
      const id = makeId("differentials", item, index);

      if (typeof item === "string") {
        const text = cleanString(item);
        return text
          ? {
              id,
              diagnosis: text,
              sourceSection: "differentials",
            }
          : null;
      }

      if (isTypedPearl(item)) {
        const diagnosis = item.title ?? item.discriminator ?? item.content;
        return {
          id: cleanString(item.id) ?? id,
          diagnosis,
          keySeparator: item.discriminator,
          whyConfused: item.content,
          classicTrap: item.trapAvoided,
          sourceSection: "differentials",
        };
      }

      if (!isRecord(item)) return null;

      const diagnosis =
        cleanString(item.diagnosis) ??
        cleanString(item.title) ??
        cleanString(item.name);

      return diagnosis
        ? {
            id,
            diagnosis,
            keySeparator:
              cleanString(item.keySeparator) ??
              cleanString(item.distinguishingPoint) ??
              undefined,
            whyConfused: cleanString(item.whyConfused) ?? undefined,
            classicTrap: cleanString(item.classicTrap) ?? undefined,
            sourceSection: "differentials",
          }
        : null;
    })
    .filter((item): item is DifferentialCard => Boolean(item));
}

function toScoringSystems(
  items: DiagnosisEducation["scoringSystems"],
): ScoringSystemCard[] {
  return (items ?? [])
    .map((item, index) => {
      const id = makeId("scoringSystems", item, index);

      if (typeof item === "string") {
        const text = cleanString(item);
        return text
          ? {
              id,
              name: text,
              sourceSection: "scoringSystems",
            }
          : null;
      }

      if (!isRecord(item)) return null;

      const record = item as Record<string, unknown>;
      const name = cleanString(item.name) ?? cleanString(record.title);

      return name
        ? {
            id: cleanString(item.id) ?? id,
            name,
            use: cleanString(item.use) ?? undefined,
            components: Array.isArray(item.components)
              ? item.components
                  .map((component) => cleanString(component))
                  .filter((component): component is string => Boolean(component))
              : undefined,
            caution: cleanString(item.caution) ?? undefined,
            sourceSection: "scoringSystems",
          }
        : null;
    })
    .filter((item): item is ScoringSystemCard => Boolean(item));
}

function toMnemonicCardsFromScoringSystems(
  items: DiagnosisEducation["scoringSystems"],
): MnemonicCard[] {
  return (items ?? [])
    .map((item, index) => {
      const id = makeId("mnemonics-score", item, index);

      if (typeof item === "string") {
        const name = extractMnemonicName(item);
        const expansion = parseMnemonicExpansion(item);
        return name && expansion.length
          ? {
              id,
              name,
              expansion,
              sourceSection: "scoringSystems",
            }
          : null;
      }

      if (!isRecord(item)) return null;

      const record = item as Record<string, unknown>;
      const components = Array.isArray(record.components)
        ? record.components
            .map((component) => cleanString(component))
            .filter((component): component is string => Boolean(component))
        : [];
      const structured = normalizeMnemonicValue(record.mnemonic);
      const name =
        structured?.name ??
        extractMnemonicName(
          cleanString(record.name),
          cleanString(record.title),
          cleanString(record.use),
          cleanString(record.caution),
        );
      const expansion =
        structured?.expansion.length
          ? structured.expansion
          : name
            ? buildMnemonicExpansion(name, components)
            : [];

      return name && expansion.length
        ? {
            id: structured?.id ?? cleanString(record.id) ?? id,
            name,
            expansion,
            useCase: structured?.useCase ?? cleanString(record.use) ?? undefined,
            sourceSection: "scoringSystems",
          }
        : null;
    })
    .filter((item): item is MnemonicCard => Boolean(item));
}

function toStandaloneMnemonicCards(
  items: DiagnosisEducation["mnemonics"],
  sourceSection: string,
): MnemonicCard[] {
  return (items ?? [])
    .map<MnemonicCard | null>((item, index) => {
      const structured = normalizeMnemonicValue(item);
      return structured
        ? {
            id: structured.id ?? makeId(sourceSection, item, index),
            name: structured.name,
            expansion: structured.expansion,
            ...(structured.useCase ? { useCase: structured.useCase } : {}),
            sourceSection,
          }
        : null;
    })
    .filter((item): item is MnemonicCard => Boolean(item));
}

function toMnemonicCardsFromPearls(
  items: Array<unknown> | null | undefined,
  sourceSection: string,
): MnemonicCard[] {
  return (items ?? [])
    .map((item, index) => {
      const id = makeId(`mnemonics-${sourceSection}`, item, index);

      if (typeof item === "string") {
        const expansion = parseMnemonicExpansion(item);
        const name = extractMnemonicName(item);
        return name && expansion.length
          ? { id, name, expansion, sourceSection }
          : null;
      }

      if (isTypedPearl(item)) {
        const isMnemonic =
          item.type === "MNEMONIC" ||
          hasMnemonicSignal(item.title, item.content);
        if (!isMnemonic) return null;

        const expansion = parseMnemonicExpansion(
          [item.title, item.content].filter(Boolean).join("\n"),
        );
        const name =
          extractMnemonicName(item.title, item.content) ??
          cleanString(item.title) ??
          "Mnemonic";

        return expansion.length
          ? {
              id: cleanString(item.id) ?? id,
              name,
              expansion,
              useCase: item.whyItMatters,
              sourceSection,
            }
          : null;
      }

      if (!isRecord(item)) return null;

      const structured = normalizeMnemonicValue(item.mnemonic);
      const text = [
        cleanString(item.title),
        cleanString(item.name),
        cleanString(item.content),
        cleanString(item.pattern),
        cleanString(item.whyItMatters),
      ]
        .filter(Boolean)
        .join("\n");
      const expansion = structured?.expansion.length
        ? structured.expansion
        : parseMnemonicExpansion(text);
      const name =
        structured?.name ??
        extractMnemonicName(text) ??
        cleanString(item.title) ??
        cleanString(item.name);

      return name && expansion.length
        ? {
            id,
            name,
            expansion,
            useCase: cleanString(item.useCase) ?? cleanString(item.whyItMatters) ?? undefined,
            sourceSection,
          }
        : null;
    })
    .filter((item): item is MnemonicCard => Boolean(item));
}

function normalizeMnemonicValue(value: unknown) {
  if (typeof value === "string") {
    const expansion = parseMnemonicExpansion(value);
    const name = extractMnemonicName(value);
    return name && expansion.length ? { name, expansion } : null;
  }

  if (!isRecord(value)) return null;

  const name =
    cleanString(value.name) ??
    cleanString(value.title) ??
    extractMnemonicName(cleanString(value.content));
  const expansion = normalizeMnemonicExpansion(value.expansion);
  const id = cleanString(value.id) ?? undefined;
  const useCase = cleanString(value.useCase) ?? undefined;

  return name && expansion.length ? { id, name, useCase, expansion } : null;
}

function normalizeMnemonicExpansion(value: unknown): MnemonicCard["expansion"] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        const parsed = parseMnemonicExpansion(entry);
        return parsed[0] ?? { meaning: entry };
      }

      if (!isRecord(entry)) return null;

      const meaning =
        cleanString(entry.meaning) ??
        cleanString(entry.text) ??
        cleanString(entry.content);
      if (!meaning) return null;

      return {
        letter: cleanString(entry.letter) ?? undefined,
        meaning,
        note: cleanString(entry.note) ?? undefined,
      };
    })
    .filter((entry): entry is MnemonicCard["expansion"][number] =>
      Boolean(entry),
    );
}

function buildMnemonicExpansion(
  name: string,
  components: string[],
): MnemonicCard["expansion"] {
  const letters = name.replace(/[^a-z0-9]/gi, "").split("");
  let letterIndex = 0;

  return components.map((component) => {
    const parsed = parseMnemonicExpansion(component)[0];
    if (parsed) return parsed;

    const first = component.trim().charAt(0).toUpperCase();
    const expected = letters[letterIndex]?.toUpperCase();
    const letter = expected && first === expected ? expected : undefined;
    if (letter) letterIndex += 1;

    return {
      letter,
      meaning: component,
    };
  });
}

function parseMnemonicExpansion(text: unknown): MnemonicCard["expansion"] {
  const raw = typeof text === "string" ? text : "";
  if (!raw.trim()) return [];

  const entries: MnemonicCard["expansion"] = [];
  const pattern = /(?:^|[\n;|])\s*([A-Za-z0-9])\s*(?:[-–—:.)])\s*([^;\n|]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw))) {
    const meaning = cleanString(match[2]);
    if (!meaning) continue;
    entries.push({
      letter: match[1].toUpperCase(),
      meaning,
    });
  }

  return entries;
}

function extractMnemonicName(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  const matches = text.match(/\b[A-Z][A-Z0-9-]{2,}\b/g) ?? [];
  return matches.find((match) => !NON_MNEMONIC_CODES.has(match)) ?? null;
}

function hasMnemonicSignal(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  return text.includes("mnemonic") || Boolean(extractMnemonicName(...values));
}

const NON_MNEMONIC_CODES = new Set([
  "ABG",
  "CBC",
  "CRP",
  "CT",
  "CXR",
  "ECG",
  "ESR",
  "FBC",
  "LFT",
  "MRI",
  "RIF",
  "RLQ",
  "USS",
  "WBC",
]);

function normalizeReferences(references: DiagnosisEducation["references"]) {
  return Array.from(
    new Set((references ?? []).map(cleanString).filter(Boolean) as string[]),
  );
}

function firstTeachingText(items: Array<unknown> | null | undefined) {
  for (const item of items ?? []) {
    if (typeof item === "string") {
      const text = cleanString(item);
      if (text) return text;
    }

    if (isTypedPearl(item)) {
      return item.title ?? item.content;
    }

    if (isRecord(item)) {
      const text =
        cleanString(item.pattern) ??
        cleanString(item.finding) ??
        cleanString(item.title) ??
        cleanString(item.content) ??
        cleanString(item.whyItMatters);
      if (text) return text;
    }
  }

  return null;
}

function getSummaryTakeaway(education: DiagnosisEducation) {
  if (!education.summary) return null;
  if (typeof education.summary === "string") return cleanString(education.summary);
  return cleanString(education.summary.highYieldTakeaway);
}

function getDedupeKey(item: DedupeCandidate) {
  return normalizeKey(
    item.id ??
      item.stableKey ??
      item.title ??
      item.name ??
      item.content ??
      item.value ??
      item.finding ??
      item.test ??
      item.step ??
      item.diagnosis,
  );
}

function makeId(sourceSection: string, item: unknown, index: number) {
  if (isRecord(item)) {
    const explicit = cleanString(item.id) ?? cleanString(item.stableKey);
    if (explicit) return slugify(explicit);
  }

  const text =
    typeof item === "string"
      ? item
      : isTypedPearl(item)
        ? item.title ?? item.content
        : isRecord(item)
          ? cleanString(item.title) ??
            cleanString(item.name) ??
            cleanString(item.finding) ??
            cleanString(item.test) ??
            cleanString(item.step) ??
            cleanString(item.diagnosis) ??
            cleanString(item.content)
          : null;

  return `${sourceSection}-${slugify(text ?? String(index + 1))}`;
}

function normalizeKey(value: unknown) {
  const text = cleanString(value);
  return text?.toLowerCase().replace(/\s+/g, " ") ?? null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTypedPearl(value: unknown): value is TypedEducationPearl {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.content === "string" &&
    value.content.trim().length > 0
  );
}

function pearlTypeLabel(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
