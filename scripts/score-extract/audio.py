"""Onset detection for the hymn instrumentals.

Deliberately dependency-light: the repo already ships ffmpeg for the app, so
decoding goes through that, and the detection itself is a spectral-flux onset
detector in numpy. Solo piano gives very clean onsets, which is what makes this
enough -- there is no need for a full beat tracker, because stage 2 already
knows the exact rhythm it is looking for and only has to locate it.
"""

from __future__ import annotations

import os
import platform
import subprocess

import numpy as np

SAMPLE_RATE = 22050
HOP = 256                       # ~11.6 ms resolution
WINDOW = 1024

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def ffmpeg_path() -> str:
    plat = {"Darwin": "darwin", "Windows": "win32", "Linux": "linux"}.get(
        platform.system(), "linux")
    bundled = os.path.join(REPO, "bin", plat, "ffmpeg" + (".exe" if plat == "win32" else ""))
    return bundled if os.path.exists(bundled) else "ffmpeg"


def decode(path: str) -> np.ndarray:
    """Mono float32 PCM at SAMPLE_RATE."""
    out = subprocess.run(
        [ffmpeg_path(), "-v", "quiet", "-i", path, "-ac", "1",
         "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def onset_envelope(y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Spectral flux over time, plus the frame times."""
    if y.size < WINDOW:
        return np.zeros(0), np.zeros(0)
    n_frames = 1 + (y.size - WINDOW) // HOP
    idx = np.arange(WINDOW)[None, :] + HOP * np.arange(n_frames)[:, None]
    frames = y[idx] * np.hanning(WINDOW)[None, :]
    mag = np.abs(np.fft.rfft(frames, axis=1))
    # Log compression keeps quiet inner voices from being swamped by the bass.
    mag = np.log1p(mag * 10.0)
    flux = np.diff(mag, axis=0)
    env = np.maximum(flux, 0.0).sum(axis=1)
    if env.size and env.max() > 0:
        env = env / env.max()
    times = (np.arange(env.size) + 1) * HOP / SAMPLE_RATE
    return env, times


def detection_function(path: str) -> tuple[np.ndarray, np.ndarray, float]:
    """Local-median-subtracted onset strength, its frame times, and duration.

    Stage 2 fits against this curve rather than against picked peaks: legato
    piano hides plenty of note onsets below any threshold, and a peak list that
    misses a third of the notes biases the fit, whereas the continuous curve
    still carries the evidence.
    """
    y = decode(path)
    duration = y.size / SAMPLE_RATE
    env, times = onset_envelope(y)
    if env.size == 0:
        return env, times, duration

    w = 25
    pad = np.pad(env, (w, w), mode="edge")
    strides = np.lib.stride_tricks.sliding_window_view(pad, 2 * w + 1)
    det = np.maximum(env - np.median(strides, axis=1), 0.0)
    if det.max() > 0:
        det = det / det.max()
    return det, times, duration


def chromagram(path: str, y: np.ndarray | None = None
               ) -> tuple[np.ndarray, np.ndarray]:
    """12 x frames of pitch-class energy, plus the frame times.

    Rhythm alone cannot place a tune whose notes are all the same length -- a
    uniform pulse fits anywhere at the right tempo. Pitch can. Chroma (rather
    than absolute pitch) also means an octave slip in reading the clef costs
    nothing.
    """
    if y is None:
        y = decode(path)
    if y.size < WINDOW:
        return np.zeros((12, 0)), np.zeros(0)
    n_frames = 1 + (y.size - WINDOW) // HOP
    idx = np.arange(WINDOW)[None, :] + HOP * np.arange(n_frames)[:, None]
    frames = y[idx] * np.hanning(WINDOW)[None, :]
    mag = np.abs(np.fft.rfft(frames, axis=1))

    freqs = np.fft.rfftfreq(WINDOW, 1.0 / SAMPLE_RATE)
    with np.errstate(divide="ignore", invalid="ignore"):
        midi = 69 + 12 * np.log2(np.where(freqs > 0, freqs, np.nan) / 440.0)
    usable = np.isfinite(midi) & (midi >= 33) & (midi <= 96)   # A1..C7
    pc = np.zeros(freqs.size, dtype=int)
    pc[usable] = np.round(midi[usable]).astype(int) % 12

    chroma = np.zeros((12, n_frames))
    for k in range(12):
        sel = usable & (pc == k)
        if sel.any():
            chroma[k] = mag[:, sel].sum(axis=1)
    # Normalise each frame so loud passages do not dominate the match.
    total = chroma.sum(axis=0, keepdims=True)
    chroma = np.divide(chroma, total, out=np.zeros_like(chroma), where=total > 0)
    times = (np.arange(n_frames) + 0.5) * HOP / SAMPLE_RATE
    return chroma, times


def detect_onsets(path: str, delta: float = 0.06,
                  min_gap: float = 0.09) -> tuple[np.ndarray, float]:
    """Peak-picked onset times, for reporting and diagnostics."""
    det, times, duration = detection_function(path)
    if det.size == 0:
        return np.zeros(0), duration
    peaks: list[int] = []
    for i in range(1, det.size - 1):
        if det[i] > delta and det[i] >= det[i - 1] and det[i] > det[i + 1]:
            if peaks and times[i] - times[peaks[-1]] < min_gap:
                if det[i] > det[peaks[-1]]:
                    peaks[-1] = i
                continue
            peaks.append(i)
    return (times[np.array(peaks, dtype=int)] if peaks else np.zeros(0)), duration
