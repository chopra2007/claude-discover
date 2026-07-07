// Stub harness: runs discover-pipeline.js with canned agent() responses.
// Catches topology/reference bugs without spending tokens. NOT a semantic test.
import { readFileSync } from 'fs'
const src = readFileSync(new URL('../skills/discover/workflows/discover-pipeline.js', import.meta.url), 'utf8')
const body = src.replace(/export const meta[\s\S]*?\n}\n/, '')
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor

const canned = label =>
  label === 'bootstrap' ? { found: false, artifacts: {}, user_edits: '' } :
  label.startsWith('mapper') || label === 'architect-merge' ? { components: [{ name: 'core', path: 'src/core.py', does: 'x' }], data_sources: [], gaps: [], unverified: [] } :
  label.startsWith('researcher') ? { candidates: [{ id: '', name: 'F-' + label, function: 'f', rationale: 'r', source_quality: 'medium', sources: [] }] } :
  label.startsWith('dry-judge') ? { new_candidates: [], dry: true } :
  label === 'filter-analyst' ? { kept: [{ id: 'c1', name: 'F1', rank: 1, failure_modes: [], safeguards: [], prior_outcome: '' }], drops: [{ id: 'c2', name: 'F2', code: 'already-exists-verified', reason: 'map says so', evidence: '' }] } :
  label.startsWith('redundancy') ? { verdict: 'stub', evidence: 'src/core.py:1 stub', extend_note: '' } :
  label.startsWith('skeptic') ? { objections: [{ candidate_id: 'c1', lens: 'code-reality', kind: 'kill-eligible', trigger: 't', mechanism: 'm', impact: 'i', evidence: 'src/core.py:10 quoted-snippet-longer-than-20', fatal_class: 'infeasible' }], endorsements: [] } :
  label === 'advocate' || label === 'judge' ? { rulings: [{ candidate_id: 'c1', objection_ref: 'o1', ruling: 'CONVERTED', reason: 'safeguardable', evidence_recheck: 'checked' }] } :
  label.startsWith('xmodel') ? { family: 'codex', available: false, notes: [] } :
  label === 'approach-enum' ? { distinct_architectures: 2, notes: '' } :
  label.startsWith('plan:') ? { stance: label.slice(5), sections: Object.fromEntries(['System Overview', 'Component Architecture', 'Data Flow Pipeline', 'Data Structures', 'Integration Plan', 'Failure Handling', 'Feature Activation Plan', 'Verification Checklist'].map(s => [s, 'x'])), features: [{ name: 'F1', probe: { kind: 'live_probe', instruction: 'run x', expected_evidence: 'y', reason: '', owed_check: '' } }] } :
  label === 'tournament-judge' ? { winner_stance: 'minimal-diff', scores: [], grounded_findings: 'ok', graft_list: [], revision_order: '' } :
  label === 'plan-reviser' ? { stance: 'minimal-diff', sections: Object.fromEntries(['System Overview', 'Component Architecture', 'Data Flow Pipeline', 'Data Structures', 'Integration Plan', 'Failure Handling', 'Feature Activation Plan', 'Verification Checklist'].map(s => [s, 'x'])), features: [{ name: 'F1', probe: { kind: 'live_probe', instruction: 'run x', expected_evidence: 'y', reason: '', owed_check: '' } }] } :
  label === 'coherence-check' ? { coherent: true, fixes_applied: [] } :
  label === 'burst-summary' ? { text: 'done' } :
  label.startsWith('synth') ? { path: '/fake/' + label, summary: 's' } :
  label.startsWith('reparse-map') ? { components: [], data_sources: [], gaps: [], unverified: [] } :
  label.startsWith('reparse-filtered') ? { kept: [{ id: 'c1', name: 'F1', rank: 1, failure_modes: [], safeguards: [], prior_outcome: '' }], drops: [] } :
  label.startsWith('reparse-kill') ? { survivors: [{ id: 'c1', name: 'F1', demerits: 0, safeguards: [], near_miss: '', cross_family: '' }], kills: [] } :
  { }

