import React, { useEffect, useMemo, useRef, useState } from "react";
import LocationPicker from "./LocationPicker.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const tokenKey = "agro_token";

async function api(path, options = {}) {
  const token = localStorage.getItem(tokenKey);
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function TrendChart({ points, label, unit = "" }) {
  const usable = points.filter(point => Number.isFinite(Number(point.value)));
  if (!usable.length) return <p className="muted small">Add measured values to see this trend.</p>;
  const values = usable.map(point => Number(point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const plotted = usable.map((point, index) => ({
    ...point,
    x: usable.length === 1 ? 50 : 8 + index * 84 / (usable.length - 1),
    y: 90 - ((Number(point.value) - min) / spread) * 72
  }));
  return <div className="chart-wrap">
    <svg viewBox="0 0 100 100" role="img" aria-label={`${label} over time`}>
      <line x1="8" y1="90" x2="92" y2="90" className="chart-axis" />
      {plotted.length > 1 && <polyline points={plotted.map(point => `${point.x},${point.y}`).join(" ")} className="chart-line" />}
      {plotted.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="2.3" className="chart-point">
        <title>{point.date}: {point.value}{unit}</title>
      </circle>)}
    </svg>
    <div className="chart-caption"><span>{label}</span><strong>{plotted[plotted.length - 1].value}{unit}</strong></div>
    <div className="chart-dates"><span>{plotted[0].date}</span><span>{plotted[plotted.length - 1].date}</span></div>
  </div>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem(tokenKey));
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("register");
  const [auth, setAuth] = useState({ name: "", email: "", password: "", language: "en" });
  const [crops, setCrops] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", variety: "", location: "", latitude: "", longitude: "", plantingDate: "", growthStage: "Seedling", soilType: "", soilPH: "", soilDataSource: "farmer", irrigation: "", notes: "" });
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const [chat, setChat] = useState([]);
  const [observation, setObservation] = useState({ kind: "other", description: "", source: "farmer" });
  const [measurements, setMeasurements] = useState({});
  const [chartMetric, setChartMetric] = useState("temperature");
  const [profile, setProfile] = useState({ name: "", language: "en", farmLocation: "", landSize: "", irrigation: "", latitude: "", longitude: "" });
  const [recommendQuestion, setRecommendQuestion] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [weather, setWeather] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadCrops() {
    const data = await api("/crops");
    setCrops(data.crops);
    if (selected) {
      const fresh = data.crops.find(c => c._id === selected._id);
      if (fresh) setSelected(fresh);
    }
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const me = await api("/auth/me");
        setUser(me.user);
        setProfile(me.user);
        await loadCrops();
        try {
          const saved = await api("/crops/recommendations");
          setRecommendations(saved.recommendations || []);
        } catch (err) { setNotice(err.message); }
      } catch {
        localStorage.removeItem(tokenKey);
        setToken(null);
        setUser(null);
      }
    })();
  }, [token]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const data = await api(`/auth/${authMode}`, { method: "POST", body: JSON.stringify(auth) });
      localStorage.setItem(tokenKey, data.token);
      setToken(data.token); setUser(data.user); setProfile(data.user); setNotice("Welcome to AGRO!");
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  function toggleAuthMode() {
    setAuthMode(mode => mode === "register" ? "login" : "register");
    setAuth({ name: "", email: "", password: "", language: "en" });
    setNotice("");
  }

  async function addCrop(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const data = await api("/crops", { method: "POST", body: JSON.stringify(form) });
      setCrops(old => [data.crop, ...old]);
      setSelected(data.crop); setChat([]); setRecommendation("");
      setForm({ name: "", variety: "", location: "", latitude: "", longitude: "", plantingDate: "", growthStage: "Seedling", soilType: "", soilPH: "", soilDataSource: "farmer", irrigation: "", notes: "" });
      setNotice("Crop profile saved. You can now talk to AGRO about this crop.");
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function openCrop(crop) {
    setSelected(crop); setNotice(""); setWeather(null);
    try {
      const data = await api(`/chat/${crop._id}/history`);
      setChat(data.messages || []);
      setSelected(current => current ? { ...current, observations: data.observations || current.observations } : current);
    } catch (err) { setNotice(err.message); setChat([]); }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!selected || (!message.trim() && !attachment)) return;
    setBusy(true); setNotice("");
    const formData = new FormData();
    formData.append("message", message);
    if (attachment) formData.append("attachment", attachment);
    try {
      const data = await api(`/chat/${selected._id}`, { method: "POST", body: formData });
      setChat(data.messages || []);
      setMessage(""); setAttachment(null);
      const input = document.getElementById("chat-attachment");
      if (input) input.value = "";
      await loadCrops();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function addObservation(e) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const values = Object.fromEntries(Object.entries(measurements)
        .filter(([, value]) => value !== "")
        .map(([key, value]) => [key, Number(value)]));
      const data = await api(`/crops/${selected._id}/observations`, { method: "POST", body: JSON.stringify({ ...observation, values }) });
      setObservation({ kind: "other", description: "", source: "farmer" });
      setMeasurements({});
      setNotice("Observation saved to this crop's timeline.");
      setSelected(current => current ? { ...current, observations: data.observations } : current);
      await loadCrops();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function getWeather() {
    if (!selected) return;
    const latitude = selected.latitude ?? user.latitude;
    const longitude = selected.longitude ?? user.longitude;
    if (latitude == null || longitude == null) {
      setNotice("Add your farm coordinates to your profile or this crop to get local weather.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), cropId: selected._id });
      const data = await api(`/weather?${query}`);
      setWeather(data);
      await loadCrops();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const data = await api("/auth/me", { method: "PATCH", body: JSON.stringify(profile) });
      setUser(data.user); setProfile(data.user);
      setNotice("Your private farmer profile has been updated.");
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function getRecommendations(e) {
    e.preventDefault(); setBusy(true); setNotice(""); setRecommendation("");
    try {
      const data = await api("/crops/recommendations", {
        method: "POST",
        body: JSON.stringify({ question: recommendQuestion })
      });
      setRecommendation(data.answer);
      const saved = await api("/crops/recommendations");
      setRecommendations(saved.recommendations || []);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Voice recording is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setAttachment(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setNotice("Recording started. Select Stop recording when you are finished.");
    } catch (err) { setNotice(err.message || "Microphone access was not available."); }
  }

  function speakAnswer(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setNotice("Spoken answers are not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = { en: "en-US", si: "si-LK", ta: "ta-LK" }[user.language] || "en-US";
    window.speechSynthesis.speak(utterance);
  }

  async function downloadMedia(cropId, media) {
    try {
      const token = localStorage.getItem(tokenKey);
      const response = await fetch(`${API}/chat/${cropId}/media/${media.mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Could not open this attachment.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = media.filename; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setNotice(err.message); }
  }

  function logout() {
    localStorage.removeItem(tokenKey); setToken(null); setUser(null);
    setCrops([]); setSelected(null); setChat([]); setWeather(null);
    setRecommendations([]);
  }

  const chartData = useMemo(() => selected?.observations || [], [selected]);
  const observationMetric = {
    temperature: { label: "Temperature", unit: "°C" },
    rainfall: { label: "Rainfall", unit: " mm" },
    humidity: { label: "Humidity", unit: "%" },
    soilMoisture: { label: "Soil moisture", unit: "%" },
    soilPH: { label: "Soil pH", unit: "" },
    expense: { label: "Expenses", unit: "" },
    income: { label: "Income", unit: "" }
  }[chartMetric];
  const chartPoints = chartData
    .filter(item => item.values?.[chartMetric] !== undefined)
    .map(item => ({ date: new Date(item.createdAt).toLocaleDateString(), value: item.values[chartMetric] }));

  if (!token || !user) {
    return <div className="auth-shell"><div className="auth-card">
      <div className="brand">🌱 AGRO</div>
      <p className="eyebrow">YOUR SMART FARMING COMPANION</p>
      <h1>{authMode === "register" ? "Let's grow together." : "Welcome back."}</h1>
      <p className="muted">Friendly farming guidance, one crop at a time.</p>
      <form onSubmit={submitAuth} className="stack" autoComplete={authMode === "register" ? "off" : "on"}>
        {authMode === "register" && <label>Your name<input name="name" autoComplete="name" required value={auth.name} onChange={e => setAuth({...auth, name:e.target.value})} placeholder="e.g. Nimal Perera" /></label>}
        <label>Email address<input name={authMode === "register" ? "registration-email" : "username"} autoComplete={authMode === "register" ? "off" : "username"} type="email" required value={auth.email} onChange={e => setAuth({...auth, email:e.target.value})} placeholder="you@example.com" /></label>
        <label>Password<input name={authMode === "register" ? "new-password" : "password"} autoComplete={authMode === "register" ? "new-password" : "current-password"} type="password" minLength="8" required value={auth.password} onChange={e => setAuth({...auth, password:e.target.value})} placeholder="At least 8 characters" /></label>
        {authMode === "register" && <label>Preferred language<select value={auth.language} onChange={e => setAuth({...auth, language:e.target.value})}><option value="en">English</option><option value="si">Sinhala</option><option value="ta">Tamil</option></select></label>}
        <button className="primary" disabled={busy}>{busy ? "Please wait..." : authMode === "register" ? "Create free account" : "Log in"}</button>
      </form>
      <button className="link-button" onClick={toggleAuthMode}>{authMode === "register" ? "Already have an account? Log in" : "New to AGRO? Create an account"}</button>
      {notice && <p className="notice">{notice}</p>}
      <p className="tiny">Prototype note: use a unique password. This is a hackathon starter, not yet production-hardened.</p>
    </div></div>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">🌱 AGRO</div><p className="muted small">Your farming companion</p>
      <div className="side-label">WORKSPACE</div>
      <a href="#overview">⌂ &nbsp; Overview</a><a href="#my-crops">♧ &nbsp; My crops</a><a href="#crop-planner">✧ &nbsp; Crop planner</a><a href="#assistant">✧ &nbsp; Ask AGRO</a><a href="#conditions">☼ &nbsp; Conditions</a><a href="#farmer-profile">☺ &nbsp; My farm profile</a>
      <div className="sidebar-bottom"><div className="avatar">{user.name?.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><p className="tiny">{user.email}</p></div><button className="icon-button" onClick={logout} title="Log out">↪</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">YOUR FARM, YOUR JOURNEY</p><h1 id="overview">Good day, {user.name.split(" ")[0]} 👋</h1><p className="muted">Let's take good care of what you're growing.</p></div><span className="pill">🌿 AGRO companion</span></header>
      {notice && <div className="notice">{notice}<button className="icon-button" onClick={() => setNotice("")}>×</button></div>}
      <section className="stats">
        <div className="stat-card"><span>🌱</span><p className="muted">My crops</p><strong>{crops.length}</strong></div>
        <div className="stat-card"><span>🗒️</span><p className="muted">Selected crop</p><strong className="stat-text">{selected?.name || "Not selected"}</strong></div>
        <div className="stat-card"><span>💬</span><p className="muted">Crop memory</p><strong className="stat-text">Saved history</strong></div>
      </section>
      <section className="panel" id="farmer-profile">
        <div className="section-heading"><div><p className="eyebrow">PRIVATE FARMER ACCOUNT</p><h2>Your farm profile</h2><p className="muted small">This information stays with your account and helps AGRO personalize suggestions.</p></div><span>👩‍🌾</span></div>
        <form className="form-grid" onSubmit={saveProfile}>
          <label>Your name<input required value={profile.name || ""} onChange={e=>setProfile({...profile,name:e.target.value})} /></label>
          <label>Preferred language<select value={profile.language || "en"} onChange={e=>setProfile({...profile,language:e.target.value})}><option value="en">English</option><option value="si">Sinhala</option><option value="ta">Tamil</option></select></label>
          <LocationPicker
            label="Farm location (any country)"
            location={profile.farmLocation || ""}
            latitude={profile.latitude}
            longitude={profile.longitude}
            onChange={location => setProfile(current => ({ ...current, ...location, farmLocation: location.location ?? current.farmLocation }))}
          />
          <label>Land size (acres)<input type="number" min="0" step="any" value={profile.landSize ?? ""} onChange={e=>setProfile({...profile,landSize:e.target.value})} /></label>
          <label>Irrigation method<input value={profile.irrigation || ""} onChange={e=>setProfile({...profile,irrigation:e.target.value})} placeholder="Rain-fed, drip, canal..." /></label>
          <button className="primary full-row" disabled={busy}>Save my farm profile</button>
        </form>
      </section>
      <section className="panel" id="my-crops">
        <div className="section-heading"><div><p className="eyebrow">YOUR GROWING SPACE</p><h2>My crops</h2></div><span className="pill">{crops.length} saved</span></div>
        {crops.length ? <div className="crop-grid">{crops.map(crop => <button key={crop._id} className={`crop-card ${selected?._id === crop._id ? "selected" : ""}`} onClick={() => openCrop(crop)}><span className="crop-emoji">🌿</span><strong>{crop.name}</strong><span className="muted small">{crop.location || "Location not added"}</span><span className="crop-stage">{crop.growthStage || "Growth stage unknown"}</span></button>)}</div> : <p className="muted">Your first crop starts here. Add a crop below.</p>}
        <details className="add-crop"><summary>＋ Add a new crop</summary><form className="form-grid" onSubmit={addCrop}>
          <label>Crop name *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Chilli, rice, tomato..." /></label>
          <label>Variety<input value={form.variety} onChange={e=>setForm({...form,variety:e.target.value})} placeholder="Optional" /></label>
          <LocationPicker
            label="Crop location (any country)"
            location={form.location}
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={location => setForm(current => ({ ...current, ...location, location: location.location ?? current.location }))}
          />
          <label>Planting date<input type="date" value={form.plantingDate} onChange={e=>setForm({...form,plantingDate:e.target.value})} /></label>
          <label>Growth stage<select value={form.growthStage} onChange={e=>setForm({...form,growthStage:e.target.value})}><option>Seedling</option><option>Vegetative</option><option>Flowering</option><option>Fruiting</option><option>Harvest</option><option>Unknown</option></select></label>
          <label>Soil type<input value={form.soilType} onChange={e=>setForm({...form,soilType:e.target.value})} placeholder="If known" /></label>
          <label>Soil pH (measured)<input type="number" min="0" max="14" step="0.1" value={form.soilPH} onChange={e=>setForm({...form,soilPH:e.target.value})} placeholder="Optional" /></label>
          <label>Soil information source<select value={form.soilDataSource} onChange={e=>setForm({...form,soilDataSource:e.target.value})}><option value="farmer">Farmer-reported</option><option value="lab_test">Laboratory test</option></select></label>
          <label>Irrigation<input value={form.irrigation} onChange={e=>setForm({...form,irrigation:e.target.value})} placeholder="Rain-fed, drip..." /></label>
          <label className="full-row">Crop notes<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Resources, plans, or anything useful to remember" /></label>
          <button className="primary full-row" disabled={busy}>Save crop profile</button>
        </form></details>
      </section>
      <section className="panel" id="crop-planner">
        <div className="section-heading"><div><p className="eyebrow">PLAN YOUR NEXT PLANTING</p><h2>What should I grow?</h2><p className="muted small">AGRO compares your location, farm profile, saved soil/crop notes and forecast when coordinates are available.</p></div><span>🌾</span></div>
        <form className="stack" onSubmit={getRecommendations}>
          <label>What would you like AGRO to know?<textarea rows="2" value={recommendQuestion} onChange={e=>setRecommendQuestion(e.target.value)} placeholder="For example: I have half an acre and water for the next three months..." /></label>
          <button className="primary" disabled={busy}>Compare suitable crops</button>
        </form>
        {recommendation && <div className="recommendation-answer"><strong>AGRO's crop comparison</strong><p>{recommendation}</p><span className="tiny">Suggestions are provisional. Market prices and yields are not assumed; verify important choices with a local agricultural officer.</span></div>}
        {recommendations.length > 0 && <div className="saved-recommendations"><h3>Saved crop-planning conversations</h3>{recommendations.slice(0,5).map(item=><details key={item._id}><summary>{item.question || "What crops could suit my land?"} · {new Date(item.createdAt).toLocaleDateString()}</summary><p>{item.answer}</p><span className="tiny">Saved privately to your farmer account</span></details>)}</div>}
      </section>
      {selected && <section className="two-col">
        <div className="panel" id="assistant"><div className="section-heading"><div><p className="eyebrow">LET'S FIGURE IT OUT TOGETHER</p><h2>Talk to AGRO</h2><p className="muted small">About: {selected.name} · AGRO can check your saved crop records, measured trends, and local forecast while answering.</p></div><span>🤖</span></div>
          <div className="chat-window">{chat.length === 0 && <div className="welcome-bubble"><strong>Hi! I'm here to help 🌱</strong><p>Tell me what's happening with your {selected.name}, or try asking:</p><button className="suggestion" onClick={()=>setMessage(`How should I care for my ${selected.name} at the ${selected.growthStage} stage?`)}>How should I care for this crop?</button><button className="suggestion" onClick={()=>setMessage(`What information do you need to help me check a problem with my ${selected.name}?`)}>Help me understand a crop problem</button></div>}
          {chat.map((m,i)=><div key={m._id || i} className={`bubble ${m.role === "user" ? "mine" : "theirs"}`}><span className="bubble-label">{m.role === "user" ? "You" : "AGRO · AI FARMING AGENT"}</span><p>{m.content}</p>{m.agentActions?.length > 0 && <details className="agent-actions"><summary>AGRO checked {m.agentActions.length} farm data source{m.agentActions.length === 1 ? "" : "s"}</summary>{m.agentActions.map((action,index)=><span key={`${action.tool}-${index}`} className={action.succeeded ? "agent-action-success" : "agent-action-warning"}>{action.succeeded ? "✓" : "!"} {action.summary}</span>)}</details>}{m.role === "assistant" && <button className="speak-button" type="button" onClick={()=>speakAnswer(m.content)}>🔊 Listen</button>}{m.attachments?.map(media=><button className="attachment-link" key={media.mediaId} type="button" onClick={()=>downloadMedia(selected._id,media)}>📎 {media.filename} · saved privately</button>)}</div>)}
          {busy && <div className="bubble theirs">AGRO is thinking…</div>}
          </div>
          <form className="chat-form" onSubmit={sendMessage}><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={`Ask anything about your ${selected.name}…`} rows="3" /><div className="chat-tools"><label className="upload-label" htmlFor="chat-attachment">📎 Add photo, voice or file</label><input id="chat-attachment" type="file" accept="image/jpeg,image/png,image/webp,audio/*,application/pdf,text/plain,text/csv,text/markdown,.docx" onChange={e=>setAttachment(e.target.files?.[0] || null)} hidden/><button className="secondary" type="button" onClick={toggleRecording} disabled={busy}>{recording ? "■ Stop recording" : "🎙 Record voice"}</button><span className="tiny">{attachment?.name || "Images, audio, PDF, DOCX, TXT, CSV · max 10 MB"}</span><button className="primary" disabled={busy || recording}>Send ↑</button></div><p className="tiny">Photos can suggest visible issues but cannot confirm a disease or measure soil nutrients/pH.</p></form>
        </div>
        <div className="right-stack">
          <div className="panel" id="conditions"><div className="section-heading"><div><p className="eyebrow">OFFICIAL FORECAST + CLIMATE ARCHIVE</p><h2>Weather and climate</h2></div><span>🌦️</span></div><p className="muted small">Forecasts and historical data are from Open-Meteo, not measurements at your field.</p><button className="secondary full" onClick={getWeather} disabled={busy}>Check forecast and past-year climate</button>
            {weather && <div className="weather-data"><div className="weather-current"><strong>{weather.current?.temperature_2m}°C</strong><span>Current forecast · humidity {weather.current?.relative_humidity_2m}% · rain {weather.current?.precipitation} mm</span></div><div className="forecast-list">{weather.daily?.time?.map((day,i)=><div key={day}><strong>{day}</strong><span>{weather.daily.temperature_2m_min[i]}° – {weather.daily.temperature_2m_max[i]}°C</span><span>Expected rain: {weather.daily.precipitation_sum[i]} mm · chance: {weather.daily.precipitation_probability_max[i]}%</span></div>)}</div>
              {weather.climate?.daily?.time?.length > 0 && <div className="climate-charts"><h3>Past year · historical climate</h3><TrendChart label="Daily mean temperature" unit="°C" points={weather.climate.daily.time.map((date,i)=>({date,value:weather.climate.daily.temperature_2m_mean[i]}))} /><TrendChart label="Daily rainfall" unit=" mm" points={weather.climate.daily.time.map((date,i)=>({date,value:weather.climate.daily.precipitation_sum[i]}))} /><p className="tiny">Archive: {weather.climate.period.start} to {weather.climate.period.end}. Historical values describe the area, not your exact plot.</p></div>}
            </div>}
          </div>
          <div className="panel"><div className="section-heading"><div><p className="eyebrow">CROP JOURNAL</p><h2>Record an observation</h2></div><span>📝</span></div><form className="stack" onSubmit={addObservation}><label>Observation type<select value={observation.kind} onChange={e=>setObservation({...observation,kind:e.target.value})}><option value="other">General</option><option value="weather">Weather</option><option value="soil">Soil</option><option value="growth">Growth</option><option value="problem">Crop problem</option><option value="watering">Watering</option><option value="fertilizer">Fertilizer</option><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Where did this information come from?<select value={observation.source} onChange={e=>setObservation({...observation,source:e.target.value})}><option value="farmer">My observation</option><option value="official_weather">Official weather source</option><option value="lab_test">Laboratory soil test</option></select></label><label>What did you notice?<textarea required rows="3" value={observation.description} onChange={e=>setObservation({...observation,description:e.target.value})} placeholder="e.g. Leaves looked droopy after a hot afternoon..." /></label>
            <div className="measure-grid"><label>Temperature °C<input type="number" step="any" value={measurements.temperature || ""} onChange={e=>setMeasurements({...measurements,temperature:e.target.value})} /></label><label>Rainfall mm<input type="number" min="0" step="any" value={measurements.rainfall || ""} onChange={e=>setMeasurements({...measurements,rainfall:e.target.value})} /></label><label>Humidity %<input type="number" min="0" max="100" step="any" value={measurements.humidity || ""} onChange={e=>setMeasurements({...measurements,humidity:e.target.value})} /></label><label>Soil moisture %<input type="number" min="0" max="100" step="any" value={measurements.soilMoisture || ""} onChange={e=>setMeasurements({...measurements,soilMoisture:e.target.value})} /></label><label>Measured soil pH<input type="number" min="0" max="14" step="any" value={measurements.soilPH || ""} onChange={e=>setMeasurements({...measurements,soilPH:e.target.value})} /></label><label>{observation.kind === "income" ? "Income amount (LKR)" : "Expense amount (LKR)"}<input type="number" min="0" step="any" value={measurements[observation.kind] || ""} onChange={e=>setMeasurements({...measurements,[observation.kind]:e.target.value})} /></label></div>
            <button className="primary" disabled={busy}>Save to this crop's history</button></form></div>
          <div className="panel"><div className="section-heading"><div><p className="eyebrow">CHANGES OVER TIME</p><h2>Crop insights</h2></div><span>📈</span></div><label>What would you like to track?<select value={chartMetric} onChange={e=>setChartMetric(e.target.value)}><option value="temperature">Temperature</option><option value="rainfall">Rainfall</option><option value="humidity">Humidity</option><option value="soilMoisture">Soil moisture</option><option value="soilPH">Soil pH</option><option value="expense">Expenses</option><option value="income">Income</option></select></label><TrendChart label={observationMetric.label} unit={observationMetric.unit} points={chartPoints} /><p className="tiny">Only explicitly saved numeric measurements are charted. No values are inferred from photos.</p></div>
          <div className="panel"><div className="section-heading"><div><p className="eyebrow">CROP JOURNAL</p><h2>Crop timeline</h2></div><span>🪴</span></div>{chartData.length ? <div className="timeline">{chartData.slice().reverse().slice(0,10).map((o,i)=><div className="timeline-item" key={o._id || i}><span className="timeline-dot"></span><div><strong>{o.kind} · {o.source === "lab_test" ? "lab test" : o.source === "official_weather" ? "official weather" : "farmer record"}</strong><p>{o.description}</p>{Object.keys(o.values || {}).length > 0 && <span className="tiny">{Object.entries(o.values).filter(([,value])=>typeof value === "number").map(([key,value])=>`${key}: ${value}`).join(" · ")}</span>}<span className="tiny">{new Date(o.createdAt).toLocaleString()}</span></div></div>)}</div> : <p className="muted small">Your saved observations will appear here. Add regular notes to build a useful history.</p>}</div>
        </div>
      </section>}
      <footer>🌱 AGRO · A friendly farming companion · AI guidance is not a substitute for verified local agricultural advice.</footer>
    </main>
  </div>;
}

export default App;
