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
// === Task 2: constants & schemas ===
// === Task 3: plumbing helpers ===
// === Task 4: passes 0-2 ===
// === Task 5: pass 3 ===
// === Task 6: pass 4 + run dispatcher ===
return { ok: true, partial: false, completed_passes: [], summary: 'skeleton', artifacts: [], counts: {}, decisions_needed: [], resume_command: '' }
