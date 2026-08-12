import 'dotenv/config';
import {
  PrismaClient,
  CaseEditorialStatus,
  CaseSource,
  DiagnosisAgeGroup,
  DiagnosisAliasKind,
  DiagnosisClinicalSetting,
  DiagnosisDifficultyBand,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisRarityBand,
  DiagnosisRegistryStatus,
  DiagnosisUrgencyLevel,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function resolvePgConnectionString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');
  if (!apiKey) {
    throw new Error('DATABASE_URL uses prisma+postgres:// but is missing api_key.');
  }

  const payload = JSON.parse(
    Buffer.from(apiKey, 'base64url').toString('utf8'),
  ) as { databaseUrl?: unknown };

  if (typeof payload.databaseUrl !== 'string' || !payload.databaseUrl) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but api_key does not contain a databaseUrl.',
    );
  }

  return payload.databaseUrl;
}

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Ménière Disease seed.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizeClinicalText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function getNextCasePublicNumber(): Promise<number> {
  const latest = await prisma.case.findFirst({
    where: { publicNumber: { not: null } },
    orderBy: { publicNumber: 'desc' },
    select: { publicNumber: true },
  });

  return (latest?.publicNumber ?? 0) + 1;
}

async function findAvailableInventoryPlaceholderDate(params: {
  preferredDate: Date;
  reusableCaseId?: string;
  displayLabel: string;
}): Promise<Date> {
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(params.preferredDate, offset);

    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: {
        id: true,
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) return candidateDate;

    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
      return candidateDate;
    }
  }

  throw new Error(`No free inventory placeholder date for ${params.displayLabel}.`);
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 11, 16, 12, 0, 0));
const seedVersion = "flagship-meniere-disease-v1";
const canonicalName = "meniere disease";
const displayLabel = "Ménière Disease";
const caseTitle = "Recurrent Vertigo with Fluctuating Unilateral Hearing Loss";

const aliasTerms = [
  "Ménière Disease",
  "Meniere Disease",
  "Ménière's Disease",
  "Meniere's Disease",
  "endolymphatic hydrops"
];

const clues = [
  {
    "order": 0,
    "type": "history",
    "value": "A 46-year-old woman reports four spontaneous attacks of true spinning vertigo over the past five months. Each episode lasts about 45 minutes to 3 hours, is not triggered by rolling in bed or changing head position, and is followed by return toward her usual balance between attacks."
  },
  {
    "order": 1,
    "type": "symptom",
    "value": "During the attacks she develops left-sided roaring tinnitus, a blocked or full sensation in the left ear, nausea, and noticeably reduced hearing on that side. The hearing often improves partially after the vertigo settles but has become less reliable over time."
  },
  {
    "order": 2,
    "type": "history",
    "value": "She has no migraine aura, photophobia, new severe headache, persistent focal neurological symptoms, or continuous vertigo lasting for days. She has no recent viral illness immediately before symptom onset, no recent aminoglycoside exposure, and no major acoustic trauma."
  },
  {
    "order": 3,
    "type": "exam",
    "value": "Between attacks, otoscopy is normal bilaterally. Cranial nerves, limb power, sensation, coordination, and gait are normal, and there is no spontaneous nystagmus. Dix-Hallpike testing does not provoke positional vertigo or a characteristic positional nystagmus."
  },
  {
    "order": 4,
    "type": "lab",
    "value": "Pure-tone audiometry demonstrates asymmetric left-sided low-frequency sensorineural hearing loss, greatest at 250 to 1000 Hz, with preserved bone conduction relative to air conduction and no conductive gap. Speech discrimination is mildly reduced on the left."
  },
  {
    "order": 5,
    "type": "imaging",
    "value": "MRI of the internal auditory canals and cerebellopontine angles shows no vestibular schwannoma, posterior-fossa mass, or other structural explanation for the asymmetric sensorineural hearing loss. Taken with recurrent 45-minute to 3-hour spontaneous vertigo, fluctuating unilateral aural symptoms, and documented low-frequency sensorineural hearing loss, the presentation meets criteria for definite Ménière Disease."
  }
] as const;

const differentials = [
  "Vestibular Migraine",
  "Benign Paroxysmal Positional Vertigo",
  "Vestibular Neuritis",
  "Labyrinthitis",
  "Vestibular Schwannoma",
  "Autoimmune Inner Ear Disease"
];

