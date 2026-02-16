## 2026-02-13 - Async Feedback Loops

**Learning:** In data-processing apps like Magellan, file conversions (MRX -> ACK/RESP) can take variable time. Users lack confidence without immediate feedback, leading to potential re-clicks.
**Action:** Always couple async action handlers with a dedicated loading state that disables the trigger button and shows a spinner. Also ensure these action buttons have explicit ARIA labels if they use icons as primary identifiers.

## 2026-02-16 - Grid Input Accessibility Context

**Learning:** In complex data grids (like Magellan's protocol visualizer), editable input fields lack visual labels since column headers may be scrolled out of view. Screen reader users navigating with Tab or arrow keys have no context about which field they're editing without ARIA labels.
**Action:** For grid-based editors, always add comprehensive `aria-label` attributes that include: field name, row number, and column position. Pair with `aria-describedby` for constraints (max length, format rules) and `aria-invalid` for validation state. This creates a complete mental model for assistive tech users.
