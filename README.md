# NeuralChat — Chat UI Assignment

A modern, responsive chat interface built for the CampusPe Gen AI internship assignment.
Inspired by Claude and ChatGPT, but with its own aesthetic. No backend needed — all UI and mock responses.

---

## Tech Stack

- HTML5, CSS3, JavaScript (ES6+)
- jQuery 3.7
- Bootstrap 5.3
- Font Awesome 6.4
- Google Fonts — Sora + DM Sans

---

## Features

**Core**
- Welcome screen with 4 clickable suggestion cards
- Real-time message bubbles — user (right) and AI (left)
- Timestamps on every message
- Typing indicator with bouncing dots
- Auto-resizing textarea
- Enter to send, Shift+Enter for newline
- Auto-scroll on new messages
- Sidebar with chat history and New Chat button

**Bonus**
- Dark/light mode toggle (smooth CSS variable transition)
- Basic markdown formatting — `code`, **bold**, *italic*, code blocks
- Typewriter effect for AI responses (letter by letter)
- Export conversation as `.txt` via Blob API
- Custom scrollbar styling

---

## Run It

No build step, no server required.

```
Just open index.html in any modern browser.
```

Or with VS Code Live Server:
1. Install the Live Server extension
2. Right-click `index.html` → Open with Live Server

---

## File Structure

```
ChatUI/
├── index.html          # Main HTML — structure and layout
├── css/
│   └── style.css       # All styles — variables, components, responsive
├── js/
│   └── chat.js         # All functionality — jQuery + vanilla JS
├── screenshots/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
└── README.md
```

---

## Design Choices

I went with a deep charcoal dark theme (`#0d1117`) with teal accents (`#5eead4`) and indigo user bubbles.
Fonts are Sora (headings) and DM Sans (body) — clean but not the default Inter everyone uses.
Light mode keeps the sidebar dark intentionally — feels more professional.

---

## Notes

- AI responses are mock only — no API calls
- Tested on Chrome, Firefox, Edge
- Responsive from 320px to 1920px+

---

*CampusPe Gen AI Internship | April 2026*
