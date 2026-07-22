export function formatSchemeText(sequence) {
  const lines = ["Points______Lines/n1____0/"];
  for (let order = 1; order < sequence.length; order++) {
    lines.push(`${sequence[order] + 1}____  ${order}`);
  }
  return lines.join("\n");
}

export function formatCsvText(sequence) {
  const rows = ["step,from,to"];
  for (let order = 1; order < sequence.length; order++) {
    rows.push(`${order},${sequence[order - 1] + 1},${sequence[order] + 1}`);
  }
  return rows.join("\n");
}
