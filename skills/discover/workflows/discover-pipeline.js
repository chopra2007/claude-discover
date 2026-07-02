export const meta = {
  name: 'discover-pipeline',
  description: 'discover Passes 0-4: map, research, filter, kill-test, plan',
  phases: [
    { title: 'Bootstrap', detail: 'load prior artifacts + user edits from disk' },
    { title: 'Pass 0 - Map', detail: 'parallel mappers + architect merge' },
    { title: 'Pass 1 - Research', detail: 'bounded rounds with dry-stop' },
    { title: 'Pass 2 - Filter', detail: 'redundancy gate + ranking + cut' },
    { title: 'Pass 3 - Kill-test', detail: 'evidence-rule skeptic panel' },
    { title: 'Pass 4 - Plan', detail: 'stance tournament + judge + coherence' },
  ],
}

const A = args
const DIALS = {
  light:    { mappers: 2, researchers: 2, roundCap: 2, dryStop: 1, p3cap: 3, skeptics: 2, rivals: 1, crossModel: false, breaker: 900_000,   passEst: { 0: 120_000, 1: 200_000, 2: 150_000, 3: 200_000, 4: 200_000 } },
  standard: { mappers: 3, researchers: 3, roundCap: 3, dryStop: 1, p3cap: 5, skeptics: 3, rivals: 2, crossModel: true,  breaker: 2_500_000, passEst: { 0: 300_000, 1: 500_000, 2: 400_000, 3: 600_000, 4: 600_000 } },
  deep:     { mappers: 5, researchers: 4, roundCap: 5, dryStop: 2, p3cap: 7, skeptics: 5, rivals: 3, crossModel: true,  breaker: 6_000_000, passEst: { 0: 600_000, 1: 1_200_000, 2: 800_000, 3: 1_600_000, 4: 1_600_000 } },
} // token figures = CALIBRATE placeholders; replaced from journal data in Task 12
const DIAL = DIALS[A.dial]
const P4CAP = 3 // fixed on every dial (spec §5 Pass 4)

const LENSES = [ // order matters: light uses first 2, standard first 3, deep all 5 (spec §5 Pass 3.1)
  { key: 'code-reality',      anchor: 'Read the actual target modules and integration points named in the system map. A kill from this lens must quote file:line proving the hook point does not exist as the idea assumes.' },
  { key: 'data-api',          anchor: 'Probe the data source or API for real (curl/CLI/read the client code). A kill must show the actual probe output proving the data is unavailable, paywalled, or rate-limited beyond use.' },
  { key: 'maintenance',       anchor: 'Read the repo size, test setup, and this user\'s constraints from the system map. A kill must ground in specifics of THIS repo, not generic burden claims.' },
  { key: 'security-tos',      anchor: 'Check terms of service / auth / scraping reality of the sources involved (fetch the ToS or docs). A kill must cite the fetched text.' },
  { key: 'evidence-quality',  anchor: 'Re-check the Pass-1 provenance of the idea: open the cited sources. A kill must show the source does not support the claimed benefit.' },
]
const FATAL_CLASSES = ['infeasible', 'redundant-verified-in-code', 'unsafeguardable', 'hard-constraint-violation']
const PROBE_REASONS = ['missing_credential', 'forward_data', 'destructive_or_costly', 'no_runtime_surface', 'environment_absent']
const DROP_CODES = ['already-exists-verified', 'below-cut', 'kill-upheld', 'dry-round-dedup', 'user-dropped', 'infeasible-early']
const PLAN_SECTIONS = ['System Overview', 'Component Architecture', 'Data Flow Pipeline', 'Data Structures', 'Integration Plan', 'Failure Handling', 'Feature Activation Plan', 'Verification Checklist']

const S_ACK = { type: 'object', required: ['path', 'summary'], properties: { path: { type: 'string' }, summary: { type: 'string' } } }
const S_BOOT = { type: 'object', required: ['found', 'artifacts', 'user_edits'], properties: {
  found: { type: 'boolean' },
  artifacts: { type: 'object', properties: { map: { type: 'string' }, candidates: { type: 'string' }, filtered: { type: 'string' }, kill_report: { type: 'string' }, drops: { type: 'string' }, outcomes_prior: { type: 'string' } }, description: 'full text content of each artifact file that exists, keyed as named' },
  user_edits: { type: 'string', description: 'verbatim content of checkpoint-edits.md if present, else empty' } } }
const CAND = { type: 'object', required: ['id', 'name', 'function', 'rationale', 'source_quality'], properties: {
  id: { type: 'string' }, name: { type: 'string' }, function: { type: 'string' }, rationale: { type: 'string' },
  source_quality: { type: 'string', enum: ['high', 'medium', 'low'] }, sources: { type: 'array', items: { type: 'string' } } } }
const S_MAP = { type: 'object', required: ['components', 'data_sources', 'gaps', 'unverified'], properties: {
  components: { type: 'array', items: { type: 'object', required: ['name', 'path', 'does'], properties: { name: { type: 'string' }, path: { type: 'string' }, does: { type: 'string' } } } },
  data_sources: { type: 'array', items: { type: 'string' } }, gaps: { type: 'array', items: { type: 'string' } },
  unverified: { type: 'array', items: { type: 'string' }, description: 'anything inferred from naming, not read' } } }