const explanation = {
  "diagnosis": "Ménière Disease",
  "summary": "Recurrent spontaneous vertigo lasting 45 minutes to 3 hours, fluctuating unilateral tinnitus/fullness and hearing loss, audiometrically documented low-frequency sensorineural hearing loss, and exclusion of a retrocochlear structural lesion establish definite Ménière Disease.",
  "reasoning": [
    "The attack duration and spontaneous non-positional pattern fit the accepted episodic vestibular window for Ménière disease.",
    "Unilateral tinnitus, aural fullness, and fluctuating hearing loss during attacks localize the syndrome to one inner ear rather than a purely central vestibular disorder.",
    "The absence of persistent focal neurologic deficits, prolonged continuous vertigo, and a clear migrainous syndrome reduces several major mimics.",
    "Normal otoscopy and a negative positional examination make middle-ear disease and classic BPPV less likely.",
    "Pure-tone audiometry objectively demonstrates the low-frequency sensorineural hearing loss required for definite disease.",
    "MRI excludes vestibular schwannoma and other retrocochlear structural causes; the final diagnosis is based on the clinical-audiometric criteria rather than imaging."
  ],
  "keyFindings": [
    "At least two spontaneous vertigo attacks lasting 20 minutes to 12 hours",
    "Unilateral fluctuating hearing loss",
    "Ipsilateral tinnitus",
    "Ipsilateral aural fullness",
    "Low-frequency sensorineural hearing loss on audiometry",
    "Normal otoscopy",
    "No persistent focal neurologic deficit",
    "No structural retrocochlear lesion on MRI"
  ],
  "differentials": [
    "Vestibular Migraine",
    "Benign Paroxysmal Positional Vertigo",
    "Vestibular Neuritis",
    "Labyrinthitis",
    "Vestibular Schwannoma",
    "Autoimmune Inner Ear Disease"
  ],
  "differentialAnalysis": [
    {
      "diagnosis": "Vestibular Migraine",
      "whyPlausibleEarly": "Vestibular migraine can cause recurrent spontaneous vertigo lasting minutes to hours and may occur without headache during every attack.",
      "ruledOutByClues": [
        {
          "clueOrder": 1,
          "evidence": "left-sided roaring tinnitus, a blocked or full sensation in the left ear",
          "reason": "Prominent recurrent unilateral cochlear symptoms accompanying the vertigo point toward an inner-ear disorder rather than isolated vestibular migraine."
        },
        {
          "clueOrder": 4,
          "evidence": "left-sided low-frequency sensorineural hearing loss",
          "reason": "Documented fluctuating low-frequency sensorineural hearing loss is a core discriminator for definite Ménière disease and is not a defining feature of vestibular migraine."
        }
      ],
      "finalReasonLessLikely": "The recurrent unilateral cochlear syndrome with audiometrically documented low-frequency sensorineural hearing loss is more characteristic of Ménière disease."
    },
    {
      "diagnosis": "Benign Paroxysmal Positional Vertigo",
      "whyPlausibleEarly": "BPPV is a common cause of episodic vertigo and can initially be described simply as recurrent spinning.",
      "ruledOutByClues": [
        {
          "clueOrder": 0,
          "evidence": "is not triggered by rolling in bed or changing head position",
          "reason": "BPPV is characteristically triggered by specific head-position changes and usually produces much shorter attacks."
        },
        {
          "clueOrder": 3,
          "evidence": "Dix-Hallpike testing does not provoke positional vertigo",
          "reason": "A negative positional examination during evaluation weakens posterior-canal BPPV when the history is also non-positional."
        }
      ],
      "finalReasonLessLikely": "The attacks are spontaneous, much longer than typical BPPV episodes, and accompanied by fluctuating unilateral auditory symptoms."
    },
    {
      "diagnosis": "Vestibular Neuritis",
      "whyPlausibleEarly": "Vestibular neuritis can cause severe vertigo with nausea and gait disturbance.",
      "ruledOutByClues": [
        {
          "clueOrder": 0,
          "evidence": "four spontaneous attacks",
          "reason": "Vestibular neuritis usually causes one prolonged acute vestibular syndrome rather than recurrent discrete attacks separated by recovery."
        },
        {
          "clueOrder": 1,
          "evidence": "noticeably reduced hearing on that side",
          "reason": "Vestibular neuritis classically spares hearing, whereas fluctuating unilateral hearing loss supports cochlear involvement."
        }
      ],
      "finalReasonLessLikely": "The recurrent episodic pattern and associated fluctuating hearing loss are inconsistent with isolated vestibular neuritis."
    },
    {
      "diagnosis": "Labyrinthitis",
      "whyPlausibleEarly": "Labyrinthitis can produce vertigo together with sensorineural hearing symptoms.",
      "ruledOutByClues": [
        {
          "clueOrder": 0,
          "evidence": "four spontaneous attacks",
          "reason": "Acute labyrinthitis more often causes a prolonged continuous vestibular syndrome rather than recurrent attacks over months."
        },
        {
          "clueOrder": 2,
          "evidence": "no recent viral illness immediately before symptom onset",
          "reason": "The absence of a preceding acute infectious syndrome and the recurrent pattern make labyrinthitis less typical."
        }
      ],
      "finalReasonLessLikely": "The months-long recurrent fluctuating course is much more compatible with Ménière disease than a single acute labyrinthine inflammatory episode."
    },
    {
      "diagnosis": "Vestibular Schwannoma",
      "whyPlausibleEarly": "Vestibular schwannoma can cause asymmetric sensorineural hearing loss, tinnitus, and imbalance.",
      "ruledOutByClues": [
        {
          "clueOrder": 0,
          "evidence": "spontaneous attacks of true spinning vertigo",
          "reason": "Vestibular schwannoma more commonly causes progressive unilateral hearing loss and chronic imbalance than recurrent classic Ménière-type attacks."
        },
        {
          "clueOrder": 5,
          "evidence": "shows no vestibular schwannoma",
          "reason": "Dedicated internal-auditory-canal imaging excludes the principal structural retrocochlear mimic in this case."
        }
      ],
      "finalReasonLessLikely": "MRI excludes a vestibular schwannoma and the fluctuating episodic cochleovestibular pattern favors Ménière disease."
    },
    {
      "diagnosis": "Autoimmune Inner Ear Disease",
      "whyPlausibleEarly": "Autoimmune inner-ear disease can cause sensorineural hearing loss with vestibular symptoms and may fluctuate.",
      "ruledOutByClues": [
        {
          "clueOrder": 1,
          "evidence": "left-sided",
          "reason": "Autoimmune inner-ear disease is more often rapidly progressive and bilateral or sequentially bilateral, although unilateral disease can occur."
        },
        {
          "clueOrder": 4,
          "evidence": "greatest at 250 to 1000 Hz",
          "reason": "A low-frequency unilateral audiometric pattern accompanying stereotyped vertigo attacks is particularly characteristic of Ménière disease."
        }
      ],
      "finalReasonLessLikely": "The stereotyped unilateral attacks with classic low-frequency hearing loss and no systemic autoimmune context make Ménière disease more likely."
    }
  ],
  "clueBreakdown": [
    {
      "clueOrder": 0,
      "clueType": "history",
      "clue": "A 46-year-old woman reports four spontaneous attacks of true spinning vertigo over the past five months. Each episode lasts about 45 minutes to 3 hours, is not triggered by rolling in bed or changing head position, and is followed by return toward her usual balance between attacks.",
      "explanation": "Recurrent spontaneous vertigo lasting 45 minutes to 3 hours falls squarely within the 20-minute to 12-hour duration required for definite Ménière disease and is not positional.",
      "diagnosticContribution": "Establishes the defining episodic vestibular pattern and immediately separates the case from typical BPPV and prolonged acute vestibular syndromes."
    },
    {
      "clueOrder": 1,
      "clueType": "symptom",
      "clue": "During the attacks she develops left-sided roaring tinnitus, a blocked or full sensation in the left ear, nausea, and noticeably reduced hearing on that side. The hearing often improves partially after the vertigo settles but has become less reliable over time.",
      "explanation": "Fluctuating unilateral hearing loss, tinnitus, and aural fullness localize the disorder to the cochleovestibular apparatus of one inner ear.",
      "diagnosticContribution": "Adds the characteristic fluctuating aural symptom complex that must accompany the vertigo syndrome."
    },
    {
      "clueOrder": 2,
      "clueType": "history",
      "clue": "She has no migraine aura, photophobia, new severe headache, persistent focal neurological symptoms, or continuous vertigo lasting for days. She has no recent viral illness immediately before symptom onset, no recent aminoglycoside exposure, and no major acoustic trauma.",
      "explanation": "Absence of prominent migrainous, focal neurologic, toxic, or prolonged post-viral features lowers the probability of major central, medication-related, and acute vestibular mimics.",
      "diagnosticContribution": "Refines the differential without relying on a single exclusion test."
    },
    {
      "clueOrder": 3,
      "clueType": "exam",
      "clue": "Between attacks, otoscopy is normal bilaterally. Cranial nerves, limb power, sensation, coordination, and gait are normal, and there is no spontaneous nystagmus. Dix-Hallpike testing does not provoke positional vertigo or a characteristic positional nystagmus.",
      "explanation": "A normal ear canal and tympanic membrane reduce conductive-ear explanations, while a normal interictal neurologic examination lowers concern for persistent central lesions; negative Dix-Hallpike weakens BPPV in a non-positional history.",
      "diagnosticContribution": "Supports peripheral inner-ear localization and removes common positional and central mimics."
    },
    {
      "clueOrder": 4,
      "clueType": "lab",
      "clue": "Pure-tone audiometry demonstrates asymmetric left-sided low-frequency sensorineural hearing loss, greatest at 250 to 1000 Hz, with preserved bone conduction relative to air conduction and no conductive gap. Speech discrimination is mildly reduced on the left.",
      "explanation": "Audiometrically documented unilateral low-frequency sensorineural hearing loss is the crucial objective hearing criterion for definite Ménière disease.",
      "diagnosticContribution": "Converts a probable clinical syndrome into one that satisfies the objective auditory requirement."
    },
    {
      "clueOrder": 5,
      "clueType": "imaging",
      "clue": "MRI of the internal auditory canals and cerebellopontine angles shows no vestibular schwannoma, posterior-fossa mass, or other structural explanation for the asymmetric sensorineural hearing loss. Taken with recurrent 45-minute to 3-hour spontaneous vertigo, fluctuating unilateral aural symptoms, and documented low-frequency sensorineural hearing loss, the presentation meets criteria for definite Ménière Disease.",
      "explanation": "MRI is not the diagnostic test for Ménière disease; here it excludes a retrocochlear structural cause of asymmetric sensorineural hearing loss. The diagnosis remains clinical plus audiometric.",
      "diagnosticContribution": "Completes exclusion of a key structural mimic and allows the full Bárány/AAO-HNS criteria to be synthesized."
    }
  ],
  "clinicalPearl": "Ménière disease is diagnosed from the pattern: recurrent spontaneous vertigo plus fluctuating unilateral aural symptoms and documented sensorineural hearing loss. No single imaging or vestibular test confirms it.",
  "managementPearl": "Treat acute attacks briefly with vestibular-suppressing medication when needed, address long-term trigger/lifestyle strategies and maintenance therapy through ENT follow-up, support hearing, and escalate persistent active disease stepwise rather than using chronic vestibular suppressants.",
  "generationQuality": {
    "contentTier": "FLAGSHIP",
    "seedVersion": "flagship-meniere-disease-v1",
    "humanReviewed": true,
    "discriminatorStrength": "HIGH",
    "expectedTeachingPoints": [
      "Use vertigo duration and triggers to distinguish episodic vestibular disorders",
      "Recognize fluctuating unilateral cochlear symptoms as the defining partner to vertigo",
      "Require audiometric sensorineural hearing loss for definite Ménière disease",
      "Do not use MRI as the confirmatory test; use it selectively to exclude structural mimics",
      "Separate Ménière disease from vestibular migraine, BPPV, neuritis, labyrinthitis, and schwannoma",
      "Avoid chronic vestibular suppressants because they can impair central compensation"
    ],
    "competencyDomains": [
      "Otolaryngology",
      "Otology and Neurotology",
      "Audiology",
      "Vestibular Medicine",
      "Clinical Reasoning"
    ]
  }
};