async function runCase(name, argsObj, assert, cannedFn = canned) {
  const calls = []
  const seats = {} // label -> "model:effort" the resolver assigned (captured post-withModel)
  const agent = async (prompt, opts = {}) => { const l = opts.label || 'unlabeled'; calls.push(l); if (opts.model) seats[l] = `${opts.model}:${opts.effort}`; return cannedFn(l) }
  const parallel = async thunks => Promise.all(thunks.map(t => t().catch(() => null)))
  const pipeline = async (items, ...stages) => Promise.all(items.map(async (it, i) => { let v = it; for (const s of stages) v = await s(v, it, i); return v }))
  const fn = new AsyncFn('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'budget', 'workflow', body)
  const result = await fn(argsObj, agent, parallel, pipeline, () => {}, () => {}, { total: null, spent: () => 0, remaining: () => Infinity }, async () => null)
  const err = assert(result, calls, seats)
  console.log(err ? `FAIL ${name}: ${err}` : `PASS ${name}`)
  if (err) process.exitCode = 1
}
const expectSeats = (seats, want) => { for (const [l, v] of Object.entries(want)) if (seats[l] !== v) return `${l} = ${seats[l] || 'MISSING'}, want ${v}`; return '' }

const base = { name: 'toy', run_dir: '/tmp/x', project_root: '/tmp/p', feature_ask: 'add F', dial: 'light', run_style: 'checkpoints', greenfield: false, capabilities: { omc: false, superpowers: false, codex: 'absent', gemini: 'absent' }, budget_override: null, free_data_only: true }

await runCase('handsoff-full-0-4', { ...base, run_style: 'handsoff', from_pass: 0, to_pass: 4 },
  (r, calls) => !r.ok ? 'not ok: ' + r.summary
    : JSON.stringify(r.completed_passes) !== '[0,1,2,3,4]' ? 'passes=' + JSON.stringify(r.completed_passes)
    : !calls.some(c => c === 'skeptic:code-reality') ? 'no skeptic ran'
    : calls.filter(c => c.startsWith('skeptic:')).length !== 2 ? 'light dial must run exactly 2 skeptics'
    : calls.some(c => c.startsWith('xmodel')) ? 'cross-model must not run on light/absent'
    : !calls.some(c => c === 'synth:pass-3-kill-report.md') ? 'kill report not written' : '')
await runCase('burst-A-0-2', { ...base, from_pass: 0, to_pass: 2 },
  (r, calls) => !r.ok ? 'not ok' : JSON.stringify(r.completed_passes) !== '[0,1,2]' ? 'passes=' + JSON.stringify(r.completed_passes)
    : calls.some(c => c.startsWith('skeptic')) ? 'pass 3 leaked into burst A' : '')
await runCase('burst-C-4-4-resume', { ...base, from_pass: 4, to_pass: 4 },
  r => (!r.partial ? 'must be partial without saved artifacts (bootstrap stub returns found:false)' : ''))
await runCase('greenfield-skips-map', { ...base, greenfield: true, from_pass: 0, to_pass: 2 },
  (r, calls) => calls.some(c => c.startsWith('mapper')) ? 'mappers ran on greenfield' : '')

// --- systemic dead-agent guard (v1.2): a null agent() return means the agent DIED on an API error,
// never "found nothing". A critical death must halt loud + resumable, never silently continue/fabricate.
// The 4th arg overrides the canned responder so a chosen label returns null (simulates a dead agent).
const hf = { ...base, run_style: 'handsoff', from_pass: 0, to_pass: 4 }
await runCase('architect-death-halts', hf,
  r => r.ok ? 'must NOT be ok when architect-merge died' : !r.partial ? 'must be partial' : r.completed_passes.includes(0) ? 'Pass 0 must not be marked complete when its merge died' : '',
  l => l === 'architect-merge' ? null : canned(l))
await runCase('mapper-wipeout-halts', hf,
  r => r.ok ? 'must NOT be ok when all mappers died' : !r.partial ? 'must be partial' : '',
  l => l.startsWith('mapper') ? null : canned(l))
await runCase('partial-mapper-loss-continues', hf,
  r => !r.ok ? 'a partial pool loss (1 of 2 mappers) should still complete: ' + r.summary : '',
  l => l === 'mapper-1' ? null : canned(l))
await runCase('filter-death-halts', hf,
  r => r.ok ? 'must NOT be ok when filter-analyst died' : r.completed_passes.includes(2) ? 'Pass 2 must not be marked complete' : '',
  l => l === 'filter-analyst' ? null : canned(l))
await runCase('kill-judge-death-halts', hf,
  r => r.ok ? 'must NOT be ok when the kill-test judge died' : r.completed_passes.includes(3) ? 'Pass 3 must not be marked complete' : '',
  l => l === 'judge' ? null : canned(l))
await runCase('redundancy-death-keeps-and-completes', hf,
  r => !r.ok ? 'a dead redundancy verifier is non-critical (candidate kept to be safe) - run should still complete: ' + r.summary : '',
  l => l.startsWith('redundancy') ? null : canned(l))
await runCase('bootstrap-death-halts', hf,
  r => r.ok ? 'must NOT be ok when bootstrap (disk read) died' : !r.partial ? 'must be partial' : '',
  l => l === 'bootstrap' ? null : canned(l))

// --- v1.2 per-seat model + effort resolver (3-layer control) ---
// standard dial so every seat runs (3 mappers/skeptics, tournament of 2 plans). Canned signals:
// approach-enum distinct=2 -> tournament-judge complexity 'low'; 3 kill-eligible objections -> kill-judge 'high'.
const std = { ...base, dial: 'standard', run_style: 'handsoff', from_pass: 0, to_pass: 4 }
await runCase('models-balanced-default', std, (r, calls, seats) => expectSeats(seats, {
  'bootstrap': 'haiku:low', 'mapper-1': 'sonnet:low', 'architect-merge': 'opus:medium',
  'researcher-1-r1': 'sonnet:low', 'dry-judge-r1': 'haiku:low', 'filter-analyst': 'opus:medium',
  'skeptic:code-reality': 'opus:medium', 'advocate': 'opus:medium', 'judge': 'fable:high', // kill-judge: balanced + complex -> fable.high
  'approach-enum': 'opus:low', 'plan:minimal-diff': 'opus:medium', 'tournament-judge': 'opus:medium', // balanced + narrow -> opus
  'plan-reviser': 'opus:medium', 'coherence-check': 'opus:low', 'synth:pass-0-system-map.md': 'haiku:low',
}))
await runCase('models-quick-caps-opus', { ...std, model_tier: 'quick' }, (r, calls, seats) => expectSeats(seats, {
  'judge': 'opus:high', 'tournament-judge': 'opus:medium', // Quick never reaches Fable
  'filter-analyst': 'opus:medium', 'skeptic:code-reality': 'opus:medium', 'mapper-1': 'sonnet:low',
}))
await runCase('models-max-reaches-fable', { ...std, model_tier: 'max' }, (r, calls, seats) => expectSeats(seats, {
  'judge': 'fable:high', 'tournament-judge': 'fable:medium', // Max: both judges Fable
  'filter-analyst': 'opus:high', 'skeptic:code-reality': 'opus:high', 'plan:minimal-diff': 'opus:high',
  'plan-reviser': 'opus:high', 'mapper-1': 'sonnet:low', 'synth:pass-0-system-map.md': 'haiku:low', // mechanical stays cheap at every tier
}))
await runCase('models-pins-override-both-judges', { ...std, pins: { judge: 'fable:max', 'plan-judge': 'opus:high' } }, (r, calls, seats) => expectSeats(seats, {
  'judge': 'fable:max', 'tournament-judge': 'opus:high', // L3 pin (plan-judge alias) beats the preset/auto
}))
