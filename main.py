import json
import math
import os
from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np
from datetime import datetime

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import sys


app = FastAPI(title="Shoulder & Face Validator", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Analysis"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

try:
    import mediapipe as mp
except Exception as e:  # pragma: no cover - import/runtime dependency issue
    raise RuntimeError(f"Failed to import mediapipe: {type(e).__name__}: {e}") from e

try:
    import mediapipe.solutions as mp_solutions
except Exception:
    try:
        import mediapipe.python.solutions as mp_solutions  # fallback for some builds
    except Exception as e:
        raise RuntimeError(f"Failed to import mediapipe solutions: {type(e).__name__}: {e}") from e
mp_pose = mp_solutions.pose
mp_face_detection = mp_solutions.face_detection

_pose_detector = None
_face_detector = None


def get_pose_detector():
    """Lazily initialize Pose detector to avoid startup crash on limited environments."""
    global _pose_detector
    if _pose_detector is None:
        try:
            _pose_detector = mp_pose.Pose(
                static_image_mode=True,
                model_complexity=1,
                min_detection_confidence=0.4,
            )
        except Exception as e:
            raise RuntimeError(f"Failed to init Pose(): {type(e).__name__}: {e}") from e
    return _pose_detector


def get_face_detector():
    """Lazily initialize FaceDetection to avoid startup crash on limited environments."""
    global _face_detector
    if _face_detector is None:
        try:
            _face_detector = mp_face_detection.FaceDetection(
                model_selection=1,
                min_detection_confidence=0.4,
            )
        except Exception as e:
            raise RuntimeError(f"Failed to init FaceDetection(): {type(e).__name__}: {e}") from e
    return _face_detector


def _decode_image(file_bytes: bytes) -> np.ndarray:
    image_array = np.frombuffer(file_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    return image


def _maybe_resize(image_bgr: np.ndarray, max_side: int = 1600) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    scale = max(h, w) / max_side
    if scale <= 1:
        return image_bgr
    new_w, new_h = int(w / scale), int(h / scale)
    return cv2.resize(image_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _extract_pose(image_rgb: np.ndarray, width: int, height: int):
    pose_results = get_pose_detector().process(image_rgb)
    if not pose_results.pose_landmarks:
        return None

    landmarks = pose_results.pose_landmarks.landmark
    left = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]

    left_pt = (int(left.x * width), int(left.y * height))
    right_pt = (int(right.x * width), int(right.y * height))
    visibility = {"left": float(left.visibility), "right": float(right.visibility)}
    shoulder_width = float(math.dist(left_pt, right_pt))

    head_bbox = _approx_head_bbox(pose_results.pose_landmarks.landmark, width, height)

    return {
        "left_pt": left_pt,
        "right_pt": right_pt,
        "visibility": visibility,
        "shoulder_width": shoulder_width,
        "head_bbox": head_bbox,
    }


def _extract_face_bbox(image_rgb: np.ndarray, width: int, height: int):
    face_results = get_face_detector().process(image_rgb)
    if not face_results.detections:
        return None

    detection = face_results.detections[0]
    bbox_rel = detection.location_data.relative_bounding_box

    x_min = max(int(bbox_rel.xmin * width), 0)
    y_min = max(int(bbox_rel.ymin * height), 0)
    box_width = int(bbox_rel.width * width)
    box_height = int(bbox_rel.height * height)
    x_min = min(x_min, width - 1)
    y_min = min(y_min, height - 1)
    box_width = min(box_width, width - x_min)
    box_height = min(box_height, height - y_min)

    return {
        "x": x_min,
        "y": y_min,
        "w": box_width,
        "h": box_height,
        "face_width": float(box_width),
    }


def _approx_head_bbox(landmarks, width: int, height: int):
    key_idxs = [
        mp_pose.PoseLandmark.NOSE,
        mp_pose.PoseLandmark.LEFT_EYE,
        mp_pose.PoseLandmark.RIGHT_EYE,
        mp_pose.PoseLandmark.LEFT_EAR,
        mp_pose.PoseLandmark.RIGHT_EAR,
    ]
    pts = []
    for idx in key_idxs:
        lm = landmarks[idx]
        if lm.visibility < 0.1:
            continue
        pts.append((lm.x * width, lm.y * height))
    if not pts:
        return None

    xs, ys = zip(*pts)
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    base_w = max(max_x - min_x, 1)
    base_h = max(max_y - min_y, 1)
    pad_x = base_w * 0.6
    pad_y = base_h * 0.8
    x = max(int(min_x - pad_x), 0)
    y = max(int(min_y - pad_y), 0)
    w = int(min(base_w + pad_x * 2, width - x))
    h = int(min(base_h + pad_y * 2, height - y))
    return {"x": x, "y": y, "w": w, "h": h, "face_width": float(w)}


def _build_overlay(
    image_bgr: np.ndarray, pose_info: Optional[Dict], face_info: Optional[Dict], mosaic: bool = False
):
    annotated = image_bgr.copy()

    if mosaic and face_info:
        x, y, w, h = face_info["x"], face_info["y"], face_info["w"], face_info["h"]
        if w > 0 and h > 0:
            roi = annotated[y : y + h, x : x + w]
            if roi.size > 0:
                small = cv2.resize(roi, (max(1, w // 40), max(1, h // 40)), interpolation=cv2.INTER_LINEAR)
                mosaic_roi = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
                annotated[y : y + h, x : x + w] = mosaic_roi

    if pose_info:
        cv2.circle(annotated, pose_info["left_pt"], 6, (0, 255, 0), -1)
        cv2.circle(annotated, pose_info["right_pt"], 6, (0, 255, 0), -1)
        cv2.line(annotated, pose_info["left_pt"], pose_info["right_pt"], (0, 255, 0), 2)

    return annotated


def _classify_ratio(ratio: Optional[float]):
    if ratio is None:
        return None

    tiers = [
        (
            float("-inf"),
            1.65,
            "레전더리 어좁이",
            "하위 20%",
            "숄더패드가 친구하고 싶어함",
            "Legendary narrow shoulders",
            "Bottom 20%",
            "Shoulder pads are calling your name",
        ),
        (
            1.65,
            1.80,
            "약간 어좁이",
            "하위 20~35%",
            "후드티가 제일 예쁜 구간",
            "Slightly narrow",
            "Bottom 20-35%",
            "Hoodies fit best right here",
        ),
        (
            1.80,
            2.00,
            "평균 어깨",
            "중간권 35~55%",
            "국민 숄더 사이즈",
            "Balanced shoulders",
            "Middle 35-55%",
            "Right down the middle",
        ),
        (
            2.00,
            2.15,
            "약간 어깨 깡패",
            "상위 20~35%",
            "셔츠 어깨선이 살짝 벌어짐",
            "Slightly broad",
            "Top 20-35%",
            "Buttons feel a gentle pull",
        ),
        (
            2.15,
            2.30,
            "어깨 깡패",
            "상위 10~20%",
            "문틀에 어깨 먼저 조심",
            "Broad shoulders",
            "Top 10-20%",
            "Watch the door frame first",
        ),
        (
            2.30,
            2.50,
            "어깨 괴물",
            "상위 3~10%",
            "역삼각형의 기운이 느껴짐",
            "Shoulder beast",
            "Top 3-10%",
            "V-taper vibes incoming",
        ),
        (
            2.50,
            2.72,
            "레전더리 어깨 괴물",
            "상위 1~3%",
            "숄더 신화 직전 구간",
            "Legendary shoulder beast",
            "Top 1-3%",
            "Entering shoulder myth zone",
        ),
        (
            2.72,
            float("inf"),
            "레전더리 어깨 괴물",
            "상위 1%",
            "숄더 신화 영역 돌파",
            "Legendary shoulder beast",
            "Top 1%",
            "Shoulder myth unlocked",
        ),
    ]

    for (
        low,
        high,
        nickname_ko,
        percentile_ko,
        quip_ko,
        nickname_en,
        percentile_en,
        quip_en,
    ) in tiers:
        if low <= ratio < high:
            return {
                "ko": {"nickname": nickname_ko, "percentile": percentile_ko, "quip": quip_ko},
                "en": {"nickname": nickname_en, "percentile": percentile_en, "quip": quip_en},
            }

    return None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...), mosaic: bool = Form(False)):
    file_bytes = await file.read()
    image_bgr = _decode_image(file_bytes)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_bgr = _maybe_resize(image_bgr, max_side=1600)
    height, width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    pose_info = _extract_pose(image_rgb, width, height)
    face_info = _extract_face_bbox(image_rgb, width, height)
    if not face_info and pose_info and pose_info.get("head_bbox"):
        face_info = pose_info["head_bbox"]

    if not pose_info and not face_info:
        raise HTTPException(
            status_code=400,
            detail={
                "ko": "사람을 인식하지 못하였습니다. 다른 사진으로 시도해주세요.",
                "en": "No person detected. Please try another photo.",
            },
        )

    ratio = None
    if pose_info and face_info and face_info["face_width"] > 0:
        ratio = pose_info["shoulder_width"] / face_info["face_width"]

    grade = _classify_ratio(ratio)
    annotated = _build_overlay(image_bgr, pose_info, face_info, mosaic=mosaic)
    success, buffer = cv2.imencode(".png", annotated)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode image")

    analysis_meta = {
        "pose_detected": bool(pose_info),
        "face_detected": bool(face_info),
        "shoulder_width_px": pose_info["shoulder_width"] if pose_info else None,
        "face_width_px": face_info["face_width"] if face_info else None,
        "ratio": ratio,
        "visibility": pose_info["visibility"] if pose_info else None,
        "nickname": grade["ko"]["nickname"] if grade else None,
        "percentile": grade["ko"]["percentile"] if grade else None,
        "quip": grade["ko"]["quip"] if grade else None,
        "nickname_en": grade["en"]["nickname"] if grade else None,
        "percentile_en": grade["en"]["percentile"] if grade else None,
        "quip_en": grade["en"]["quip"] if grade else None,
    }

    headers = {"X-Analysis": json.dumps(analysis_meta)}
    return Response(content=buffer.tobytes(), media_type="image/png", headers=headers)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/robots.txt")
def robots(request: Request):
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            f"Sitemap: {base_url}/sitemap.xml",
        ]
    )
    return Response(content=content, media_type="text/plain")


@app.get("/sitemap.xml")
def sitemap(request: Request):
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    lastmod = datetime.utcnow().date().isoformat()
    content = "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            "  <url>",
            f"    <loc>{base_url}/</loc>",
            f"    <lastmod>{lastmod}</lastmod>",
            "    <changefreq>weekly</changefreq>",
            "    <priority>1.0</priority>",
            "  </url>",
            "</urlset>",
        ]
    )
    return Response(content=content, media_type="application/xml")


@app.get("/debug/mediapipe")
def debug_mediapipe():
    """배포 환경에서 mediapipe, Python 버전 확인용."""
    return {
        "mediapipe_version": getattr(mp, "__version__", "unknown"),
        "python_version": sys.version,
    }
