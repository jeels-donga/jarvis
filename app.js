// Core Elements
const turn_on = document.querySelector("#turn_on");
const jarvis_intro = document.querySelector("#j_intro");
const timeDisplay = document.querySelector("#time");
const batteryDisplay = document.querySelector("#battery");
const internetDisplay = document.querySelector("#internet");
const reactor = document.querySelector("#reactor");
const responseText = document.querySelector("#response-text");
const transcriptDisplay = document.querySelector("#transcript");
const setupForm = document.querySelector("#setup_form");
const commandsList = document.querySelector("#commands_list");

// State
let isStopping = false;
let charge = 100;
let chargeStatus = "unplugged";
let connectivity = "online";
let userData = JSON.parse(localStorage.getItem("jarvis_setup") || "{}");

// Commands List (Simplified for UI display)
const jarvisCommands = [
  "Hi Jarvis",
  "Tell about yourself",
  "What's the weather",
  "Open YouTube/Google/Github",
  "Play [song name]",
  "Search for [query]",
  "Shut down"
];

// Initialize UI
window.onload = () => {
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Commands List
  jarvisCommands.forEach(cmd => {
    commandsList.innerHTML += `<p># ${cmd}</p>`;
  });

  // Battery & Connectivity
  initBattery();
  initConnectivity();

  // Check Setup
  if (!localStorage.getItem("jarvis_setup")) {
    setupForm.style.display = "flex";
  } else {
    fetchWeather(userData.location);
    readOut("Systems online. Ready for your command, sir.");
  }
};

// --- UI Feedback Functions ---
function setJarvisState(state) {
  reactor.classList.remove("listening", "processing");
  if (state === "listening") reactor.classList.add("listening");
  if (state === "processing") reactor.classList.add("processing");
}

function updateResponse(text, isTranscript = false) {
  if (isTranscript) {
    transcriptDisplay.textContent = text;
  } else {
    responseText.textContent = text;
  }
}

// --- System Functions ---
function updateDateTime() {
  const now = new Date();
  timeDisplay.textContent = now.toLocaleTimeString();
}

function initBattery() {
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      updateBattery(battery);
      battery.onlevelchange = () => updateBattery(battery);
      battery.onchargingchange = () => updateBattery(battery);
    });
  }
}

function updateBattery(battery) {
  const level = (battery.level * 100).toFixed(0);
  charge = level;
  chargeStatus = battery.charging ? "charging" : "discharging";
  batteryDisplay.textContent = `${level}% ${battery.charging ? '⚡' : ''}`;
}

