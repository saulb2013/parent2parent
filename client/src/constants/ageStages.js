// Single source of truth for the age/stage values used across the
// marketplace. The `value` is what gets persisted to the DB and sent
// over the wire; the `label` is what users see.
//
// Keep this list in sync with the server-side validation in
// server/routes/listings.js if you ever add validation there.
export const AGE_STAGES = [
  // Baby & child ages
  { value: 'newborn', label: 'Newborn' },
  { value: '0-3m',    label: '0–3 months' },
  { value: '3-6m',    label: '3–6 months' },
  { value: '6-12m',   label: '6–12 months' },
  { value: '12-18m',  label: '12–18 months' },
  { value: '18-24m',  label: '18–24 months' },
  { value: '2-3y',    label: '2–3 years' },
  { value: '3-4y',    label: '3–4 years' },
  { value: '4-5y',    label: '4–5 years' },
  { value: '5-6y',    label: '5–6 years' },
  { value: '6+',      label: '6+ years' },
  // Parent / maternity stages
  { value: 'pregnancy',  label: 'Pregnancy' },
  { value: 'postpartum', label: 'Postpartum / Nursing' },
  { value: 'parent',     label: 'Parent (any stage)' },
];

// Quick lookup: value → label
export const AGE_STAGE_LABELS = AGE_STAGES.reduce((acc, s) => {
  acc[s.value] = s.label;
  return acc;
}, {});
