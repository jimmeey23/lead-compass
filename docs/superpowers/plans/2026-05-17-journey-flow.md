# Journey Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a filtered Journey Flow dashboard view that shows the lead acquisition route as a river-style infographic with branch exits and sales insights.

**Architecture:** Add deterministic funnel classification in `src/lib/journey-flow.ts`, test it with Vitest, and render it with a new `src/components/JourneyFlow.tsx` component. Register the view in the existing `Index.tsx` tab switch and `ViewMode` union so it respects the current filtered lead dataset.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, lucide-react, Vitest.

---

## File Structure

- Create `src/lib/journey-flow.ts`: owns classification, stage counts, branch counts, source summary, insight metrics, and SVG layout helper values.
- Create `src/test/journey-flow.test.ts`: validates deterministic mapping and edge cases.
- Create `src/components/JourneyFlow.tsx`: owns the visual river route, branch labels, insight tiles, and source breakdown.
- Modify `src/types/leads.ts`: adds `journey-flow` to `ViewMode`.
- Modify `src/pages/Index.tsx`: imports and registers the new view.

---

### Task 1: Journey Flow Analytics Utility

**Files:**
- Create: `src/lib/journey-flow.ts`
- Test: `src/test/journey-flow.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/journey-flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildJourneyFlow } from '@/lib/journey-flow';
import type { Lead } from '@/types/leads';

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1',
  fullName: 'Test Lead',
  phoneNumber: '',
  email: '',
  createdAt: '2026-05-01',
  sourceId: '',
  sourceName: 'Instagram',
  memberId: '',
  convertedAt: '',
  stageId: '',
  stageName: 'New Lead',
  associate: '',
  remarks: '',
  followUps: [],
  center: '',
  classType: '',
  hostId: '',
  status: 'Active',
  channel: '',
  period: '',
  purchasesMade: 0,
  ltv: 0,
  visits: 0,
  trialStatus: '',
  conversionStatus: '',
  retentionStatus: '',
  ...overrides,
});

describe('journey flow', () => {
  it('counts the main journey stages and branch exits', () => {
    const result = buildJourneyFlow([
      lead({ id: 'new', stageName: 'New Lead' }),
      lead({ id: 'contacted', stageName: 'Contacted' }),
      lead({ id: 'scheduled', stageName: 'Trial Scheduled', trialStatus: 'Scheduled' }),
      lead({ id: 'completed', stageName: 'Trial Completed', trialStatus: 'Completed' }),
      lead({ id: 'converted', conversionStatus: 'Converted', convertedAt: '2026-05-12', ltv: 12000 }),
      lead({ id: 'no-response', stageName: 'No Response' }),
      lead({ id: 'missed', trialStatus: 'No Show' }),
      lead({ id: 'lost', status: 'Not Interested' }),
    ]);

    expect(result.totalLeads).toBe(8);
    expect(result.stages.map((stage) => [stage.key, stage.count])).toEqual([
      ['source', 8],
      ['newLead', 1],
      ['contacted', 1],
      ['trialScheduled', 2],
      ['trialCompleted', 1],
      ['converted', 1],
    ]);
    expect(result.branches.map((branch) => [branch.key, branch.count])).toEqual([
      ['noResponse', 1],
      ['trialNotAttended', 1],
      ['lost', 1],
    ]);
    expect(result.insights.conversionRate).toBe(12.5);
    expect(result.insights.convertedLtv).toBe(12000);
    expect(result.insights.biggestLeakage?.label).toBe('No response');
  });

  it('groups missing sources and ranks top sources by lead count', () => {
    const result = buildJourneyFlow([
      lead({ id: 'unknown', sourceName: '' }),
      lead({ id: 'insta-1', sourceName: 'Instagram' }),
      lead({ id: 'insta-2', sourceName: 'Instagram' }),
      lead({ id: 'walkin', sourceName: 'Walk-in' }),
    ]);

    expect(result.sources).toEqual([
      { label: 'Instagram', count: 2, percentage: 50 },
      { label: 'Unknown Source', count: 1, percentage: 25 },
      { label: 'Walk-in', count: 1, percentage: 25 },
    ]);
    expect(result.insights.topSource?.label).toBe('Instagram');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/test/journey-flow.test.ts`

Expected: FAIL because `src/lib/journey-flow.ts` does not exist.

- [ ] **Step 3: Implement analytics utility**

Create `src/lib/journey-flow.ts` with:

