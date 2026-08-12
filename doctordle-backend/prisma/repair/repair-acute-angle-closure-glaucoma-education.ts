import 'dotenv/config';
import {
  PrismaClient,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * REPAIR — Acute Angle-Closure Glaucoma diagnosis education
 *
 * Repairs the already-created DiagnosisEducation record so it follows Wardle's
 * structured education contract:
 * - key signs explain mechanism, diagnostic impact, discriminator, and trap;
 * - exam pearls use typed pearls with finding -> mechanism -> probability shift;
 * - investigations include expected result, interpretation, and operational use;
 * - differentials explain overlap, key separator, consequence, and classic trap;
 * - management states action, indication, rationale, next step, and escalation;
 * - pitfalls include trap, consequence, and safer heuristic;
 * - recall prompts use Wardle's prompt/answer/explanation schema.
 *
 * This script does not modify the case, clues, date, public number, diagnosis
 * mapping, registry identity, or DailyCase scheduling.
 *
 * Run:
 *   npx tsx prisma/repair/repair-acute-angle-closure-glaucoma-education.ts
 *
 * Railway:
 *   railway run npx tsx prisma/repair/repair-acute-angle-closure-glaucoma-education.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the acute angle-closure glaucoma education repair.',
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
  allowExitOnIdle: true,
  ssl:
    databaseUrl.includes('railway') ||
    databaseUrl.includes('proxy.rlwy.net') ||
    databaseUrl.includes('postgres.railway.internal')
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on('error', (error) => {
  console.error('[pg-pool] idle client error:', error);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function resolvePgConnectionString(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');

  if (!apiKey) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but is missing api_key.',
    );
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

function normalizeClinicalText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stableJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (typeof input !== 'object' || input === null) return input;

    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  };

  return JSON.stringify(normalize(value));
}

const now = new Date();
const repairVersion = 'repair-acute-angle-closure-glaucoma-education-v2';
const canonicalNormalized = 'acute angle closure glaucoma';
const displayLabel = 'Acute Angle-Closure Glaucoma';

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Acute angle-closure glaucoma is a sight-threatening pressure crisis caused by sudden obstruction of aqueous outflow at the iridocorneal angle. In primary pupillary block, pressure behind the iris bows the peripheral iris forward against the trabecular meshwork, rapidly raising intraocular pressure and risking irreversible optic-nerve injury.',
    highYieldTakeaway:
      'A painful red eye with reduced vision or coloured halos, nausea or vomiting, a steamy cornea, a mid-dilated poorly reactive pupil, a shallow anterior chamber, and markedly raised intraocular pressure is an ophthalmic emergency. Gonioscopy establishes angle closure and clarifies the mechanism.',
  },
  recognitionPattern: [
    {
      id: 'acute-pressure-crisis-pattern',
      type: 'PATTERN_RECOGNITION',
      title: 'Acute ocular pressure crisis',
      content:
        'Sudden unilateral ocular pain, blurred vision or coloured halos, headache, nausea, and vomiting occur when abrupt angle obstruction produces a rapid rise in intraocular pressure and corneal oedema.',
      whyItMatters:
        'The autonomic symptoms can dominate the presentation, but their combination with a painful red eye and visual loss raises suspicion for an ocular emergency rather than a primary gastrointestinal or neurological disorder.',
      discriminator:
        'Severe visual disturbance with corneal haze and an abnormal pupil rather than isolated headache, nausea, or vomiting.',
      trapAvoided:
        'Do not pursue only migraine or gastrointestinal causes before examining the painful red eye.',
    },
    {
      id: 'anterior-segment-pattern',
      type: 'PATTERN_RECOGNITION',
      title: 'Congested, oedematous anterior segment',
      content:
        'Ciliary injection, a steamy cornea, a mid-dilated poorly reactive pupil, and a shallow anterior chamber reflect acute pressure elevation, iris ischaemia, and forward displacement of the peripheral iris.',
      whyItMatters:
        'This linked anterior-segment pattern shifts probability strongly away from uncomplicated conjunctivitis and toward acute angle closure.',
      discriminator:
        'A hazy cornea, abnormal pupil, and shallow chamber rather than discharge, itch, and preserved visual acuity.',
      trapAvoided:
        'Do not call a painful red eye conjunctivitis when the cornea, pupil, or vision is abnormal.',
    },
    {
      id: 'angle-obstruction-pattern',
      type: 'PATTERN_RECOGNITION',
      title: 'Mechanical obstruction of aqueous outflow',
      content:
        'A markedly elevated intraocular pressure with iridotrabecular contact or gonioscopic closure indicates that the peripheral iris is blocking the trabecular meshwork.',
      whyItMatters:
        'This is the anatomical event that makes the condition time-critical and directs treatment toward immediate pressure reduction followed by relief of the obstructing mechanism.',
      discriminator:
        'Closed-angle anatomy rather than isolated ocular hypertension with an open angle.',
      trapAvoided:
        'Do not use tonometry alone to define the mechanism; inspect the angle.',
    },
    {
      id: 'fellow-eye-risk-pattern',
      type: 'ESCALATION_RED_FLAG',
      title: 'Shared fellow-eye anatomy',
      content:
        'The fellow eye often has the same crowded or occludable anterior-segment anatomy because the predisposing biometric features are usually bilateral.',
      whyItMatters:
        'Failure to assess the fellow eye leaves the patient at risk of a second preventable acute attack.',
      discriminator:
        'Bilateral anatomical susceptibility despite a unilateral symptomatic crisis.',
      managementImplication:
        'Arrange prompt gonioscopic assessment and preventive treatment of the fellow eye when indicated.',
      escalationImplication:
        'A missed occludable fellow angle can progress to another sight-threatening attack.',
      trapAvoided:
        'Do not stop management after the symptomatic eye improves.',
    },
  ],
  keySymptoms: [
    {
      finding: 'Sudden severe unilateral eye pain',
      whyItMatters:
        'Abrupt severe pain reflects rapid ocular pressure elevation and anterior-segment ischaemia rather than the mild irritation typical of conjunctivitis.',
      diagnosticImpact:
        'Pain combined with visual loss and an abnormal pupil substantially raises suspicion for acute angle closure.',
      discriminator:
        'Severe deep pain rather than itch, grittiness, or mild surface discomfort.',
    },
    {
      finding: 'Blurred vision or coloured halos',
      whyItMatters:
        'Raised intraocular pressure impairs corneal endothelial function, producing corneal oedema that scatters light and causes haze or halos.',
      diagnosticImpact:
        'Halos with a painful red eye point toward pressure-related corneal oedema.',
      discriminator:
        'Optical haze from corneal oedema rather than discharge-related blur that clears with blinking.',
    },
    {
      finding: 'Ipsilateral headache',
      whyItMatters:
        'Ocular pain may refer through trigeminal pathways to the brow or frontal region.',
      diagnosticImpact:
        'Headache is meaningful when it accompanies an abnormal painful eye, but is nonspecific in isolation.',
      discriminator:
        'Headache with red eye and reduced vision rather than a neurologically normal eye during primary headache.',
    },
    {
      finding: 'Nausea and vomiting',
      whyItMatters:
        'Severe ocular pain and abrupt autonomic activation can produce prominent gastrointestinal symptoms.',
      diagnosticImpact:
        'Vomiting should increase urgency when paired with a painful red eye and visual disturbance.',
      discriminator:
        'Autonomic symptoms linked to an ocular pressure crisis rather than isolated gastroenteritis.',
    },
  ],
  keySigns: [
    {
      id: 'ciliary-injection',
      finding: 'Ciliary injection',
      description:
        'A deep violaceous flush concentrated around the limbus occurs because congestion of deeper episcleral and ciliary vessels accompanies acute anterior-segment pressure and ischaemic stress.',
      whyItMatters:
        'Perilimbal injection with pain and visual loss is more concerning than the diffuse superficial redness of uncomplicated conjunctivitis.',
      diagnosticImpact:
        'It localizes the process to the cornea, anterior chamber, iris, or ciliary body rather than the conjunctival surface alone.',
      discriminator:
        'Deep perilimbal flush rather than diffuse mobile superficial conjunctival vessels.',
      trapAvoided:
        'Do not equate all red eyes with conjunctivitis.',
    },
    {
      id: 'steamy-corneal-oedema',
      finding: 'Hazy or steamy cornea',
      description:
        'Markedly raised intraocular pressure overwhelms corneal endothelial fluid transport, allowing stromal and epithelial oedema that produces a cloudy or steamy appearance.',
      whyItMatters:
        'The oedema explains reduced vision and coloured halos and signals a substantial pressure rise.',
      diagnosticImpact:
        'Corneal haze in a painful red eye shifts away from simple conjunctivitis and toward keratitis, uveitis, or an acute pressure crisis; the remaining pupil, chamber, and pressure findings separate these.',
      discriminator:
        'Diffuse pressure-related oedema without a focal epithelial defect or stromal infiltrate.',
      trapAvoided:
        'Do not assume every hazy painful cornea is infectious keratitis; perform fluorescein examination and assess pressure when safe.',
    },
    {
      id: 'mid-dilated-pupil',
      finding: 'Mid-dilated poorly reactive pupil',
      description:
        'The iris sphincter becomes ischaemic at very high intraocular pressure, while a mid-dilated position maximizes iris-lens contact and can intensify pupillary block.',
      whyItMatters:
        'This pupil configuration is a classic sign of an acute pressure crisis and helps explain why attacks may occur during physiologic dilation.',
      diagnosticImpact:
        'It strongly favours acute angle closure over conjunctivitis and contrasts with the small or irregular pupil often seen in anterior uveitis.',
      discriminator:
        'A fixed or sluggish mid-dilated pupil rather than a normal reactive pupil or inflammatory miosis.',
      trapAvoided:
        'Do not omit pupillary examination in a patient whose main complaints are headache or vomiting.',
    },
    {
      id: 'shallow-anterior-chamber',
      finding: 'Shallow anterior chamber',
      description:
        'Relative pupillary block creates a posterior-to-anterior pressure gradient across the iris, bowing the peripheral iris forward until it approaches or contacts the trabecular meshwork.',
      whyItMatters:
        'The shallow chamber reveals the crowded anatomy that permits angle obstruction.',
      diagnosticImpact:
        'A shallow chamber with raised pressure supports angle closure rather than an open-angle pressure elevation.',
      discriminator:
        'Reduced peripheral chamber depth and iridotrabecular contact rather than a deep open chamber.',
      trapAvoided:
        'Van Herick grading estimates risk but does not replace gonioscopy.',
    },
    {
      id: 'markedly-raised-iop',
      finding: 'Markedly elevated intraocular pressure',
      description:
        'Obstruction of the trabecular meshwork abruptly reduces aqueous outflow, so aqueous production continues against a closed drainage pathway and pressure rises rapidly.',
      whyItMatters:
        'The magnitude and duration of pressure elevation determine the risk of corneal dysfunction, iris ischaemia, and optic-nerve injury.',
      diagnosticImpact:
        'Very high pressure supports an acute glaucoma crisis, although pressure alone does not identify whether the angle is open or closed.',
      discriminator:
        'Raised pressure plus a shallow or closed angle rather than raised pressure with open-angle anatomy.',
      managementImplication:
        'Begin urgent pressure reduction while arranging definitive ophthalmic treatment.',
      trapAvoided:
        'Digital palpation is only a rough clue and must not substitute for tonometry when tonometry is safe.',
    },
    {
      id: 'gonioscopic-angle-closure',
      finding: 'Closed or occludable angle on gonioscopy',
      description:
        'Gonioscopy directly visualizes whether the peripheral iris is contacting or permanently adherent to the trabecular meshwork and can reveal secondary causes such as neovascularization or inflammation.',
      whyItMatters:
        'This examination confirms the anatomical diagnosis and distinguishes appositional closure from peripheral anterior synechiae.',
      diagnosticImpact:
        'It separates true angle closure from painful red-eye mimics and from ocular hypertension with an open angle.',
      discriminator:
        'Direct iridotrabecular contact rather than an angle inferred only from symptoms, tonometry, or anterior-chamber depth.',
      managementImplication:
        'Use the mechanism identified on gonioscopy to select definitive therapy.',
      trapAvoided:
        'Do not let adjunctive imaging replace gonioscopy when an adequate examination becomes possible.',
    },
  ],
  examPearls: [
    {
      id: 'corneal-oedema-mechanism',
      type: 'EXAM',
      title: 'Steamy cornea explains halos',
      content:
        'The cornea becomes hazy because markedly raised intraocular pressure overwhelms endothelial fluid transport and produces oedema.',
      whyItMatters:
        'Pressure-related oedema links the visual blur and coloured halos to an acute glaucoma crisis rather than uncomplicated conjunctivitis.',
      discriminator:
        'Diffuse oedema without a focal fluorescein-positive epithelial defect or stromal infiltrate.',
      managementImplication:
        'Pressure reduction is required to restore corneal clarity and permit definitive angle treatment.',
      trapAvoided:
        'Do not diagnose keratitis from corneal haze alone.',
    },
    {
      id: 'pupil-mechanism',
      type: 'EXAM',
      title: 'Mid-dilated poorly reactive pupil',
      content:
        'The pupil becomes sluggish and mid-dilated because severe pressure compromises iris sphincter perfusion, while this pupil size increases iris-lens contact and pupillary block.',
      whyItMatters:
        'The finding strongly increases the probability of acute angle closure in a painful red eye.',
      discriminator:
        'Mid-dilation rather than the small or irregular pupil that more often accompanies anterior uveitis.',
      managementImplication:
        'Recognize that an ischaemic sphincter may respond poorly to a miotic until pressure begins to fall.',
      trapAvoided:
        'Do not give repeated miotic doses without considering severe sphincter ischaemia and the closure mechanism.',
    },
    {
      id: 'shallow-chamber-mechanism',
      type: 'EXAM',
      title: 'Shallow chamber reflects iris bombe',
      content:
        'Peripheral chamber depth is reduced because relative pupillary block bows the iris forward toward the trabecular meshwork.',
      whyItMatters:
        'This anatomical sign links the pressure rise to angle obstruction rather than to open-angle glaucoma.',
      discriminator:
        'A crowded anterior segment rather than a deep chamber with an open drainage angle.',
      managementImplication:
        'Confirm angle anatomy with gonioscopy and identify whether the mechanism is primary or secondary.',
      trapAvoided:
        'Do not use Van Herick grading as definitive proof of angle closure.',
    },
    {
      id: 'gonioscopy-mechanism',
      type: 'EXAM',
      title: 'Gonioscopy defines the mechanism',
      content:
        'Gonioscopy demonstrates closure because the goniolens overcomes total internal reflection and permits direct inspection of the iridocorneal angle.',
      whyItMatters:
        'Direct angle examination confirms the diagnosis, separates appositional from synechial closure, and may expose neovascular, inflammatory, lens-related, or plateau-iris mechanisms.',
      discriminator:
        'Observed iridotrabecular contact rather than an angle assumed from high pressure alone.',
      managementImplication:
        'Definitive treatment must address the mechanism seen on angle examination.',
      trapAvoided:
        'Do not assume every acute angle closure is primary pupillary block.',
    },
    {
      id: 'fellow-eye-examination',
      type: 'ESCALATION_RED_FLAG',
      title: 'Examine the fellow eye',
      content:
        'The fellow eye is at risk because biometric predisposition such as a crowded anterior chamber is usually bilateral.',
      whyItMatters:
        'A unilateral symptomatic attack may therefore be followed by a preventable contralateral attack.',
      discriminator:
        'Bilateral anatomical risk despite unilateral acute symptoms.',
      managementImplication:
        'Assess the fellow angle promptly and provide prophylactic treatment when indicated.',
      escalationImplication:
        'Failure to protect the fellow eye risks another sight-threatening emergency.',
      trapAvoided:
        'Do not discharge after treating only the painful eye.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      id: 'visual-acuity-pupils',
      type: 'INVESTIGATION',
      title: 'Visual acuity and pupillary examination',
      content:
        'Visual acuity is usually reduced, and the affected pupil may be mid-dilated and poorly reactive.',
      whyItMatters:
        'Reduced acuity documents functional severity, while the abnormal pupil supports iris ischaemia and an acute pressure crisis.',
      discriminator:
        'Marked visual impairment and an abnormal pupil rather than the preserved vision and normal pupil expected in uncomplicated conjunctivitis.',
      managementImplication:
        'Document baseline vision before treatment when this does not delay emergency care.',
      trapAvoided:
        'Do not allow vomiting or headache to distract from visual-acuity and pupil assessment.',
    },
    {
      id: 'tonometry',
      type: 'INVESTIGATION',
      title: 'Applanation tonometry',
      content:
        'Tonometry shows elevated intraocular pressure, often markedly above the fellow eye during an acute attack.',
      whyItMatters:
        'The result confirms a pressure crisis and provides a baseline for response, but does not by itself distinguish open-angle from closed-angle disease.',
      discriminator:
        'Raised pressure interpreted with chamber depth and gonioscopy rather than as a standalone diagnosis.',
      managementImplication:
        'Repeat pressure measurement during treatment; avoid tonometry when globe rupture is suspected.',
      trapAvoided:
        'Do not use a single pressure value without assessing angle anatomy and the clinical pattern.',
    },
    {
      id: 'slit-lamp-van-herick',
      type: 'INVESTIGATION',
      title: 'Slit-lamp examination and Van Herick assessment',
      content:
        'Slit-lamp examination may show corneal oedema, a shallow anterior chamber, and a narrow peripheral chamber by Van Herick grading.',
      whyItMatters:
        'These findings indicate crowded anterior-segment anatomy and help distinguish pressure-related oedema from focal corneal ulceration or marked anterior-chamber inflammation.',
      discriminator:
        'Shallow chamber with diffuse oedema rather than a focal infiltrate, epithelial defect, hypopyon, or deep chamber.',
      managementImplication:
        'Use the examination to identify mimics and estimate closure risk, but confirm the angle with gonioscopy.',
      trapAvoided:
        'Do not treat Van Herick estimation as equivalent to direct angle examination.',
    },
    {
      id: 'gonioscopy',
      type: 'INVESTIGATION',
      title: 'Gonioscopy',
      content:
        'Gonioscopy shows iridotrabecular contact, appositional closure, or peripheral anterior synechiae and may reveal neovascular or inflammatory abnormalities.',
      whyItMatters:
        'It confirms angle closure and indicates whether the process is reversible apposition, established synechial closure, primary pupillary block, or a secondary mechanism.',
      discriminator:
        'Directly observed closed-angle anatomy rather than inferred closure from high pressure or anterior-segment imaging alone.',
      managementImplication:
        'Perform once corneal clarity permits and use the mechanism to guide definitive treatment.',
      trapAvoided:
        'Do not omit gonioscopy after the cornea clears.',
    },
    {
      id: 'anterior-segment-imaging',
      type: 'INVESTIGATION',
      title: 'Anterior-segment OCT or ultrasound biomicroscopy',
      content:
        'Imaging may show iridotrabecular contact, anterior iris bowing, lens crowding, plateau-iris configuration, or ciliochoroidal effusion.',
      whyItMatters:
        'The anatomy supports angle closure and can identify structures not fully visible during an acute attack.',
      discriminator:
        'Mechanism-specific anatomical findings rather than a nonspecific pressure elevation.',
      managementImplication:
        'Use as an adjunct when gonioscopy is limited or a non-pupillary-block mechanism is suspected.',
      trapAvoided:
        'Do not let non-contact imaging replace gonioscopy when direct examination is possible.',
    },
    {
      id: 'post-attack-damage-assessment',
      type: 'INVESTIGATION',
      title: 'Optic-nerve and visual-field assessment',
      content:
        'After pressure and corneal clarity improve, optic-disc examination, retinal nerve-fibre imaging, and perimetry may show glaucomatous structural or functional damage.',
      whyItMatters:
        'Damage assessment distinguishes an isolated acute primary angle-closure event from established angle-closure glaucoma and informs long-term follow-up.',
      discriminator:
        'Persistent glaucomatous damage rather than transient visual blur from corneal oedema alone.',
      managementImplication:
        'Schedule reliable structural and functional testing after the acute crisis has stabilized.',
      trapAvoided:
        'Do not assume normalization of pressure means no optic-nerve injury occurred.',
    },
  ],
  differentialDistinguishers: [
    {
      id: 'anterior-uveitis-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Anterior Uveitis',
      content:
        'Both disorders can cause a painful photophobic red eye with reduced vision, but anterior uveitis usually produces anterior-chamber cells and flare with a small or irregular pupil.',
      whyItMatters:
        'Distinguishing inflammation from primary pupillary-block closure changes the immediate treatment strategy and avoids worsening an unrecognized pressure crisis.',
      discriminator:
        'Inflammatory cells and miosis rather than a steamy cornea, mid-dilated pupil, shallow chamber, very high pressure, and gonioscopic closure.',
      managementImplication:
        'Measure pressure and examine the angle before treating the presentation as isolated uveitis.',
      trapAvoided:
        'Assuming photophobia and ciliary injection automatically mean uveitis.',
    },
    {
      id: 'keratitis-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Keratitis',
      content:
        'Both can cause severe ocular pain, photophobia, corneal haze, and reduced vision, but keratitis more often has a focal epithelial defect, infiltrate, ulcer, or contact-lens risk.',
      whyItMatters:
        'Missing infectious keratitis threatens the cornea, whereas missing angle closure threatens the optic nerve; the examination must separate the mechanisms quickly.',
      discriminator:
        'Fluorescein-positive epithelial disease or stromal infiltrate rather than diffuse pressure-related oedema with a shallow closed angle.',
      managementImplication:
        'Perform fluorescein examination and assess pressure when safe, then escalate to the correct emergency pathway.',
      trapAvoided:
        'Calling all corneal haze infection or all painful red eyes glaucoma.',
    },
    {
      id: 'conjunctivitis-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Acute Conjunctivitis',
      content:
        'Both can present with a red eye, but conjunctivitis usually causes discharge, itch or grittiness, preserved visual acuity, a clear cornea, and a normal reactive pupil.',
      whyItMatters:
        'Mislabeling angle closure as conjunctivitis delays pressure reduction and definitive treatment, increasing the risk of permanent visual loss.',
      discriminator:
        'Painful visual loss with corneal oedema and an abnormal pupil rather than surface irritation with preserved vision.',
      managementImplication:
        'Check vision, pupil, cornea, chamber depth, and pressure before diagnosing conjunctivitis in a painful eye.',
      trapAvoided:
        'Treating redness alone without assessing visual function.',
    },
    {
      id: 'scleritis-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Scleritis',
      content:
        'Both can cause severe deep ocular pain and redness, but scleritis produces deep scleral tenderness and vascular inflammation without the characteristic shallow chamber and closed angle.',
      whyItMatters:
        'Scleritis may signal systemic inflammatory disease, while acute angle closure requires immediate pressure reduction and angle treatment.',
      discriminator:
        'Tender non-blanching deep scleral inflammation rather than corneal oedema, mid-dilated pupil, and marked ocular hypertension.',
      managementImplication:
        'Assess the cornea, pupil, pressure, and angle rather than relying on pain severity alone.',
      trapAvoided:
        'Assuming every deeply painful red eye has the same mechanism.',
    },
    {
      id: 'orbital-cellulitis-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Orbital Cellulitis',
      content:
        'Both may cause ocular pain, redness, headache, and reduced vision, but orbital cellulitis more often causes fever, proptosis, painful restricted eye movements, and post-septal imaging abnormalities.',
      whyItMatters:
        'Orbital infection requires systemic antimicrobial and surgical assessment, while angle closure requires an ocular pressure pathway.',
      discriminator:
        'Proptosis and ophthalmoplegia rather than a steamy cornea, mid-dilated pupil, shallow chamber, and closed angle.',
      managementImplication:
        'Escalate for orbital imaging and antimicrobial treatment when orbital signs are present.',
      trapAvoided:
        'Using redness and pain alone to distinguish orbital infection from an anterior-segment emergency.',
    },
    {
      id: 'optic-neuritis-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Optic Neuritis',
      content:
        'Both can cause acute monocular visual loss and pain, but optic neuritis more often causes pain with eye movement, dyschromatopsia, and an afferent pupillary defect with a relatively quiet anterior segment.',
      whyItMatters:
        'The distinction redirects evaluation from the iridocorneal angle to the optic nerve and neurological causes.',
      discriminator:
        'Optic-nerve dysfunction without corneal oedema or severe ocular hypertension rather than a congested closed-angle anterior segment.',
      managementImplication:
        'Examine colour vision, afferent pupillary function, the anterior segment, pressure, and angle before localizing the lesion.',
      trapAvoided:
        'Assuming all painful monocular visual loss arises from the optic nerve.',
    },
  ],
  managementOverview: [
    {
      id: 'emergency-ophthalmology-iop-lowering',
      type: 'MANAGEMENT',
      title: 'Begin emergency pressure reduction',
      content:
        'Arrange immediate ophthalmology involvement and start pressure-lowering treatment when acute angle closure is suspected and globe rupture has been excluded.',
      whyItMatters:
        'Rapid pressure reduction relieves pain, improves corneal clarity, restores iris perfusion, and limits optic-nerve injury while definitive treatment is arranged.',
      managementImplication:
        'Use appropriate topical aqueous suppressants and systemic carbonic-anhydrase inhibition, adjusted for contraindications and systemic comorbidity.',
      escalationImplication:
        'Persistent severe pressure or worsening vision requires urgent escalation and additional pressure-lowering measures.',
      trapAvoided:
        'Do not wait for every test result before initiating emergency treatment.',
    },
    {
      id: 'hyperosmotic-escalation',
      type: 'MANAGEMENT',
      title: 'Escalate refractory severe pressure',
      content:
        'Consider a systemic hyperosmotic agent when intraocular pressure remains dangerously high despite initial therapy and no major contraindication is present.',
      whyItMatters:
        'Rapid osmotic reduction of ocular volume can lower pressure when conventional measures are insufficient.',
      managementImplication:
        'Assess renal, cardiac, and volume status and monitor for systemic adverse effects.',
      escalationImplication:
        'Failure of medical therapy requires urgent procedural management by ophthalmology.',
      trapAvoided:
        'Do not use hyperosmotic therapy without considering systemic risk.',
    },
    {
      id: 'miotic-timing',
      type: 'MANAGEMENT',
      title: 'Use a miotic at the appropriate stage',
      content:
        'Use pilocarpine for a confirmed pupillary-block mechanism after intraocular pressure begins to fall and iris sphincter perfusion is likely to improve.',
      whyItMatters:
        'At very high pressure the ischaemic sphincter may not respond, so repeated early dosing adds delay without reliably opening the angle.',
      managementImplication:
        'Treat the pressure first, then use the miotic as part of preparation for definitive iridotomy when appropriate.',
      escalationImplication:
        'An ineffective pupil response should prompt reassessment of pressure and the closure mechanism rather than repeated dosing alone.',
      trapAvoided:
        'Do not rely on immediate pilocarpine as the sole first intervention at extreme pressure.',
    },
    {
      id: 'laser-peripheral-iridotomy',
      type: 'MANAGEMENT',
      title: 'Relieve primary pupillary block definitively',
      content:
        'Perform laser peripheral iridotomy when the cornea has cleared sufficiently and primary pupillary block is the confirmed or strongly suspected mechanism.',
      whyItMatters:
        'The iridotomy creates an alternative pathway for aqueous flow, equalizes pressure across the iris, and relieves iris bombe.',
      managementImplication:
        'Confirm patency and reassess the angle and pressure after the procedure.',
      escalationImplication:
        'Persistent closure after a patent iridotomy suggests plateau iris, lens crowding, synechial closure, or another secondary mechanism requiring additional treatment.',
      trapAvoided:
        'Do not regard a pressure-lowered eye as definitively treated without relieving the block.',
    },
    {
      id: 'fellow-eye-prevention',
      type: 'MANAGEMENT',
      title: 'Protect the fellow eye',
      content:
        'Assess the fellow eye urgently and offer preventive laser peripheral iridotomy when it has an occludable angle or shares a pupillary-block risk pattern.',
      whyItMatters:
        'The anatomical predisposition is often bilateral even though only one eye is symptomatic.',
      managementImplication:
        'Include fellow-eye gonioscopy and a prevention plan before discharge from specialist care.',
      escalationImplication:
        'Untreated fellow-eye anatomy can lead to a second acute attack.',
      trapAvoided:
        'Do not focus only on the presenting eye.',
    },
    {
      id: 'mechanism-specific-follow-up',
      type: 'MANAGEMENT',
      title: 'Reassess mechanism and damage',
      content:
        'After the acute crisis, investigate persistent closure, elevated pressure, or recurrent symptoms for lens crowding, plateau iris, synechiae, neovascularization, inflammation, or drug-induced ciliochoroidal effusion.',
      whyItMatters:
        'Iridotomy corrects pupillary block but does not resolve every cause of angle closure or established glaucomatous damage.',
      managementImplication:
        'Plan lens extraction, iridoplasty, glaucoma procedures, or treatment of the secondary cause when indicated, and assess the optic nerve and visual field.',
      escalationImplication:
        'Persistent pressure or progressive structural damage requires long-term glaucoma management.',
      trapAvoided:
        'Do not assume a patent iridotomy ends follow-up.',
    },
  ],
  complications: [
    'Permanent visual loss',
    'Glaucomatous optic neuropathy',
    'Peripheral anterior synechiae',
    'Chronic angle-closure glaucoma',
    'Corneal endothelial damage and persistent oedema',
    'Iris sphincter atrophy and a persistently abnormal pupil',
    'Recurrent acute attacks',
    'A preventable fellow-eye attack',
  ],
  pitfalls: [
    {
      id: 'headache-vomiting-misdirection',
      type: 'PITFALL',
      title: 'Following the systemic symptoms away from the eye',
      content:
        'Headache, nausea, and vomiting can falsely redirect assessment toward migraine or gastrointestinal disease before the painful red eye is examined.',
      whyItMatters:
        'That delay prolongs extreme intraocular pressure and increases the risk of irreversible visual loss.',
      trapAvoided:
        'In acute headache or vomiting with ocular pain or visual symptoms, document vision, pupils, cornea, and eye pressure urgently.',
    },
    {
      id: 'conjunctivitis-mislabel',
      type: 'PITFALL',
      title: 'Calling every red eye conjunctivitis',
      content:
        'Diffuse diagnostic labeling can miss an early pressure crisis when reduced vision, corneal haze, severe pain, or an abnormal pupil is present.',
      whyItMatters:
        'Topical conjunctivitis treatment does not relieve angle obstruction and delays definitive care.',
      trapAvoided:
        'A painful red eye with impaired vision or an abnormal cornea or pupil is not simple conjunctivitis until dangerous causes are excluded.',
    },
    {
      id: 'tonometry-alone',
      type: 'PITFALL',
      title: 'Using pressure alone as the diagnosis',
      content:
        'A high intraocular pressure can be over-interpreted without confirming whether the angle is closed or identifying the closure mechanism.',
      whyItMatters:
        'Open-angle ocular hypertension and several secondary glaucomas require different definitive pathways.',
      trapAvoided:
        'Pair tonometry with slit-lamp assessment and gonioscopy when safe and possible.',
    },
    {
      id: 'early-miotic-overreliance',
      type: 'PITFALL',
      title: 'Repeating a miotic before iris perfusion improves',
      content:
        'At extreme pressure the ischaemic iris sphincter may respond poorly, so early repeated pilocarpine can delay effective pressure reduction.',
      whyItMatters:
        'The pupil may remain fixed while optic-nerve and corneal injury continue.',
      trapAvoided:
        'Lower pressure first, then use a miotic when appropriate for a confirmed pupillary-block mechanism.',
    },
    {
      id: 'secondary-mechanism-missed',
      type: 'PITFALL',
      title: 'Assuming all closure is primary pupillary block',
      content:
        'Neovascularization, uveitis, lens-related crowding, plateau iris, aqueous misdirection, or drug-induced effusion can be missed if the angle and context are not reassessed.',
      whyItMatters:
        'A patent iridotomy may not resolve a non-pupillary-block mechanism, allowing pressure and closure to persist.',
      trapAvoided:
        'Use gonioscopy and mechanism-focused imaging or history to identify secondary causes.',
    },
    {
      id: 'fellow-eye-ignored',
      type: 'PITFALL',
      title: 'Ignoring the fellow eye',
      content:
        'The asymptomatic fellow eye can appear reassuring despite sharing the same occludable anatomy.',
      whyItMatters:
        'Without preventive assessment and treatment, a second acute attack may occur.',
      trapAvoided:
        'Include the fellow angle in the emergency and definitive treatment plan.',
    },
    {
      id: 'pressure-normalization-cure',
      type: 'PITFALL',
      title: 'Treating pressure normalization as cure',
      content:
        'A normal pressure after initial treatment can falsely reassure before pupillary block is relieved or optic-nerve damage is assessed.',
      whyItMatters:
        'The angle may reclose, synechiae may persist, and established glaucomatous injury may remain.',
      trapAvoided:
        'Complete definitive mechanism treatment and arrange structural, functional, and pressure follow-up.',
    },
  ],
  recallPrompts: [
    {
      id: 'why-steamy-cornea',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why does a steamy cornea with coloured halos increase suspicion for an acute intraocular-pressure crisis?',
      answer:
        'Marked pressure impairs corneal endothelial fluid transport, producing oedema that scatters light and reduces vision.',
      explanation:
        'The mechanism links an objective corneal sign to the visual symptom and distinguishes pressure-related haze from uncomplicated conjunctivitis.',
      linkedConcept: 'pressure-related corneal oedema',
      sourceSection: 'examPearls',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'pupil-discriminator',
      type: 'DISTINGUISH',
      prompt:
        'How does the pupil help distinguish acute angle closure from anterior uveitis?',
      answer:
        'Acute angle closure commonly produces a mid-dilated poorly reactive pupil, whereas anterior uveitis more often causes a small or irregular pupil.',
      explanation:
        'This distinction indicates iris sphincter ischaemia from severe pressure rather than inflammatory miosis and posterior synechiae.',
      linkedConcept: 'pupil mechanism',
      sourceSection: 'keySigns',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'gonioscopy-why',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why is gonioscopy required even when the pressure is very high and the anterior chamber appears shallow?',
      answer:
        'It directly confirms iridotrabecular contact and identifies appositional, synechial, primary, or secondary closure.',
      explanation:
        'Pressure and chamber depth raise suspicion, but direct angle examination confirms the anatomical diagnosis and distinguishes the definitive treatment pathway.',
      linkedConcept: 'angle anatomy',
      sourceSection: 'investigations',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'miotic-timing-trap',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why may pilocarpine be ineffective when intraocular pressure is still extremely high?',
      answer:
        'The iris sphincter may be ischaemic and unable to constrict until pressure and perfusion improve.',
      explanation:
        'This interpretation indicates when repeated dosing is unlikely to work and prevents delay in pressure reduction and definitive care.',
      linkedConcept: 'iris sphincter ischaemia',
      sourceSection: 'management',
      difficulty: 'ADVANCED',
    },
    {
      id: 'fellow-eye-next-step',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why must the fellow eye be examined and often treated after a unilateral acute attack?',
      answer:
        'The anatomical predisposition is commonly bilateral, so the fellow eye may have an occludable angle despite having no symptoms.',
      explanation:
        'The bilateral anatomical pattern indicates ongoing contralateral risk; preventive assessment and iridotomy can avoid another sight-threatening pressure crisis.',
      linkedConcept: 'bilateral anatomical risk',
      sourceSection: 'management',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'pressure-not-definitive',
      type: 'DISTINGUISH',
      prompt:
        'What distinguishes temporary pressure control from definitive treatment of primary pupillary-block angle closure?',
      answer:
        'Medical therapy lowers pressure temporarily; laser peripheral iridotomy relieves the block by creating an alternative path for aqueous flow.',
      explanation:
        'The distinction confirms that pressure normalization is temporary control rather than correction of the underlying mechanism.',
      linkedConcept: 'definitive pupillary-block treatment',
      sourceSection: 'pitfalls',
      difficulty: 'INTERMEDIATE',
    },
  ],
  references: [
    'Royal College of Ophthalmologists. The Management of Angle-Closure Glaucoma Clinical Guideline.',
    'American Academy of Ophthalmology EyeWiki. Primary versus Secondary Angle-Closure Glaucoma.',
    'American Academy of Ophthalmology EyeWiki. Laser Peripheral Iridotomy.',
  ],
};


