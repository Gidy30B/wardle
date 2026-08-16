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
  throw new Error('DATABASE_URL is required to run the Acquired Cholesteatoma seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 2, 12, 12, 0, 0));
const seedVersion = 'flagship-acquired-cholesteatoma-v1';

const canonicalName = 'acquired cholesteatoma';
const displayLabel = 'Acquired Cholesteatoma';
const caseTitle = 'Progressive Unilateral Hearing Loss with Chronic Otorrhea';

const aliasTerms = [
  'Acquired Cholesteatoma',
  'acquired cholesteatoma',
  'Middle Ear Cholesteatoma',
  'middle ear cholesteatoma',
  'Attic Cholesteatoma',
  'Pars Flaccida Cholesteatoma',
  'Epitympanic Cholesteatoma',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 34-year-old man reports eight months of recurrent left-sided ear discharge that improves briefly with topical treatment but repeatedly returns. He has no recent ear trauma or ear surgery.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The discharge is persistently foul-smelling, and hearing in the left ear has gradually worsened. He describes intermittent dull ear discomfort but no sustained high fever, severe acute otalgia, or sudden vertigo.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'After careful aural toilet, otoscopy shows a deep posterosuperior pars flaccida retraction pocket containing white keratin debris with adjacent granulation tissue. The external auditory canal is not diffusely oedematous, and tragal pressure is not painful.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Weber testing lateralizes to the left ear and Rinne testing is negative on the left, supporting conductive hearing loss. Facial movement is symmetric, there is no spontaneous nystagmus, and there is no postauricular swelling or tenderness.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Pure-tone audiometry demonstrates a moderate left conductive hearing loss with a 30 dB air-bone gap and preserved bone-conduction thresholds; right-ear hearing is normal.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'High-resolution CT of the temporal bone shows nondependent soft tissue in the left epitympanum extending toward the mastoid with scutum erosion and partial erosion of the incus, without labyrinthine fistula, facial canal dehiscence, or intracranial extension. The combined otoscopic, audiometric, and erosive imaging pattern confirms Acquired Cholesteatoma.',
  },
] as const;