```ts
import type { Lead } from '@/types/leads';
import { cleanLooseText, isSalesConvertedLead } from '@/lib/lead-utils';

export type JourneyStageKey = 'source' | 'newLead' | 'contacted' | 'trialScheduled' | 'trialCompleted' | 'converted';
export type JourneyBranchKey = 'noResponse' | 'trialNotAttended' | 'lost';

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
  count: number;
  percentage: number;
  previousConversionRate: number | null;
}

export interface JourneyBranch {
  key: JourneyBranchKey;
  label: string;
  fromStageKey: JourneyStageKey;
  count: number;
  percentage: number;
}

export interface JourneySource {
  label: string;
  count: number;
  percentage: number;
}

export interface JourneyInsight {
  conversionRate: number;
  trialYield: number;
  convertedLtv: number;
  topSource: JourneySource | null;
  biggestLeakage: JourneyBranch | null;
}

export interface JourneyFlowData {
  totalLeads: number;
  stages: JourneyStage[];
  branches: JourneyBranch[];
  sources: JourneySource[];
  insights: JourneyInsight;
}

const STAGE_DEFS: Array<{ key: JourneyStageKey; label: string }> = [
  { key: 'source', label: 'Source' },
  { key: 'newLead', label: 'New Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'trialScheduled', label: 'Trial Scheduled' },
  { key: 'trialCompleted', label: 'Trial Completed' },
  { key: 'converted', label: 'Converted' },
];

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeLeadText(lead: Lead): string {
  return [
    lead.stageName,
    lead.status,
    lead.trialStatus,
    lead.conversionStatus,
    lead.remarks,
  ].map((value) => cleanLooseText(value).toLowerCase()).join(' ');
}

function isNoResponse(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/no response/, /unresponsive/, /did not answer/, /not answering/, /call back pending/]);
}

function isTrialNotAttended(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/no show/, /not attended/, /missed trial/, /trial missed/, /did not attend/]);
}

function isLost(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/not interested/, /lost/, /dropped/, /dead/, /cancel/]);
}

function isTrialCompleted(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/trial completed/, /completed trial/, /attended trial/, /trial done/, /completed/]);
}

function isTrialScheduled(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/trial scheduled/, /trial booked/, /scheduled/, /booked/, /appointment/]);
}

function isContacted(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/contacted/, /called/, /whatsapp/, /follow up/, /follow-up/, /spoken/, /consultation/]);
}

function isNewLead(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/new lead/, /fresh/, /new enquiry/, /inquiry/, /enquiry/]);
}

function percentage(count: number, total: number): number {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function countByPredicate(leads: Lead[], predicate: (lead: Lead) => boolean): number {
  return leads.reduce((count, lead) => count + (predicate(lead) ? 1 : 0), 0);
}

export function buildJourneyFlow(leads: Lead[]): JourneyFlowData {
  const totalLeads = leads.length;
  const rawCounts: Record<JourneyStageKey, number> = {
    source: totalLeads,
    newLead: countByPredicate(leads, isNewLead),
    contacted: countByPredicate(leads, isContacted),
    trialScheduled: countByPredicate(leads, isTrialScheduled),
    trialCompleted: countByPredicate(leads, isTrialCompleted),
    converted: countByPredicate(leads, isSalesConvertedLead),
  };

  const stages = STAGE_DEFS.map((stage, index): JourneyStage => {
    const previous = index > 0 ? rawCounts[STAGE_DEFS[index - 1].key] : 0;
    return {
      ...stage,
      count: rawCounts[stage.key],
      percentage: percentage(rawCounts[stage.key], totalLeads),
      previousConversionRate: index === 0 ? null : percentage(rawCounts[stage.key], previous),
    };
  });

  const branches: JourneyBranch[] = [
    { key: 'noResponse', label: 'No response', fromStageKey: 'contacted', count: countByPredicate(leads, isNoResponse), percentage: 0 },
    { key: 'trialNotAttended', label: 'Trial not attended', fromStageKey: 'trialScheduled', count: countByPredicate(leads, isTrialNotAttended), percentage: 0 },
    { key: 'lost', label: 'Lost / Not interested', fromStageKey: 'contacted', count: countByPredicate(leads, isLost), percentage: 0 },
  ].map((branch) => ({ ...branch, percentage: percentage(branch.count, totalLeads) }));

  const sourceCounts = new Map<string, number>();
  for (const lead of leads) {
    const source = cleanLooseText(lead.sourceName) || 'Unknown Source';
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const sources = Array.from(sourceCounts.entries())
    .map(([label, count]) => ({ label, count, percentage: percentage(count, totalLeads) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);

  const convertedLtv = leads.reduce((sum, lead) => sum + (isSalesConvertedLead(lead) ? Number(lead.ltv) || 0 : 0), 0);
  const trialCompleted = rawCounts.trialCompleted;

  return {
    totalLeads,
    stages,
    branches,
    sources,
    insights: {
      conversionRate: percentage(rawCounts.converted, totalLeads),
      trialYield: percentage(rawCounts.converted, trialCompleted),
      convertedLtv,
      topSource: sources[0] ?? null,
      biggestLeakage: branches.slice().sort((a, b) => b.count - a.count)[0] ?? null,
    },
  };
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/test/journey-flow.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/journey-flow.ts src/test/journey-flow.test.ts
git commit -m "Add journey flow analytics"
```

