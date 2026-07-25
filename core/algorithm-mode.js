export const SUPPORTED_ALGORITHMS = Object.freeze([
  "portrait-v4",
  "portrait-v5",
  "portrait-v6",
  "reference-v7",
]);

export function isOpticalAlgorithm(algorithm) {
  return algorithm === "portrait-v4"
    || algorithm === "portrait-v5"
    || algorithm === "portrait-v6";
}

export function isReferenceAlgorithm(algorithm) {
  return algorithm === "reference-v7";
}

export function isMultiScaleAlgorithm(algorithm) {
  return algorithm === "portrait-v5" || algorithm === "portrait-v6";
}

export function isStableV5Algorithm(algorithm) {
  return algorithm === "portrait-v5";
}

export function usesImprovedOpticalKernel(algorithm) {
  return false;
}

export function usesReferenceCalibratedRoute(algorithm) {
  return algorithm === "portrait-v6";
}

export function usesAutomaticNeutralBackground(algorithm) {
  return algorithm === "portrait-v5" || algorithm === "portrait-v6";
}

export function canRefineAlgorithm(algorithm) {
  return algorithm === "portrait-v6";
}
