#!/usr/bin/env python3
"""
better_image.py
---------------
Two-stage automated smart border cropping and Gemini 3.8 Flash-Low image
enhancement pipeline for Queez:
Milk Operations and Farm Management (Exam 1) & (Part 2).

Stage 1 (Smart Border Cropping):
- Inspects every non-excluded image across both Milk Operations exams.
- If the image has a discernible rectangular photographic background surrounded
  by paper margins or leaked bottom text captions (Type A, e.g. cattle breed
  photos), crops cleanly to the photo background boundaries.
- If the image has no discernible rectangular background border (Type B floating
  diagram, isolated farm tool, or already edge-to-edge), leaves it untouched.

Stage 2 (AI Quality Enhancement):
- Calls `agy` with `--model "Gemini 3.8 Flash (Low)"` and the exact prompt:
  "Turn this image like it was taken at this moment (If photo) or it was just
  exported from photoshop (if art) without changing its file size."
- Enforces post-AI pixel dimension preservation `(orig_w, orig_h)` via Lanczos4.
- Waits 60 seconds (`--delay 60.0`) between AI subprocess calls.

Strictly excludes:
- Portable milking machine images / diagrams
- Parts of cattle images / diagrams
- Daily activities and daily time schedule images
"""

import os
import sys
import time
import json
import shutil
import hashlib
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple, Set, Optional
from datetime import datetime, timezone

import cv2
import numpy as np

# Base directories
DEFAULT_QUEEZ_DATA = Path(r"D:/Documents/Programming/Languages/Javascript/Queez/data")
DEFAULT_MIRROR_DATA = Path(r"D:/Conversations/queez/quizzes")
DEFAULT_LEDGER_PATH = Path(r"D:/Conversations/queez/.better_image_ledger.json")
# Records every Stage 1 decision (cropped / preserved) so an image is only ever
# analysed once. Re-analysing an already-cropped pale photo (white sky, glare)
# could otherwise trim real photo content on a second pass.
DEFAULT_CROP_LEDGER_PATH = Path(r"D:/Conversations/queez/.better_image_crop_ledger.json")

# Target subdirectories
EXAM1_DIR_NAME = "milk-operation-quiz"
EXAM2_DIR_NAME = "milk-operation-part-2-quiz"

# Smart cropping constants
PAPER_WHITE_GRAY_THRESHOLD = 240
MIN_PHOTO_AREA_RATIO = 0.35

# Default AI model & prompt
DEFAULT_MODEL = "Gemini 3.8 Flash (Low)"
FIXED_USER_PROMPT = (
    "Turn this image like it was taken at this moment (If photo) or it was "
    "just exported from photoshop (if art) without changing its file size."
)
FIXED_PROMPT_TEMPLATE = (
    FIXED_USER_PROMPT + ' Target image file to edit and replace in-place: "{image_path}".'
)

# Exact filename exclusions (12 total across Part 2 and Exam 1)
EXCLUDED_FILENAMES: Set[str] = {
    # Part 2 diagrams & routines (7 files)
    "body-parts-of-cattle-answer.jpg",
    "body-parts-of-cattle-question.jpg",
    "portable-milking-machine-answer.jpg",
    "portable-milking-machine-question.jpg",
    "daily-routine-activity-quiz.jpg",
    "daily-routine-time-quiz.jpg",
    "dairy-square-daily-routine-original.jpg",
    # Exam 1 anatomical / mechanical diagrams (4 files) + Part 2 cover if needed
    "p14_p14_img1.png",  # Body parts of cattle anatomical diagram
    "p40_p40_img2.png",  # Portable milking machine unit
    "p60_p60_img3.png",  # Portable milking machine diagram
    "p60_p60_img4.png",  # Milking cluster assembly detail
}

# Substring / pattern exclusions (case-insensitive)
EXCLUDED_PATTERNS: List[str] = [
    "portable-milking-machine",
    "milking-machine",
    "milking_machine",
    "milking-cluster",
    "milking_cluster",
    "body-parts-of-cattle",
    "parts-of-cattle",
    "parts_of_cattle",
    "daily-routine",
    "activity-quiz",
    "time-quiz",
    "daily-schedule",
    "dairy-square",
]


def find_agy_binary() -> str:
    """Locate the agy CLI binary executable."""
    found = shutil.which("agy")
    if found:
        return found
    standard_loc = Path(os.environ.get("LOCALAPPDATA", "")) / "agy" / "bin" / "agy.exe"
    if standard_loc.is_file():
        return str(standard_loc)
    fallback_win = Path(r"C:\Users\samad\AppData\Local\agy\bin\agy.exe")
    if fallback_win.is_file():
        return str(fallback_win)
    return "agy"