const differentials = [
  'Chronic Suppurative Otitis Media',
  'Otitis Externa',
  'Keratosis Obturans',
  'Tympanosclerosis',
  'Otitis Media with Effusion',
  'Middle Ear Neoplasm',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Persistent malodorous unilateral otorrhea, progressive conductive hearing loss, a posterosuperior retraction pocket filled with keratin debris, and CT evidence of scutum and ossicular erosion support acquired cholesteatoma.',
  reasoning: [
    'Months of recurrent unilateral otorrhea that only transiently responds to topical treatment suggests a structural middle-ear process rather than an isolated acute infection.',
    'Progressive unilateral hearing loss accompanying chronic malodorous drainage raises concern for ossicular or tympanic membrane disease.',
    'A deep attic or posterosuperior retraction pocket containing white keratin debris is the key otoscopic recognition pattern for acquired cholesteatoma.',
    'Conductive bedside hearing findings localize the functional deficit to the external or middle ear while preserved facial and vestibular function argue against advanced complications.',
    'Audiometry quantifies a conductive deficit and establishes a baseline for treatment planning and follow-up.',
    'Temporal-bone CT defines disease extent and demonstrates characteristic bony erosion, supporting surgical planning after the clinical diagnosis has been recognized.',
  ],
  keyFindings: [
    'Chronic recurrent unilateral otorrhea',
    'Malodorous discharge resistant to repeated topical treatment',
    'Progressive unilateral hearing loss',
    'Posterosuperior pars flaccida retraction pocket',
    'White keratin debris',
    'Adjacent granulation tissue',
    'Conductive bedside hearing pattern',
    'Audiometric air-bone gap',
    'Scutum erosion',
    'Incus erosion',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Chronic Suppurative Otitis Media',
      whyPlausibleEarly:
        'Both disorders can cause chronic otorrhea and conductive hearing loss, and chronic suppurative otitis media may coexist with cholesteatoma.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'deep posterosuperior pars flaccida retraction pocket containing white keratin debris',
          reason:
            'A keratin-filled attic retraction pocket is much more specific for cholesteatoma than uncomplicated chronic suppurative otitis media.',
        },
        {
          clueOrder: 5,
          evidence: 'scutum erosion and partial erosion of the incus',
          reason:
            'Focal ossicular and scutal erosion strongly suggests an erosive cholesteatoma process rather than simple chronic mucosal infection.',
        },
      ],
      finalReasonLessLikely:
        'The keratin-filled retraction pocket and focal bony erosion establish cholesteatoma rather than uncomplicated chronic suppurative otitis media.',
    },
    {
      diagnosis: 'Otitis Externa',
      whyPlausibleEarly:
        'External-ear infection can cause otorrhea, discomfort, and temporary conductive hearing loss from canal obstruction.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'external auditory canal is not diffusely oedematous, and tragal pressure is not painful',
          reason:
            'Diffuse canal inflammation and marked tragal tenderness are expected in acute otitis externa.',
        },
        {
          clueOrder: 5,
          evidence: 'soft tissue in the left epitympanum extending toward the mastoid',
          reason:
            'The disease localizes to the middle ear and mastoid rather than the external auditory canal.',
        },
      ],
      finalReasonLessLikely:
        'The normal canal examination and epitympanic erosive process argue against otitis externa.',
    },
    {
      diagnosis: 'Keratosis Obturans',
      whyPlausibleEarly:
        'Keratin accumulation can also produce conductive hearing loss and visible white debris.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'posterosuperior pars flaccida retraction pocket',
          reason:
            'Keratosis obturans is primarily a circumferential external auditory canal keratin disorder rather than an attic retraction-pocket lesion.',
        },
        {
          clueOrder: 5,
          evidence: 'scutum erosion and partial erosion of the incus',
          reason:
            'Middle-ear ossicular erosion is characteristic of cholesteatoma and not the typical pattern of keratosis obturans.',
        },
      ],
      finalReasonLessLikely:
        'The lesion originates from a tympanic membrane retraction pocket and erodes middle-ear structures rather than filling and widening the external canal.',
    },
    {
      diagnosis: 'Tympanosclerosis',
      whyPlausibleEarly:
        'Tympanosclerosis can produce chronic conductive hearing loss after recurrent middle-ear disease.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'white keratin debris with adjacent granulation tissue',
          reason:
            'Tympanosclerosis produces chalky plaques or ossicular fixation rather than a keratin-filled retraction pocket with granulation tissue.',
        },
        {
          clueOrder: 5,
          evidence: 'scutum erosion and partial erosion of the incus',
          reason:
            'Erosive destruction is inconsistent with uncomplicated tympanosclerosis.',
        },
      ],
      finalReasonLessLikely:
        'The destructive keratinizing lesion is incompatible with a nonerosive tympanosclerotic plaque process.',
    },
    {
      diagnosis: 'Otitis Media with Effusion',
      whyPlausibleEarly:
        'Middle-ear effusion can cause unilateral conductive hearing loss and a blocked-ear sensation.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'persistently foul-smelling',
          reason:
            'Malodorous recurrent drainage is not typical of uncomplicated sterile middle-ear effusion.',
        },
        {
          clueOrder: 5,
          evidence: 'scutum erosion and partial erosion of the incus',
          reason:
            'Otitis media with effusion does not produce focal erosive destruction of the scutum and ossicles.',
        },
      ],
      finalReasonLessLikely:
        'Chronic drainage, keratin debris, and bony erosion exclude uncomplicated middle-ear effusion.',
    },
    {
      diagnosis: 'Middle Ear Neoplasm',
      whyPlausibleEarly:
        'A middle-ear tumor can present with unilateral hearing loss, otorrhea, granulation tissue, or destructive imaging abnormalities.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'retraction pocket containing white keratin debris',
          reason:
            'A keratin-filled attic retraction pocket is a classic structural pattern for cholesteatoma rather than a solid neoplasm.',
        },
        {
          clueOrder: 5,
          evidence: 'combined otoscopic, audiometric, and erosive imaging pattern confirms Acquired Cholesteatoma',
          reason:
            'The integrated pattern is typical of acquired cholesteatoma, with no separate enhancing or invasive tumor described.',
        },
      ],
      finalReasonLessLikely:
        'The characteristic retraction-pocket origin with keratin debris and expected erosive pattern favors cholesteatoma over neoplasm.',
    },
  ],
  clueBreakdown: clues.map((clue) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: [
      'Chronic recurrent drainage that only transiently improves with drops suggests persistent structural disease.',
      'Malodor plus progressive hearing loss strengthens concern for chronic destructive middle-ear pathology.',
      'The keratin-filled posterosuperior retraction pocket is the pivotal visual recognition clue.',
      'Conductive bedside testing localizes hearing loss while the absence of facial, vestibular, or mastoid signs lowers concern for advanced complications.',
      'Audiometry confirms and quantifies conductive hearing loss.',
      'CT demonstrates the extent and erosive consequences of the lesion for surgical planning.',
    ][clue.order],
    diagnosticContribution: [
      'Establishes chronicity and treatment resistance.',
      'Adds progressive conductive symptom burden.',
      'Provides the key disease-specific otoscopic morphology.',
      'Functionally localizes hearing loss and screens for complications.',
      'Objectively quantifies the conductive deficit.',
      'Maps extent and bony erosion, completing the clinical-imaging synthesis.',
    ][clue.order],
  })),
  clinicalPearl:
    'Persistent unilateral otorrhea plus progressive conductive hearing loss should trigger careful inspection of the attic and posterosuperior tympanic membrane for a retraction pocket or keratin debris.',
  managementPearl:
    'Cholesteatoma is a surgically managed destructive middle-ear disease. Topical therapy may control superimposed infection or drainage temporarily, but it does not eradicate the keratinizing lesion.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Recognize chronic malodorous otorrhea and progressive conductive hearing loss',
      'Inspect the attic and posterosuperior tympanic membrane for retraction pockets and keratin debris',
      'Use audiometry to quantify hearing loss and CT to define extent and bony erosion',
      'Distinguish cholesteatoma from uncomplicated chronic suppurative otitis media and otitis externa',
      'Recognize facial weakness, vertigo, severe pain, mastoid signs, and neurologic symptoms as complication red flags',
      'Understand that definitive treatment is surgical removal rather than repeated courses of drops alone',
    ],
    competencyDomains: [
      'Otolaryngology',
      'Otology',
      'Audiology',
      'Head and Neck Imaging',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Acquired cholesteatoma is an abnormal collection of keratinizing squamous epithelium within the middle ear, epitympanum, or mastoid that can expand, become chronically infected, and erode adjacent bone and soft tissue.',
    highYieldTakeaway:
      'Think cholesteatoma when chronic or recurrent malodorous unilateral otorrhea and progressive conductive hearing loss coexist with an attic or posterosuperior retraction pocket containing keratin debris.',
  },
  recognitionPattern: [
    {
      pattern: 'Chronic unilateral otorrhea that repeatedly returns',
      whyItMatters:
        'Temporary improvement with topical therapy does not exclude cholesteatoma because treatment may suppress secondary infection without removing the keratinizing lesion.',
      progression:
        'Eustachian tube dysfunction or tympanic membrane injury -> retraction pocket or epithelial migration -> retained keratin -> expanding destructive middle-ear lesion.',
      discriminator:
        'Persistent or recurrent drainage plus progressive hearing loss should prompt inspection for structural disease rather than repeated empiric treatment alone.',
      commonTrap:
        'Assuming recurrent otorrhea is simply another episode of infection without examining the attic and posterosuperior tympanic membrane.',
    },
    {
      pattern: 'Keratin-filled attic or posterosuperior retraction pocket',
      whyItMatters:
        'This is the most disease-specific bedside morphology in acquired cholesteatoma.',
      discriminator:
        'White keratin debris within a retraction pocket differs from diffuse canal debris in otitis externa and from chalky tympanosclerotic plaques.',
      commonTrap:
        'Failing to clear obstructing discharge safely enough to visualize the tympanic membrane and attic.',
    },
    {
      pattern: 'Conductive hearing loss with focal bony erosion',
      whyItMatters:
        'Ossicular damage explains progressive conductive hearing loss and indicates the destructive potential of the disease.',
      discriminator:
        'Scutum or ossicular erosion on CT strongly supports cholesteatoma when the otoscopic findings are compatible.',
      commonTrap:
        'Treating CT soft tissue alone as diagnostic without correlating it with otoscopy and audiometry.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Persistent or recurrent unilateral otorrhea',
      significance:
        'Drainage is often chronic, malodorous, and incompletely responsive to medical treatment.',
    },
    {
      symptom: 'Progressive hearing loss',
      significance:
        'Conductive loss commonly reflects tympanic membrane dysfunction or ossicular erosion.',
    },
    {
      symptom: 'Otalgia, vertigo, or facial weakness in advanced disease',
      significance:
        'These symptoms raise concern for local invasion, labyrinthine involvement, osteitis, or facial nerve complications.',
    },
  ],
  keySigns: [
    {
      finding: 'Attic or posterosuperior retraction pocket containing keratin debris',
      significance:
        'Retraction allows keratinizing epithelium to accumulate within the middle ear and is a key recognition feature of acquired cholesteatoma.',
      discriminator:
        'Focal keratin within a tympanic membrane retraction pocket is more specific than nonspecific granulation tissue or discharge.',
    },
    {
      finding: 'Granulation tissue or aural polyp adjacent to the lesion',
      significance:
        'Chronic inflammation around cholesteatoma can produce granulation tissue and persistent drainage.',
      discriminator:
        'Persistent granulation tissue should prompt assessment for cholesteatoma and, when atypical, consideration of neoplasia.',
    },
    {
      finding: 'Conductive tuning-fork pattern',
      significance:
        'A negative Rinne on the affected side and Weber lateralization toward that ear support conductive hearing loss from middle-ear disease.',
      discriminator:
        'This pattern differs from primary sensorineural inner-ear disorders, in which Weber tends to lateralize away from the affected ear.',
    },
    {
      finding: 'Facial weakness, spontaneous nystagmus, postauricular inflammation, or neurologic change',
      significance:
        'These are warning signs for facial nerve involvement, labyrinthine fistula or labyrinthitis, mastoid complications, or intracranial spread.',
      urgency:
        'Requires expedited ENT assessment and complication-directed imaging or treatment.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Inspect the attic, not just the canal',
      content:
        'A cholesteatoma may hide in a pars flaccida or posterosuperior retraction pocket even when the external canal mainly shows drainage or granulation tissue.',
      whyItMatters:
        'The disease-defining morphology can be missed if the examination stops at visible discharge.',
      discriminator:
        'A keratin-filled retraction pocket localizes pathology to the tympanic membrane and middle ear rather than diffuse external-canal infection.',
      trapAvoided:
        'Do not diagnose otitis externa solely from otorrhea without checking tragal tenderness, canal inflammation, and the tympanic membrane.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Granulation tissue is a warning sign, not the final diagnosis',
      content:
        'Granulation tissue can accompany cholesteatoma, chronic infection, or occasionally neoplasia.',
      whyItMatters:
        'The clinician must identify the underlying lesion rather than labeling granulation tissue as the disease itself.',
      discriminator:
        'Keratin debris, retraction-pocket anatomy, and erosive imaging help separate cholesteatoma from other causes.',
      trapAvoided:
        'Do not repeatedly cauterize or treat persistent granulation tissue without reassessing the middle ear.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Screen for complications on every examination',
      content:
        'Check facial movement, vestibular symptoms or signs, mastoid tenderness, severe pain, and neurologic status when cholesteatoma is suspected.',
      whyItMatters:
        'The lesion can erode the facial canal, labyrinth, tegmen, or mastoid and can seed serious infection.',
      discriminator:
        'New facial weakness, vertigo, or postauricular inflammation shifts the case from uncomplicated outpatient disease toward urgent complicated disease.',
      escalationImplication:
        'Complication signs warrant expedited ENT management and targeted imaging.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Microscopic or endoscopic otoscopy',
      interpretation:
        'May show an attic or posterosuperior retraction pocket, white keratin debris, granulation tissue, or an aural polyp.',
      whyItMatters:
        'History plus direct visualization provides the core clinical diagnosis.',
      limitation:
        'Discharge, wax, canal swelling, or a narrow anatomy may obscure the lesion until careful aural toilet is performed.',
    },
    {
      test: 'Pure-tone audiometry with air and bone conduction',
      interpretation:
        'Usually shows conductive hearing loss, although mixed or sensorineural components may occur in advanced disease.',
      whyItMatters:
        'Quantifies functional impact, identifies the hearing-loss type, and provides a baseline for surgical counseling and follow-up.',
      limitation:
        'Audiometry confirms hearing dysfunction but does not establish the structural diagnosis by itself.',
    },
    {
      test: 'High-resolution CT temporal bone',
      interpretation:
        'May show epitympanic or mastoid soft tissue with scutum, ossicular, tegmen, labyrinthine, or other temporal-bone erosion.',
      whyItMatters:
        'Defines disease extent, complications, and anatomy important for surgical planning.',
      limitation:
        'Soft tissue on CT is not specific; findings must be interpreted with otoscopy and clinical context.',
    },
    {
      test: 'Non-echo-planar diffusion-weighted MRI',
      interpretation:
        'Restricted diffusion can help identify cholesteatoma, especially residual or recurrent disease after surgery.',
      whyItMatters:
        'Particularly useful in postoperative surveillance and when CT cannot distinguish soft-tissue types.',
      limitation:
        'Not every uncomplicated primary case requires MRI; use depends on anatomy, complications, and local practice.',
    },
  ],
  managementOverview: [
    {
      step: 'Refer for otolaryngology assessment',
      rationale:
        'Cholesteatoma is destructive and generally requires specialist surgical management rather than indefinite medical therapy.',
    },
    {
      step: 'Control active drainage and secondary infection',
      rationale:
        'Careful aural toilet and appropriate topical therapy may reduce infection and improve visualization before definitive treatment.',
    },
    {
      step: 'Obtain formal audiometry',
      rationale:
        'Preoperative hearing assessment documents the conductive deficit and supports counseling about expected hearing outcomes.',
    },
    {
      step: 'Use temporal-bone imaging when planning surgery or evaluating extent',
      rationale:
        'CT helps define ossicular, mastoid, labyrinthine, facial canal, tegmen, and other bony involvement.',
    },
    {
      step: 'Definitive surgical removal',
      rationale:
        'Surgery removes the keratinizing lesion and aims to create a safe, dry ear while preserving or reconstructing hearing when feasible.',
    },
    {
      step: 'Long-term postoperative surveillance',
      rationale:
        'Residual or recurrent cholesteatoma can occur, so otoscopic follow-up and, when indicated, diffusion-weighted MRI are important.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Chronic Suppurative Otitis Media',
      whyConfused:
        'Both cause persistent ear drainage and conductive hearing loss and may coexist.',
      distinguishingPoint:
        'Uncomplicated chronic suppurative otitis media is defined by chronic perforation and mucosal infection without the characteristic keratin-filled retraction pocket or focal erosive lesion.',
      keySeparator:
        'Keratin debris in an attic/posterosuperior pocket plus scutum or ossicular erosion favors cholesteatoma.',
      classicTrap:
        'Repeatedly treating drainage without looking for an underlying cholesteatoma.',
    },
    {
      diagnosis: 'Otitis Externa',
      whyConfused:
        'Both can cause otorrhea and ear discomfort.',
      distinguishingPoint:
        'Otitis externa produces diffuse canal inflammation and usually significant tragal or pinna tenderness.',
      keySeparator:
        'A relatively noninflamed canal with a keratin-filled tympanic membrane retraction pocket favors cholesteatoma.',
      classicTrap:
        'Assuming all otorrhea originates in the external canal.',
    },
    {
      diagnosis: 'Keratosis Obturans',
      whyConfused:
        'Both involve keratin accumulation and may cause conductive hearing loss.',
      distinguishingPoint:
        'Keratosis obturans is primarily an external auditory canal disorder with circumferential keratin accumulation and canal widening.',
      keySeparator:
        'A focal attic or posterosuperior tympanic membrane retraction pocket with middle-ear erosion favors cholesteatoma.',
      classicTrap:
        'Calling any visible keratin cholesteatoma without localizing where it originates.',
    },
    {
      diagnosis: 'Tympanosclerosis',
      whyConfused:
        'Both may occur after chronic middle-ear disease and cause conductive hearing loss.',
      distinguishingPoint:
        'Tympanosclerosis produces white calcified plaques or ossicular fixation rather than retained keratin and erosive destruction.',
      keySeparator:
        'Keratin debris with scutum or ossicular erosion supports cholesteatoma.',
      classicTrap:
        'Mistaking any white tympanic membrane abnormality for cholesteatoma.',
    },
    {
      diagnosis: 'Otitis Media with Effusion',
      whyConfused:
        'Both can cause conductive hearing loss and a sensation of a blocked ear.',
      distinguishingPoint:
        'Effusion causes fluid behind an intact tympanic membrane and does not cause keratin debris or focal bony erosion.',
      keySeparator:
        'Malodorous otorrhea with a retraction pocket and erosion excludes simple effusion.',
      classicTrap:
        'Attributing persistent adult unilateral hearing loss to effusion without visualizing the attic and considering structural disease.',
    },
    {
      diagnosis: 'Middle Ear Neoplasm',
      whyConfused:
        'A middle-ear tumor may cause unilateral hearing loss, drainage, granulation tissue, and destructive imaging findings.',
      distinguishingPoint:
        'Cholesteatoma has a characteristic keratinizing retraction-pocket pattern, while neoplasms may form solid or vascular masses and require different imaging or tissue assessment.',
      keySeparator:
        'Typical keratin debris arising from a retraction pocket with expected erosive spread strongly favors cholesteatoma.',
      classicTrap:
        'Ignoring atypical bleeding, persistent unexplained mass, cranial neuropathy, or unusual imaging that should prompt consideration of neoplasia.',
    },
  ],
  complications: [
    {
      complication: 'Ossicular erosion and conductive hearing loss',
      whyItMatters:
        'The lesion commonly damages the incus, malleus, or stapes and can cause substantial hearing impairment.',
    },
    {
      complication: 'Labyrinthine fistula or labyrinthitis',
      whyItMatters:
        'Erosion into the labyrinth may cause vertigo and sensorineural hearing loss.',
    },
    {
      complication: 'Facial nerve injury',
      whyItMatters:
        'Facial canal erosion or inflammation can produce facial weakness and requires urgent assessment.',
    },
    {
      complication: 'Mastoid and temporal-bone infection',
      whyItMatters:
        'Cholesteatoma can act as a nidus for persistent infection and local osteitis.',
    },
    {
      complication: 'Intracranial infection',
      whyItMatters:
        'Rare extension can lead to serious complications such as meningitis or intracranial abscess.',
    },
    {
      complication: 'Residual or recurrent cholesteatoma',
      whyItMatters:
        'Long-term follow-up is needed even after surgery because disease can persist or recur.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Treating recurrent drainage as infection alone',
      consequence:
        'Secondary infection may improve while the destructive cholesteatoma continues to enlarge.',
      saferHeuristic:
        'Recurrent unilateral malodorous otorrhea plus hearing loss should trigger full tympanic membrane and attic inspection.',
    },
    {
      pitfall: 'Failing to clear the canal enough to inspect the tympanic membrane',
      consequence:
        'The retraction pocket and keratin debris may remain hidden behind discharge or granulation tissue.',
      saferHeuristic:
        'Use careful aural toilet and specialist microscopy/endoscopy when visualization is inadequate.',
    },
    {
      pitfall: 'Using CT as a standalone diagnosis',
      consequence:
        'Middle-ear soft tissue is nonspecific and can represent fluid, granulation tissue, or other pathology.',
      saferHeuristic:
        'Correlate CT with history, otoscopy, and audiometry; use imaging primarily to define extent and complications.',
    },
    {
      pitfall: 'Missing complication red flags',
      consequence:
        'Facial weakness, vertigo, severe pain, mastoid inflammation, or neurologic symptoms may indicate dangerous local or intracranial extension.',
      saferHeuristic:
        'Actively screen for facial, vestibular, mastoid, and neurologic findings in every suspected case.',
    },
    {
      pitfall: 'Assuming medical therapy eradicates cholesteatoma',
      consequence:
        'Drops may suppress drainage but do not remove the keratinizing lesion.',
      saferHeuristic:
        'Treat superimposed infection while arranging definitive ENT surgical management.',
    },
  ],
  recallPrompts: [
    {
      type: 'SHORT_ANSWER',
      prompt: 'What otoscopic finding most strongly suggests acquired cholesteatoma?',
      answer: 'A keratin-filled attic or posterosuperior tympanic membrane retraction pocket.',
      explanation:
        'The retraction pocket creates a space where keratinizing epithelium accumulates and progressively expands.',
    },
    {
      type: 'DISTINGUISH',
      prompt: 'What bedside findings separate cholesteatoma from uncomplicated otitis externa?',
      answer:
        'Cholesteatoma localizes to a tympanic membrane retraction pocket with keratin debris, whereas otitis externa causes diffuse canal inflammation and usually tragal or pinna tenderness.',
      explanation:
        'Localizing the pathology to the canal versus middle ear prevents a common diagnostic error.',
    },
    {
      type: 'WHY_IT_MATTERS',
      prompt: 'Why is progressive conductive hearing loss important in cholesteatoma?',
      answer:
        'It may reflect tympanic membrane dysfunction or erosion of the ossicular chain by the expanding lesion.',
      explanation:
        'Progressive hearing loss is a clue to structural damage rather than a transient infectious episode.',
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'What is the main role of temporal-bone CT in suspected cholesteatoma?',
      answer:
        'To map disease extent, bony erosion, complications, and anatomy for surgical planning.',
      explanation:
        'CT complements rather than replaces the history and otoscopic examination.',
    },
    {
      type: 'PEARL_RECALL',
      prompt: 'What symptoms should raise concern for complicated cholesteatoma?',
      answer:
        'New facial weakness, vertigo, severe otalgia, postauricular swelling or tenderness, or neurologic symptoms.',
      explanation:
        'These findings may signal facial nerve, labyrinthine, mastoid, or intracranial involvement.',
    },
  ],
  references: [
    {
      citation:
        'Merck Manual Professional Edition. Cholesteatoma. Reviewed/updated June 2026.',
    },
    {
      citation:
        'Maxwell AK, Hoff SR. Evaluation of Cholesteatoma. Otolaryngol Clin North Am. 2025;58(1):29-39.',
    },
    {
      citation:
        'Touska P, Connor SEJ. ESR Essentials: imaging of middle ear cholesteatoma—practice recommendations by the European Society of Head and Neck Radiology. Eur Radiol. 2025;35(4):2053-2064.',
    },
  ],
};

