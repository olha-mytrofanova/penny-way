PennyWay is a lightweight personal finance tracker that helps you **track income and expenses**, **see spending by category**, and **stay on budget** with category limits. Everything is stored locally in your browser (LocalStorage) — no account, no backend.
>  **Work in progress:** This project is currently being edited and improved. Some features, UI details, or data structure may change.

---

## Features

- Add **income and expenses** (amount, category, date, note)
- **Balance overview** (current balance + quick stats)
- **Categories** with:
  - spending totals
  - **limits / budgets** per category (with visual progress)
- **Charts** (Chart.js) for a quick breakdown of where your money goes
- **Savings Jar** (goal-based savings widget)
- **Wishlist** (track items you want to buy and their cost)
- **LocalStorage persistence** — your data stays after refresh

---

## Tech Stack

- HTML, CSS, Vanilla JavaScript
- Chart.js
- LocalStorage (no database)

---

## Getting Started

### Option A — Open directly
If the project does not use `fetch()` for local files, you can open `index.html` directly.

### Option B — Run with a local server (recommended)
Some browsers block `fetch()` when opening files locally. Use a simple local server:

```bash
# from the project folder
python3 -m http.server 5173
