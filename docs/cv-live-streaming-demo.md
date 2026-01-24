# CV Live Streaming Demo (Under 60 Seconds)

Pre-reqs:
- `docker compose up -d`
- Dashboard: `http://localhost:3000/cv`
- Optional: DroidCam running (phone -> laptop camera)

Live Camera (primary)
1) Click `Live Camera`.
2) Click `Start Camera` (pick DroidCam in the dropdown if present).
3) Click `Start Inference` and point the camera at the scene.
4) Call out: ~1 FPS snapshots, backpressure (no overlapping calls), overlay + last analyzed timestamp.

Video File (fallback)
1) Click `Video File`.
2) Choose an `.mp4`/`.webm`/`.mov` file.
3) Click play.
4) Click `Start Inference` (runs only while playing; pause stops ticks; end stops inference).

Image Upload (fallback testing)
1) Click `Image Upload`.
2) Select an image and click `Run Analysis`.

Troubleshooting
- Camera requires `http://localhost` (or HTTPS) and browser permissions.
- If switching away from Live, the app stops camera tracks automatically.
