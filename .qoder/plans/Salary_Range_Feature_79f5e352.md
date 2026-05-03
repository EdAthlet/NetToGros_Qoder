# Salary Range Batch Calculation Feature

All changes in `c:\Users\flyin\Desktop\NetToGros_Qoder\index.html`.

## Task 1: Add collapsible "Salary Range" HTML section

Insert after the input amount form-group (after line 1076), before the Family Status form-group:

- A clickable header/toggle: "Salary Range" with a chevron indicator (e.g., `▸` / `▾`)
- A hidden div (`id="salaryRangeSection"`, `style="display: none;"`) containing:
  - A second input field (`id="rangeEndAmount"`, type="number") labeled dynamically (e.g., "Upper Gross Weekly Salary (€):")
  - A hint text: "Enter upper salary to calculate 11 evenly spaced values"
- Styled consistently with the existing `.manual-input-section` pattern (light background, border, rounded corners)

## Task 2: Add CSS for the collapsible section

- `.salary-range-toggle` — clickable header with cursor:pointer, subtle styling
- `.salary-range-section` — similar to `.manual-input-section` (background: #f8f9fa, border, padding, border-radius)
- Responsive: ensure the section works on mobile (single column under 768px)

## Task 3: JavaScript — Toggle visibility and dynamic labels

- Toggle click handler on the "Salary Range" header to show/hide `#salaryRangeSection`
- Update `updateLabels()` function to also set the range field label dynamically based on period and calc type (e.g., "Upper Gross Weekly Salary (€):" or "Upper Desired Net Monthly Salary (€):")

## Task 4: JavaScript — Dynamic Calculate button text

- Listen to `input` events on `#rangeEndAmount`
- When the range field has a valid value > 0, change Calculate button text to "Calculate Range"
- When the range field is empty or 0, revert button text to "Calculate"
- Also handle: when the salary range section is collapsed/hidden, clear the range field and revert button text

## Task 5: JavaScript — Modify `calculate()` for range mode

When the range field has a value:
1. Read both values: `inputAmount.value` (low) and `rangeEndAmount.value` (high)
2. Validate: both must be positive, high > low, both under €1,000,000
3. If low > high, swap them automatically
4. Calculate step size: `(high - low) / 10` to produce 11 values (inclusive of both endpoints)
5. Loop through 11 values, for each:
   - Convert to annual via `convertToAnnual()`
   - Run the appropriate calculation (`calculateGrossFromNet` or `calculateNetFromGross`)
   - Build a details object (same as current single calculation)
   - Call `saveToHistory()` for each (in order from lowest to highest)
6. Display results for the **last** calculation (highest value) in the main output area
7. Show "Done" feedback with count: "Done ✓ (11)" for 1 second
8. Call `displayHistory()` to refresh

**History limit adjustment for range mode**: Temporarily allow up to 11 entries from the batch (the 11 new entries replace everything). The `saveToHistory` already caps at 10 — for range mode, we'll save all 11 directly to localStorage in one batch rather than calling `saveToHistory` 11 times.

## Task 6: Adjust `saveToHistory` / add batch save

Add a `saveHistoryBatch(entries)` function that:
- Takes an array of history entry objects
- Replaces the current history with these entries (up to 11 for range, keeping newest first)
- Saves to localStorage in one operation

This avoids the 10-entry cap trimming entries mid-batch.

## Summary of user-visible behavior

| Range field state | Button text | Click behavior |
|---|---|---|
| Empty / hidden | "Calculate" | Single calculation (current behavior) |
| Has valid value | "Calculate Range" | 11 calculations saved to History, results shown for highest value |
