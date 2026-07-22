#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy import sparse
from skimage import exposure, filters


@dataclass
class Settings:
    image_size: int = 640
    points: int = 240
    lines: int = 4500
    size_cm: float = 47.0
    thread_mm: float = 0.16
    line_strength: float = 0.055
    min_skip: int = 16
    zoom: float = 1.0
    offset_x: float = 0.0
    offset_y: float = 0.0
    profile: str = "portrait"
    mode: str = "multi"
    render_alpha: float = 0.043
    render_width: float = 0.48


PROFILE_PRESETS = {
    "raw": {
        "gamma": 0.95,
        "edge_weight": 0.06,
        "local_weight": 0.15,
        "shadow_weight": 0.95,
        "overdraw": 0.020,
        "detail_boost": 0.25,
    },
    "portrait": {
        "gamma": 0.78,
        "edge_weight": 0.20,
        "local_weight": 0.42,
        "shadow_weight": 0.92,
        "overdraw": 0.024,
        "detail_boost": 0.44,
    },
    "high_detail": {
        "gamma": 0.70,
        "edge_weight": 0.32,
        "local_weight": 0.55,
        "shadow_weight": 0.88,
        "overdraw": 0.030,
        "detail_boost": 0.62,
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="High quality string art experiment runner.")
    parser.add_argument("image", type=Path, help="Source image path")
    parser.add_argument("--out", type=Path, default=Path("outputs/experiment"), help="Output directory")
    parser.add_argument("--profile", choices=sorted(PROFILE_PRESETS), default="portrait")
    parser.add_argument("--mode", choices=("single", "multi"), default="multi")
    parser.add_argument("--points", type=int, default=240)
    parser.add_argument("--lines", type=int, default=4500)
    parser.add_argument("--size", type=float, default=47.0, help="Physical picture diameter in cm")
    parser.add_argument("--image-size", type=int, default=640, help="Internal square working size")
    parser.add_argument("--thread", type=float, default=0.16, help="Thread thickness in mm")
    parser.add_argument("--strength", type=float, default=0.055, help="Per-line darkness subtraction")
    parser.add_argument("--min-skip", type=int, default=16)
    parser.add_argument("--zoom", type=float, default=1.0)
    parser.add_argument("--offset-x", type=float, default=0.0, help="Crop offset in working pixels")
    parser.add_argument("--offset-y", type=float, default=0.0, help="Crop offset in working pixels")
    parser.add_argument("--render-alpha", type=float, default=0.043, help="Preview darkness per rendered line")
    parser.add_argument("--render-width", type=float, default=0.48, help="Preview line width bias")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = Settings(
        image_size=args.image_size,
        points=args.points,
        lines=args.lines,
        size_cm=args.size,
        thread_mm=args.thread,
        line_strength=args.strength,
        min_skip=args.min_skip,
        zoom=args.zoom,
        offset_x=args.offset_x,
        offset_y=args.offset_y,
        profile=args.profile,
        mode=args.mode,
        render_alpha=args.render_alpha,
        render_width=args.render_width,
    )

    args.out.mkdir(parents=True, exist_ok=True)
    source = load_source_image(args.image)
    crop = crop_to_square(source, settings)
    layers = build_target_layers(crop, settings)
    target = layers["combined"]

    crop.save(args.out / "source_crop.png")
    save_gray(args.out / "target_map.png", 1.0 - target)
    save_gray(args.out / "target_shadow.png", 1.0 - layers["shadow"])
    save_gray(args.out / "target_detail.png", 1.0 - layers["detail"])
    save_gray(args.out / "target_edges.png", 1.0 - layers["edge"])
    save_gray(args.out / "subject_mask.png", 1.0 - layers["subject"])

    points = circle_points(settings.points, settings.image_size)
    line_index = build_line_index(points, settings.image_size)
    if settings.mode == "multi":
        sequence, diagnostics = generate_sequence_multipass(layers, line_index, settings)
    else:
        sequence, diagnostics = generate_sequence(target, line_index, settings)
    preview = render_preview(sequence, points, settings)

    preview.save(args.out / "preview.png")
    write_sequence(args.out / "sequence.txt", sequence, settings)
    write_csv(args.out / "sequence.csv", sequence)
    write_report(args.out / "report.json", args.image, settings, diagnostics)

    print(f"Done: {args.out}")
    print(f"Lines: {len(sequence) - 1}")
    print(f"Preview: {args.out / 'preview.png'}")


def load_source_image(path: Path) -> Image.Image:
    image = Image.open(path)
    if image.mode in ("RGBA", "LA") or ("transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (246, 243, 234, 255))
        background.alpha_composite(rgba)
        return background.convert("RGB")
    return image.convert("RGB")


def crop_to_square(image: Image.Image, settings: Settings) -> Image.Image:
    size = settings.image_size
    canvas = Image.new("RGB", (size, size), "white")
    scale = max(size / image.width, size / image.height) * settings.zoom
    width = image.width * scale
    height = image.height * scale
    x = size / 2 - width / 2 + settings.offset_x
    y = size / 2 - height / 2 + settings.offset_y
    resized = image.resize((round(width), round(height)), Image.Resampling.LANCZOS)
    canvas.paste(resized, (round(x), round(y)))
    return canvas


def build_target_map(image: Image.Image, settings: Settings) -> np.ndarray:
    return build_target_layers(image, settings)["combined"]


def build_target_layers(image: Image.Image, settings: Settings) -> dict[str, np.ndarray]:
    preset = PROFILE_PRESETS[settings.profile]
    rgb = np.asarray(image).astype(np.float32) / 255.0
    gray = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    mask = circle_mask(settings.image_size)

    values = gray[mask]
    low, high = np.percentile(values, (1.0, 99.5))
    normalized = np.clip((gray - low) / max(0.05, high - low), 0, 1)
    subject = estimate_subject_mask(rgb, mask)

    # CLAHE gives the optimizer enough facial detail without changing the visible source image.
    adaptive = exposure.equalize_adapthist(normalized, kernel_size=settings.image_size // 8, clip_limit=0.012)
    smooth = ndimage.gaussian_filter(adaptive, sigma=3.0)
    local = np.clip(adaptive + (adaptive - smooth) * preset["local_weight"], 0, 1)
    broad = ndimage.gaussian_filter(local, sigma=7.0)

    edge = filters.sobel(local)
    edge = edge / max(1e-6, edge[mask].max())
    fine = np.abs(local - ndimage.gaussian_filter(local, sigma=1.35))
    fine = fine / max(1e-6, np.percentile(fine[mask], 99.0))
    detail = np.clip(np.power(edge, 0.58) * 0.70 + np.power(fine, 0.70) * 0.30, 0, 1)
    subject_weight = 0.34 + subject * 0.92
    detail_weight = 0.42 + subject * 0.95

    darkness = np.power(np.clip(1.0 - local, 0, 1), preset["gamma"])
    shadow = np.power(np.clip(1.0 - broad, 0, 1), preset["gamma"]) * subject_weight
    structure = np.clip(darkness * subject_weight * 0.78 + detail * detail_weight * preset["detail_boost"], 0, 1)
    detail = np.clip(detail * detail_weight, 0, 1)
    combined = darkness * subject_weight * preset["shadow_weight"] + detail * preset["edge_weight"]

    layers = {
        "shadow": np.clip(shadow, 0, 1),
        "structure": np.clip(structure, 0, 1),
        "detail": np.clip(detail, 0, 1),
        "edge": np.clip(edge, 0, 1),
        "subject": np.clip(subject, 0, 1),
        "combined": np.clip(combined, 0, 1),
    }
    for layer in layers.values():
        layer[~mask] = 0
    return {name: layer.astype(np.float32) for name, layer in layers.items()}


def estimate_subject_mask(rgb: np.ndarray, circle: np.ndarray) -> np.ndarray:
    height, width, _ = rgb.shape
    border = max(10, min(height, width) // 18)
    border_mask = np.zeros((height, width), dtype=bool)
    border_mask[:border, :] = True
    border_mask[-border:, :] = True
    border_mask[:, :border] = True
    border_mask[:, -border:] = True
    border_mask &= circle

    background = np.median(rgb[border_mask], axis=0)
    color_distance = np.linalg.norm(rgb - background, axis=2) / math.sqrt(3)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    raw = np.maximum(color_distance, chroma * 0.72)
    low, high = np.percentile(raw[circle], (42, 96))
    subject = np.clip((raw - low) / max(1e-4, high - low), 0, 1)
    subject = ndimage.gaussian_filter(subject, sigma=2.0)
    subject = ndimage.binary_closing(subject > 0.18, iterations=3).astype(np.float32)
    subject = ndimage.gaussian_filter(subject, sigma=5.0)
    subject = np.clip(subject, 0, 1)
    subject[~circle] = 0
    return subject


def circle_mask(size: int) -> np.ndarray:
    yy, xx = np.mgrid[0:size, 0:size]
    radius = size / 2 - 8
    return (xx - size / 2) ** 2 + (yy - size / 2) ** 2 <= radius**2


def circle_points(count: int, size: int) -> list[tuple[int, int]]:
    radius = size / 2 - 8
    cx = cy = size / 2
    points = []
    for index in range(count):
        angle = -math.pi / 2 + index / count * math.tau
        points.append((round(cx + math.cos(angle) * radius), round(cy + math.sin(angle) * radius)))
    return points


@dataclass
class LineIndex:
    lines: list[np.ndarray]
    pairs: list[tuple[int, int]]
    options: list[list[tuple[int, int]]]
    matrix: sparse.csr_matrix


def build_line_index(points: list[tuple[int, int]], size: int) -> LineIndex:
    count = len(points)
    lines: list[np.ndarray] = []
    pairs: list[tuple[int, int]] = []
    options: list[list[tuple[int, int]]] = [[] for _ in range(count)]
    rows = []
    cols = []
    data = []

    for a in range(count):
        for b in range(a + 1, count):
            idx = raster_line(points[a], points[b], size)
            edge_id = len(lines)
            lines.append(idx)
            pairs.append((a, b))
            options[a].append((edge_id, b))
            options[b].append((edge_id, a))
            weight = 1.0 / math.sqrt(max(1, len(idx)))
            rows.extend([edge_id] * len(idx))
            cols.extend(idx.tolist())
            data.extend([weight] * len(idx))

    matrix = sparse.csr_matrix((data, (rows, cols)), shape=(len(lines), size * size), dtype=np.float32)
    return LineIndex(lines=lines, pairs=pairs, options=options, matrix=matrix)


def raster_line(a: tuple[int, int], b: tuple[int, int], size: int) -> np.ndarray:
    x0, y0 = a
    x1, y1 = b
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    indices: list[int] = []
    seen = set()

    while True:
        if 0 <= x0 < size and 0 <= y0 < size:
            idx = y0 * size + x0
            if idx not in seen:
                indices.append(idx)
                seen.add(idx)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy

    return np.asarray(indices, dtype=np.int32)


def generate_sequence(
    target: np.ndarray,
    line_index: LineIndex,
    settings: Settings,
) -> tuple[list[int], dict[str, float]]:
    preset = PROFILE_PRESETS[settings.profile]
    flat_target = target.reshape(-1)
    residual = flat_target.copy()
    drawn = np.zeros_like(residual)
    sequence = [0]
    current = 0
    count = settings.points

    for step in range(settings.lines):
        options = [(edge_id, candidate) for edge_id, candidate in line_index.options[current] if circular_distance(current, candidate, count) >= settings.min_skip]
        if not options:
            break

        edge_ids = np.asarray([edge_id for edge_id, _ in options], dtype=np.int32)
        candidates = [candidate for _, candidate in options]
        residual_score = line_index.matrix[edge_ids].dot(residual * residual)
        overdraw_pixels = np.maximum(0, drawn - residual - settings.line_strength)
        overdraw_score = line_index.matrix[edge_ids].dot(overdraw_pixels)
        scores = residual_score - overdraw_score * preset["overdraw"]
        best_pos = int(np.argmax(scores))
        best = candidates[best_pos]
        best_edge = int(edge_ids[best_pos])

        if best < 0:
            break

        idx = line_index.lines[best_edge]
        residual[idx] = np.maximum(0, residual[idx] - settings.line_strength)
        drawn[idx] += settings.line_strength
        sequence.append(best)
        current = best

        if (step + 1) % 250 == 0:
            print(f"{step + 1}/{settings.lines}")

    mse = float(np.mean((flat_target - np.clip(drawn, 0, 1)) ** 2))
    return sequence, {"mse": mse, "lines": len(sequence) - 1}


@dataclass(frozen=True)
class PassSpec:
    name: str
    layer: str
    fraction: float
    strength: float
    overdraw: float
    min_skip: int
    target_gain: float = 1.0
    light_penalty: float = 0.0


def generate_sequence_multipass(
    layers: dict[str, np.ndarray],
    line_index: LineIndex,
    settings: Settings,
) -> tuple[list[int], dict[str, float]]:
    preset = PROFILE_PRESETS[settings.profile]
    detail_skip = max(7, settings.min_skip // 2)
    pass_specs = [
        PassSpec("shadow", "shadow", 0.38, settings.line_strength * 0.82, preset["overdraw"] * 0.70, settings.min_skip, 1.06, 0.18),
        PassSpec("structure", "structure", 0.34, settings.line_strength * 0.70, preset["overdraw"] * 1.05, max(10, settings.min_skip - 3), 1.03, 0.13),
        PassSpec("detail", "detail", 0.28, settings.line_strength * 0.50, preset["overdraw"] * 1.45, detail_skip, 1.05, 0.04),
    ]

    sequence = [0]
    drawn = np.zeros(settings.image_size * settings.image_size, dtype=np.float32)
    point_usage = np.zeros(settings.points, dtype=np.float32)
    point_usage[0] = 1
    current = 0
    used = 0
    pass_reports: list[dict[str, float | str]] = []

    for pass_index, spec in enumerate(pass_specs):
        if pass_index == len(pass_specs) - 1:
            budget = settings.lines - used
        else:
            budget = int(round(settings.lines * spec.fraction))
        if budget <= 0:
            continue

        target = np.clip(layers[spec.layer].reshape(-1) * spec.target_gain, 0, 1)
        added, current = run_greedy_pass(
            sequence=sequence,
            current=current,
            target=target,
            drawn=drawn,
            point_usage=point_usage,
            line_index=line_index,
            settings=settings,
            budget=budget,
            strength=spec.strength,
            overdraw=spec.overdraw,
            min_skip=spec.min_skip,
            light_penalty=spec.light_penalty,
            label=spec.name,
            global_start=used,
        )
        used += added
        pass_reports.append({"name": spec.name, "lines": added, "strength": spec.strength, "min_skip": spec.min_skip})
        if used >= settings.lines:
            break

    combined = layers["combined"].reshape(-1)
    mse = float(np.mean((combined - np.clip(drawn, 0, 1)) ** 2))
    return sequence, {"mse": mse, "lines": len(sequence) - 1, "passes": pass_reports}


def run_greedy_pass(
    sequence: list[int],
    current: int,
    target: np.ndarray,
    drawn: np.ndarray,
    point_usage: np.ndarray,
    line_index: LineIndex,
    settings: Settings,
    budget: int,
    strength: float,
    overdraw: float,
    min_skip: int,
    light_penalty: float,
    label: str,
    global_start: int,
) -> tuple[int, int]:
    residual = np.maximum(0, target - drawn * 0.78)
    highlight_penalty = np.square(np.maximum(0, 0.62 - target))
    count = settings.points
    added = 0

    for step in range(budget):
        recent = set(sequence[-18:])
        options = [
            (edge_id, candidate)
            for edge_id, candidate in line_index.options[current]
            if circular_distance(current, candidate, count) >= min_skip and candidate not in recent
        ]
        if len(options) < 8:
            options = [(edge_id, candidate) for edge_id, candidate in line_index.options[current] if circular_distance(current, candidate, count) >= min_skip]
        if not options:
            break

        edge_ids = np.asarray([edge_id for edge_id, _ in options], dtype=np.int32)
        candidates = np.asarray([candidate for _, candidate in options], dtype=np.int32)
        residual_score = line_index.matrix[edge_ids].dot(residual * residual)
        overdraw_pixels = np.maximum(0, drawn - target - strength)
        overdraw_score = line_index.matrix[edge_ids].dot(overdraw_pixels)
        light_score = line_index.matrix[edge_ids].dot(highlight_penalty) if light_penalty else 0
        usage_penalty = np.sqrt(point_usage[candidates])

        scores = residual_score - overdraw_score * overdraw - light_score * light_penalty - usage_penalty * 0.030
        best_pos = int(np.argmax(scores))
        best = int(candidates[best_pos])
        best_edge = int(edge_ids[best_pos])

        idx = line_index.lines[best_edge]
        residual[idx] = np.maximum(0, residual[idx] - strength)
        drawn[idx] += strength
        point_usage[current] += 0.18
        point_usage[best] += 1.0
        sequence.append(best)
        current = best
        added += 1

        total = global_start + added
        if total % 250 == 0:
            print(f"{total}/{settings.lines} ({label})")

    return added, current


def circular_distance(a: int, b: int, count: int) -> int:
    direct = abs(a - b)
    return min(direct, count - direct)


def render_preview(sequence: list[int], points: list[tuple[int, int]], settings: Settings) -> Image.Image:
    size = settings.image_size
    paper = np.array([246, 243, 234], dtype=np.float32)
    darkness = np.zeros((size * size,), dtype=np.float32)
    alpha = float(np.clip(settings.render_alpha + settings.thread_mm * 0.06, 0.018, 0.06))
    width = max(1, round(settings.render_width + settings.thread_mm * 2.8))

    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((8, 8, size - 8, size - 8), fill=255)
    mask_array = np.asarray(mask) > 0

    for a, b in zip(sequence, sequence[1:]):
        idx = raster_line(points[a], points[b], size)
        darkness[idx] = 1.0 - (1.0 - darkness[idx]) * (1.0 - alpha)
        if width > 1:
            yy = idx // size
            xx = idx % size
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx = xx + ox
                ny = yy + oy
                valid = (nx >= 0) & (nx < size) & (ny >= 0) & (ny < size)
                nidx = ny[valid] * size + nx[valid]
                darkness[nidx] = 1.0 - (1.0 - darkness[nidx]) * (1.0 - alpha * 0.45)

    darkness_2d = darkness.reshape(size, size)
    rgb = np.ones((size, size, 3), dtype=np.float32) * paper
    rgb[mask_array] = paper * (1.0 - darkness_2d[mask_array, None])
    image = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)), mode="RGB")
    draw_rgb = ImageDraw.Draw(image)
    draw_rgb.ellipse((8, 8, size - 8, size - 8), outline=(32, 38, 44), width=2)
    for idx, (x, y) in enumerate(points):
        draw_rgb.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(32, 38, 44))
        if idx % max(1, settings.points // 30) == 0:
            draw_rgb.text((x, y), str(idx), fill=(90, 96, 105), anchor="mm")
    return image


def save_gray(path: Path, values: np.ndarray) -> None:
    image = Image.fromarray(np.uint8(np.clip(values, 0, 1) * 255), mode="L")
    image.save(path)


def write_sequence(path: Path, sequence: list[int], settings: Settings) -> None:
    radius_cm = settings.size_cm / 2
    lines = [
        "String Art Instruction",
        f"points: {settings.points}",
        f"lines: {len(sequence) - 1}",
        f"diameter_cm: {settings.size_cm}",
        f"thread_mm: {settings.thread_mm}",
        "point_0: top",
        "numbering: clockwise",
        "",
        "sequence:",
        " -> ".join(map(str, sequence)),
        "",
        "steps:",
    ]
    for step, (a, b) in enumerate(zip(sequence, sequence[1:]), start=1):
        lines.append(f"{step}. {a} -> {b}")
    lines.append("")
    lines.append("point coordinates, cm from center:")
    for idx in range(settings.points):
        angle = -math.pi / 2 + idx / settings.points * math.tau
        x = math.cos(angle) * radius_cm
        y = math.sin(angle) * radius_cm
        lines.append(f"{idx}: x={x:.2f}, y={y:.2f}")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_csv(path: Path, sequence: list[int]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["step", "from", "to"])
        for step, (a, b) in enumerate(zip(sequence, sequence[1:]), start=1):
            writer.writerow([step, a, b])


def write_report(path: Path, image_path: Path, settings: Settings, diagnostics: dict[str, float]) -> None:
    payload = {
        "image": str(image_path),
        "settings": asdict(settings),
        "diagnostics": diagnostics,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
