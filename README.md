# AGRO — AI Farming Companion

AGRO is a web application that helps farmers organize farm and crop information, ask crop-specific questions, and review weather and recorded measurements in one place. Its AI assistant can use a farmer's saved crop records and, when relevant, look up recorded measurements or a location-based forecast before answering.

AGRO is an international hackathon MVP: the core product is designed to be adaptable to different farming contexts, but recommendations have not been validated for every region, crop, or climate. Treat AI responses as guidance to review with qualified local agricultural experts.

## The problem

Farmers need practical guidance that considers their crops, farm conditions, and observations over time. Generic advice can miss this context, while unsupported estimates about weather, soil, or crop problems can lead to poor decisions.

## The solution

AGRO combines crop and farm records with AI chat and external weather data. Farmers can save what they observe and measure, then ask questions grounded in that information. The assistant has limited, read-only tools for retrieving crop history, recorded numeric measurements, and local weather. Its actions are shown in the chat so users can see which data sources were checked.

## Features

- Farmer accounts: Register and log in to a private account; manage a worldwide farm address, map coordinates, land size, irrigation, and language preferences.
- Google Maps location picker: Search for an address or select a point on an interactive map; AGRO saves the place address and coordinates for weather and farm context.
- Crop profiles: Save crop name, variety, location, planting date, growth stage, soil details, irrigation, and notes.
- Crop-specific AI chat: Ask questions with crop and farm context, continue saved conversations, and see summaries of data lookups.
- AI crop planning: Request crop suggestions informed by available farmer profile details, crop history, and forecast data.
- Crop journal: Record observations for weather, soil, growth, crop problems, watering, fertilizer, expenses, income, and other notes.
- Measurement charts: Store numeric values and visualize recorded trends. AGRO does not fill in missing measurements.
- Weather and climate: Retrieve current conditions and a five-day forecast, plus a one-year historical climate view, for entered coordinates through Open-Meteo.
- AI data tools: Retrieve recent crop observations, recorded numeric trends, and a five-day local forecast when relevant. Tools are read-only and limited per response.
- Photo and file questions: Review JPEG, PNG, or WebP crop photos with a local vision model; extract text locally from supported PDF/DOCX reports and TXT, CSV, or Markdown files.
- Voice questions: Record audio in the browser and transcribe it locally with Whisper; OpenAI transcription remains available in cloud mode.
- Language preferences: English, Sinhala, or Tamil.
- Spoken answers: Play assistant responses with the browser's speech synthesis support.
- Private attachments: Uploaded files are associated with the authenticated farmer and crop and stored in MongoDB.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 18, Vite 6, JavaScript, HTML, CSS |
| Backend | Node.js, Express 4 |
| Database | MongoDB, Mongoose 8 |
| AI | Optional OpenAI API; local Ollama text and vision models |
| Speech transcription | Transformers.js Whisper Tiny and FFmpeg locally; optional OpenAI whisper-1 cloud transcription |
| Weather | Open-Meteo forecast and historical archive APIs |
| Location search and map picker | Google Maps Platform Maps JavaScript API and Geocoding API (optional key required) |
| Authentication | Password hashing with bcryptjs; signed JSON Web Tokens |
| Upload handling | Multer memory storage; 10 MB per-file limit |

## Requirements

- Node.js 20.16+ or 22.3+ and npm
- Either a local MongoDB server or a MongoDB Atlas cluster
- Either an OpenAI API key with available credits or Ollama installed locally with the required text model; vision and transcription

models are needed for all local media features

Weather views use Open-Meteo and do not require an API key. Local Ollama mode runs chat, crop planning, image analysis, and document review without OpenAI credits. Local inference requires adequate computer memory and processing capacity.

## Run locally

Run commands from the project root unless a step says otherwise. You can use a local MongoDB server or MongoDB Atlas. With Atlas, there is no local database service to start; the backend connects over the internet.

### 1. Configure the backend

In PowerShell:

cd backend
npm.cmd install
Copy-Item .env.example .env


#### Option A: MongoDB Atlas (no local MongoDB service)

1. Create a MongoDB Atlas account and create a cluster.
2. In Atlas, create a database user and save its username and password securely. This is separate from your Atlas website login.
3. In Network Access, add your current IP address so your computer can connect. Avoid allowing access from anywhere (0.0.0.0/0) except temporarily for testing; remove broad access afterward.
4. Choose Connect → Drivers → Node.js and copy the connection string.
5. In backend/.env, set MONGODB_URI to that URI. Replace <db_password> with the database user's password, URL-encoding special characters in the password if necessary, and add the database name agro_ai_farming_companion before any query parameters.

Example format (replace all placeholders; do not copy this as-is):