const educationForFrontend = {
  "title": "Ménière Disease",
  "summary": {
    "definition": "Ménière disease is a chronic inner-ear disorder characterized by recurrent spontaneous vertigo associated with fluctuating sensorineural hearing loss and ipsilateral aural symptoms such as tinnitus or fullness.",
    "highYieldTakeaway": "Think Ménière disease when recurrent spontaneous vertigo lasts 20 minutes to 12 hours and repeatedly travels with unilateral fluctuating hearing symptoms; definite disease requires audiometrically documented low- to mid-frequency sensorineural hearing loss and no better explanation."
  },
  "recognitionPattern": [
    {
      "pattern": "Episodic spontaneous vertigo in the correct time window",
      "whyItMatters": "Definite Ménière disease requires at least two spontaneous vertigo episodes lasting 20 minutes to 12 hours.",
      "progression": "Recurrent spontaneous vertigo -> unilateral aural symptoms -> objective sensorineural hearing loss -> exclusion of a better diagnosis.",
      "discriminator": "Seconds-long positional attacks favor BPPV, while continuous vertigo for days favors acute vestibular neuritis or labyrinthitis.",
      "commonTrap": "Calling any recurrent dizziness Ménière disease without confirming true episodic vertigo and the required auditory component."
    },
    {
      "pattern": "Fluctuating unilateral cochlear symptoms",
      "whyItMatters": "Tinnitus, aural fullness, and fluctuating hearing loss in the same ear link the vestibular attacks to a unilateral inner-ear process.",
      "progression": "Aural fullness/tinnitus around attacks -> fluctuating hearing -> progressive residual hearing loss in some patients.",
      "discriminator": "Pure vestibular syndromes such as vestibular neuritis do not typically produce fluctuating hearing loss.",
      "commonTrap": "Ignoring hearing history because the patient presents primarily for vertigo."
    },
    {
      "pattern": "Audiometric confirmation rather than imaging confirmation",
      "whyItMatters": "Low- to mid-frequency sensorineural hearing loss documented by audiometry is part of the definite-disease criteria.",
      "progression": "Subjective fluctuating hearing -> audiogram shows asymmetric low-frequency SNHL -> MRI only if needed to exclude a structural mimic.",
      "discriminator": "Vestibular schwannoma can cause asymmetric SNHL but does not produce the classic fluctuating recurrent cochleovestibular attack pattern.",
      "commonTrap": "Treating a normal MRI as proof of Ménière disease or ordering broad vestibular testing as a substitute for the clinical criteria."
    }
  ],
  "keySymptoms": [
    {
      "symptom": "Recurrent spontaneous vertigo",
      "significance": "The attacks are typically discrete and last 20 minutes to 12 hours in definite disease.",
      "discriminator": "Very brief position-triggered attacks favor BPPV; days of continuous vertigo favor acute vestibular syndromes."
    },
    {
      "symptom": "Fluctuating unilateral hearing loss",
      "significance": "Hearing may worsen during or around attacks and can become progressively less reversible over time.",
      "discriminator": "Fluctuating cochlear symptoms are not expected in isolated vestibular neuritis."
    },
    {
      "symptom": "Unilateral tinnitus",
      "significance": "Ipsilateral tinnitus is a common fluctuating aural symptom and helps localize the affected ear.",
      "discriminator": "Tinnitus alone is nonspecific; its repeated coupling with vertigo and hearing change is more informative."
    },
    {
      "symptom": "Aural fullness",
      "significance": "A feeling of pressure or blockage in the affected ear often accompanies attacks.",
      "discriminator": "Normal otoscopy helps distinguish inner-ear fullness from obstructive external or middle-ear disease."
    }
  ],
  "keySigns": [
    {
      "finding": "Normal otoscopy",
      "mechanism": "Ménière disease affects the inner ear, so the tympanic membrane and external canal are usually normal.",
      "significance": "A normal ear examination supports a sensorineural rather than conductive explanation for hearing symptoms.",
      "diagnosticImpact": "Shifts evaluation toward audiometry and inner-ear/retrocochlear causes rather than otitis media or external-ear obstruction.",
      "discriminator": "Middle-ear effusion, perforation, or other visible pathology would favor a conductive process.",
      "trapAvoided": "Do not dismiss hearing complaints because the tympanic membrane looks normal."
    },
    {
      "finding": "No persistent focal neurologic deficit between attacks",
      "mechanism": "A peripheral episodic inner-ear disorder should not cause a fixed corticospinal, cerebellar, or cranial-nerve deficit between typical attacks.",
      "significance": "Persistent diplopia, limb ataxia, weakness, sensory loss, or other focal signs would raise concern for a central cause.",
      "diagnosticImpact": "Supports peripheral vestibular localization while preserving vigilance for central red flags.",
      "discriminator": "Persistent focal neurologic abnormalities are atypical for uncomplicated Ménière disease.",
      "escalationImplication": "New persistent neurologic deficits require urgent assessment for a central neurologic process."
    },
    {
      "finding": "Negative Dix-Hallpike in a non-positional history",
      "mechanism": "Posterior-canal BPPV produces position-dependent canalith movement and a characteristic positional nystagmus.",
      "significance": "A negative positional test strengthens the distinction when the patient's attacks are also spontaneous and last much longer than typical BPPV.",
      "diagnosticImpact": "Reduces the likelihood that the recurrent vertigo is classic posterior-canal BPPV.",
      "discriminator": "BPPV is triggered by head position and usually lasts seconds rather than hours.",
      "trapAvoided": "Do not diagnose BPPV solely because vertigo is episodic."
    },
    {
      "finding": "Audiometric low-frequency sensorineural hearing loss",
      "mechanism": "Inner-ear dysfunction in Ménière disease commonly affects low- to mid-frequency hearing earlier in the disease course.",
      "significance": "This is the key objective auditory finding required for definite disease.",
      "diagnosticImpact": "Upgrades a compatible probable syndrome to definite Ménière disease when the remaining clinical criteria are satisfied.",
      "discriminator": "A conductive gap would suggest external or middle-ear pathology rather than Ménière disease.",
      "managementImplication": "Establish a baseline for monitoring progression and hearing-rehabilitation needs."
    }
  ],
  "examPearls": [
    {
      "type": "DISCRIMINATOR",
      "title": "Duration separates common episodic vertigo syndromes",
      "content": "Ménière attacks typically last 20 minutes to 12 hours. BPPV is usually much briefer and position-triggered; vestibular neuritis usually causes continuous symptoms for days.",
      "whyItMatters": "The time course is often more diagnostically powerful than the patient's general description of dizziness.",
      "discriminator": "Hours-long spontaneous attacks with cochlear symptoms strongly favor Ménière disease over BPPV or neuritis.",
      "trapAvoided": "Do not group all vertigo under a single vestibular diagnosis without establishing timing and triggers."
    },
    {
      "type": "DISCRIMINATOR",
      "title": "Hearing loss must be sensorineural and documented",
      "content": "Subjective muffled hearing is not enough for definite disease; pure-tone audiometry should document low- to mid-frequency sensorineural hearing loss in the affected ear.",
      "whyItMatters": "Objective hearing loss is part of the accepted definite-disease criteria.",
      "discriminator": "A conductive hearing pattern suggests a different ear disorder.",
      "managementImplication": "Audiometry also provides a baseline for longitudinal hearing care.",
      "trapAvoided": "Do not diagnose definite Ménière disease from tinnitus and vertigo alone."
    },
    {
      "type": "MECHANISM",
      "title": "MRI excludes mimics; it does not confirm Ménière disease",
      "content": "MRI of the internal auditory canals may be appropriate when asymmetric sensorineural hearing loss warrants exclusion of vestibular schwannoma or another retrocochlear lesion.",
      "whyItMatters": "The diagnosis remains clinical and audiometric even when imaging is normal.",
      "discriminator": "A structural lesion on MRI redirects the diagnosis away from primary Ménière disease.",
      "managementImplication": "Use imaging selectively rather than as a routine confirmatory test.",
      "trapAvoided": "Do not interpret a normal MRI as a positive test for Ménière disease."
    }
  ],
  "scoringSystems": [],
  "investigations": [
    {
      "test": "Pure-tone audiometry",
      "expectedFinding": "Low- to mid-frequency sensorineural hearing loss in the affected ear, which may fluctuate over time.",
      "interpretation": "Objective sensorineural hearing loss is required for definite Ménière disease under accepted criteria.",
      "whyItMatters": "Confirms the auditory component and establishes a baseline for future comparison.",
      "managementImplication": "Repeat audiometry when clinically useful to monitor progression and guide hearing rehabilitation.",
      "commonTrap": "Do not substitute tuning-fork testing or subjective hearing fluctuation for formal audiometry when classifying definite disease."
    },
    {
      "test": "Speech audiometry",
      "expectedFinding": "Speech discrimination may be reduced in the affected ear depending on hearing severity.",
      "interpretation": "Complements pure-tone thresholds and helps characterize functional hearing impact.",
      "whyItMatters": "Useful for hearing-aid counseling and longitudinal assessment.",
      "managementImplication": "Integrate with pure-tone findings when planning hearing support.",
      "commonTrap": "Speech testing alone does not establish the characteristic low-frequency pattern."
    },
    {
      "test": "MRI internal auditory canals/posterior fossa when asymmetric SNHL warrants imaging",
      "expectedFinding": "No vestibular schwannoma or other retrocochlear structural lesion in primary Ménière disease.",
      "interpretation": "A normal MRI excludes important structural mimics but does not prove Ménière disease.",
      "whyItMatters": "Asymmetric sensorineural hearing loss may require evaluation for retrocochlear pathology.",
      "managementImplication": "A detected structural lesion changes the diagnostic and specialty-management pathway.",
      "commonTrap": "Do not order MRI as if it were the confirmatory test for Ménière disease."
    },
    {
      "test": "Vestibular function testing",
      "expectedFinding": "Results can be abnormal but are variable and are not required to establish the diagnosis.",
      "interpretation": "Vestibular testing may help characterize function in selected patients but should not replace the clinical-audiometric criteria.",
      "whyItMatters": "Can assist difficult or pre-procedural cases rather than routine diagnosis.",
      "managementImplication": "Reserve testing for a specific clinical question or specialist plan.",
      "commonTrap": "Routine vestibular testing can add noise without improving diagnostic certainty."
    },
    {
      "test": "Electrocochleography or other hydrops-directed testing",
      "expectedFinding": "May show changes associated with endolymphatic hydrops but performance is insufficient for routine diagnostic confirmation.",
      "interpretation": "These tests are not necessary to establish definite Ménière disease.",
      "whyItMatters": "Prevents over-testing and false certainty from imperfect surrogate markers.",
      "managementImplication": "Do not delay appropriate counseling and treatment while seeking a single confirmatory hydrops test.",
      "commonTrap": "Endolymphatic hydrops is associated with Ménière disease but no single hydrops test substitutes for the accepted diagnostic criteria."
    }
  ],
  "differentialDistinguishers": [
    {
      "diagnosis": "Vestibular Migraine",
      "whyConfused": "Both disorders can cause recurrent spontaneous vertigo lasting minutes to hours and may coexist in the same patient.",
      "distinguishingPoint": "Ménière disease requires the characteristic unilateral fluctuating aural syndrome with documented sensorineural hearing loss; vestibular migraine is supported by migraine features and migraine-linked episodes.",
      "keySeparator": "Low-frequency unilateral SNHL plus recurrent ipsilateral tinnitus/fullness strongly favors Ménière disease.",
      "classicTrap": "Excluding vestibular migraine simply because headache is absent during one attack, or calling all recurrent vertigo with headache Ménière disease.",
      "managementConsequence": "The long-term preventive strategy differs, so migraine features should be actively assessed before committing to a Ménière-specific pathway."
    },
    {
      "diagnosis": "Benign Paroxysmal Positional Vertigo",
      "whyConfused": "Both cause recurrent vertigo and may be described similarly by patients.",
      "distinguishingPoint": "BPPV is triggered by specific head positions and usually lasts seconds, with a characteristic positional nystagmus.",
      "keySeparator": "Spontaneous 20-minute-to-hours attacks with fluctuating hearing symptoms favor Ménière disease.",
      "classicTrap": "Diagnosing BPPV from the word 'vertigo' without asking about triggers and duration.",
      "managementConsequence": "BPPV is treated with repositioning maneuvers rather than a chronic Ménière-management strategy."
    },
    {
      "diagnosis": "Vestibular Neuritis",
      "whyConfused": "Both can cause severe vertigo, nausea, and temporary gait difficulty.",
      "distinguishingPoint": "Vestibular neuritis usually causes one prolonged continuous attack and does not cause fluctuating hearing loss.",
      "keySeparator": "Recurrent discrete attacks with unilateral cochlear symptoms favor Ménière disease.",
      "classicTrap": "Labeling any severe peripheral vertigo as vestibular neuritis despite recurrent attacks and hearing change.",
      "managementConsequence": "An acute neuritis pathway emphasizes short-term symptom control and vestibular rehabilitation rather than long-term recurrent-attack management."
    },
    {
      "diagnosis": "Labyrinthitis",
      "whyConfused": "Labyrinthitis can combine vertigo with sensorineural hearing loss.",
      "distinguishingPoint": "Labyrinthitis usually presents as a prolonged acute vestibular syndrome, often after infection, rather than recurrent fluctuating attacks over months.",
      "keySeparator": "Stereotyped recurrent episodes separated by recovery favor Ménière disease.",
      "classicTrap": "Using the presence of hearing loss alone to call recurrent vertigo labyrinthitis.",
      "managementConsequence": "A suspected acute infectious or inflammatory labyrinthine process requires evaluation of the acute cause rather than a chronic Ménière treatment plan."
    },
    {
      "diagnosis": "Vestibular Schwannoma",
      "whyConfused": "Both can cause unilateral tinnitus and asymmetric sensorineural hearing loss.",
      "distinguishingPoint": "Vestibular schwannoma more often causes progressive hearing loss and chronic imbalance; MRI can reveal the retrocochlear lesion.",
      "keySeparator": "A normal dedicated MRI plus classic fluctuating recurrent Ménière-type attacks favors Ménière disease.",
      "classicTrap": "Failing to investigate clinically significant asymmetric SNHL for a retrocochlear lesion when imaging is indicated.",
      "managementConsequence": "A vestibular schwannoma requires a structural-lesion management pathway rather than medical treatment for Ménière disease."
    },
    {
      "diagnosis": "Autoimmune Inner Ear Disease",
      "whyConfused": "Both may cause fluctuating sensorineural hearing loss with vestibular symptoms.",
      "distinguishingPoint": "Autoimmune inner-ear disease is typically more rapidly progressive and often bilateral or sequentially bilateral, sometimes with systemic autoimmune clues.",
      "keySeparator": "Classic unilateral episodic vertigo with low-frequency hearing fluctuation favors Ménière disease.",
      "classicTrap": "Assuming every fluctuating SNHL syndrome is Ménière disease without considering bilateral progression or systemic autoimmune context.",
      "managementConsequence": "Suspected autoimmune inner-ear disease may require systemic investigation and immunomodulatory management."
    }
  ],
  "managementOverview": [
    {
      "action": "Use a limited course of vestibular suppressants during acute attacks",
      "indication": "Severe vertigo or nausea during an active Ménière attack.",
      "rationale": "Short-term symptomatic treatment can reduce attack-related distress and vomiting.",
      "nextStep": "Stop or minimize vestibular suppressants once the acute episode resolves so chronic use does not interfere with compensation."
    },
    {
      "action": "Provide education on symptom triggers and lifestyle/dietary modification",
      "indication": "All patients with suspected or established recurrent disease.",
      "rationale": "Guidelines recommend counseling on measures that may reduce attack frequency and improve self-management.",
      "nextStep": "Track attack frequency, hearing fluctuation, and suspected triggers over time rather than relying on one visit."
    },
    {
      "action": "Consider maintenance therapy such as a diuretic and/or betahistine through ENT care",
      "indication": "Patients with recurrent attacks who need preventive treatment after shared decision-making.",
      "rationale": "AAO-HNS guidance allows these options for reducing or preventing attacks, while recognizing variable individual benefit.",
      "nextStep": "Reassess attack control, adverse effects, and hearing trajectory before escalating therapy."
    },
    {
      "action": "Offer hearing rehabilitation",
      "indication": "Persistent or functionally important hearing loss.",
      "rationale": "Progressive sensorineural hearing loss can affect communication even when vertigo is controlled.",
      "nextStep": "Use audiology follow-up and hearing-assistive options according to measured hearing needs."
    },
    {
      "action": "Consider intratympanic therapy for persistent active disease",
      "indication": "Ongoing troublesome attacks despite non-invasive treatment.",
      "rationale": "Intratympanic steroids may be offered; intratympanic gentamicin is an ablative option with greater hearing risk and is generally reserved for persistent disease not responsive to non-ablative therapy.",
      "nextStep": "ENT should balance vertigo control against residual hearing and discuss risks before proceeding."
    },
    {
      "action": "Use vestibular rehabilitation for chronic imbalance, not during acute attacks",
      "indication": "Persistent disequilibrium between attacks or after ablative treatment.",
      "rationale": "Rehabilitation supports central compensation when imbalance becomes chronic.",
      "nextStep": "Avoid using vestibular rehabilitation as the primary treatment for an acute spinning attack."
    }
  ],
  "complications": [
    {
      "complication": "Progressive sensorineural hearing loss",
      "whyItMatters": "Fluctuating hearing may become persistently impaired and require long-term audiologic support."
    },
    {
      "complication": "Falls or injury during unpredictable vertigo attacks",
      "whyItMatters": "Sudden severe vertigo can impair balance and create safety risks during driving, climbing, or other activities."
    },
    {
      "complication": "Chronic disequilibrium",
      "whyItMatters": "Some patients develop persistent imbalance between attacks and may benefit from vestibular rehabilitation."
    },
    {
      "complication": "Reduced quality of life from unpredictable recurrent attacks",
      "whyItMatters": "Uncertainty around vertigo, tinnitus, and hearing fluctuation can affect work, mobility, communication, and social functioning."
    }
  ],
  "pitfalls": [
    {
      "pitfall": "Diagnosing Ménière disease from vertigo plus tinnitus alone",
      "consequence": "Vestibular migraine, BPPV, and other disorders may be mislabeled and treated incorrectly.",
      "saferHeuristic": "Require the full temporal pattern, fluctuating unilateral aural symptoms, documented sensorineural hearing loss for definite disease, and no better explanation."
    },
    {
      "pitfall": "Ignoring attack duration and triggers",
      "consequence": "BPPV and acute vestibular syndromes can be confused with Ménière disease.",
      "saferHeuristic": "Always establish timing, triggers, recovery between attacks, and whether vertigo is spontaneous or positional."
    },
    {
      "pitfall": "Using MRI as the confirmatory test",
      "consequence": "A normal scan may create false diagnostic confidence despite an incompatible clinical pattern.",
      "saferHeuristic": "Use MRI selectively to exclude structural causes of asymmetric SNHL; diagnose Ménière disease clinically with audiometric support."
    },
    {
      "pitfall": "Ordering routine vestibular or electrocochleographic testing to prove the diagnosis",
      "consequence": "Non-specific results may create unnecessary cost and diagnostic confusion.",
      "saferHeuristic": "Base diagnosis on accepted clinical-audiometric criteria and reserve additional testing for a specific question."
    },
    {
      "pitfall": "Continuing vestibular suppressants chronically",
      "consequence": "Long-term use can worsen sedation and may hinder vestibular compensation.",
      "saferHeuristic": "Use vestibular suppressants for a limited course during acute attacks and reassess persistent imbalance separately."
    }
  ],
  "recallPrompts": [
    {
      "type": "PEARL_RECALL",
      "prompt": "What vertigo duration supports definite Ménière disease?",
      "answer": "Two or more spontaneous episodes lasting 20 minutes to 12 hours.",
      "explanation": "Attack duration is part of the accepted diagnostic criteria and helps separate Ménière disease from BPPV and prolonged acute vestibular syndromes.",
      "linkedConcept": "Vertigo timing",
      "sourceSection": "Clinical Pattern"
    },
    {
      "type": "SHORT_ANSWER",
      "prompt": "What objective hearing finding is required for definite Ménière disease?",
      "answer": "Audiometrically documented low- to mid-frequency sensorineural hearing loss in the affected ear.",
      "explanation": "Subjective hearing fluctuation alone supports probable disease but does not satisfy the definite-disease auditory criterion.",
      "linkedConcept": "Audiometric criterion",
      "sourceSection": "Investigations"
    },
    {
      "type": "DISTINGUISH",
      "prompt": "How does BPPV usually differ from Ménière disease?",
      "answer": "BPPV is position-triggered and usually lasts seconds, without the characteristic fluctuating unilateral cochlear syndrome.",
      "explanation": "Timing and triggers are high-yield discriminators in episodic vertigo.",
      "linkedConcept": "BPPV versus Ménière disease",
      "sourceSection": "Differentials"
    },
    {
      "type": "DISTINGUISH",
      "prompt": "What feature makes vestibular neuritis less likely in recurrent Ménière-type attacks?",
      "answer": "Vestibular neuritis usually causes one prolonged episode and typically spares hearing.",
      "explanation": "Recurrent attacks plus fluctuating unilateral hearing loss point toward a cochleovestibular disorder.",
      "linkedConcept": "Neuritis versus Ménière disease",
      "sourceSection": "Differentials"
    },
    {
      "type": "WHY_IT_MATTERS",
      "prompt": "Why might MRI be obtained in a patient with suspected Ménière disease?",
      "answer": "To exclude a retrocochlear structural cause such as vestibular schwannoma when asymmetric sensorineural hearing loss warrants imaging.",
      "explanation": "MRI is an exclusion tool in selected patients, not the confirmatory test for Ménière disease.",
      "linkedConcept": "Selective imaging",
      "sourceSection": "Investigations"
    },
    {
      "type": "PEARL_RECALL",
      "prompt": "When should vestibular suppressants be used in Ménière disease?",
      "answer": "For a limited course during acute vertigo attacks rather than as chronic daily therapy.",
      "explanation": "Chronic suppressants can cause sedation and interfere with vestibular compensation.",
      "linkedConcept": "Acute attack management",
      "sourceSection": "Management"
    }
  ],
  "references": [
    {
      "citation": "Lopez-Escamez JA, et al. Diagnostic criteria for Ménière's disease. J Vestib Res. 2015;25(1):1-7."
    },
    {
      "citation": "Basura GJ, et al. Clinical Practice Guideline: Ménière's Disease. Otolaryngol Head Neck Surg. 2020."
    },
    {
      "citation": "National Institute on Deafness and Other Communication Disorders (NIDCD). Ménière's Disease."
    }
  ]
};

