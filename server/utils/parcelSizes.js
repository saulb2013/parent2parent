// Concrete dimensions for each parcel size preset — used when creating
// shipments and when requesting shipping rates from The Courier Guy.
//
// Keep in sync with client/src/constants/parcelSizes.js (same values,
// same keys). The client only needs labels; the server only needs the
// physical dimensions. Both sides own their piece independently.
const PARCEL_DIMENSIONS = {
  small:     { length: 30, width: 20, height: 15, weight: 2 },
  medium:    { length: 40, width: 30, height: 25, weight: 5 },
  large:     { length: 60, width: 40, height: 30, weight: 10 },
  oversized: { length: 100, width: 50, height: 40, weight: 20 },
};

const DEFAULT_PARCEL_SIZE = 'medium';

// Resolve a parcel size key (possibly null / unknown) to its physical
// dimensions, falling back to `medium` for legacy or invalid values.
function getParcelDimensions(size) {
  return PARCEL_DIMENSIONS[size] || PARCEL_DIMENSIONS[DEFAULT_PARCEL_SIZE];
}

// Shape the dimensions into the Shiplogic `parcels[]` entry format.
function parcelForShiplogic(size) {
  const d = getParcelDimensions(size);
  return {
    submitted_length_cm: d.length,
    submitted_width_cm: d.width,
    submitted_height_cm: d.height,
    submitted_weight_kg: d.weight,
  };
}

module.exports = {
  PARCEL_DIMENSIONS,
  DEFAULT_PARCEL_SIZE,
  getParcelDimensions,
  parcelForShiplogic,
};