MONGODB_URI=mongodb+srv://<database-user>:<encoded-password>@<cluster-host>/agro_ai_farming_companion?retryWrites=true&w=majority


#### Option B: Local MongoDB

Keep MongoDB running locally and use:

MONGODB_URI=mongodb://127.0.0.1:27017/agro_ai_farming_companion


#### Complete backend configuration

Open backend/.env and set the database URI from Option A or B, plus the other values:

PORT=5000
MONGODB_URI=your-mongodb-connection-uri
JWT_SECRET=replace-with-a-private-random-secret-at-least-32-characters-long
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=llama3.2:latest
AI_VISION_MODEL=qwen2.5vl:3b
AI_TRANSCRIPTION_MODEL=onnx-community/whisper-tiny
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173


Generate a unique, private JWT_SECRET of at least 32 characters. Keep .env out of source control; never put your Atlas URI, database password, or API keys in frontend code, screenshots, or chat. This example selects local Ollama. OpenAI remains optional and requires setting AI_PROVIDER=openai, OPENAI_API_KEY, and (optionally) OPENAI_MODEL.

#### No-cost local AI with Ollama

OpenAI API usage requires available credits. To use a local model instead:

1. Install Ollama for Windows from ollama.com/download.
2. Open PowerShell and download the local text and vision models:

      ollama pull llama3.2:latest
   ollama pull qwen2.5vl:3b
   

3. Make sure Ollama is running, then set these values in backend/.env:

      AI_PROVIDER=ollama
   AI_BASE_URL=http://127.0.0.1:11434/v1
   AI_MODEL=llama3.2:latest
   AI_VISION_MODEL=qwen2.5vl:3b
   AI_TRANSCRIPTION_MODEL=onnx-community/whisper-tiny
   

   OPENAI_API_KEY is not needed in local mode. Keep MONGODB_URI and JWT_SECRET configured as usual.

4. Restart the backend after saving .env. Keep Ollama running while using AGRO.

Local mode supports crop chat, AGRO's crop-data tools, crop recommendations, crop-photo analysis, PDF/DOCX text extraction, and local voice transcription. The text and vision models are served by Ollama. The Whisper speech model is downloaded from Hugging Face by Transformers.js on first use and cached locally; audio is decoded locally with FFmpeg and is not sent to OpenAI. The first transcription therefore needs an internet connection to download the model. Scanned-image PDFs require OCR and are not supported; ordinary text-based PDFs and DOCX files are supported. Plain text, CSV, and Markdown attachments are included as text. Local model speed depends on your computer.

Start the backend from the backend directory:

npm.cmd run dev


The API starts at http://localhost:5000. C

heck that it is available at http://localhost:5000/api/health.

### 2. Start the frontend

Open a second terminal:

cd frontend
npm.cmd install
npm.cmd run dev


Open the local URL Vite prints, usually http://localhost:5173.

#### Configure Google Maps location search and picker