function assertSeedShape(): void {
  const allowedClueTypes = new Set([
    'history',
    'symptom',
    'vital',
    'lab',
    'exam',
    'imaging',
  ]);

  if (clues.length !== 6) {
    throw new Error(`Expected exactly 6 clues; found ${clues.length}.`);
  }

  clues.forEach((clue, index) => {
    if (clue.order !== index) {
      throw new Error(`Clue order mismatch at index ${index}: found ${clue.order}.`);
    }

    if (!allowedClueTypes.has(clue.type)) {
      throw new Error(`Unsupported clue type at order ${clue.order}: ${clue.type}.`);
    }

    if (!clue.value.trim()) {
      throw new Error(`Empty clue value at order ${clue.order}.`);
    }
  });

  const earlyText = clues
    .filter((clue) => clue.order < 5)
    .map((clue) => normalizeClinicalText(clue.value))
    .join(' ');

  for (const phrase of [canonicalName, displayLabel]) {
    const normalized = normalizeClinicalText(phrase);
    if (earlyText.includes(normalized)) {
      throw new Error(`Diagnosis leakage before final clue: ${phrase}.`);
    }
  }

  if (explanation.clueBreakdown.length !== clues.length) {
    throw new Error('Clue breakdown length does not match clue count.');
  }

  explanation.clueBreakdown.forEach((entry, index) => {
    const clue = clues[index];

    if (
      entry.clueOrder !== clue.order ||
      entry.clueType !== clue.type ||
      entry.clue !== clue.value
    ) {
      throw new Error(`Clue breakdown mismatch at clue ${index}.`);
    }
  });

  explanation.differentialAnalysis.forEach((differential) => {
    if (!differentials.includes(differential.diagnosis)) {
      throw new Error(
        `Differential analysis is not canonical: ${differential.diagnosis}.`,
      );
    }

    differential.ruledOutByClues.forEach((evidence) => {
      const clue = clues.find((item) => item.order === evidence.clueOrder);

      if (!clue) {
        throw new Error(
          `Differential evidence references missing clue: ${differential.diagnosis} -> ${evidence.clueOrder}.`,
        );
      }

      if (!clue.value.toLowerCase().includes(evidence.evidence.toLowerCase())) {
        throw new Error(
          `Differential evidence not found: ${differential.diagnosis} -> ${evidence.evidence}`,
        );
      }
    });
  });

  if (educationForFrontend.keySigns.length < 3) {
    throw new Error('Education requires at least 3 structured key signs.');
  }

  educationForFrontend.keySigns.forEach((sign) => {
    if (
      !sign.finding ||
      !sign.mechanism ||
      !sign.diagnosticImpact ||
      !sign.discriminator
    ) {
      throw new Error(`Incomplete key sign education: ${sign.finding}.`);
    }
  });

  educationForFrontend.scoringSystems.forEach((score) => {
    if (!score.name || !score.purpose || !score.interpretation || !score.limitation) {
      throw new Error(`Incomplete scoring/staging system: ${score.name}.`);
    }
  });

  educationForFrontend.investigations.forEach((investigation) => {
    if (
      !investigation.test ||
      !investigation.expectedFinding ||
      !investigation.interpretation ||
      !investigation.managementImplication
    ) {
      throw new Error(`Incomplete investigation education: ${investigation.test}.`);
    }
  });

  educationForFrontend.differentialDistinguishers.forEach((differential) => {
    if (
      !differential.diagnosis ||
      !differential.whyConfused ||
      !differential.keySeparator ||
      !differential.classicTrap ||
      !differential.managementConsequence
    ) {
      throw new Error(`Incomplete differential education: ${differential.diagnosis}.`);
    }
  });

  educationForFrontend.managementOverview.forEach((item) => {
    if (!item.action || !item.indication || !item.rationale || !item.nextStep) {
      throw new Error(`Incomplete management education: ${item.action}.`);
    }
  });

  educationForFrontend.pitfalls.forEach((item) => {
    if (!item.pitfall || !item.consequence || !item.saferHeuristic) {
      throw new Error(`Incomplete pitfall education: ${item.pitfall}.`);
    }
  });

  const allowedRecallTypes = new Set([
    'CLOZE',
    'SHORT_ANSWER',
    'DISTINGUISH',
    'PEARL_RECALL',
    'WHY_IT_MATTERS',
  ]);

  educationForFrontend.recallPrompts.forEach((prompt) => {
    if (!allowedRecallTypes.has(prompt.type)) {
      throw new Error(`Unsupported recall prompt type: ${prompt.type}.`);
    }

    if (!prompt.prompt || !prompt.answer || !prompt.explanation) {
      throw new Error(`Incomplete recall prompt: ${prompt.prompt}.`);
    }
  });
}

