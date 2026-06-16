# BigQuery Pulse - Release Notes Explorer

BigQuery Pulse is a web dashboard designed to fetch, organize, search, and share release updates from Google Cloud's BigQuery release log. Built using **Python Flask** on the server and a **Vanilla HTML/CSS/JS** glassmorphism frontend, it breaks down daily log lists into structured, category-coded cards, facilitating easy consumption and developer tracking.

---

## 🚀 Key Features

* **Granular Feed Parsing:** Splits daily release note updates into separate cards by categories: *Features* 🟢, *Issues* 🔴, *Changes* 🟣, *Announcements* 🟡, and *Breaking* 🚨.
* **1-Hour In-Memory Cache:** Restricts redundant external HTTP queries to Google's servers, falling back gracefully to cache if network calls time out.
* **Reactive Client Search & Filters:** Fast, client-side keyword indexing and category switches with live counts.
* **Mock Twitter/X Composer Modal:** Shows a simulated Tweet card preview, including:
  * Dynamic preset toggles for adding emojis, hashtags, or release log links.
  * Real-time SVG circular character progress ring enforcing the 280-character limit.
  * Web Intent integration to instantly post to X/Twitter or copy text.
* **Card-level Copy Utility:** Copy the clean raw text of individual release updates to your clipboard instantly with visual success verification.
* **Export to CSV:** Download the currently filtered list of release updates (accounting for search terms and category buttons) as a formatted `.csv` spreadsheet.
* **Custom Theme Switcher:** Transitions smoothly between slate dark mode (default) and light mode, storing preferences inside the browser's `localStorage`.
* **Keyboard Navigation:** Press `Ctrl + K` or `/` to focus the search input; press `Esc` to close the modal.

---

## 📂 Project Structure

```
bigquery-event-talks-app/
├── .gitignore                  # Git patterns to ignore
├── README.md                   # Project documentation (this file)
└── bq-releases-notes/          # Application source directory
    ├── app.py                  # Python Flask server & Atom parser
    ├── templates/
    │   └── index.html          # Web interface skeleton
    └── static/
        ├── css/
        │   └── style.css       # Design tokens & glassmorphism stylesheet
        └── js/
            └── app.js          # App state engine & modal math
```

---

## ⚙️ Installation & Running

### Prerequisites
* Python 3.8 or higher
* `pip` package manager

### 1. Clone & Set Up
Navigate to the project directory:
```bash
cd bq-releases-notes
```

### 2. Install Dependencies
Install Flask and requests via pip:
```bash
pip install Flask requests
```

### 3. Start the Server
Run the Flask server script:
```bash
python app.py
```
By default, the server runs in debug mode on **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 🔄 API Routes Reference

### `GET /`
Serves the responsive dashboard index page.

### `GET /api/releases`
Fetches and formats release log updates.
* **Query Parameters:**
  * `refresh=true` (Optional): Forces a live HTTP request to Google's server to rebuild the cache.
* **Sample JSON Response:**
```json
{
  "status": "success",
  "source": "live",
  "last_fetched": "2026-06-16T19:55:00.123456",
  "updates": [
    {
      "id": "update-0",
      "date": "June 15, 2026",
      "category": "Feature",
      "content_html": "<p>Use Gemini Cloud Assist to analyze SQL...</p>",
      "content_text": "Use Gemini Cloud Assist to analyze SQL...",
      "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026"
    }
  ]
}
```

---

## 🎨 Design Systems
The UI uses glassmorphism properties:
* **Backgrounds:** `backdrop-filter: blur(12px)` with gradient glow orbs.
* **Typography:** `Outfit` (Headings) and `Inter` (Body Text) imported from Google Fonts.
* **Layout:** Grid timeline with adaptive dot nodes.