const S_CAND = { type: 'object', required: ['candidates'], properties: { candidates: { type: 'array', items: CAND } } }
const S_DRY = { type: 'object', required: ['new_candidates', 'dry'], properties: { new_candidates: { type: 'array', items: CAND }, dry: { type: 'boolean' } } }
const S_RED = { type: 'object', required: ['verdict', 'evidence'], properties: {
  verdict: { type: 'string', enum: ['exists-fully', 'exists-partially', 'stub', 'not-found'] },
  evidence: { type: 'string', description: 'file path + line numbers + quoted snippet actually read' },
  extend_note: { type: 'string', description: 'when exists-partially: what to extend' } } }
const S_FILTER = { type: 'object', required: ['kept', 'drops'], properties: {
  kept: { type: 'array', items: { type: 'object', required: ['id', 'name', 'rank', 'failure_modes', 'safeguards', 'prior_outcome'], properties: { id: { type: 'string' }, name: { type: 'string' }, rank: { type: 'number' }, failure_modes: { type: 'array', items: { type: 'string' } }, safeguards: { type: 'array', items: { type: 'string' } }, prior_outcome: { type: 'string', description: 'from outcome read-back, or empty' } } } },
  drops: { type: 'array', items: { type: 'object', required: ['id', 'name', 'code', 'reason', 'evidence'], properties: { id: { type: 'string' }, name: { type: 'string' }, code: { type: 'string', enum: DROP_CODES }, reason: { type: 'string' }, evidence: { type: 'string' } } } } } }
const OBJ = { type: 'object', required: ['candidate_id', 'lens', 'kind', 'trigger', 'mechanism', 'impact', 'evidence', 'fatal_class'], properties: {
  candidate_id: { type: 'string' }, lens: { type: 'string' },
  kind: { type: 'string', enum: ['kill-eligible', 'concern'] },
  trigger: { type: 'string' }, mechanism: { type: 'string' }, impact: { type: 'string' },
  evidence: { type: 'string', description: 'REQUIRED artifact inspected THIS run: file:line / command + output / fetched URL / map entry. Empty or generic => auto-downgrade to concern.' },
  fatal_class: { type: 'string', enum: [...FATAL_CLASSES, 'none'] } } }
const S_SKEPTIC = { type: 'object', required: ['objections', 'endorsements'], properties: { objections: { type: 'array', items: OBJ }, endorsements: { type: 'array', items: { type: 'string' }, description: 'candidate_ids with no objection from this lens' } } }
const S_DEFENSE = { type: 'object', required: ['rulings'], properties: { rulings: { type: 'array', items: { type: 'object', required: ['candidate_id', 'objection_ref', 'ruling', 'reason', 'evidence_recheck'], properties: { candidate_id: { type: 'string' }, objection_ref: { type: 'string' }, ruling: { type: 'string', enum: ['UPHELD', 'CONVERTED', 'REJECTED'] }, reason: { type: 'string' }, evidence_recheck: { type: 'string', description: 'what the judge saw when it re-opened the cited evidence' } } } } } }
const S_XMODEL = { type: 'object', required: ['family', 'available', 'notes'], properties: { family: { type: 'string' }, available: { type: 'boolean' }, notes: { type: 'array', items: { type: 'object', required: ['candidate_id', 'stance', 'note'], properties: { candidate_id: { type: 'string' }, stance: { type: 'string', enum: ['endorse', 'dissent', 'dispute-kill'] }, note: { type: 'string' } } } } } }
const S_KILL = { type: 'object', required: ['survivors', 'kills'], properties: {
  survivors: { type: 'array', items: { type: 'object', required: ['id', 'name', 'demerits', 'safeguards', 'near_miss', 'cross_family'], properties: { id: { type: 'string' }, name: { type: 'string' }, demerits: { type: 'number' }, safeguards: { type: 'array', items: { type: 'string' } }, near_miss: { type: 'string', description: 'strongest objection raised and how it was resolved' }, cross_family: { type: 'string' } } } },
  kills: { type: 'array', items: { type: 'object', required: ['id', 'name', 'objection', 'evidence', 'rebuttal', 'judge_reason', 'disputed_by'], properties: { id: { type: 'string' }, name: { type: 'string' }, objection: { type: 'string' }, evidence: { type: 'string' }, rebuttal: { type: 'string' }, judge_reason: { type: 'string' }, disputed_by: { type: 'string', description: 'cross-model family disputing this kill, or empty' } } } } } }
const S_APPROACHES = { type: 'object', required: ['distinct_architectures'], properties: { distinct_architectures: { type: 'number' }, notes: { type: 'string' } } }
const S_PLAN = { type: 'object', required: ['stance', 'sections', 'features'], properties: {
  stance: { type: 'string' },
  sections: { type: 'object', required: PLAN_SECTIONS.map(s => s), properties: Object.fromEntries(PLAN_SECTIONS.map(s => [s, { type: 'string' }])) },
  features: { type: 'array', items: { type: 'object', required: ['name', 'probe'], properties: { name: { type: 'string' }, probe: { type: 'object', required: ['kind'], properties: { kind: { type: 'string', enum: ['live_probe', 'deferred_probe'] }, instruction: { type: 'string' }, expected_evidence: { type: 'string' }, reason: { type: 'string', enum: [...PROBE_REASONS, ''] }, owed_check: { type: 'string' } } } } } } } }