function requireString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Education quality failure: ${label} is missing.`);
  }
}

function requireObjectArray(
  value: unknown,
  label: string,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Education quality failure: ${label} must be a non-empty array.`,
    );
  }

  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(
        `Education quality failure: ${label}[${index}] must be a structured object.`,
      );
    }

    return item as Record<string, unknown>;
  });
}

function assertWardleEducationQuality(): void {
  const signs = requireObjectArray(educationForFrontend.keySigns, 'keySigns');
  signs.forEach((sign, index) => {
    requireString(sign.finding, `keySigns[${index}].finding`);
    requireString(sign.description, `keySigns[${index}].description`);
    requireString(sign.whyItMatters, `keySigns[${index}].whyItMatters`);
    requireString(sign.diagnosticImpact, `keySigns[${index}].diagnosticImpact`);
    requireString(sign.discriminator, `keySigns[${index}].discriminator`);
    requireString(sign.trapAvoided, `keySigns[${index}].trapAvoided`);
  });

  const typedSections = [
    ['examPearls', educationForFrontend.examPearls],
    ['investigations', educationForFrontend.investigations],
    [
      'differentialDistinguishers',
      educationForFrontend.differentialDistinguishers,
    ],
    ['managementOverview', educationForFrontend.managementOverview],
    ['pitfalls', educationForFrontend.pitfalls],
  ] as const;

  typedSections.forEach(([sectionName, value]) => {
    requireObjectArray(value, sectionName).forEach((item, index) => {
      requireString(item.id, `${sectionName}[${index}].id`);
      requireString(item.type, `${sectionName}[${index}].type`);
      requireString(item.title, `${sectionName}[${index}].title`);
      requireString(item.content, `${sectionName}[${index}].content`);
      requireString(
        item.whyItMatters,
        `${sectionName}[${index}].whyItMatters`,
      );
    });
  });

  requireObjectArray(educationForFrontend.examPearls, 'examPearls').forEach(
    (item, index) => {
      requireString(item.discriminator, `examPearls[${index}].discriminator`);
      if (
        !/\b(?:because|due to|reflects|indicates|produces|mechanism)\b/i.test(
          String(item.content),
        )
      ) {
        throw new Error(
          `Education quality failure: examPearls[${index}] does not explain a mechanism.`,
        );
      }
    },
  );

  requireObjectArray(
    educationForFrontend.investigations,
    'investigations',
  ).forEach((item, index) => {
    requireString(
      item.managementImplication,
      `investigations[${index}].managementImplication`,
    );
  });

  requireObjectArray(
    educationForFrontend.differentialDistinguishers,
    'differentialDistinguishers',
  ).forEach((item, index) => {
    requireString(
      item.discriminator,
      `differentialDistinguishers[${index}].discriminator`,
    );
    requireString(
      item.managementImplication,
      `differentialDistinguishers[${index}].managementImplication`,
    );
    requireString(
      item.trapAvoided,
      `differentialDistinguishers[${index}].trapAvoided`,
    );
  });

  requireObjectArray(
    educationForFrontend.managementOverview,
    'managementOverview',
  ).forEach((item, index) => {
    requireString(
      item.managementImplication,
      `managementOverview[${index}].managementImplication`,
    );
    requireString(
      item.escalationImplication,
      `managementOverview[${index}].escalationImplication`,
    );
    requireString(
      item.trapAvoided,
      `managementOverview[${index}].trapAvoided`,
    );
  });

  requireObjectArray(educationForFrontend.pitfalls, 'pitfalls').forEach(
    (item, index) => {
      requireString(item.trapAvoided, `pitfalls[${index}].trapAvoided`);
    },
  );

  const recallPrompts = requireObjectArray(
    educationForFrontend.recallPrompts,
    'recallPrompts',
  );
  const allowedRecallTypes = new Set([
    'CLOZE',
    'SHORT_ANSWER',
    'DISTINGUISH',
    'PEARL_RECALL',
    'WHY_IT_MATTERS',
  ]);

  recallPrompts.forEach((prompt, index) => {
    requireString(prompt.id, `recallPrompts[${index}].id`);
    requireString(prompt.type, `recallPrompts[${index}].type`);
    requireString(prompt.prompt, `recallPrompts[${index}].prompt`);
    requireString(prompt.answer, `recallPrompts[${index}].answer`);
    requireString(prompt.explanation, `recallPrompts[${index}].explanation`);
    requireString(prompt.linkedConcept, `recallPrompts[${index}].linkedConcept`);
    requireString(prompt.sourceSection, `recallPrompts[${index}].sourceSection`);
    requireString(prompt.difficulty, `recallPrompts[${index}].difficulty`);

    if (!allowedRecallTypes.has(String(prompt.type))) {
      throw new Error(
        `Education quality failure: unsupported recall type at index ${index}.`,
      );
    }
  });

  const educationText = normalizeClinicalText(JSON.stringify(educationForFrontend));
  const caseSpecificTerms = [
    '64 year old',
    'watching a film',
    'four hours ago',
    'two episodes of vomiting',
    '6 60',
    '52 mmhg',
    'more than 270 degrees',
    'this patient',
    'this case',
  ];

  for (const term of caseSpecificTerms) {
    if (educationText.includes(normalizeClinicalText(term))) {
      throw new Error(
        `Education quality failure: case-specific wording remains: ${term}.`,
      );
    }
  }
}

