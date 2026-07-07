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

const A = typeof args === 'string' ? JSON.parse(args) : args
const DIALS = {
  light:    { mappers: 2, researchers: 2, roundCap: 2, dryStop: 1, p3cap: 3, skeptics: 2, rivals: 1, crossModel: false, breaker: 900_000,   passEst: { 0: 120_000, 1: 200_000, 2: 150_000, 3: 200_000, 4: 200_000 } },
  standard: { mappers: 3, researchers: 3, roundCap: 3, dryStop: 1, p3cap: 5, skeptics: 3, rivals: 2, crossModel: true,  breaker: 2_500_000, passEst: { 0: 300_000, 1: 500_000, 2: 400_000, 3: 600_000, 4: 600_000 } },
  deep:     { mappers: 5, researchers: 4, roundCap: 5, dryStop: 2, p3cap: 7, skeptics: 5, rivals: 3, crossModel: true,  breaker: 6_000_000, passEst: { 0: 600_000, 1: 1_200_000, 2: 800_000, 3: 1_600_000, 4: 1_600_000 } },
} // Light validated by a real 0-4 run (2026-07-02): 793,694 output tokens, 21 agents, completed under the 900k breaker. Standard/Deep still extrapolated (~2.8x / ~6.7x Light); refine when a run at those dials exists.
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
async function passMap() {
  phase('Pass 0 - Map')
  if (A.greenfield) { log('greenfield project - Pass 0 skipped (nothing to map)'); return { components: [], data_sources: [], gaps: ['greenfield - no existing system'], unverified: [] } }
  const views = await parallel(Array.from({ length: DIAL.mappers }, (_, i) => () =>
    agent(`${PRE}
You are codebase mapper ${i + 1} of ${DIAL.mappers}. Divide the repo mentally into ${DIAL.mappers} slices by top-level directory order and take slice ${i + 1}. READ the actual source files in your slice (entrypoints, core modules, config). Mark anything you did not actually read as unverified.`,
      { label: `mapper-${i + 1}`, phase: 'Pass 0 - Map', schema: S_MAP })))
  const merged = await agent(`${PRE}
You are the architect. Merge these mapper inventories into ONE faithful system map (dedupe, resolve conflicts by re-reading the disputed file yourself). Keep the unverified list honest.
MAPPER OUTPUTS: ${JSON.stringify(views.filter(Boolean))}`, { label: 'architect-merge', phase: 'Pass 0 - Map', schema: S_MAP })
  await synth('Pass 0', 'pass-0-system-map.md', `Component inventory, data sources, gaps (only truly absent things), and an "inferred but not verified" section. JSON to render: ${JSON.stringify(merged)}`, 'Pass 0 - Map')
  return merged
}

async function passResearch(map) {
  phase('Pass 1 - Research')
  const angles = ['how similar open-source systems solve this', 'academic/industry patterns and their tradeoffs', 'data sources and APIs that could power it', 'failure stories and anti-patterns from practitioners']
  let all = []
  let dry = 0
  for (let round = 1; round <= DIAL.roundCap; round++) {
    const found = await parallel(Array.from({ length: DIAL.researchers }, (_, i) => () =>
      agent(`${PRE}
You are researcher ${i + 1}, round ${round}. Your angle: ${angles[i % angles.length]}. Search the web and read real sources. The system already has (do NOT propose): ${JSON.stringify(map.components.map(c => c.name))}. Already found this run (do NOT repeat): ${JSON.stringify(all.map(c => c.name))}. Return candidate features with function, rationale, source_quality (high=peer-reviewed/production-validated, medium=widely-used pattern, low=blog-grade), sources.`,
        { label: `researcher-${i + 1}-r${round}`, phase: 'Pass 1 - Research', schema: S_CAND })))
    const roundCands = found.filter(Boolean).flatMap(f => f.candidates)
    const judged = await agent(`${PRE}
You are the round judge (cheap dedup - NOT a generator). Existing list: ${JSON.stringify(all)}. New this round: ${JSON.stringify(roundCands)}. new_candidates MUST be a subset of items literally present in "New this round" above - NEVER invent, rename, or synthesize a candidate that is not already in that list, even if the list is empty and even if you can think of a good idea yourself. Return new_candidates = only the genuinely-new (vs Existing list) items from that subset (semantic dedup, drop off-topic), and dry = true iff new_candidates is empty. If "New this round" is empty, new_candidates MUST be [] and dry MUST be true - no exceptions.`,
      { label: `dry-judge-r${round}`, phase: 'Pass 1 - Research', schema: S_DRY, model: 'haiku' })
    if (!judged || judged.dry) { dry++; if (dry >= DIAL.dryStop) { log(`round ${round} dry - research complete`); break } }
    else { dry = 0; all = all.concat(judged.new_candidates) }
    if (!gate(1)) break
  }
  all = all.map((c, i) => ({ ...c, id: `c${i + 1}` }))
  RUNSTATE.counts.candidates = all.length
  await synth('Pass 1', 'pass-1-candidates.md', `Full unfiltered candidate list with function/rationale/source-quality/sources. JSON: ${JSON.stringify(all)}`, 'Pass 1 - Research')
  return all
}