def get_file_hash(path: Path) -> str:
    """Calculates SHA256 hash of a file."""
    if not path.is_file():
        return ""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def is_excluded_image(file_path: Path) -> Tuple[bool, str]:
    """
    Evaluates whether an image file is excluded based on:
    1. Portable milking machine
    2. Parts of the cattle
    3. Daily activities and daily time schedule
    """
    fname_lower = file_path.name.lower()

    if fname_lower in EXCLUDED_FILENAMES:
        return True, f"Matched exact excluded filename '{file_path.name}'"

    for pat in EXCLUDED_PATTERNS:
        if pat in fname_lower:
            return True, f"Filename matched excluded pattern '{pat}'"

    return False, ""


def build_prompt(image_path: Path) -> str:
    """Constructs the exact fixed prompt for agy."""
    abs_path = str(image_path.resolve()).replace("\\", "/")
    return FIXED_PROMPT_TEMPLATE.format(image_path=abs_path)


def _find_longest_band(density_1d: np.ndarray, threshold: float, max_gap: int = 2) -> Optional[Tuple[int, int]]:
    """
    Finds the longest contiguous [start, end) index interval where density_1d >= threshold,
    bridging interior gaps of up to `max_gap` pixels.
    """
    active = density_1d >= threshold
    n = len(active)
    if not np.any(active):
        return None

    # Bridge tiny gaps up to max_gap
    bridged = active.copy()
    i = 0
    while i < n:
        if not bridged[i]:
            j = i
            while j < n and not bridged[j]:
                j += 1
            if i > 0 and j < n and (j - i) <= max_gap:
                bridged[i:j] = True
            i = j
        else:
            i += 1

    best_start, best_end = 0, 0
    i = 0
    while i < n:
        if bridged[i]:
            j = i
            while j < n and bridged[j]:
                j += 1
            # Tighten start/end to actual active pixels
            while i < j and not active[i]:
                i += 1
            while j > i and not active[j - 1]:
                j -= 1
            if (j - i) > (best_end - best_start):
                best_start, best_end = i, j
            i = j
        else:
            i += 1

    if best_end <= best_start:
        return None
    return best_start, best_end


def _scan_outward_boundary(
    profile: np.ndarray,
    start_idx: int,
    direction: int,
    low_thresh: float = 0.15,
    cliff_from: float = 0.75,
    cliff_to: float = 0.32
) -> int:
    """
    Walks outward from `start_idx` in `direction` (-1 toward 0, or +1 toward len-1).
    Stops at the first index where the profile enters a white paper margin gap:
    - `profile[i] < low_thresh`, OR
    - a sharp cliff drop from `>= cliff_from` to `< cliff_to` sustained for >= 2px.
    Returns the inclusive inner boundary index (for -1) or exclusive outer index (for +1).
    """
    n = len(profile)
    idx = start_idx
    prev_val = float(profile[start_idx])

    while 0 <= idx < n:
        val = float(profile[idx])
        if val < low_thresh:
            return (idx + 1) if direction < 0 else idx
        if prev_val >= cliff_from and val < cliff_to:
            next_idx = idx + direction
            if not (0 <= next_idx < n) or float(profile[next_idx]) < cliff_to:
                return (idx + 1) if direction < 0 else idx
        prev_val = max(prev_val * 0.8 + val * 0.2, val)
        idx += direction

    return 0 if direction < 0 else n