const S_JUDGE = { type: 'object', required: ['winner_stance', 'scores', 'grounded_findings', 'graft_list', 'revision_order'], properties: {
  winner_stance: { type: 'string' },
  scores: { type: 'array', items: { type: 'object', required: ['stance', 'score', 'reason'], properties: { stance: { type: 'string' }, score: { type: 'number' }, reason: { type: 'string' } } } },
  grounded_findings: { type: 'string', description: 'what the judge found when grepping each plan\'s claimed integration points against real code' },
  graft_list: { type: 'array', items: { type: 'object', required: ['from_stance', 'target_section', 'item'], properties: { from_stance: { type: 'string' }, target_section: { type: 'string', enum: ['Failure Handling', 'Feature Activation Plan', 'Verification Checklist', 'tests', 'risk-callouts'] }, item: { type: 'string' } } } },
  revision_order: { type: 'string', description: 'ONE bounded structural revision instruction, or empty' } } }
const S_COHERE = { type: 'object', required: ['coherent', 'fixes_applied'], properties: { coherent: { type: 'boolean' }, fixes_applied: { type: 'array', items: { type: 'string' } } } }
const PRE = `You are part of the "discover" feature-discovery pipeline, run ${A.name}, working on the project at ${A.project_root}.
The feature ask: ${A.feature_ask}
Run directory for artifacts: ${A.run_dir}
EVIDENCE RULES (non-negotiable): Read actual source before claiming anything about the code - NEVER infer functionality from filenames (a stub file is a gap, not a feature). Free/public data only${A.free_data_only ? '' : ' EXCEPT the user has allowed paid sources'}; no fragile scraping or ToS violations. Cite what you inspected (file:line, command + output, URL). Your final structured output is consumed by a program - be precise, no padding.`

const spent0 = budget.spent()
const used = () => budget.spent() - spent0
const BREAKER = A.budget_override || DIAL.breaker
const gate = passNo => used() + DIAL.passEst[passNo] * 1.1 <= BREAKER

const RUNSTATE = { artifacts: [], counts: { candidates: 0, drops: 0, kills: 0, survivors: 0 }, decisions: [] }

async function synth(passTitle, fileName, bodySpec, phase) {
  const r = await agent(`${PRE}
You are the ${passTitle} synthesizer. Write the artifact file ${A.run_dir}/${fileName} (create/overwrite) with the content described below, formatted as clean human-readable markdown with plain-language section intros (the plugin author is not a coder). Then return {path, summary} where summary is 2-4 plain sentences.
CONTENT SPEC:
${bodySpec}`, { label: `synth:${fileName}`, phase, schema: S_ACK })
  if (r && r.path) RUNSTATE.artifacts.push(r.path)
  return r
}

async function appendDrops(drops, phase) {
  if (!drops.length) return
  RUNSTATE.counts.drops += drops.length
  await agent(`${PRE}
APPEND (never overwrite; create if missing) to ${A.run_dir}/drops-log.md one markdown bullet per item below, format: "- **<name>** [<stage> / <code>] <reason> - evidence: <evidence>". Items (JSON): ${JSON.stringify(drops)}
Return {path, summary}.`, { label: 'synth:drops-log', phase, schema: S_ACK })
}

async function bootstrap() {
  return await agent(`${PRE}
You are the burst bootstrap reader. Read the run directory ${A.run_dir} (it may not exist yet - then found=false).
Return the FULL TEXT of each of these files that exists, in artifacts keyed exactly: map=pass-0-system-map.md, candidates=pass-1-candidates.md, filtered=pass-2-filtered.md, kill_report=pass-3-kill-report.md, drops=drops-log.md. Also key outcomes_prior = concatenated content of outcome.json files from OTHER run dirs under ${A.project_root}/.claude/discover/*/outcome.json (empty string if none).
user_edits = verbatim content of ${A.run_dir}/checkpoint-edits.md if it exists (the human's checkpoint decisions - these OVERRIDE artifact content), else "".`, { label: 'bootstrap', phase: 'Bootstrap', schema: S_BOOT })
}

function partialReturn(completed, why) {
  return { ok: false, partial: true, completed_passes: completed, summary: why + ` Everything finished so far is saved in ${A.run_dir}. Resume with the command below - completed work will not be re-paid.`, artifacts: RUNSTATE.artifacts, counts: RUNSTATE.counts, decisions_needed: RUNSTATE.decisions, resume_command: `discover: ${A.name}` }
}
// === Task 4: passes 0-2 ===
// === Task 5: pass 3 ===
// === Task 6: pass 4 + run dispatcher ===
return { ok: true, partial: false, completed_passes: [], summary: 'skeleton', artifacts: [], counts: {}, decisions_needed: [], resume_command: '' }