async function ensureRegistry() {
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const existing = await prisma.diagnosisRegistry.findFirst({
    where: {
      OR: [
        { canonicalNormalized: { in: normalizedTerms } },
        {
          aliases: {
            some: {
              normalizedTerm: { in: normalizedTerms },
              active: true,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: {
          canonicalName,
          canonicalNormalized,
          displayLabel,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          specialty: 'Otolaryngology',
          subspecialty: 'Otology and Neurotology',
          category: 'Inner Ear Disorder',
          bodySystem: 'Head and Neck',
          organSystem: 'Inner Ear',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Ménière Disease case emphasizing attack timing, fluctuating unilateral aural symptoms, audiometric confirmation, and exclusion of vestibular mimics.',
        },
        select: { id: true, displayLabel: true },
      })
    : await prisma.diagnosisRegistry.create({
        data: {
          canonicalName,
          canonicalNormalized,
          displayLabel,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          specialty: 'Otolaryngology',
          subspecialty: 'Otology and Neurotology',
          category: 'Inner Ear Disorder',
          bodySystem: 'Head and Neck',
          organSystem: 'Inner Ear',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Ménière Disease case emphasizing attack timing, fluctuating unilateral aural symptoms, audiometric confirmation, and exclusion of vestibular mimics.',
        },
        select: { id: true, displayLabel: true },
      });

  for (const [rank, term] of aliasTerms.entries()) {
    await prisma.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm: normalizeClinicalText(term),
        },
      },
      update: {
        term,
        active: true,
        acceptedForMatch: true,
        rank,
        kind:
          rank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm: normalizeClinicalText(term),
        active: true,
        acceptedForMatch: true,
        rank,
        kind:
          rank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
        source: seedVersion,
      },
    });
  }

  return registry;
}

async function ensureEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  if (existing) {
    console.log('Skipped existing Ménière Disease education:', existing);
    return existing;
  }

  const education = await prisma.diagnosisEducation.create({
    data: {
      diagnosisRegistryId,
      title: educationForFrontend.title,
      summary: educationForFrontend.summary,
      clinicalPattern: educationForFrontend.recognitionPattern,
      keySymptoms: educationForFrontend.keySymptoms,
      keySigns: educationForFrontend.keySigns,
      examPearls: educationForFrontend.examPearls,
      scoringSystems: educationForFrontend.scoringSystems,
      investigations: educationForFrontend.investigations,
      differentials: educationForFrontend.differentialDistinguishers,
      management: educationForFrontend.managementOverview,
      complications: educationForFrontend.complications,
      pitfalls: educationForFrontend.pitfalls,
      recallPrompts: educationForFrontend.recallPrompts,
      references: educationForFrontend.references,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
      reviewedAt: now,
      publishedAt: now,
      version: 1,
    },
    select: { id: true, version: true },
  });

  await prisma.diagnosisEducationRevision.create({
    data: {
      educationId: education.id,
      version: education.version,
      snapshot: {
        ...educationForFrontend,
        storedColumnMap: {
          recognitionPattern: 'clinicalPattern',
          managementOverview: 'management',
          differentialDistinguishers: 'differentials',
        },
      },
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
    },
  });

  return education;
}