def smart_crop_image(
    image_path: Path,
    dry_run: bool = False
) -> Tuple[bool, str, Optional[Tuple[int, int, int, int]]]:
    """
    Detects whether an image has a discernible rectangular photographic background
    surrounded by outer paper margins or bottom text captions (Type A) versus a
    floating diagram/object with no discernible rectangular border (Type B).

    Detection runs two strategies in order:
      1. `_detect_profile_box`: row/column density scan with edge/corner validation.
      2. `_detect_component_box`: largest connected non-white region with straight-edge
         validation (handles photos whose sky, snow, or glare washes out one or two sides).

    If Type A with outer margins/captions is detected:
      Crops cleanly to `(left, top, right, bottom)` (in-place unless `dry_run=True`)
      and returns `(True, reason, (left, top, right, bottom))`.
    If Type B or already edge-to-edge:
      Leaves the file untouched and returns `(False, reason, None)`.
    """
    if not image_path.is_file():
        return False, f"File not found: {image_path}", None

    img = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if img is None:
        return False, "Unreadable image file", None

    h, w = img.shape[:2]
    if h < 32 or w < 32:
        return False, "Image too small to crop", None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]

    # Non-white mask: pixel is darker than paper-white OR has discernible color saturation
    non_white = (gray < PAPER_WHITE_GRAY_THRESHOLD) | (sat >= 18)

    # 1. Check if image already bleeds edge-to-edge on all 4 borders (idempotency guard)
    top_edge = float(np.mean(non_white[:2, :]))
    bottom_edge = float(np.mean(non_white[-2:, :]))
    left_edge = float(np.mean(non_white[:, :2]))
    right_edge = float(np.mean(non_white[:, -2:]))

    if min(top_edge, bottom_edge, left_edge, right_edge) >= 0.80:
        return False, "Already edge-to-edge (no outer margin)", None

    # 2. Primary profile scan, then connected-component fallback
    crop_box, reason = _detect_profile_box(non_white)
    method = "profile"
    if crop_box is None:
        crop_box, fallback_reason = _detect_component_box(non_white)
        method = "component"
        if crop_box is None:
            return False, f"Preserved floating diagram ({reason}; {fallback_reason})", None

    left, top, right, bottom = crop_box

    # 3. Check that the crop actually removes a meaningful margin or caption (>= 4px total)
    margin_top = top
    margin_bottom = h - bottom
    margin_left = left
    margin_right = w - right
    total_trimmed = margin_top + margin_bottom + margin_left + margin_right

    if total_trimmed < 4:
        return False, "Already tightly cropped (margin < 4px)", None

    if not dry_run:
        cropped_img = img[top:bottom, left:right]
        cv2.imwrite(str(image_path), cropped_img)

    return (
        True,
        f"Cropped discernible background [{method}] from {w}x{h} to {right - left}x{bottom - top} "
        f"(trimmed L={margin_left}, T={margin_top}, R={margin_right}, B={margin_bottom})",
        (int(left), int(top), int(right), int(bottom)),
    )


