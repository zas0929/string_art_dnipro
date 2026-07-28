export function getMigrationCandidates(localProjects, cloudProjects) {
  const cloudIds = new Set((cloudProjects || []).map(({ id }) => id));
  return (localProjects || []).filter(({ id }) => id && !cloudIds.has(id));
}
