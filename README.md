# Live Sports Scoreboard

This is a self‑hosted, browser‑based scoreboard that shows **MLB**, **NFL**, and **NBA** scores one game at a time with smooth transitions.

## Features
- Supports **MLB**, **NFL**, and **NBA** (selectable from dropdown).
- Pulls live data from ESPN’s public JSON endpoints.
- Displays:
  - **MLB:** Inning status, count, outs, runners on base (diamond), linescore by inning.
  - **NFL:** Quarter, game clock, down & distance, yard line, possession, red zone marker.
  - **NBA:** Quarter and game clock.
- Team logos, records, and big scores (aligned cleanly).
- Auto‑rotate between games with fade/slide animation (≈1.35s).
- Manual Prev/Next navigation.
- Auto‑hide header/footer after 5s of inactivity (re‑appear on mouse/keyboard/touch).
- Responsive layout suitable for large screens / TVs.

## How to Use
1. Unzip the package.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox).
3. Use the **League** dropdown to select MLB / NFL / NBA.
4. Use the **Date** picker to view scores for a specific day.
5. Enable **Auto‑rotate** to cycle through games automatically every few seconds.

## Notes
- Data refreshes every **30 seconds** for live games.
- Make sure to **hard refresh** (`Ctrl+F5` / `Cmd+Shift+R`) if updating builds.
- This is for **personal use** only — data is from ESPN’s public JSON feeds.

## Files
- `index.html` – main page
- `css/styles.css` – styling
- `js/app.js` – logic for fetching & rendering
- `README.md` – this file

Enjoy your live scoreboard!
