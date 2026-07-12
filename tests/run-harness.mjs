// Stub harness: runs discover-pipeline.js with canned agent() responses.
// Catches topology/reference bugs without spending tokens. NOT a semantic test.
import { readFileSync } from 'fs'
const src = readFileSync(new URL('../skills/discover/workflows/discover-pipeline.js', import.meta.url), 'utf8')
const body = src.replace(/export const meta[\s\S]*?\n}\n/, '')
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor

const canned = label =>
  label === 'bootstrap' ? { found: false, artifacts: {}, user_edits: '', map_cache: '', map_cache_sha: '', git_diff_ok: false, changed_since_cache: [] } :
  label.startsWith('mapper') || label === 'architect-merge' || label === 'delta-mapper' ? { components: [{ name: 'core', path: 'src/core.py', does: 'x' }], data_sources: [], gaps: [], unverified: [] } :
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
  r => r.ok ? 'must NOT be ok when filter-analyst died' : r.completed_passes.includes(2) ? 'Pass 2 must not be marked complete'
    : !/filter-analyst/.test(r.summary) ? 'death message must name the dead seat (distinguishes the clean halt from a raw crash)' : '',
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
await runCase('models-balanced-complex-tournament-reaches-fable', { ...std }, (r, calls, seats) => expectSeats(seats, {
  'tournament-judge': 'fable:high', // balanced + wide approach space (distinct=4 -> 'max' signal) -> Fable.high
}), l => l === 'approach-enum' ? { distinct_architectures: 4, notes: '' } : canned(l))

// --- review fixes: total-wipeout floor on the candidate pool (F1), primary-synth hand-off (F2),
//     and the coverage gaps the reviewer named (skeptic/planner wipeout, tournament-judge death, resume path) ---
await runCase('research-wipeout-halts', hf, // F1: every researcher dies every round -> halt, not a false "complete, 0 candidates"
  r => r.ok ? 'must NOT be ok when every researcher died (would be a silent empty run)' : r.completed_passes.includes(1) ? 'Pass 1 must not be marked complete' : '',
  l => l.startsWith('researcher') ? null : canned(l))
await runCase('primary-synth-death-halts', hf, // F2: a pass hand-off artifact failing to write must halt (later bursts read it from disk)
  r => r.ok ? 'must NOT be ok when a primary synth (pass-2-filtered) failed to write' : r.completed_passes.includes(2) ? 'Pass 2 must not be marked complete with no artifact' : '',
  l => l === 'synth:pass-2-filtered.md' ? null : canned(l))
await runCase('aux-synth-death-still-completes', std, // build-next.md is auxiliary -> its death must NOT halt
  r => !r.ok ? 'an auxiliary synth (build-next) death should not halt the run: ' + r.summary : '',
  l => l === 'synth:build-next.md' ? null : canned(l))
await runCase('skeptic-wipeout-halts', hf,
  r => r.ok ? 'must NOT be ok when the whole skeptic panel died' : r.completed_passes.includes(3) ? 'Pass 3 must not be marked complete' : '',
  l => l.startsWith('skeptic') ? null : canned(l))
await runCase('planner-wipeout-halts', std,
  r => r.ok ? 'must NOT be ok when all planners died' : r.completed_passes.includes(4) ? 'Pass 4 must not be marked complete' : '',
  l => l.startsWith('plan:') ? null : canned(l))
await runCase('tournament-judge-death-halts', std,
  r => r.ok ? 'must NOT be ok when the tournament judge died' : r.completed_passes.includes(4) ? 'Pass 4 must not be marked complete' : '',
  l => l === 'tournament-judge' ? null : canned(l))
// resume/reparse death path: a from_pass:4 resume with saved artifacts whose kill-report reparse dies must halt
const savedBoot = l => l === 'bootstrap'
  ? { found: true, artifacts: { map: 'M', candidates: '', filtered: 'F', kill_report: 'K', drops: '', outcomes_prior: '' }, user_edits: '' }
  : l === 'reparse-kill' ? null : canned(l)
await runCase('reparse-kill-death-halts', { ...base, dial: 'standard', from_pass: 4, to_pass: 4 },
  r => r.ok ? 'must NOT be ok when reparse-kill died on a resume' : !r.partial ? 'must be partial' : '', savedBoot)
await runCase('reparse-filtered-death-irrelevant-on-frompass4', { ...base, dial: 'standard', from_pass: 4, to_pass: 4 }, // F3: filtered is unused at from_pass 4, so its reparse is skipped and cannot halt
  r => !r.ok ? 'a from_pass:4 resume must not halt on reparse-filtered (never consumed): ' + r.summary : '',
  l => l === 'bootstrap' ? { found: true, artifacts: { map: 'M', candidates: '', filtered: 'F', kill_report: 'K', drops: '', outcomes_prior: '' }, user_edits: '' }
     : l === 'reparse-filtered' ? null : canned(l))

