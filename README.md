# AGRO — AI Farming Companion

AGRO is a full-stack web application designed to help farmers organize crop records, log field observations, track weather trends, and interact with a context-aware AI assistant. Its AI engine utilizes saved crop history, numeric trends, and location-based weather data to provide grounded agricultural guidance.

> **Disclaimer:** AGRO is an international hackathon MVP designed to demonstrate context-grounded AI in agriculture. AI recommendations should serve as preliminary guidance and must be reviewed with qualified local agricultural experts before making field decisions.

---

## 📋 Table of Contents

- [The Problem & Solution](#-the-problem--solution)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture & Workflow](#-system-architecture--workflow)
- [AI Models & APIs](#-ai-models--apis)
- [Requirements](#-requirements)
- [Getting Started](#-getting-started)
  - [1. Backend Setup](#1-configure-the-backend)
  - [2. Frontend Setup](#2-start-the-frontend)
  - [3. Google Maps Integration](#configure-google-maps-location-search-and-picker)
  - [4. Trying the Application](#3-try-the-app)
- [AI Methodology & Implementation](#-ai-methodology-and-implementation)
- [Verification & Testing](#-verification--testing)
- [Security, Safety, & Limitations](#-security-safety-and-limitations)
- [Team Contributions](#-team-contributions)

---

## 🌾 The Problem & Solution

### The Problem
Farmers need practical guidance that considers their specific crops, farm conditions, and observations over time. Generic advice can miss critical local context, while unsupported estimates about weather, soil, or crop problems can lead to poor agricultural decisions.

### The Solution
AGRO combines crop and farm records with interactive AI chat and external weather data. Farmers can save what they observe and measure, then ask questions directly grounded in that information. The assistant features read-only tools for retrieving crop history, recorded numeric measurements, and local forecasts. All tool actions are transparently displayed in the chat interface.

---

## ✨ Key Features

- **Farmer Profiles & Location Setup:** Register and manage worldwide farm addresses, interactive map coordinates, land acreage, irrigation types, and language preferences.
- **Interactive Google Maps Picker:** Search for addresses or pinpoint coordinates directly on a map to automate local weather and context retrieval.
- **Crop Profiles:** Save crop parameters including variety, location, planting date, growth stage, soil details, irrigation, and operational notes.
- **Context-Aware AI Chat:** Ask crop-specific questions where the AI leverages read-only database and weather tools to ground its answers.
- **AI Crop Planning:** Generate tailored crop recommendations based on farmer profile details, historical performance, and regional forecasts.
- **Crop Journal & Field Logs:** Record qualitative observations for weather, soil conditions, pest management, watering schedules, fertilizer application, expenses, and yield.
- **Measurement Trends & Charts:** Store numeric data (e.g., soil pH, ambient temperature, rainfall) and visualize recorded trends without artificial interpolation.
- **Weather & Historical Climate Integration:** Real-time current conditions, 5-day forecasts, and 1-year historical climate data powered by Open-Meteo APIs.
- **Multimodal File Analysis:** 
  - **Photos:** Inspect JPEG, PNG, and WebP crop images using local vision models.
  - **Documents:** Extract text from text-based PDF, DOCX, TXT, CSV, and Markdown files locally.
- **Voice Input & Speech Output:** Record voice queries in-browser transcribed via local Whisper models, with browser-native text-to-speech for answers.
- **Multilingual Support:** Localized interfaces and assistant responses in **English**, **Sinhala**, and **Tamil**.
- **Private Attachments:** User-uploaded files are securely tied to authenticated accounts and stored in MongoDB.

---

## 🛠️ Technology Stack

| Domain | Stack / Libraries |
| --- | --- |
| **Frontend** | React 18, Vite 6, JavaScript (ES6+), HTML5, CSS3 |
| **Backend** | Node.js, Express 4 |
| **Database** | MongoDB, Mongoose 8 |
| **AI Models** | Ollama (`llama3.2`, `qwen2.5vl:3b`) locally; optional OpenAI API (`gpt-4o-mini`) |
| **Speech Transcription** | Transformers.js (`whisper-tiny`), FFmpeg local decoding; optional OpenAI Whisper (`whisper-1`) |
| **Weather** | Open-Meteo Forecast and Historical Archive APIs |
| **Location & Maps** | Google Maps Platform (Maps JavaScript API & Geocoding API) |
| **Authentication** | Password hashing with `bcryptjs`; signed JSON Web Tokens (JWT) |
| **Upload Handling** | Multer memory storage (10 MB per-file limit) |

---

## 🔄 System Architecture & Workflow

```mermaid
flowchart TD
    Farmer[Farmer in AGRO web app] -->|Sign in, ask crop question, or request crop plan| API[Express API]
    API --> Auth[Authenticate farmer via JWT]
    Auth --> Data[Load farmer, crop, observations, and conversation from MongoDB]
    Data --> Router{AI task and configured provider}
    
    Router -->|Text chat or crop plan| Ollama[Local Ollama text model]
    Router -->|Optional cloud provider| OpenAI[OpenAI API]
    
    Farmer -->|Photo| Vision[Local Ollama vision model]
    Farmer -->|PDF or DOCX| Extract[Extract document text locally]
    Farmer -->|Voice recording| Whisper[Local Whisper transcription]
    Farmer -->|TXT, CSV, or Markdown| TextFile[Read text attachment]
    
    Data -->|Coordinates when available| Weather[Open-Meteo forecast]
    
    Weather --> Context[Build grounded AI context]
    Ollama --> Context
    OpenAI --> Context
    Vision --> Context
    Extract --> Context
    Whisper --> Context
    TextFile --> Context
    
    Context --> Tools{Relevant read-only lookup?}
    Tools -->|Crop history or measurements| Data
    Tools -->|Local forecast| Weather
    Tools -->|No further lookup| Answer[Return answer and data-source actions]
    
    Answer --> Save[Save conversation or recommendation to MongoDB]
    Save --> Farmer

🤖 AI Models & APIs
| Provider | Model / API | Use Case |
|---|---|---|
| OpenAI | gpt-4o-mini (configurable via OPENAI_MODEL) | Optional cloud text chat, crop planning recommendations, image and document analysis |
| Ollama | llama3.2:latest (configurable via AI_MODEL) | Local text chat, crop-data tools, and crop planning recommendations |
| Ollama | qwen2.5vl:3b (configurable via AI_VISION_MODEL) | Local crop-photo visual review |
| Transformers.js | onnx-community/whisper-tiny (configurable via AI_TRANSCRIPTION_MODEL) | Local CPU audio transcription |
| OpenAI | whisper-1 | Optional cloud audio transcription in OpenAI mode |
| Open-Meteo | Forecast API | Current weather and 5-day forecasts (Non-AI API) |
| Open-Meteo | Historical Archive API | 1-year historical climate data (Non-AI API) |
📌 Requirements
 * Node.js: v20.16+ or v22.3+ and npm
 * Database: Local MongoDB server OR a MongoDB Atlas cluster
 * Local AI Engine (Optional): Ollama installed locally with required text and vision models
> Note: Weather services use Open-Meteo and do not require an API key. Local Ollama mode runs chat, crop planning, image analysis, and document review without OpenAI credits. Local inference requires adequate computer memory and processing power.
> 
🚀 Run Locally
Run commands from the project root unless a step specifies otherwise. You can use a local MongoDB server or MongoDB Atlas.
1. Configure the Backend
In PowerShell / Terminal:
cd backend
npm.cmd install
Copy-Item .env.example .env

Option A: MongoDB Atlas (No Local Service)
 * Create a MongoDB Atlas account and cluster.
 * Create a database user and password.
 * In Network Access, add your IP address.
 * Obtain the connection string under Connect → Drivers → Node.js.
 * Set MONGODB_URI in backend/.env.
Example:
MONGODB_URI=mongodb+srv://<database-user>:<encoded-password>@<cluster-host>/agro_ai_farming_companion?retryWrites=true&w=majority

Option B: Local MongoDB
Keep MongoDB running locally and use:
MONGODB_URI=mongodb://127.0.0.1:27017/agro_ai_farming_companion

Complete .env Setup
Open backend/.env and update the full set of environment variables:
PORT=5000
MONGODB_URI=your-mongodb-connection-uri
JWT_SECRET=replace-with-a-private-random-secret-at-least-32-characters-long

# Provider Configuration (ollama OR openai)
AI_PROVIDER=ollama
AI_BASE_URL=[http://127.0.0.1:11434/v1](http://127.0.0.1:11434/v1)
AI_MODEL=llama3.2:latest
AI_VISION_MODEL=qwen2.5vl:3b
AI_TRANSCRIPTION_MODEL=onnx-community/whisper-tiny

# Optional Cloud OpenAI Setup
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

CLIENT_ORIGIN=http://localhost:5173,[http://127.0.0.1:5173](http://127.0.0.1:5173)

No-Cost Local AI with Ollama
To run completely offline using Ollama:
 * Download and install Ollama from ollama.com/download.
 * Pull required models via terminal:
   ollama pull llama3.2:latest
ollama pull qwen2.5vl:3b

 * Verify Ollama is running and set AI_PROVIDER=ollama in backend/.env.
 * Start the backend:
   npm.cmd run dev

   The API will start at http://localhost:5000. Confirm availability at http://localhost:5000/api/health.
2. Start the Frontend
In a second terminal:
cd frontend
npm.cmd install
npm.cmd run dev

Configure Google Maps Location Search and Picker
 * In Google Cloud Console, enable the Maps JavaScript API and Geocoding API.
 * Generate an API key restricted to your HTTP referrers (e.g., http://localhost:5173/*).
 * Create frontend/.env.local:
   VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=your-restricted-browser-key

 * Restart the Vite dev server. (Without a key, address/coordinate fields remain manual).
3. Try the App
 * Register an account and select a language preference.
 * Enter farm details and map coordinates for location-based weather tracking.
 * Create a crop profile.
 * Record crop observations and numeric values to populate field journals and trend charts.
 * Interact with the context-aware AI chat (attach photos, documents, or record audio queries).
 * Request crop-planning recommendations based on live records and regional forecasts.
 * Reload the page to verify persistent session data in MongoDB.
🧠 AI Methodology and Implementation
The backend constructs assistant requests using system prompts, historical chat logs, user language settings, farm/crop fields, and field journal observations.
For crop chat, the AI may dynamically invoke read-only tool calls:
 * get_crop_history: Fetches up to 12 recent field observations for a selected crop.
 * get_measurement_trend: Retrieves up to 30 actual recorded numeric values (e.g., soil pH, rainfall, temperature).
 * get_local_weather: Fetches current conditions and a 5-day forecast from Open-Meteo.
Guardrails & Tool Bounding
 * Tool usage is restricted to a maximum of 4 rounds and 3 lookups per round.
 * Image analysis operates natively through Ollama's vision endpoints (/api/chat).
 * PDF and DOCX reports undergo text extraction locally prior to query generation.
 * Audio recordings are transcribed locally with Whisper via Hugging Face Transformers.js.
 * System instructions strictly force the AI to distinguish reported observations from inferences, refrain from generating fake measurements or prices, and explicitly recommend consulting local extension officers for critical issues.
🧪 Verification & Testing
Execute backend integration tests directly from the backend directory:
cd backend
npm.cmd test

Test Suite Summary
 * 16 Automated Backend Tests: Covers agent direct responses, crop history lookups, numeric trend fetching, weather lookup handling, missing coordinate fallbacks, execution cap safety, document parsing, photo query pipelines, and system safety disclaimers.
 * Verification Audit: Backend test suite passed, Vite build succeeded, zero dependency vulnerabilities detected via npm audit.
🛡️ Security, Safety, and Limitations
 * Hackathon MVP Status: AGRO is a proof-of-concept system, not a certified diagnostic agricultural engine.
 * Validation: Generated responses may contain errors. Always cross-reference crucial fertilizer, pesticide, or crop management decisions with label instructions and local agricultural officers.
 * Grid-Based Weather: Weather and historical climate queries rely on grid-interpolated satellite measurements, not on-site sensor hardware.
 * Visual Limitations: Standard photo analysis cannot determine quantitative parameters like exact soil pH or micro-nutrient deficiencies.
 * Production Readiness: Before public deployment, implement deployment secret vaults, file upload virus scanning, privacy consent policies, and database backup routines.
👤 Team Contributions
 * U.G.Harshani Sandunika Ranasingha — Individual Contributor: Full-stack project implementation, including the React/Vite interface, Express/MongoDB backend, crop and weather features, AI assistant integration, and automated test suite.

