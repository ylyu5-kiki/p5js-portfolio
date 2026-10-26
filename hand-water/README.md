# Hand Water

A camera-based interactive artwork: move an open hand to disturb a transparent glass-like water surface; close it into a fist to gather white particles, then open it to release water again.

## Experience

Open the hosted page in a desktop browser, choose **Enable camera**, and allow camera access. Keep one hand and your face visible in good light. The initial screen shows only the camera access button, with no background animation.

- Open hand: liquid refraction and ripples.
- Closed fist: a compact particle cloud with particles orbiting the fist.
- Reopen hand: particles disperse and water returns.
- Face and hand protection: original camera pixels are retained around detected faces and hand landmarks to reduce distortion. When tracking is lost, refraction pauses as a fallback. Very fast motion or occlusion can affect the mask.
- Controls: ripple strength, refraction strength, reset, fullscreen and camera stop.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/hand-water/`. Camera access requires HTTPS or localhost. Stopping the camera returns to the camera access screen. First use requires internet access for the pinned MediaPipe runtime and models. No build step is needed.

## Technology and privacy

JavaScript, WebGL/GLSL water shading, a damped height-field wave simulation, Canvas 2D particles, and MediaPipe Tasks Vision 0.10.21 for hand landmarks and face detection. Camera frames are processed locally by this code; this project does not record or upload video. Runtime, models and font files are fetched from their external providers.

The cover is an illustrative graphic, not a camera capture. Camera interaction must be checked with a real camera; tracking accuracy depends on lighting, pose and browser performance.