const allowedClueTypes = new Set([
  'history',
  'symptom',
  'vital',
  'lab',
  'exam',
  'imaging',
]);

const allowedRecallTypes = new Set([
  'CLOZE',
  'SHORT_ANSWER',
  'DISTINGUISH',
  'PEARL_RECALL',
  'WHY_IT_MATTERS',
]);

function assertSeedShape() {
  if (clues.length !== 6) {
    throw new Error(`Expected exactly 6 clues; received ${clues.length}.`);
  }

  clues.forEach((clue, index) => {
    if (clue.order !== index) {
      throw new Error(`Clue order mismatch at index ${index}: ${clue.order}.`);
    }
    if (!allowedClueTypes.has(clue.type)) {
      throw new Error(`Unsupported clue type: ${clue.type}.`);
    }
    if (!clue.value.trim()) {
      throw new Error(`Clue ${clue.order} is empty.`);
    }
  });

  for (const clue of clues.slice(0, 5)) {
    if (normalizeClinicalText(clue.value).includes('acquired cholesteatoma')) {
      throw new Error(`Diagnosis leaked before final clue at order ${clue.order}.`);
    }
  }

  if (explanation.differentialAnalysis.length !== differentials.length) {
    throw new Error('Differential analysis count does not match differential list.');
  }

  explanation.differentialAnalysis.forEach((analysis) => {
    if (!differentials.includes(analysis.diagnosis)) {
      throw new Error(`Unexpected differential analysis: ${analysis.diagnosis}.`);
    }

    analysis.ruledOutByClues.forEach((item) => {
      const clue = clues.find((candidate) => candidate.order === item.clueOrder);
      if (!clue) {
        throw new Error(
          `Differential ${analysis.diagnosis} references missing clue ${item.clueOrder}.`,
        );
      }
      if (!clue.value.toLowerCase().includes(item.evidence.toLowerCase())) {
        throw new Error(
          `Differential evidence not found: ${analysis.diagnosis} -> ${item.evidence}`,
        );
      }
    });
  });

  if (explanation.clueBreakdown.length !== clues.length) {
    throw new Error('Clue breakdown length does not match clues.');
  }

  explanation.clueBreakdown.forEach((item, index) => {
    const clue = clues[index];
    if (
      item.clueOrder !== clue.order ||
      item.clueType !== clue.type ||
      item.clue !== clue.value
    ) {
      throw new Error(`Clue breakdown mismatch at order ${index}.`);
    }
  });

  if (educationForFrontend.scoringSystems.length !== 0) {
    throw new Error('scoringSystems must be empty for cholesteatoma.');
  }

  if (educationForFrontend.keySigns.length < 3) {
    throw new Error('Expected at least three structured key signs.');
  }

  educationForFrontend.examPearls.forEach((pearl) => {
    if (!pearl.title || !pearl.content || !pearl.whyItMatters || !pearl.discriminator) {
      throw new Error(`Incomplete exam pearl: ${pearl.title || 'untitled'}.`);
    }
  });

  educationForFrontend.investigations.forEach((investigation) => {
    if (!investigation.test || !investigation.interpretation || !investigation.whyItMatters) {
      throw new Error(`Incomplete investigation entry: ${investigation.test || 'untitled'}.`);
    }
  });

  educationForFrontend.differentialDistinguishers.forEach((item) => {
    if (
      !item.diagnosis ||
      !item.whyConfused ||
      !item.distinguishingPoint ||
      !item.keySeparator ||
      !item.classicTrap
    ) {
      throw new Error(`Incomplete differential teaching entry: ${item.diagnosis}.`);
    }
  });

  educationForFrontend.managementOverview.forEach((item) => {
    if (!item.step || !item.rationale) {
      throw new Error(`Incomplete management entry: ${item.step || 'untitled'}.`);
    }
  });

  educationForFrontend.pitfalls.forEach((item) => {
    if (!item.pitfall || !item.consequence || !item.saferHeuristic) {
      throw new Error(`Incomplete pitfall entry: ${item.pitfall || 'untitled'}.`);
    }
  });

  educationForFrontend.recallPrompts.forEach((item) => {
    if (!allowedRecallTypes.has(item.type)) {
      throw new Error(`Unsupported recall prompt type: ${item.type}.`);
    }
    if (!item.prompt || !item.answer || !item.explanation) {
      throw new Error(`Incomplete recall prompt: ${item.prompt || 'untitled'}.`);
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

  const registryData = {
    canonicalName,
    canonicalNormalized,
    displayLabel,
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    isPlayable: true,
    isGeneratable: true,
    specialty: 'Otolaryngology',
    subspecialty: 'Otology',
    category: 'Chronic Middle Ear Disease',
    bodySystem: 'Head and Neck',
    organSystem: 'Middle Ear',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    rarityBand: DiagnosisRarityBand.UNCOMMON,
    clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
    notes:
      'Seeded flagship acquired cholesteatoma case emphasizing chronic otorrhea, conductive hearing loss, keratin-filled retraction pocket, and erosive disease.',
  };

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: registryData,
        select: { id: true, displayLabel: true },
      })
    : await prisma.diagnosisRegistry.create({
        data: registryData,
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

async function upsertEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  const educationData = {
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
  };

  const education = existing
    ? await prisma.diagnosisEducation.update({
        where: { id: existing.id },
        data: {
          ...educationData,
          version: { increment: 1 },
        },
        select: { id: true, version: true },
      })
    : await prisma.diagnosisEducation.create({
        data: {
          diagnosisRegistryId,
          ...educationData,
          version: 1,
        },
        select: { id: true, version: true },
      });

  const existingRevision = await prisma.diagnosisEducationRevision.findFirst({
    where: {
      educationId: education.id,
      version: education.version,
    },
    select: { id: true },
  });

  if (!existingRevision) {
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
  }

  return education;
}

async function upsertCase(params: {
  diagnosisRegistryId: string;
  registryDisplayLabel: string;
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
    console.log('Skipped existing scheduled Acquired Cholesteatoma case:', scheduledCase);
    return;
  }

  const reusableCase = existingCases.find((item) => item.dailyCases.length === 0);

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
      'Seeded complete frontend-aligned flagship Acquired Cholesteatoma case with full education and erosive middle-ear disease reasoning.',
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

  const revisionData = {
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
      'Created complete Acquired Cholesteatoma revision with education-aligned explanation.',
  };

  for (const forbiddenField of ['editorialStatus', 'approvedAt', 'publishedAt']) {
    if (forbiddenField in revisionData) {
      throw new Error(`Forbidden CaseRevision field present: ${forbiddenField}.`);
    }
  }

  const revision = await prisma.caseRevision.create({
    data: revisionData,
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  const existingValidation = await prisma.caseValidationRun.findFirst({
    where: {
      caseId: seededCase.id,
      revisionId: revision.id,
      validatorVersion: 'flagship-human-review:acquired-cholesteatoma-v1',
    },
    select: { id: true },
  });

  if (!existingValidation) {
    await prisma.caseValidationRun.create({
      data: {
        caseId: seededCase.id,
        revisionId: revision.id,
        source: CaseSource.MANUAL,
        publishTrack: PublishTrack.DAILY,
        outcome: ValidationOutcome.PASSED,
        validatorVersion: 'flagship-human-review:acquired-cholesteatoma-v1',
        summary: {
          contentTier: 'FLAGSHIP',
          seedVersion,
          humanReviewed: true,
          note:
            'Complete Acquired Cholesteatoma flagship seed with six playable clues, exact differential evidence, and full Wardle education payload.',
        },
        findings: [],
        completedAt: now,
      },
    });
  }

  console.log('Seeded Acquired Cholesteatoma:', {
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
  console.log('Acquired Cholesteatoma seed validation passed.');

  const registry = await ensureRegistry();
  const education = await upsertEducation(registry.id);

  await upsertCase({
    diagnosisRegistryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
    educationId: education.id,
  });
}

main()
  .catch((error) => {
    console.error('Acquired Cholesteatoma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
