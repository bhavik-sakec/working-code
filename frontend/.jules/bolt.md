# Bolt's Journal - Performance Optimizations

This journal tracks critical performance learnings and optimizations.

## 2026-02-16 - Optimized GridRow Re-renders

**Learning:** Passing complex objects (like `activeCell` or `editingField`) as props to memoized components causes all instances to re-render whenever any property of those objects changes, even if the specific instance is not affected.

**Action:** Refactored `GridRow` to accept primitive props (`activeCol`, `editingCol`, `editingValue`) instead of the full `activeCell` and `editingField` objects.

- **Impact:** Moving the selection cursor now only re-renders the previously active row and the new active row, instead of every visible row in the virtualized list.
- **Measurable Improvement:** In a view with 20 rows visible, re-renders during navigation dropped from 20 rows to 2 rows per movement.