function initConnectivity() {
  const updateStatus = () => {
    connectivity = navigator.onLine ? "Online" : "Offline";
    internetDisplay.textContent = connectivity;
    internetDisplay.style.color = navigator.onLine ? "var(--primary)" : "#ff4444";
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// --- Weather (Using existing API key from original code) ---
function fetchWeather(location) {
  const key = "48ddfe8c9cf29f95b7d0e54d6e171008";
  fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${key}&units=metric`)
    .then(res => res.json())
    .then(data => {
      if (data.cod === 200) {
        document.querySelector("#location").textContent = `Location: ${data.name}`;
        document.querySelector("#weatherT").textContent = `Temp: ${data.main.temp}°C`;
        document.querySelector("#weatherD").textContent = `Condition: ${data.weather[0].description}`;
      }
    });
}

// --- Setup Form ---
document.querySelector("#sub_btn").addEventListener("click", () => {
  const inputs = setupForm.querySelectorAll("input");
  const data = {
    name: inputs[0].value,
    location: inputs[1].value,
    github: inputs[2].value
  };

  if (data.name && data.location) {
    localStorage.setItem("jarvis_setup", JSON.stringify(data));
    userData = data;
    setupForm.style.display = "none";
    fetchWeather(data.location);
    readOut(`Welcome back, ${data.name}. Systems initialized.`);
  } else {
    readOut("Sir, please provide the required identification parameters.");
  }
});

// --- Voice Recognition ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';

recognition.onstart = () => {
  setJarvisState("listening");
  updateResponse("LISTENING...");
  document.querySelector("#start_jarvis_btn").style.display = "none";
  document.querySelector("#stop_jarvis_btn").style.display = "flex";
};

recognition.onend = () => {
  if (!isStopping) {
    recognition.start();
  } else {
    setJarvisState(null);
    updateResponse("DEACTIVATED");
    document.querySelector("#start_jarvis_btn").style.display = "flex";
    document.querySelector("#stop_jarvis_btn").style.display = "none";
  }
};

recognition.onresult = (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
  updateResponse(transcript, true);
  handleCommand(transcript);
};

// --- Command Handling ---
async function handleCommand(command) {
  setJarvisState("processing");

  // Casual/Hardcoded
  if (command.includes("hi jarvis") || command.includes("hello jarvis")) {
    readOut("Hello sir, how can I assist you today?");
    return;
  }

  if (command.includes("status") || command.includes("system status")) {
    readOut(`Systems are functional. Battery at ${charge} percent. Connectivity is ${connectivity}.`);
    return;
  }

  if (command.includes("open google")) {
    readOut("Opening Google");
    window.open("https://google.com", "_blank");
    return;
  }

  if (command.includes("open youtube")) {
    readOut("Opening YouTube");
    window.open("https://youtube.com", "_blank");
    return;
  }

  if (command.includes("shut down") || command.includes("go to sleep")) {
    readOut("Understood. Powering down systems. Goodbye sir.");
    isStopping = true;
    recognition.stop();
    return;
  }

  // Default: Gemini LLM Integration
  updateResponse("THINKING...");
  const aiResponse = await getGeminiResponse(command);
  readOut(aiResponse);
  updateResponse(aiResponse);
}

// --- Gemini AI Integration ---
async function getGeminiResponse(prompt) {
  const API_KEY = "AIzaSyDwGUhC-0_0kE8HFdUQYvwsRfrjfhIsAzY";

  if (window.location.protocol === "file:") {
    return "Sir, I cannot access my cognitive modules while running from a file pool. Please launch me using a local server (Live Server) to bypass security restrictions.";
  }

  // Best chance: try the stable v1 endpoint first, then fallback to v1beta
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`
  ];

  let lastError = "";

  for (const url of endpoints) {
    try {
      console.log(`Diagnostic: Connecting to endpoint...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are Jarvis, a highly intelligent AI assistant. Respond concisely to: ${prompt}` }] }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
      }

      const errorData = await response.json();
      lastError = errorData.error ? errorData.error.message : response.statusText;
      console.warn(`Endpoint failed:`, lastError);
    } catch (error) {
      console.error(`Connection failure:`, error);
      lastError = `Network Error - Likely restricted by browser security.`;
    }
  }

  return `Sir, the cognitive interface failed. Detail: ${lastError}. Ensure you are using a Local Server and your API key is active.`;
}

async function listAllModels(key) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    console.log("DIAGNOSTIC - Available Models for this Key:", data.models ? data.models.map(m => m.name) : data);
  } catch (e) {
    console.error("Diagnostic failure:", e);
  }
}

// --- Voice Output ---
function readOut(message) {
  const speech = new SpeechSynthesisUtterance();
  speech.text = message;
  speech.volume = 1;
  speech.rate = 0.9;
  speech.pitch = 1;

  // Attempt to find a "male" or "cool" voice
  const voices = window.speechSynthesis.getVoices();
  speech.voice = voices.find(v => v.name.includes("Google UK English Male")) || voices[0];

  window.speechSynthesis.speak(speech);
  updateResponse(message);
  setJarvisState(null);
}

// --- Particle Background ---
const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.1;
    this.speedX = Math.random() * 0.5 - 0.25;
    this.speedY = Math.random() * 0.5 - 0.25;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x > canvas.width) this.x = 0;
    if (this.x < 0) this.x = canvas.width;
    if (this.y > canvas.height) this.y = 0;
    if (this.y < 0) this.y = canvas.height;
  }
  draw() {
    ctx.fillStyle = "rgba(0, 210, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initParticles() {
  for (let i = 0; i < 100; i++) {
    particlesArray.push(new Particle());
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < particlesArray.length; i++) {
    particlesArray[i].update();
    particlesArray[i].draw();
  }
  requestAnimationFrame(animateParticles);
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

initParticles();
animateParticles();

// --- End Particle Background ---

// Controls
document.querySelector("#start_jarvis_btn").addEventListener("click", () => {
  isStopping = false;
  recognition.start();
  turn_on.play();
});

document.querySelector("#stop_jarvis_btn").addEventListener("click", () => {
  isStopping = true;
  recognition.stop();
});
