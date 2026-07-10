# Dispatch envelope promotion checklist

Promotion remains blocked until the exact release SHA has all required GitHub checks and the following manual audits recorded.

- [ ] NVDA with current Chrome: range state, marker names, drawer focus, table, and export result announced correctly.
- [ ] VoiceOver with current Safari: range state, marker names, drawer focus, table, and export result announced correctly.
- [ ] Branch protection requires `install`, `quality`, `unit`, `build`, `browser`, and `audit` on the exact head SHA.
- [ ] Vercel success is treated as supplementary and does not override required checks.

Record tester, browser/AT versions, exact commit SHA, date, failures, and remediation links below before promotion.
