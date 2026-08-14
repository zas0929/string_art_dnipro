export const BUILD_CHECKPOINTS = Object.freeze([3500, 4000]);

export function getCrossedBuildCheckpoints(
  previousStep,
  currentStep,
  total,
  checkpoints = BUILD_CHECKPOINTS,
) {
  const previous = Math.max(0, Number(previousStep) || 0);
  const current = Math.max(0, Number(currentStep) || 0);
  const maximum = Math.max(0, Number(total) || 0);

  if (current <= previous) return [];

  return checkpoints.filter((checkpoint) => (
    maximum >= checkpoint
    && previous < checkpoint
    && current >= checkpoint
  ));
}
