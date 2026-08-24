# Hand-timed reference TTMLs

The originals, timed by hand before the pipeline existed. Kept because
`assets/hymns/` is now generated and will overwrite them.

- **`003.ttml` is the only usable ground truth.** Its recording is unchanged
  (`mp3-source/003.mp3` and the old cached copy are both 207.023s), so
  `compare.py` against it is meaningful. Stage 2 scores rms 0.180s on it.
- **`001.ttml` cannot be scored.** It was timed against a 157.647s recording;
  the canonical `mp3-source/001.mp3` is 146.9s — a different take. Kept only for
  reference.

```bash
python3 stage2.py <score.json> ../../mp3-source/003.mp3 --out /tmp/003.ttml
python3 compare.py /tmp/003.ttml fixtures/003.ttml
```
