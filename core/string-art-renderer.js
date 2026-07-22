export const STRING_ART_WORK_SIZE = 560;

export function createCirclePoints(count, radius, cx, cy) {
  const points = [];
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2;
    points.push({
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
    });
  }
  return points;
}

export function renderStringArtBase(context, pointCount, canvasSize = context.canvas.width) {
  const center = canvasSize / 2;
  const radius = center - 20;
  context.clearRect(0, 0, canvasSize, canvasSize);
  context.fillStyle = "#f6f3ea";
  context.fillRect(0, 0, canvasSize, canvasSize);

  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#f8f6ef";
  context.fillRect(0, 0, canvasSize, canvasSize);
  context.restore();

  context.strokeStyle = "#2d2f34";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();
  renderNails(context, createCirclePoints(pointCount, radius, center, center), canvasSize);
}

export function renderStringArtLines(context, lines, points, options = {}) {
  const canvasSize = options.canvasSize ?? context.canvas.width;
  const workSize = options.workSize ?? STRING_ART_WORK_SIZE;
  const threadMm = options.threadMm ?? 0.19;
  const opticalPreview = options.opticalPreview ?? true;
  const startIndex = options.startIndex ?? 0;
  const scale = canvasSize / workSize;

  context.save();
  context.beginPath();
  context.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 20, 0, Math.PI * 2);
  context.clip();
  context.globalAlpha = opticalPreview ? 0.16 : 0.075 + threadMm * 0.32;
  context.strokeStyle = "#050506";
  context.lineWidth = opticalPreview
    ? Math.max(0.65, threadMm * 4.6)
    : Math.max(0.42, threadMm * 3.6);

  // Each line is stroked separately so intersections accumulate optical density.
  for (let index = startIndex; index < lines.length; index++) {
    const [fromIndex, toIndex] = lines[index];
    const from = points[fromIndex];
    const to = points[toIndex];
    if (!from || !to) continue;
    context.beginPath();
    context.moveTo(from.x * scale, from.y * scale);
    context.lineTo(to.x * scale, to.y * scale);
    context.stroke();
  }
  context.restore();
}

export function renderNails(context, points, canvasSize) {
  context.save();
  context.fillStyle = "#2e333b";
  context.strokeStyle = "#f3f5f7";
  context.lineWidth = 1;
  const dot = canvasSize > 500 ? 2.1 : 1.2;
  const labelEvery = Math.max(1, Math.ceil(points.length / 30));

  points.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, dot, 0, Math.PI * 2);
    context.fill();
    const pointNumber = index + 1;
    if (pointNumber !== 1 && pointNumber !== points.length && pointNumber % labelEvery !== 0) return;

    const labelX = point.x + (point.x - canvasSize / 2) * 0.035;
    let labelY = point.y + (point.y - canvasSize / 2) * 0.035;
    if (pointNumber === 1) labelY += 8;
    if (pointNumber === points.length) labelY -= 8;
    context.fillStyle = "#5c6470";
    context.font = "10px ui-monospace, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(pointNumber), labelX, labelY);
    context.fillStyle = "#2e333b";
  });
  context.restore();
}
