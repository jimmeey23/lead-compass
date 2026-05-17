# Journey Flow View Design

## Goal

Add a new dashboard view named **Journey Flow** that visualizes the lead acquisition route as an infographic-style river flow. The view should help the Physique 57 India team see where leads enter, move forward, stall, drop off, and convert.

## Funnel Route

The primary journey route is:

`Source -> New Lead -> Contacted -> Trial Scheduled -> Trial Completed -> Converted`

Branch flows show journey exits and loops:

- `Contacted -> No Response`
- `Trial Scheduled -> Trial Not Attended`
- active stages -> `Lost / Not Interested`

## Data Mapping

The view will use existing lead records and respect the dashboard's current filtered dataset.

Fields used:

- `sourceName` for acquisition source grouping.
- `stageName` and `status` for contacted, lost, no-response, and active-stage classification.
- `trialStatus` for trial scheduled, completed, and missed classification.
- `conversionStatus` and `convertedAt` for converted classification.
- `ltv` for converted revenue summary.

Classification should be deterministic and local to the component. It should use resilient text matching because source data may contain inconsistent wording.

## UI Structure

The tab navigation adds **Journey Flow** with a route-oriented icon.

The view contains:

- A header with title, filtered lead count, and route description.
- A Sankey-inspired river visualization where band thickness represents lead volume.
- Stage nodes showing count, percent of total leads, and previous-step conversion where applicable.
- Branch bands for no response, missed trial, and lost/not interested.
- Insight tiles for conversion rate, biggest leakage point, trial yield, top source, and converted LTV.
- A source breakdown panel that shows the top acquisition sources feeding the journey.

## Visual Direction

Use a polished infographic style, not a standard chart. The main route should feel like a flowing river with clear nodes and branch exits.

Styling should fit the existing app:

- Use the current card, border, background, and dark-mode tokens.
- Keep radius at or below existing dashboard patterns.
- Avoid one-note palettes by combining Physique 57 rose tones with green, amber, slate, and neutral surfaces.
- Keep labels compact and readable on mobile.

## Responsive Behavior

Desktop:

- River visualization is the primary horizontal feature.
- Insight tiles and source breakdown sit below or beside the river depending on available width.

Mobile:

- River can horizontally scroll inside its panel.
- Insights stack into two-column or single-column tiles.
- Text must not overlap or resize the layout unexpectedly.

## Empty And Edge States

- If there are no filtered leads, show an empty state inside the Journey Flow view.
- If a stage has zero leads, keep the node visible with zero count so the journey route remains understandable.
- If source data is missing, group it as `Unknown Source`.

## Testing

Verification should include:

- TypeScript/build checks.
- Existing tests if available.
- Browser visual check at desktop and mobile widths.
- Confirm that the view respects existing filters.