// --- v1.3 reusable codebase map: reuse the repo-level cache verbatim when nothing changed, patch it
//     with ONE delta mapper on a small drift, full fan-out when missing/stale/forced, and never
//     re-run mappers on a same-run restart whose map is already on disk ---
const cachedBoot = changed => l => l === 'bootstrap'
  ? { found: false, artifacts: {}, user_edits: '', map_cache: '# saved map', map_cache_sha: 'abc1234def', git_diff_ok: true, changed_since_cache: changed }
  : canned(l)
await runCase('map-cache-no-diff-reuses-verbatim', hf,
  (r, calls) => !r.ok ? 'not ok: ' + r.summary
    : calls.some(c => c.startsWith('mapper-') || c === 'architect-merge' || c === 'delta-mapper') ? 'must not re-read the repo when nothing changed'
    : !calls.includes('reparse-map-cache') ? 'cached map must be reparsed'
    : !r.completed_passes.includes(0) ? 'Pass 0 must still count as complete' : '',
  cachedBoot([]))
await runCase('map-cache-small-diff-runs-one-delta-mapper', hf,
  (r, calls, seats) => !r.ok ? 'not ok: ' + r.summary
    : calls.filter(c => c === 'delta-mapper').length !== 1 ? 'exactly one delta-mapper must run'
    : calls.some(c => c.startsWith('mapper-') || c === 'architect-merge') ? 'full mappers must not run on a small diff'
    : !calls.includes('synth:pass-0-system-map.md') ? 'patched map must still be written to the run dir'
    : seats['delta-mapper'] !== 'sonnet:low' ? 'delta-mapper should resolve to sonnet:low, got ' + seats['delta-mapper'] : '',
  cachedBoot(['src/a.py', 'src/b.py']))
await runCase('map-cache-huge-diff-full-rescan', hf,
  (r, calls) => !r.ok ? 'not ok: ' + r.summary
    : !calls.some(c => c.startsWith('mapper-')) ? 'a too-stale cache must trigger the full fan-out'
    : calls.includes('delta-mapper') ? 'delta path must not run past the staleness cap' : '',
  cachedBoot(Array.from({ length: 101 }, (_, i) => `src/f${i}.py`)))
await runCase('map-cache-noise-paths-ignored', hf, // only .claude/.omc/.git churn since the cache -> still counts as "nothing changed"
  (r, calls) => calls.some(c => c.startsWith('mapper-') || c === 'delta-mapper') ? 'artifact-dir churn must not defeat the cache' : '',
  cachedBoot(['.claude/discover/old-run/state.json', '.omc/notepad.md']))
await runCase('no-cache-full-rescan-writes-cache', hf,
  (r, calls) => !r.ok ? 'not ok: ' + r.summary
    : !calls.some(c => c.startsWith('mapper-')) ? 'no cache must run the full fan-out'
    : !calls.includes('synth:map-cache') ? 'a full scan must write the repo-level map cache' : '')
await runCase('remap-fresh-forces-full-rescan', { ...hf, remap: 'fresh' },
  (r, calls) => !calls.some(c => c.startsWith('mapper-')) ? 'remap=fresh must run the full fan-out'
    : calls.includes('delta-mapper') || calls.includes('reparse-map-cache') ? 'remap=fresh must ignore the cache' : '',
  cachedBoot([]))
await runCase('remap-reuse-forces-cache-despite-diff', { ...hf, remap: 'reuse' },
  (r, calls) => !calls.includes('reparse-map-cache') ? 'remap=reuse must reuse the cache'
    : calls.some(c => c.startsWith('mapper-') || c === 'delta-mapper') ? 'no mappers may run on a forced reuse' : '',
  cachedBoot(Array.from({ length: 300 }, (_, i) => `src/f${i}.py`)))
await runCase('same-run-restart-reuses-own-map', hf,
  (r, calls) => !r.ok ? 'not ok: ' + r.summary
    : calls.some(c => c.startsWith('mapper-') || c === 'delta-mapper' || c === 'architect-merge') ? 'a restart with the map already on disk must not re-run mappers'
    : !calls.includes('reparse-map') ? 'must reparse the run-dir map'
    : !r.completed_passes.includes(0) ? 'Pass 0 must count as complete' : '',
  l => l === 'bootstrap' ? { found: true, artifacts: { map: '# this run map', candidates: '', filtered: '', kill_report: '', drops: '', outcomes_prior: '' }, user_edits: '', map_cache: '', map_cache_sha: '', git_diff_ok: false, changed_since_cache: [] } : canned(l))
