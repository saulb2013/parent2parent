// Parcel size presets shown to sellers when listing an item. The courier
// (Shiplogic/TCG) is billed on declared dimensions and weight — sellers
// pick the preset closest to their item so the buyer's shipping quote
// matches what we actually ship.
//
// Keep in sync with server/utils/parcelSizes.js (same values, same keys)
// — the server needs the raw dimensions when creating shipments, the
// client only needs the labels and descriptions for the dropdown UI.
export const PARCEL_SIZES = [
  {
    value: 'small',
    label: 'Small box',
    desc: 'Toys, shoes, feeding bottles — up to 2 kg',
  },
  {
    value: 'medium',
    label: 'Medium box',
    desc: 'Car seat bases, disassembled chairs, bulk toys — up to 5 kg',
  },
  {
    value: 'large',
    label: 'Large box',
    desc: 'Prams (folded), play mats, toddler toys — up to 10 kg',
  },
  {
    value: 'oversized',
    label: 'Oversized',
    desc: 'Cots, changing tables, large play equipment — up to 20 kg',
  },
];

// Default used for listings created before this feature existed, and
// whenever a seller doesn't pick one.
export const DEFAULT_PARCEL_SIZE = 'medium';

export const PARCEL_SIZE_LABELS = PARCEL_SIZES.reduce((acc, s) => {
  acc[s.value] = s.label;
  return acc;
}, {});