function desiredColumnData() {
  return {
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
  };
}

function educationMatches(
  education: Record<string, unknown>,
): boolean {
  const desired = desiredColumnData();

  return Object.entries(desired).every(
    ([key, value]) => stableJson(education[key]) === stableJson(value),
  );
}

async function findRegistry() {
  const exact = await prisma.diagnosisRegistry.findMany({
    where: { canonicalNormalized },
    select: {
      id: true,
      canonicalName: true,
      canonicalNormalized: true,
      displayLabel: true,
    },
  });

  if (exact.length > 1) {
    throw new Error(
      `Multiple exact ${displayLabel} registry rows were found. Repair aborted.`,
    );
  }

  if (exact.length === 1) return exact[0];

  const aliases = await prisma.diagnosisRegistry.findMany({
    where: {
      aliases: {
        some: {
          normalizedTerm: canonicalNormalized,
          active: true,
          acceptedForMatch: true,
        },
      },
    },
    select: {
      id: true,
      canonicalName: true,
      canonicalNormalized: true,
      displayLabel: true,
    },
  });

  if (aliases.length !== 1) {
    throw new Error(
      `Expected one ${displayLabel} registry row but found ${aliases.length}. Run the flagship seed first if the registry does not yet exist.`,
    );
  }

  return aliases[0];
}