def _detect_profile_box(non_white: np.ndarray) -> Tuple[Optional[Tuple[int, int, int, int]], str]:
    """
    Primary detector: scans row/column non-white density outward from the image core
    to the first paper-white gap on each side, then validates that the candidate box
    has dense rectangular edges and corners (Type A photo).
    Returns `((left, top, right, bottom), reason)` or `(None, reason)`.
    """
    h, w = non_white.shape[:2]

    # Use the central 70% horizontal span when computing row density so outer vertical table
    # lines or side callouts do not mask the top/bottom paper gaps.
    x_core_start = int(0.15 * w)
    x_core_end = max(x_core_start + 1, int(0.85 * w))
    row_density = np.mean(non_white[:, x_core_start:x_core_end], axis=1)

    y_start_up = int(0.22 * h)
    y_start_down = int(0.75 * h)
    if float(np.mean(row_density[y_start_up:y_start_down])) < 0.25:
        return None, "sparse interior row density"

    top = _scan_outward_boundary(row_density, y_start_up, direction=-1, low_thresh=0.16)
    bottom = _scan_outward_boundary(row_density, y_start_down, direction=+1, low_thresh=0.16)

    if (bottom - top) < int(0.40 * h):
        return None, "vertical photo span too small"

    # Compute column density strictly within [top, bottom] (and upper/lower halves so
    # outdoor photos with overcast white skies still have a crisp 100% grass edge in the lower half)
    mid_y = top + (bottom - top) // 2
    col_full = np.mean(non_white[top:bottom, :], axis=0)
    col_lower = np.mean(non_white[mid_y:bottom, :], axis=0)
    col_upper = np.mean(non_white[top:mid_y, :], axis=0)
    col_density = np.maximum(col_full, 0.85 * np.maximum(col_lower, col_upper))

    x_start_left = int(0.18 * w)
    x_start_right = int(0.82 * w)
    if float(np.mean(col_density[x_start_left:x_start_right])) < 0.25:
        return None, "sparse interior column density"

    left = _scan_outward_boundary(col_density, x_start_left, direction=-1, low_thresh=0.18)
    right = _scan_outward_boundary(col_density, x_start_right, direction=+1, low_thresh=0.18)

    if (right - left) < int(0.40 * w):
        return None, "horizontal photo span too small"

    # Re-refine top and bottom within [left, right] in case of narrow captions
    inner_row_density = np.mean(non_white[:, left:right], axis=1)
    top = max(top, _scan_outward_boundary(inner_row_density, y_start_up, direction=-1, low_thresh=0.18))
    bottom = min(bottom, _scan_outward_boundary(inner_row_density, y_start_down, direction=+1, low_thresh=0.18))

    # Tighten anti-aliased paper-bleed or thin dark border lines up to 4px inward
    for _ in range(4):
        mid_curr = top + (bottom - top) // 2
        if (bottom - top) > 20 and np.mean(non_white[top, left:right]) < 0.70 and np.mean(non_white[top + 1, left:right]) >= 0.70:
            top += 1
        if (bottom - top) > 20 and np.mean(non_white[bottom - 1, left:right]) < 0.70 and np.mean(non_white[bottom - 2, left:right]) >= 0.70:
            bottom -= 1
        if (right - left) > 20:
            left_col_score = max(float(np.mean(non_white[top:bottom, left])), float(np.mean(non_white[mid_curr:bottom, left])))
            next_left_score = max(float(np.mean(non_white[top:bottom, left + 1])), float(np.mean(non_white[mid_curr:bottom, left + 1])))
            if left_col_score < 0.70 and next_left_score >= 0.70:
                left += 1
            right_col_score = max(float(np.mean(non_white[top:bottom, right - 1])), float(np.mean(non_white[mid_curr:bottom, right - 1])))
            prev_right_score = max(float(np.mean(non_white[top:bottom, right - 2])), float(np.mean(non_white[mid_curr:bottom, right - 2])))
            if right_col_score < 0.70 and prev_right_score >= 0.70:
                right -= 1

    crop_w = right - left
    crop_h = bottom - top
    area_ratio = (crop_w * crop_h) / float(w * h)
    if area_ratio < MIN_PHOTO_AREA_RATIO:
        return None, f"crop area ratio {area_ratio:.2f} < {MIN_PHOTO_AREA_RATIO}"

    # Discriminate Type A (rectangular photo with discernible background)
    # from Type B (isolated floating object/diagram on white background).
    sub_mask = non_white[top:bottom, left:right]
    box_fill_ratio = float(np.mean(sub_mask))

    # Check non-white density along the 4 inner edges of the candidate rectangle (3px strip)
    strip = min(3, crop_h // 4, crop_w // 4)
    half_h = crop_h // 2
    p_top = float(np.mean(sub_mask[:strip, :]))
    p_bottom = float(np.mean(sub_mask[-strip:, :]))
    p_left = max(float(np.mean(sub_mask[:, :strip])), 0.9 * float(np.mean(sub_mask[half_h:, :strip])))
    p_right = max(float(np.mean(sub_mask[:, -strip:])), 0.9 * float(np.mean(sub_mask[half_h:, -strip:])))
    edge_scores = [p_top, p_bottom, p_left, p_right]
    dense_edges_count = sum(1 for s in edge_scores if s >= 0.68)
    perimeter_density = float(np.mean(edge_scores))

    # Check 4 inner corners (10x10 patches)
    c_size = min(10, crop_h // 4, crop_w // 4)
    corners = [
        float(np.mean(sub_mask[:c_size, :c_size])),
        float(np.mean(sub_mask[:c_size, -c_size:])),
        float(np.mean(sub_mask[-c_size:, :c_size])),
        float(np.mean(sub_mask[-c_size:, -c_size:])),
    ]
    dense_corners_count = sum(1 for c in corners if c >= 0.45)

    # Type A rectangular photo criteria:
    # 1) Standard 4-edge or 3-edge rectangular background, OR
    # 2) Outdoor photo with bright overcast sky where bottom edge + lower-half side edges + bottom corners are solid
    is_discernible_photo = (
        (dense_edges_count >= 3 and perimeter_density >= 0.68 and dense_corners_count >= 2 and box_fill_ratio >= 0.70)
        or (
            p_bottom >= 0.80
            and p_left >= 0.72
            and p_right >= 0.72
            and corners[2] >= 0.70
            and corners[3] >= 0.70
            and box_fill_ratio >= 0.70
        )
    )

    if not is_discernible_photo:
        return None, (
            f"fill={box_fill_ratio:.2f}, perim={perimeter_density:.2f}, "
            f"edges={dense_edges_count}/4, corners={dense_corners_count}/4"
        )

    return (int(left), int(top), int(right), int(bottom)), "profile scan"


def _detect_component_box(non_white: np.ndarray) -> Tuple[Optional[Tuple[int, int, int, int]], str]:
    """
    Fallback detector for photos whose sky, snow, or glare washes out part of the border.
    Finds the largest connected non-white region (captions separated by a paper gap stay
    in their own components) and accepts it only if it is solidly filled (>= 74%) and its
    bounding box has straight photo edges: one side covered >= 95% and a second side >= 60%.
    Floating objects only touch their bounding box at a few points, so they fail this test.
    Returns `((left, top, right, bottom), reason)` or `(None, reason)`.
    """
    h, w = non_white.shape[:2]
    mask = non_white.astype(np.uint8)
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    count, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    if count <= 1:
        return None, "no connected region"

    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x = int(stats[largest, cv2.CC_STAT_LEFT])
    y = int(stats[largest, cv2.CC_STAT_TOP])
    bw = int(stats[largest, cv2.CC_STAT_WIDTH])
    bh = int(stats[largest, cv2.CC_STAT_HEIGHT])
    area = int(stats[largest, cv2.CC_STAT_AREA])

    if bw * bh < MIN_PHOTO_AREA_RATIO * w * h or bw < 20 or bh < 20:
        return None, "largest region too small"

    region = labels[y:y + bh, x:x + bw] == largest
    fill = area / float(bw * bh)

    strip = 3
    coverage = sorted([
        float(np.mean(np.any(region[:strip, :], axis=0))),   # top
        float(np.mean(np.any(region[-strip:, :], axis=0))),  # bottom
        float(np.mean(np.any(region[:, :strip], axis=1))),   # left
        float(np.mean(np.any(region[:, -strip:], axis=1))),  # right
    ], reverse=True)

    is_rectangular = (
        fill >= 0.74
        and coverage[0] >= 0.95
        and coverage[1] >= 0.60
    )
    if not is_rectangular:
        return None, f"component fill={fill:.2f}, edge coverage={[round(c, 2) for c in coverage]}"

    return (x, y, x + bw, y + bh), "component scan"


def enforce_image_dimensions(
    image_path: Path,
    target_width: int,
    target_height: int
) -> bool:
    """
    Ensures the image at `image_path` matches `(target_width, target_height)`.
    If its pixel dimensions differ, resizes in-place using Lanczos4 interpolation.
    Returns True if resized, False if already matching or unreadable.
    """
    if not image_path.is_file() or target_width <= 0 or target_height <= 0:
        return False

    img = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return False

    h, w = img.shape[:2]
    if w == target_width and h == target_height:
        return False

    resized = cv2.resize(img, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
    cv2.imwrite(str(image_path), resized)
    return True


def discover_target_images(
    target_scope: str = "all",
    base_dir: Path = DEFAULT_QUEEZ_DATA
) -> List[Tuple[Path, bool, str]]:
    """
    Discovers all candidate image assets and determines inclusion/exclusion.
    Returns list of tuples: (image_path, is_excluded, exclusion_reason).
    """
    results: List[Tuple[Path, bool, str]] = []
    dirs_to_scan = []

    if target_scope in ("all", "exam1"):
        exam1_assets = base_dir / EXAM1_DIR_NAME / "assets"
        if exam1_assets.is_dir():
            dirs_to_scan.append(exam1_assets)

    if target_scope in ("all", "part2", "upcoming"):
        exam2_assets = base_dir / EXAM2_DIR_NAME / "assets"
        if exam2_assets.is_dir():
            dirs_to_scan.append(exam2_assets)

    for directory in dirs_to_scan:
        for f in sorted(directory.iterdir()):
            if f.is_file() and f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                excluded, reason = is_excluded_image(f)
                results.append((f, excluded, reason))

    return results


def load_ledger(ledger_path: Path) -> Dict[str, dict]:
    """Loads completion ledger from disk."""
    if ledger_path.is_file():
        try:
            with open(ledger_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_ledger(ledger: Dict[str, dict], ledger_path: Path):
    """Saves completion ledger to disk."""
    try:
        with open(ledger_path, "w", encoding="utf-8") as f:
            json.dump(ledger, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"  [Warning] Failed to write ledger: {e}", file=sys.stderr)


def sync_to_mirror(source_file: Path, base_data_dir: Path, mirror_dir: Path) -> bool:
    """Syncs modified file to mirror directory if it exists."""
    try:
        rel_path = source_file.relative_to(base_data_dir)
        dest_file = mirror_dir / rel_path
        if dest_file.parent.is_dir():
            shutil.copy2(source_file, dest_file)
            return True
    except Exception as e:
        print(f"  [Warning] Failed to sync {source_file.name} to mirror: {e}", file=sys.stderr)
    return False


def run_image_enhancement(
    image_path: Path,
    agy_bin: str,
    model: str = DEFAULT_MODEL,
    backup: bool = False,
    timeout: float = 600.0,
    preserve_dimensions: bool = True
) -> Tuple[bool, str]:
    """
    Invokes `agy` CLI via subprocess with `--model` and the fixed user prompt.
    Verifies that the image content was genuinely modified and enforces original
    pixel dimensions `(orig_w, orig_h)` when `preserve_dimensions=True`.
    """
    if not image_path.is_file():
        return False, f"Target image does not exist: {image_path}"

    orig_img = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    orig_h, orig_w = orig_img.shape[:2] if orig_img is not None else (0, 0)

    initial_hash = get_file_hash(image_path)
    initial_mtime = image_path.stat().st_mtime

    if backup:
        bak_path = image_path.with_suffix(image_path.suffix + ".bak")
        if not bak_path.exists():
            shutil.copy2(image_path, bak_path)

    prompt = build_prompt(image_path)
    cmd = [agy_bin]
    if model:
        cmd.extend(["--model", model])
    cmd.extend(["-p", prompt, "--dangerously-skip-permissions"])

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False
        )
        output = (proc.stdout + "\n" + proc.stderr).strip()

        if proc.returncode != 0:
            return False, f"agy exited with code {proc.returncode}: {output[:300]}"

        current_hash = get_file_hash(image_path)
        current_mtime = image_path.stat().st_mtime

        if current_hash != initial_hash and image_path.stat().st_size > 0:
            dim_note = ""
            if preserve_dimensions and orig_w > 0 and orig_h > 0:
                if enforce_image_dimensions(image_path, orig_w, orig_h):
                    dim_note = f" (restored dimensions to {orig_w}x{orig_h})"
            return True, f"Image successfully updated{dim_note}."
        elif current_mtime > initial_mtime and image_path.stat().st_size > 0:
            dim_note = ""
            if preserve_dimensions and orig_w > 0 and orig_h > 0:
                if enforce_image_dimensions(image_path, orig_w, orig_h):
                    dim_note = f" (restored dimensions to {orig_w}x{orig_h})"
            return True, f"Image updated (timestamp changed){dim_note}."
        else:
            return False, f"Image was not modified (output: {output[:150]})."
    except subprocess.TimeoutExpired:
        return False, f"Process timed out after {timeout} seconds."
    except Exception as e:
        return False, f"Execution error: {e}"


def main():
    parser = argparse.ArgumentParser(
        description="Smart border cropping and Gemini 3.8 Flash-Low image enhancement pipeline."
    )
    parser.add_argument(
        "--target",
        choices=["all", "exam1", "part2", "upcoming"],
        default="all",
        help="Target exam visual assets (default: all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan, test smart crop detection, and list candidates without modifying files or invoking agy"
    )
    parser.add_argument(
        "--crop-only",
        action="store_true",
        help="Execute Stage 1 (smart border cropping) only without invoking AI enhancement"
    )
    parser.add_argument(
        "--enhance-only",
        action="store_true",
        help="Execute Stage 2 (AI enhancement) only without running Stage 1 smart cropping"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"AI model name passed to agy --model (default: '{DEFAULT_MODEL}')"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Process a single image file directly"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of images to process in this run"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=60.0,
        help="Delay in seconds between AI enhancement calls (default: 60.0s / 1 minute)"
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=600.0,
        help="Timeout in seconds for agy subprocess (default: 600.0)"
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Create .bak copy before replacing original image"
    )
    parser.add_argument(
        "--preserve-dimensions",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Enforce pre-AI pixel width and height after AI enhancement (default: True)"
    )
    parser.add_argument(
        "--sync",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Sync modified assets to conversation mirror directory (default: True)"
    )
    parser.add_argument(
        "--resume",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Skip images already recorded as enhanced in ledger (default: True)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force enhancement even if already recorded in ledger"
    )
    parser.add_argument(
        "--ledger",
        type=str,
        default=str(DEFAULT_LEDGER_PATH),
        help="Path to JSON progress ledger"
    )
    parser.add_argument(
        "--crop-ledger",
        type=str,
        default=str(DEFAULT_CROP_LEDGER_PATH),
        help="Path to JSON ledger recording Stage 1 crop decisions (prevents re-cropping)"
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(DEFAULT_QUEEZ_DATA),
        help="Path to Queez data directory"
    )

    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    mirror_dir = DEFAULT_MIRROR_DATA
    ledger_path = Path(args.ledger)
    ledger = load_ledger(ledger_path)
    crop_ledger_path = Path(args.crop_ledger)
    crop_ledger = load_ledger(crop_ledger_path)

    print("==================================================")
    print("           Queez Better Image Pipeline            ")
    print("==================================================")
    print(f"Target Scope:  {args.target}")
    print(f"Data Dir:      {data_dir}")
    print(f"Model:         {args.model}")
    print(f"Dry Run Mode:  {args.dry_run}")
    print(f"Crop Only:     {args.crop_only}")
    print(f"Enhance Only:  {args.enhance_only}")
    print(f"Pacing Delay:  {args.delay}s")
    print(f"Timeout:       {args.timeout}s")
    print(f"Resume Ledger: {args.resume} ({ledger_path})")
    print(f"Sync Mirrors:  {args.sync}")
    print("--------------------------------------------------")

    if args.file:
        single_path = Path(args.file)
        if not single_path.is_file():
            print(f"[Error] Specified file does not exist: {single_path}", file=sys.stderr)
            sys.exit(1)
        excluded, reason = is_excluded_image(single_path)
        items = [(single_path, excluded, reason)]
    else:
        items = discover_target_images(target_scope=args.target, base_dir=data_dir)

    included_items = [(p, r) for p, excl, r in items if not excl]
    excluded_items = [(p, r) for p, excl, r in items if excl]

    pending_items = []
    already_done_items = []
    for p, r in included_items:
        key = str(p.resolve()).replace("\\", "/")
        if args.crop_only:
            if not args.force and key in crop_ledger:
                already_done_items.append((p, crop_ledger[key]))
            else:
                pending_items.append((p, r))
        elif args.resume and not args.force and key in ledger:
            already_done_items.append((p, ledger[key]))
        else:
            pending_items.append((p, r))

    print(f"Total Discovered: {len(items)}")
    print(f"Eligible Images:  {len(included_items)}")
    print(f"Already {'Crop-Checked' if args.crop_only else 'Enhanced'}: {len(already_done_items)}")
    print(f"Pending To Run:   {len(pending_items)}")
    print(f"Excluded Images:  {len(excluded_items)}")
    print("--------------------------------------------------")

    if args.dry_run:
        print("\n[EXCLUDED ASSETS]:")
        for p, r in excluded_items:
            print(f"  [SKIP] {p.name:<35} -> Reason: {r}")

        if already_done_items:
            print("\n[ALREADY PROCESSED ASSETS]:")
            for p, meta in already_done_items[:10]:
                print(f"  [DONE] {p.parent.name}/{p.name} (Recorded at {meta.get('completed_at')})")
            if len(already_done_items) > 10:
                print(f"  ... and {len(already_done_items) - 10} more already recorded.")

        print("\n[PENDING CANDIDATE ASSETS]:")
        candidate_sample = pending_items if args.limit is None else pending_items[:args.limit]
        crop_preview_count = 0
        for idx, (p, _) in enumerate(candidate_sample, 1):
            key = str(p.resolve()).replace("\\", "/")
            if args.enhance_only:
                print(f"  [{idx:03d}/{len(candidate_sample):03d}] {p.parent.parent.name}/{p.name}")
            elif key in crop_ledger and not args.force:
                status = crop_ledger[key].get("status", "checked")
                print(f"  [{idx:03d}/{len(candidate_sample):03d}] [CROP-CHECKED:{status}] {p.parent.parent.name}/{p.name}")
            else:
                would_crop, crop_msg, _ = smart_crop_image(p, dry_run=True)
                tag = "CROP" if would_crop else "KEEP"
                if would_crop:
                    crop_preview_count += 1
                print(f"  [{idx:03d}/{len(candidate_sample):03d}] [{tag}] {p.parent.parent.name}/{p.name} -> {crop_msg}")

        if args.limit and len(pending_items) > args.limit:
            print(f"  ... and {len(pending_items) - args.limit} more images (capped by --limit {args.limit})")

        if not args.enhance_only:
            print(f"\n[Smart Crop Preview] {crop_preview_count}/{len(candidate_sample)} candidate images have discernible backgrounds to crop.")
        print("\n[Dry Run Completed] No modifications or subprocess calls made.")
        return 0

    candidates = pending_items if args.limit is None else pending_items[:args.limit]
    total_candidates = len(candidates)

    if total_candidates == 0:
        print("No pending candidate images to process. Everything is up to date!")
        return 0

    agy_bin = find_agy_binary()
    if not args.crop_only:
        print(f"Using agy binary: {agy_bin}")

    print(f"\nBeginning execution for {total_candidates} images...")
    success_count = 0
    failure_count = 0
    cropped_count = 0

    # Source-hash deduplication cache: maps pre-enhancement SHA256 -> enhanced Path
    processed_by_source_hash: Dict[str, Path] = {}

    for idx, (img_path, _) in enumerate(candidates, 1):
        print(f"\n[{idx}/{total_candidates}] Processing: {img_path.parent.parent.name}/{img_path.name}")
        print(f"  Path: {img_path}")

        if args.backup:
            bak_path = img_path.with_suffix(img_path.suffix + ".bak")
            if not bak_path.exists():
                shutil.copy2(img_path, bak_path)

        # Stage 1: Smart Border Cropping (each image is analysed at most once)
        was_cropped = False
        crop_box = None
        if not args.enhance_only:
            key = str(img_path.resolve()).replace("\\", "/")
            if key in crop_ledger and not args.force:
                recorded = crop_ledger[key]
                was_cropped = recorded.get("status") == "cropped"
                crop_box = tuple(recorded["crop_box"]) if recorded.get("crop_box") else None
                print(f"  [CROP-CHECKED] Already analysed ({recorded.get('status')}); skipping Stage 1")
            else:
                was_cropped, crop_msg, crop_box = smart_crop_image(img_path, dry_run=False)
                crop_ledger[key] = {
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "status": "cropped" if was_cropped else "preserved",
                    "crop_box": list(crop_box) if crop_box else None,
                    "reason": crop_msg,
                }
                save_ledger(crop_ledger, crop_ledger_path)
                if was_cropped:
                    cropped_count += 1
                    print(f"  [CROPPED] {crop_msg}")
                    if args.sync:
                        sync_to_mirror(img_path, data_dir, mirror_dir)
                else:
                    print(f"  [PRESERVED] {crop_msg}")

        if args.crop_only:
            success_count += 1
            continue

        # Check source-hash deduplication before invoking AI
        source_hash = get_file_hash(img_path)
        if source_hash and source_hash in processed_by_source_hash:
            donor_path = processed_by_source_hash[source_hash]
            if donor_path.is_file() and donor_path.resolve() != img_path.resolve():
                shutil.copy2(donor_path, img_path)
                success_count += 1
                print(f"  [DEDUP] Copied already-enhanced identical asset from {donor_path.name}")
                key = str(img_path.resolve()).replace("\\", "/")
                ledger[key] = {
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "cropped": was_cropped,
                    "crop_box": list(crop_box) if crop_box else None,
                    "source_sha256": source_hash,
                    "sha256": get_file_hash(img_path),
                    "file_size": img_path.stat().st_size,
                    "model": args.model,
                    "deduplicated_from": str(donor_path),
                }
                save_ledger(ledger, ledger_path)
                if args.sync:
                    sync_to_mirror(img_path, data_dir, mirror_dir)
                continue

        # Stage 2: AI Image Enhancement via agy
        start_time = time.time()
        success, message = run_image_enhancement(
            image_path=img_path,
            agy_bin=agy_bin,
            model=args.model,
            backup=False,  # Handled before Stage 1 so .bak preserves uncropped original
            timeout=args.timeout,
            preserve_dimensions=args.preserve_dimensions,
        )
        elapsed = time.time() - start_time

        if success:
            success_count += 1
            print(f"  [SUCCESS] {message} ({elapsed:.1f}s)")
            if source_hash:
                processed_by_source_hash[source_hash] = img_path

            key = str(img_path.resolve()).replace("\\", "/")
            ledger[key] = {
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "cropped": was_cropped,
                "crop_box": list(crop_box) if crop_box else None,
                "source_sha256": source_hash,
                "sha256": get_file_hash(img_path),
                "file_size": img_path.stat().st_size,
                "model": args.model,
            }
            save_ledger(ledger, ledger_path)

            if args.sync:
                synced = sync_to_mirror(img_path, data_dir, mirror_dir)
                if synced:
                    print(f"  [SYNC] Mirrored to {mirror_dir.name}")
        else:
            failure_count += 1
            print(f"  [FAILED] {message} ({elapsed:.1f}s)", file=sys.stderr)

        # Stage 3: Pacing delay between AI calls
        if idx < total_candidates and args.delay > 0:
            print(f"  [Pacing] Waiting {args.delay}s before next image...")
            time.sleep(args.delay)

    print("\n==================================================")
    print("                 Execution Summary                ")
    print("==================================================")
    print(f"Total Processed: {total_candidates}")
    print(f"Smart Cropped:   {cropped_count}")
    print(f"Successful:      {success_count}")
    print(f"Failed:          {failure_count}")
    print(f"Previously Done: {len(already_done_items)}")
    print(f"Excluded:        {len(excluded_items)}")
    print("==================================================")

    return 0 if failure_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