async function ensureValidationRun(params: {
  caseId: string;
  revisionId: string;
}): Promise<void> {
  const existing = await prisma.caseValidationRun.findFirst({
    where: {
      caseId: params.caseId,
      revisionId: params.revisionId,
      validatorVersion: `flagship-human-review:${seedVersion}`,
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.caseValidationRun.create({
    data: {
      caseId: params.caseId,
      revisionId: params.revisionId,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: `flagship-human-review:${seedVersion}`,
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Ménière Disease flagship seed with six playable clues, exact differential evidence checks, and frontend-aligned education.',
      },
      findings: [],
      completedAt: now,
    },
  });
}

async function ensureCase(params: {
  diagnosisRegistryId: string;
  educationId: string;
}) {
  const history = clues[0].value;
  const symptoms = [clues[1].value];

  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: params.diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
      title: true,
      date: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const scheduledCase = existingCases.find((item) => item.dailyCases.length > 0);

  if (scheduledCase) {
    console.log('Skipped existing scheduled Ménière Disease case:', scheduledCase);
    return;
  }

  const completeCase = existingCases.find(
    (item) => item.dailyCases.length === 0 && item.currentRevisionId,
  );

  if (completeCase?.currentRevisionId) {
    await ensureValidationRun({
      caseId: completeCase.id,
      revisionId: completeCase.currentRevisionId,
    });

    console.log('Skipped existing complete Ménière Disease case:', completeCase);
    return;
  }

  const reusableCase = existingCases.find(
    (item) => item.dailyCases.length === 0 && !item.currentRevisionId,
  );

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    reusableCaseId: reusableCase?.id,
    displayLabel: caseTitle,
  });

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'intermediate',
    history,
    symptoms,
    clues: clues as unknown as object,
    explanation: explanation as object,
    differentials,
    editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: now,
    publishedAt: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Seeded complete frontend-aligned flagship Ménière Disease case with timing, audiometry, and vestibular differential teaching.',
  };

  const seededCase = reusableCase
    ? await prisma.case.update({
        where: { id: reusableCase.id },
        data: caseData,
        select: { id: true },
      })
    : await prisma.case.create({
        data: caseData,
        select: { id: true },
      });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId: seededCase.id },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: caseTitle,
      date: assignedDate,
      difficulty: 'intermediate',
      history,
      symptoms,
      clues: clues as unknown as object,
      explanation: explanation as object,
      differentials,
      diagnosisRegistryId: params.diagnosisRegistryId,
      proposedDiagnosisText: displayLabel,
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote:
        'Created complete Ménière Disease revision with frontend-aligned explanation and education.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  await ensureValidationRun({
    caseId: seededCase.id,
    revisionId: revision.id,
  });

  console.log('Seeded Ménière Disease:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
  });
}

async function main() {
  assertSeedShape();
  console.log('Ménière Disease seed validation passed.');

  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);

  await ensureCase({
    diagnosisRegistryId: registry.id,
    educationId: education.id,
  });
}

main()
  .catch((error) => {
    console.error('Ménière Disease seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