The farm and crop location map requires a Google Maps Platform API key. In Google Cloud Console, enable billing and the Maps JavaScript API and Geocoding API for a project, create an API key, and restrict it to the APIs and website referrers you use (for local development, http://localhost:5173/* and http://127.0.0.1:5173/*). Browser keys are visible to users by design; restrict them and never reuse a server-side secret key.

Create frontend/.env.local from the example and set the browser key:

VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=your-restricted-browser-key


Restart Vite after changing environment variables. Without a Maps key, the address and manual coordinate fields remain available, but map selection and address lookup are disabled.

The frontend uses http://localhost:5000/api by default. Set VITE_API_URL in frontend/.env.local only when your backend uses another URL.

### 3. Try the app

1. Register an account and choose a language preference.
2. Add farm details and coordinates if you want location-based weather.
3. Create a crop profile.
4. Add crop observations and measured values to build a journal and trends.
5. Ask a question in the crop chat; attach a supported photo or document, or record a voice question.
6. Ask for crop-planning suggestions and review the farm information and forecast used.
7. Refresh the page and confirm your profile, crops, chat, observations, and attachments persist.

## AI methodology and implementation

The backend constructs the assistant request from a system prompt, recent crop-specific conversation history, the farmer's language preference, farm and crop profile fields, and recent saved observations. Responses use the configured OpenAI model or local Ollama model.

For crop chat, the model may request one or more of the following read-only tools:

1. **get_crop_history returns up to 12 recent observations for the selected crop.
2. get_measurement_trend returns up to 30 actual recorded numeric values for a supported metric, such as soil pH, soil moisture, rainfall, or temperature.
3. get_local_weather** retrieves current conditions and a five-day forecast from Open-Meteo when farm coordinates are saved.

Tool use is bounded to a maximum of four tool rounds and three lookups per round. The app records a summary of tool actions alongside the assistant message. Crop recommendations use a separate AI request with available profile details, recent crop records, and a forecast when coordinates are available.

Images are sent to the configured vision model for visual review. PDF and DOCX text is extracted locally before analysis; TXT, CSV, and Markdown content is included as text. In Ollama mode, audio recordings are transcribed locally before the transcript is sent to the assistant. File uploads are limited to 10 MB.

The assistant is instructed to distinguish farmer-reported observations from inference, avoid inventing measurements or prices, avoid claiming certainty from limited evidence, and recommend qualified local advice for serious or uncertain crop problems. These safeguards reduce risk but cannot guarantee that generated advice is correct.

In local mode, text chat uses Ollama's OpenAI-compatible endpoint, while crop-photo analysis uses Ollama's native /api/chat endpoint for image input.

### System workflow

flowchart TD
    Farmer[Farmer in AGRO web app] -->|Sign in, ask crop question, or request crop plan| API[Express API]
    API --> Auth[Authenticate farmer]
    Auth --> Data[Load farmer, crop, observations, and conversation from MongoDB]
    Data --> Router{AI task and configured provider}
    Router -->|Text chat or crop plan| Ollama[Local Ollama text model]
    Router -->|Optional cloud provider| OpenAI[OpenAI API]
    Farmer -->|Photo| Vision[Local Ollama vision mode

l]
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


The local Ollama text model handles crop chat, crop-data tools, and crop planning. Image analysis uses a separate Ollama vision model; PDF and DOCX uploads are converted to text before analysis. Voice recordings are transcribed locally before their transcript is sent to the text model. The text and vision models must be pulled with Ollama; the Whisper model downloads from Hugging Face on first transcription.

## AI models and APIs

| Provider | Model/API | Use |
| --- | --- | --- |
| OpenAI | gpt-4o-mini by default; configurable with OPENAI_MODEL | Optional cloud text chat, crop-planning recommendations, image and document analysis |
| Ollama | llama3.2:latest by default; configurable with AI_MODEL | Local text chat, crop-data tools, and crop-planning recommendations |
| Ollama | qwen2.5vl:3b by default; configurable with AI_VISION_MODEL | Local crop-photo visual review |
| Transformers.js | onnx-community/whisper-tiny by default; configurable with AI_TRANSCRIPTION_MODEL | Local CPU audio transcription |
| OpenAI | whisper-1 | Optional cloud audio transcription in OpenAI mode |
| Open-Meteo | Forecast API | Current weather and forecast; not an AI model |
| Open-Meteo | Historical Archive API | Historical climate data; not an AI model |

OpenAI usage is billed according to the account and model. A valid key must also have available API access/credits. Do not commit or publish the key.


## Team contributions

- U.G.Harshani Sandunika Ranasingha — individual contributor: Full-stack project implementation, including the React/Vite interface, Express/MongoDB backend, crop and weather features, AI assistant integration, and tests.

Please review this contribution statement and adjust it if any part does not accurately reflect the work completed.

## Tests

Run backend tests from the backend directory:

npm.cmd test


The backend test suite has 16 tests covering direct agent answers, crop-history lookup, recorded measurement retrieval, weather lookup and missing-coordinate handling, safe stopping when the tool-round limit is reached, local PDF/DOCX extraction, image-analysis request handling, and safety disclaimers. Authenticated API smoke tests have also verified local text chat, crop planning, crop-photo review, PDF/DOCX uploads, and speech transcription.

Latest local verification (2026-10-18): all 16 backend tests passed, the frontend production build succeeded, and npm.cmd audit reported zero vulnerabilities. The frontend, backend health endpoint, and Ollama responded with HTTP 200. The configured local text model (llama3.2:latest) and vision model (qwen2.5vl:3b) were installed. These checks describe this development environment; they do not certify a public deployment.

## Security, safety, and limitations

- This is a hackathon MVP, not a production-ready agricultural diagnostic or decision system.
- Generated responses can be inaccurate. Confirm important crop, disease, fertilizer, and pesticide decisions with qualified local agricultural experts and official product-label instructions.
- Weather and historical climate data refer to a nearby grid location; they are not measurements taken in the field.
- An ordinary photo cannot reliably determine soil pH or nutrient levels. Use actual measurements or a soil-test report.
- Recommendations can be incomplete w

hen location, season, climate, soil, water, or other local details are missing. The app does not provide authoritative market prices or guaranteed yields.
- Agricultural advice has not been validated for every region or crop. Review and localize recommendations before relying on them in a new area.
- Uploaded files and crop records are stored in MongoDB under the owning account. Only share real farmer data with appropriate consent.
- Before public deployment, add and test production controls such as deployment secrets management, upload scanning, backups, privacy/consent documentation, monitoring, and broader security and integration testing.