async function findEducation(diagnosisRegistryId: string) {
  return prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: {
      id: true,
      diagnosisRegistryId: true,
      title: true,
      summary: true,
      clinicalPattern: true,
      keySymptoms: true,
      keySigns: true,
      examPearls: true,
      scoringSystems: true,
      investigations: true,
      differentials: true,
      management: true,
      complications: true,
      pitfalls: true,
      recallPrompts: true,
      references: true,
      editorialStatus: true,
      source: true,
      reviewedAt: true,
      publishedAt: true,
      version: true,
    },
  });
}

function revisionSnapshot() {
  return {
    ...educationForFrontend,
    repairMetadata: {
      repairVersion,
      repairedAt: now.toISOString(),
      keySignsMechanismsExplained: true,
      typedPearlContractApplied: true,
      playableCaseChanged: false,
      caseSchedulingChanged: false,
      diagnosisRegistryChanged: false,
    },
    storedColumnMap: {
      recognitionPattern: 'clinicalPattern',
      managementOverview: 'management',
      differentialDistinguishers: 'differentials',
    },
  };
}

async function repairEducation() {
  assertWardleEducationQuality();

  const registry = await findRegistry();
  const existing = await findEducation(registry.id);
  const desired = desiredColumnData();

  if (existing && educationMatches(existing as unknown as Record<string, unknown>)) {
    console.log('Acute angle-closure glaucoma education is already repaired.', {
      registryId: registry.id,
      educationId: existing.id,
      version: existing.version,
      repairVersion,
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (!existing) {
      const created = await tx.diagnosisEducation.create({
        data: {
          diagnosisRegistryId: registry.id,
          ...desired,
          editorialStatus: DiagnosisEducationStatus.PUBLISHED,
          source: DiagnosisEducationSource.MANUAL,
          reviewedAt: now,
          publishedAt: now,
          version: 1,
        },
        select: {
          id: true,
          version: true,
          editorialStatus: true,
          source: true,
        },
      });

      const revision = await tx.diagnosisEducationRevision.create({
        data: {
          educationId: created.id,
          version: created.version,
          snapshot: revisionSnapshot() as object,
          editorialStatus: created.editorialStatus,
          source: created.source,
        },
        select: { id: true },
      });

      return {
        action: 'created',
        educationId: created.id,
        educationVersion: created.version,
        educationRevisionId: revision.id,
      };
    }

    const updated = await tx.diagnosisEducation.update({
      where: { id: existing.id },
      data: {
        ...desired,
        reviewedAt: now,
        version: { increment: 1 },
      },
      select: {
        id: true,
        version: true,
        editorialStatus: true,
        source: true,
      },
    });

    const revision = await tx.diagnosisEducationRevision.create({
      data: {
        educationId: updated.id,
        version: updated.version,
        snapshot: revisionSnapshot() as object,
        editorialStatus:
          updated.editorialStatus ?? DiagnosisEducationStatus.PUBLISHED,
        source: updated.source ?? DiagnosisEducationSource.MANUAL,
      },
      select: { id: true },
    });

    return {
      action: 'updated',
      educationId: updated.id,
      educationVersion: updated.version,
      educationRevisionId: revision.id,
    };
  });

  console.log('Acute angle-closure glaucoma education repair completed.', {
    registryId: registry.id,
    registryLabel: registry.displayLabel,
    repairVersion,
    ...result,
    repairedSections: [
      'summary',
      'clinicalPattern',
      'keySymptoms',
      'keySigns',
      'examPearls',
      'scoringSystems',
      'investigations',
      'differentials',
      'management',
      'complications',
      'pitfalls',
      'recallPrompts',
      'references',
    ],
    preserved: [
      'case',
      'clues',
      'case date',
      'public number',
      'diagnosis mapping',
      'DailyCase scheduling',
    ],
  });
}

repairEducation()
  .catch((error) => {
    console.error('Acute angle-closure glaucoma education repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