async function passFilter(map, candidates, priorOutcomes, userEdits) {
  phase('Pass 2 - Filter')
  const analysis = await agent(`${PRE}
You are the filter analyst. For each candidate: (a) if you believe it already exists in the system, put it in drops with code "already-exists-verified" and name the map entry - it will be independently verified, so only claim it when the map really says so; (b) list failure modes + safeguards; (c) rank the rest on impact + feasibility (rank 1 = best). Never drop for weak/low-impact silently - use code "below-cut" with a one-line reason.
${priorOutcomes ? `PRIOR RUN OUTCOMES on this repo (surface next to matching candidates as prior_outcome - NEVER auto-drop because of them, reasons go stale): ${priorOutcomes}` : ''}
${userEdits ? `HUMAN CHECKPOINT EDITS (these OVERRIDE everything - apply them literally, log removed items with code "user-dropped"): ${userEdits}` : ''}
SYSTEM MAP: ${JSON.stringify(map)}
CANDIDATES: ${JSON.stringify(candidates)}`, { label: 'filter-analyst', phase: 'Pass 2 - Filter', schema: S_FILTER })
  const claimed = analysis.drops.filter(d => d.code === 'already-exists-verified')
  const verified = await parallel(claimed.map(d => () =>
    agent(`${PRE}
You are an independent redundancy verifier (you did NOT propose this drop). Claim: candidate "${d.name}" (${JSON.stringify(candidates.find(c => c.id === d.id) || d)}) already exists in this codebase. Locate and READ the actual source yourself - do not trust the map. Quote file + lines + snippet. Verdict: exists-fully (drop stands) / exists-partially (keep as "extend existing X") / stub (looks built, is not - keep) / not-found (keep).`,
      { label: `redundancy:${d.name.slice(0, 30)}`, phase: 'Pass 2 - Filter', schema: S_RED }).then(v => ({ d, v }))))
  const drops = analysis.drops.filter(x => x.code !== 'already-exists-verified')
  let kept = analysis.kept
  for (const { d, v } of verified.filter(Boolean)) {
    if (v.verdict === 'exists-fully') drops.push({ ...d, evidence: v.evidence })
    else kept.push({ id: d.id, name: v.verdict === 'exists-partially' ? `Extend existing: ${d.name} (${v.extend_note})` : d.name, rank: kept.length + 1, failure_modes: [], safeguards: [], prior_outcome: v.verdict === 'stub' ? 'stub found - map patched' : '' })
  }
  kept = kept.sort((x, y) => x.rank - y.rank)
  const cut = kept.slice(DIAL.p3cap).map(k => ({ id: k.id, name: k.name, code: 'below-cut', reason: `ranked ${k.rank}, cap ${DIAL.p3cap}`, evidence: '' }))
  kept = kept.slice(0, DIAL.p3cap)
  await appendDrops(drops.concat(cut).map(d => ({ ...d, stage: 'pass-2' })), 'Pass 2 - Filter')
  await synth('Pass 2', 'pass-2-filtered.md', `Kept candidates (ranked, with failure modes, safeguards, prior-outcome notes) and the redundancy-verifier evidence. kept=${JSON.stringify(kept)} verifier_evidence=${JSON.stringify(verified.filter(Boolean).map(x => ({ name: x.d.name, verdict: x.v.verdict, evidence: x.v.evidence })))}`, 'Pass 2 - Filter')
  return { kept, drops }
}
async function passKill(map, kept) {
  phase('Pass 3 - Kill-test')
  const lenses = LENSES.slice(0, DIAL.skeptics)
  const panel = (await parallel(lenses.map(l => () =>
    agent(`${PRE}
You are the ${l.key} skeptic. Try to disprove EACH candidate below through your lens ONLY. Your evidence anchor - you MUST actually do this before objecting: ${l.anchor}
An objection is kill-eligible ONLY if all three hold: CONCRETE (trigger + mechanism + impact), GROUNDED (evidence field cites an artifact you inspected THIS run), FATAL-CLASS (exactly one of ${FATAL_CLASSES.join(' / ')}). Otherwise mark kind=concern, fatal_class=none. Do not manufacture objections - explicit endorsement is a valid result.
SYSTEM MAP: ${JSON.stringify(map)}
CANDIDATES: ${JSON.stringify(kept)}`, { label: `skeptic:${l.key}`, phase: 'Pass 3 - Kill-test', schema: S_SKEPTIC })))).filter(Boolean)
  let objections = panel.flatMap(p => p.objections)
    .map((o, i) => ({ ...o, ref: `o${i + 1}`, kind: (o.kind === 'kill-eligible' && o.evidence && o.evidence.length > 20 && FATAL_CLASSES.includes(o.fatal_class)) ? 'kill-eligible' : 'concern' }))
  const killable = objections.filter(o => o.kind === 'kill-eligible')
  let rulings = []
  if (killable.length) {
    if (!gate(3)) { objections = objections.map(o => ({ ...o, kind: 'concern', budget_flagged: true })); log('budget guard: defense cannot run - kill-eligible objections downgraded to flagged concerns (never kill without a defense)') }
    else {
      const defense = await agent(`${PRE}
You are the advocate. For each kill-eligible objection below, draft the strongest honest rebuttal (tool access allowed - read the code, probe the source).
OBJECTIONS: ${JSON.stringify(killable)}
CANDIDATES: ${JSON.stringify(kept)}
Return your rebuttals inside rulings with ruling=REJECTED and reason=your rebuttal (the judge will overwrite ruling).`, { label: 'advocate', phase: 'Pass 3 - Kill-test', schema: S_DEFENSE })
      const judged = await agent(`${PRE}
You are the judge. For each objection: FIRST re-open its cited evidence yourself (re-read the file / re-run the command / re-fetch the URL) and record what you saw in evidence_recheck. Then, weighing the advocate's rebuttal, rule UPHELD (candidate dies) / CONVERTED (becomes safeguard + demerit) / REJECTED. An objection whose evidence does not check out is REJECTED. One UPHELD objection kills - there is no vote.
OBJECTIONS: ${JSON.stringify(killable)}
ADVOCATE REBUTTALS: ${JSON.stringify(defense ? defense.rulings : [])}`, { label: 'judge', phase: 'Pass 3 - Kill-test', schema: S_DEFENSE })
      rulings = judged ? judged.rulings : []
    }
  }
  const killedIds = new Set(rulings.filter(r => r.ruling === 'UPHELD').map(r => r.candidate_id))
  const singleFamily = !(DIAL.crossModel && (A.capabilities.codex === 'healthy' || A.capabilities.gemini === 'healthy'))
  let xnotes = []
  if (!singleFamily) {
    const unanimousKills = kept.filter(k => killedIds.has(k.id))
    const survivors = kept.filter(k => !killedIds.has(k.id))
    const batch = survivors.concat(unanimousKills).slice(0, 8)
    const families = [['codex', 'timeout 240 codex exec'], ['gemini', 'GEMINI_CLI_TRUST_WORKSPACE=true timeout 240 gemini --skip-trust -y -m gemini-flash-latest -p']].filter(([f]) => A.capabilities[f] === 'healthy')
    xnotes = (await parallel(families.map(([fam, cli]) => () =>
      agent(`${PRE}
You are the cross-model auditor for ${fam}. Compose ONE batched prompt covering all ideas below (include the panel's evidence per idea; for killed ideas attach the kill's failure scenario and ask "is this stated failure scenario factually correct for this system?"). Run it via bash: ${cli} "<your prompt>" . If the CLI errors or times out, return available=false. Parse the reply into per-candidate notes: endorse / dissent (for survivors) / dispute-kill (for killed ones). Advisory only - you are NOT a vote.
IDEAS: ${JSON.stringify(batch)}
KILL RULINGS: ${JSON.stringify(rulings)}`, { label: `xmodel:${fam}`, phase: 'Pass 3 - Kill-test', schema: S_XMODEL })))).filter(Boolean).filter(x => x.available)
  }
  const survivors = kept.filter(k => !killedIds.has(k.id)).map(k => {
    const mine = objections.filter(o => o.candidate_id === k.id)
    const conv = rulings.filter(r => r.candidate_id === k.id && r.ruling === 'CONVERTED')
    const strongest = mine[0]
    return { id: k.id, name: k.name, demerits: mine.filter(o => o.kind === 'concern').length + conv.length,
      safeguards: (k.safeguards || []).concat(mine.filter(o => o.kind === 'concern').map(o => `guard against: ${o.trigger}`)),
      near_miss: strongest ? `${strongest.lens}: ${strongest.trigger} -> resolved: ${rulings.find(r => r.objection_ref === strongest.ref)?.reason || 'concern, safeguard attached'}` : 'no objections raised',
      cross_family: xnotes.flatMap(x => x.notes.filter(n => n.candidate_id === k.id && n.stance === 'dissent').map(n => `${x.family} dissent: ${n.note}`)).join('; ') }
  })
  const kills = kept.filter(k => killedIds.has(k.id)).map(k => {
    const r = rulings.find(x => x.candidate_id === k.id && x.ruling === 'UPHELD')
    const o = objections.find(x => x.ref === r.objection_ref) || {}
    return { id: k.id, name: k.name, objection: `${o.lens}: ${o.trigger} -> ${o.mechanism} -> ${o.impact}`, evidence: o.evidence || '', rebuttal: r.reason, judge_reason: `${r.reason} | recheck: ${r.evidence_recheck}`,
      disputed_by: xnotes.flatMap(x => x.notes.filter(n => n.candidate_id === k.id && n.stance === 'dispute-kill').map(n => x.family)).join(',') }
  })
  RUNSTATE.counts.kills = kills.length; RUNSTATE.counts.survivors = survivors.length
  kills.filter(k => k.disputed_by).forEach(k => RUNSTATE.decisions.push(`kill of "${k.name}" disputed by ${k.disputed_by} - human decision (see kill report)`))
  await appendDrops(kills.map(k => ({ name: k.name, stage: 'pass-3', code: 'kill-upheld', reason: k.objection, evidence: k.evidence })), 'Pass 3 - Kill-test')
  await synth('Pass 3', 'pass-3-kill-report.md', `${singleFamily ? 'LABEL PROMINENTLY AT TOP: "single-family panel - all verdicts are from one AI family; unanimity counts for less." ' : ''}Sections: KILLS (each: objection + evidence + rebuttal + judge reason + disputed_by flag), SURVIVORS (each: demerits, safeguards, near_miss - the strongest objection and its resolution, cross_family notes). Symmetric reporting is mandatory. JSON: ${JSON.stringify({ survivors, kills })}`, 'Pass 3 - Kill-test')
  return { survivors, kills }
}
async function passPlan(map, survivors) {
  phase('Pass 4 - Plan')
  const ranked = [...survivors].sort((x, y) => x.demerits - y.demerits)
  const chosen = ranked.slice(0, P4CAP)
  const backlog = ranked.slice(P4CAP)
  if (backlog.length) await synth('Pass 4', 'build-next.md', `Ranked backlog of survivors beyond the top-${P4CAP} build cap (never deleted; promotable by the human next run). JSON: ${JSON.stringify(backlog)}`, 'Pass 4 - Plan')
  const STANCES = ['minimal-diff', 'robustness-first', 'extensibility-first'].slice(0, DIAL.rivals)
  let rivals
  if (DIAL.rivals > 1) {
    const enu = await agent(`${PRE}
Quick check: for integrating ${JSON.stringify(chosen.map(c => c.name))} into this system (map: ${JSON.stringify(map.components)}), how many MATERIALLY DISTINCT architectures exist? Distinct = different integration points or data flow, not different polish.`, { label: 'approach-enum', phase: 'Pass 4 - Plan', schema: S_APPROACHES, model: 'haiku' })
    if (enu && enu.distinct_architectures < 2) { log('approach space is narrow - tournament skipped, single plan'); rivals = [STANCES[0]] } else rivals = STANCES
  } else rivals = [STANCES[0]]
  const planPrompt = stance => `${PRE}
You are the ${stance} planner. Produce a build-ready plan integrating the features below into the existing system without duplicating anything. Your assigned stance - optimize for: ${stance === 'minimal-diff' ? 'the smallest correct change; touch the fewest files' : stance === 'robustness-first' ? 'failure handling, safeguards, and observability' : 'clean seams for future features'}. READ the actual integration-point code before naming file paths or signatures. Every plan section required. EVERY feature needs a probe: live_probe {instruction: exact command/action, expected_evidence: what output proves it works} or deferred_probe {reason from ${PROBE_REASONS.join('/')}, owed_check}. destructive_or_costly REQUIRES a dry-run analog in instruction.
FEATURES (with safeguards to bake in): ${JSON.stringify(chosen)}
SYSTEM MAP: ${JSON.stringify(map)}`
  const plans = (await parallel(rivals.map(s => () => agent(planPrompt(s), { label: `plan:${s}`, phase: 'Pass 4 - Plan', schema: S_PLAN })))).filter(Boolean)
  let final = plans[0], judge = null
  if (plans.length > 1) {
    judge = await agent(`${PRE}
You are the single tournament judge. Rubric per plan, scored 1-10 each, in isolation first: buildability (are named files/functions real - GREP THE CODE for each plan's claimed integration points, record findings in grounded_findings), completeness (all sections + probes), risk handling, fit-to-stance. Then ONE comparative pass -> winner_stance. graft_list: ONLY additive items from losers (allowed target sections: Failure Handling / Feature Activation Plan / Verification Checklist / tests / risk-callouts). Structural superiority of a loser => either declare it winner or put ONE bounded instruction in revision_order - structural ideas are NEVER grafted.
PLANS: ${JSON.stringify(plans)}`, { label: 'tournament-judge', phase: 'Pass 4 - Plan', schema: S_JUDGE })
    const winner = plans.find(p => p.stance === judge.winner_stance) || plans[0]
    final = await agent(`${PRE}
You are the plan reviser. Re-generate the winning plan as ONE coherent whole: apply the graft list (additive items only, into their target sections)${judge.revision_order ? ' and this single structural revision: ' + judge.revision_order : ''}. Do not import any other loser ideas.
WINNER: ${JSON.stringify(winner)}
GRAFTS: ${JSON.stringify(judge.graft_list)}`, { label: 'plan-reviser', phase: 'Pass 4 - Plan', schema: S_PLAN })
    const co = await agent(`${PRE}
Coherence check on the merged plan: contradictions between sections, grafted items that don't fit, features without probes. Fix what you find and report fixes_applied. PLAN: ${JSON.stringify(final)}`, { label: 'coherence-check', phase: 'Pass 4 - Plan', schema: S_COHERE })
    if (co && co.fixes_applied.length) log(`coherence pass applied ${co.fixes_applied.length} fixes`)
  }
  await synth('Pass 4', 'final-plan.md', `The build spec Pass 5 reads. Render all 8 sections in order, then a "Feature Probes" section listing every feature's probe verbatim, then (if a tournament ran) "Tournament notes": scores table, grounded_findings, graft decisions, losing-plan one-line summaries. plan=${JSON.stringify(final)} judge=${JSON.stringify(judge)}`, 'Pass 4 - Plan')
  if (A.run_style === 'planonly') await synth('Pass 4', 'EXECUTE.md', `Separate-session kickoff per references/kickoff-prompt.md template: run name ${A.name}, absolute plan path ${A.run_dir}/final-plan.md, activation summary from the plan's Feature Activation Plan section, and the one-line resume trigger "discover: build ${A.name}".`, 'Pass 4 - Plan')
  return { plan_path: `${A.run_dir}/final-plan.md` }
}
phase('Bootstrap')
const boot = await bootstrap()
const priorMap = boot.found && boot.artifacts.map ? boot.artifacts.map : ''
const completed = []
let map = null, candidates = null, filtered = null
try {
  if (A.from_pass > 0 && !boot.found) return partialReturn([], `Cannot start at pass ${A.from_pass}: no saved artifacts found in ${A.run_dir}.`)
  if (A.from_pass === 0) {
    if (!gate(0)) return partialReturn(completed, 'Budget too low for Pass 0.')
    map = await passMap(); completed.push(0)
    if (!map) return partialReturn(completed, 'Pass 0 did not return a usable system map (the merge step failed - likely a transient API error) - cannot safely continue into Pass 1 with no map, since every researcher call needs it. A saved pass-0-system-map.md may still exist from an agent recovery attempt, but the pipeline requires the structured map, not just the file. Resume to retry Pass 0 cleanly.')
    if (!gate(1)) return partialReturn(completed, 'Budget exhausted after Pass 0.')
    candidates = await passResearch(map); completed.push(1)
    if (!gate(2)) return partialReturn(completed, 'Budget exhausted after Pass 1.')
    filtered = await passFilter(map, candidates, boot.artifacts.outcomes_prior, boot.user_edits); completed.push(2)
  } else {
    map = { fromDisk: true, raw: priorMap, components: [], data_sources: [], gaps: [], unverified: [] }
    const reparse = await agent(`${PRE}\nParse this saved system-map artifact back into structured form:\n${priorMap}`, { label: 'reparse-map', phase: 'Bootstrap', schema: S_MAP, model: 'haiku' })
    if (reparse) map = reparse
    const refilter = await agent(`${PRE}\nParse the saved pass-2 artifact back into {kept, drops} structured form. HUMAN CHECKPOINT EDITS OVERRIDE the artifact - apply them (drop = remove from kept; note rewordings): edits=${JSON.stringify(boot.user_edits)}\nARTIFACT:\n${boot.artifacts.filtered}`, { label: 'reparse-filtered', phase: 'Bootstrap', schema: S_FILTER, model: 'haiku' })
    filtered = refilter || { kept: [], drops: [] }
  }
  let survivors = null
  if (A.to_pass >= 3 && A.from_pass <= 3) {
    if (!gate(3)) return partialReturn(completed, 'Budget exhausted before Pass 3.')
    const kill = await passKill(map, filtered.kept); completed.push(3)
    survivors = kill.survivors
  } else if (A.from_pass === 4) {
    const rekill = await agent(`${PRE}\nParse the saved kill report back into {survivors, kills} structured form. HUMAN CHECKPOINT EDITS OVERRIDE (an overridden kill re-enters survivors WITH its objection recorded as a safeguard): edits=${JSON.stringify(boot.user_edits)}\nARTIFACT:\n${boot.artifacts.kill_report}`, { label: 'reparse-kill', phase: 'Bootstrap', schema: S_KILL, model: 'haiku' })
    survivors = rekill ? rekill.survivors : []
  }
  if (A.to_pass >= 4) {
    if (!gate(4)) return partialReturn(completed, 'Budget exhausted before Pass 4.')
    await passPlan(map, survivors); completed.push(4)
  }
} catch (e) {
  return partialReturn(completed, `A stage failed hard (${String(e).slice(0, 200)}).`)
}
const summary = await agent(`${PRE}\nWrite a 3-6 sentence plain-language summary of this burst for a non-coder: passes completed ${JSON.stringify(completed)}, counts ${JSON.stringify(RUNSTATE.counts)}, decisions needed ${JSON.stringify(RUNSTATE.decisions)}. Name the artifact files to look at. No jargon.`, { label: 'burst-summary', phase: completed.includes(4) ? 'Pass 4 - Plan' : 'Pass 3 - Kill-test', schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } }, model: 'haiku' })
return { ok: true, partial: false, completed_passes: completed, summary: summary ? summary.text : 'burst complete', artifacts: RUNSTATE.artifacts, counts: RUNSTATE.counts, decisions_needed: RUNSTATE.decisions, resume_command: '' }
