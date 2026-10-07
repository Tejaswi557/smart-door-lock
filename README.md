# Face Recognition Based Smart Door Lock and Access Monitoring System

A client-side biometric access control and monitoring prototype built using pure frontend web technologies.

![Technology](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JavaScript-blue)
![Architecture](https://img.shields.io/badge/Architecture-100%25%20Client--Side-green)
![Deployment](https://img.shields.io/badge/Deployment-GitHub%20Pages%20Ready-yellow)
![Hardware](https://img.shields.io/badge/Type-Software%20Prototype-orange)

---

## 📌 Project Overview

This project is a complete, self-contained **software prototype** for a biometric door lock access management system. It operates 100% inside modern web browsers using standard web APIs, featuring real client-side face detection, 128-dimensional biometric descriptor extraction, and Euclidean distance verification.

### Key Architectural Highlights:
- **Zero Backend / Zero Paid APIs**: No Python, Flask, Firebase, or MongoDB required.
- **Client-Side Processing**: All face detections, descriptor extractions, and distance calculations execute locally on the user's machine.
- **Local Persistence**: User enrollments and access audit trails are persisted securely in browser `LocalStorage`.
- **Deployable Anywhere**: 100% static files, ready for instant hosting on **GitHub Pages**, Vercel, Netlify, or Apache/Nginx.

---

## 📂 Project Structure

```text
smart-door-lock/
│
├── index.html           # 1. Dashboard (KPI stats, lock state, recent activity)
├── register.html        # 2. Face Registration (Webcam enrollment, 128D vectors)
├── recognition.html     # 3. Live Recognition (Real-time HUD, simulated door relay)
├── logs.html            # 4. Access Logs (Audit trail, search, filter, CSV/JSON export)
├── about.html           # 5. Project Information (Specs, architecture, future hardware scope)
│
├── css/
│   ├── style.css        # Dark blue sidebar, yellow accent, typography & layout
│   └── components.css   # Cards, camera viewports, HUD overlay, lock orb, tables
│
├── js/
│   ├── storage.js       # LocalStorage manager (Users, logs, configuration)
│   ├── camera.js        # Browser Webcam API wrapper (getUserMedia, frame capture)
│   ├── face-engine.js   # Client-side 128D biometric vector extraction & Euclidean matcher
│   ├── app.js           # Core UI navigation, Web Audio synthesizer, digital clock
│   ├── dashboard.js     # Live statistics calculation and recent logs view
│   ├── register.js      # Enrollment workflow and personnel directory management
│   ├── recognition.js   # Live webcam recognition loop and simulated unlock logic
│   └── logs.js          # Audit log table rendering, filtering, and data export
│
└── README.md            # Comprehensive project documentation
```

---

## 🖥️ The 5 System Pages

1. **Dashboard (`index.html`)**:
   - Real-time digital system clock and biometric status monitor.
   - Dynamic KPI cards computing enrolled users, today's events, authorized entries, and security alerts from `LocalStorage`.
   - Simulated electronic door lock state indicator with unlock pulse visualizer.
   - Chronological table of recent access attempts.

2. **Face Registration (`register.html`)**:
   - Live camera enrollment viewfinder with an oval alignment guide.
   - Client-side face detection and 128-dimensional biometric descriptor generation.
   - Personnel metadata capture: Full Name, Department, Roll No./Staff ID, Access Level.
   - Searchable directory of registered personnel with delete capabilities.

3. **Live Recognition (`recognition.html`)**:
   - Real-time continuous webcam scanning loop with HUD bounding box overlay and laser scan beam.
   - Instant biometric comparison using Euclidean distance against enrolled templates.
   - Sensitivity threshold slider to tune strictness ($0.40$ to $0.70$).
   - Real-time decision panel (Access Granted / Access Denied / Unrecognized).
   - Audio feedback synthesizer (affirmative chime for Granted, alert buzzer for Denied) generated via the HTML5 Web Audio API (no external sound files required).
   - Simulated electronic relay actuation (5-second unlock pulse with auto-relocking).

4. **Access Logs (`logs.html`)**:
   - Detailed audit trail with timestamps, subject photo snapshots, status badges, and match confidence scores.
   - Search by name, department, or user ID.
   - Filter by decision outcome (All, Granted, Denied) and date (All Time, Today, Past 7 Days).
   - Instant export to **CSV** and **JSON** files.

5. **Project Information (`about.html`)**:
   - Academic abstract and motivation.
   - End-to-end client-side system architecture workflow.
   - Technical specifications matrix.
   - **Future Scope: Physical Hardware Integration** detailing how this software prototype can interface with Raspberry Pi 4, ESP32-CAM, 12V solenoid locks, 5V optocoupler relays, and PIR motion sensors.

---

## 🚀 How to Run Locally

Because the application uses the browser Webcam API (`navigator.mediaDevices.getUserMedia`), modern browsers require a secure origin (`https://` or `http://localhost`).

### Option A: VS Code Live Server (Recommended)
1. In VS Code, right-click on `index.html`.
2. Click **"Open with Live Server"**.
3. Allow camera access when prompted by the browser.

### Option B: Python Simple HTTP Server
Open your terminal in the project directory and run:
```bash
# Python 3
python -m http.server 8000
```
Open `http://localhost:8000` in Google Chrome, Microsoft Edge, or Firefox.

### Option C: Node.js `npx serve`
```bash
npx serve .
```

---

## 🌐 How to Deploy on GitHub Pages

1. Create a new repository on GitHub (e.g. `smart-door-lock`).
2. Push this project folder to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Face Recognition Smart Door Lock Prototype"
   git branch -M main
   git remote add origin https://github.com/<your-username>/smart-door-lock.git
   git push -u origin main
   ```
3. Go to repository **Settings** &rarr; **Pages**.
4. Under **Branch**, select `main` and `/ (root)`, then click **Save**.
5. Your system will be live at `https://<your-username>.github.io/smart-door-lock/` with full HTTPS support for the Webcam API!

---

## 🔒 Privacy & Security

- All face descriptors and image snapshots remain **strictly confined to the local browser sandbox** (`LocalStorage`).
- No biometric data or video streams are ever transmitted across the internet.
- Zero server-side tracking, cookies, or paid API requirements.