---

### Task 2: Journey Flow Component

**Files:**
- Create: `src/components/JourneyFlow.tsx`

- [ ] **Step 1: Create component**

Create `src/components/JourneyFlow.tsx` with a React component that:

- Accepts `leads: Lead[]`.
- Calls `buildJourneyFlow(leads)` in `useMemo`.
- Shows an empty state when `leads.length === 0`.
- Renders a horizontally scrollable SVG river flow.
- Renders stage nodes, branch chips, insight tiles, and source bars.

- [ ] **Step 2: Use these visual constants**

Use this data inside the component:

```ts
const NODE_POSITIONS = {
  source: { x: 56, y: 170 },
  newLead: { x: 214, y: 92 },
  contacted: { x: 384, y: 138 },
  trialScheduled: { x: 554, y: 188 },
  trialCompleted: { x: 732, y: 132 },
  converted: { x: 912, y: 170 },
} as const;

const STAGE_COLORS = {
  source: '#7f1231',
  newLead: '#9f1d4c',
  contacted: '#c2416b',
  trialScheduled: '#e96f78',
  trialCompleted: '#f4a261',
  converted: '#2f855a',
} as const;
```

- [ ] **Step 3: Render the river**

Render an SVG with:

- Main path: `M64 170 C150 78, 226 78, 330 132 S520 230, 640 178 S820 90, 920 170`
- Stroke width scaled from total leads, minimum `34`, maximum `78`.
- Branch paths from contacted to no response, trial scheduled to missed trial, contacted to lost.
- Node circles with labels and count chips.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/JourneyFlow.tsx
git commit -m "Add journey flow visualization"
```

---

### Task 3: Register Dashboard View

**Files:**
- Modify: `src/types/leads.ts`
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: Add view mode**

In `src/types/leads.ts`, change:

```ts
export type ViewMode = 'table' | 'compact' | 'periodic' | 'stage-board' | 'center-board' | 'associate' | 'comparison';
```

to:

```ts
export type ViewMode = 'table' | 'compact' | 'periodic' | 'journey-flow' | 'stage-board' | 'center-board' | 'associate' | 'comparison';
```

- [ ] **Step 2: Import component and icon**

In `src/pages/Index.tsx`, import `JourneyFlow` from `@/components/JourneyFlow` and add `Route` to the lucide import.

- [ ] **Step 3: Add navigation entry**

Add this entry after Periodic:

```ts
{ key: 'journey-flow', label: 'Journey Flow', icon: Route },
```

- [ ] **Step 4: Add render branch**

Add this render branch after Periodic:

```tsx
{view === 'journey-flow' && <JourneyFlow leads={filteredLeads} />}
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/test/journey-flow.test.ts
npm run build
```

Expected: both PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/types/leads.ts src/pages/Index.tsx
git commit -m "Register journey flow dashboard view"
```

---

### Task 4: Browser Verification

**Files:**
- No planned source edits unless visual QA reveals a defect.

- [ ] **Step 1: Start dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL.

- [ ] **Step 2: Verify desktop**

Open the app at the Vite URL. Confirm:

- `Journey Flow` appears in the dashboard navigation.
- The river flow renders without blank SVG areas.
- Stage labels and insight tiles do not overlap.
- Existing filters remain visible and change the counts.

- [ ] **Step 3: Verify mobile width**

Set viewport around `390x844`. Confirm:

- The river panel scrolls horizontally.
- Insight tiles stack cleanly.
- Text remains readable and does not overlap.

- [ ] **Step 4: Final status**

Run:

```bash
git status --short
```

Expected: clean or only intentional uncommitted verification artifacts.
