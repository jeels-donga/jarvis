// Core Elements
const turn_on = document.querySelector("#turn_on");
const nova_intro = document.querySelector("#n_intro");
const timeDisplay = document.querySelector("#time");
const batteryDisplay = document.querySelector("#battery");
const internetDisplay = document.querySelector("#internet");
const reactor = document.querySelector("#reactor");
const responseText = document.querySelector("#response-text");
const transcriptDisplay = document.querySelector("#transcript");
const setupForm = document.querySelector("#setup_form");
const commandsList = document.querySelector("#commands_list");

// State
let isAwake = false;
let isStopping = false;
let charge = 100;
let chargeStatus = "unplugged";
let connectivity = "online";
let userData = JSON.parse(localStorage.getItem("jarvis_setup") || "{}");

// Commands List (Simplified for UI display)
const novaCommands = [
  "Hi Nova",
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
  novaCommands.forEach(cmd => {
    commandsList.innerHTML += `<p># ${cmd}</p>`;
  });

  // Battery & Connectivity
  initBattery();
  initConnectivity();

  // Check Setup
  if (!localStorage.getItem("jarvis_setup")) {
    setupForm.style.display = "flex";
  } else {
    initWeather();
    readOut("Systems online. Ready for your command, sir.");

    // Auto-start recognition
    setTimeout(() => {
      try {
        recognition.start();
      } catch (e) {
        console.log("Waiting for user interaction to start recognition...");
        updateResponse("CLICK ANYWHERE TO SYNC SYSTEMS");
        // Fallback: Start on first click anywhere if browser blocks auto-start
        document.body.addEventListener('click', () => {
          if (!isStopping) {
            recognition.start();
            readOut("Systems synchronized. Ready for your command, sir.");
          }
        }, { once: true });
      }
    }, 2000);
  }
};

// --- UI Feedback Functions ---
function setNovaState(state) {
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
function initWeather() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeather({ lat: latitude, lon: longitude });
      },
      (error) => {
        console.warn("Geolocation failed or denied. Falling back to manual location.", error);
        fetchWeather({ location: userData.location });
      }
    );
  } else {
    fetchWeather({ location: userData.location });
  }
}

function fetchWeather({ location, lat, lon }) {
  const key = "48ddfe8c9cf29f95b7d0e54d6e171008";
  let url = `https://api.openweathermap.org/data/2.5/weather?appid=${key}&units=metric`;

  if (lat && lon) {
    url += `&lat=${lat}&lon=${lon}`;
  } else if (location) {
    url += `&q=${location}`;
  } else {
    return; // No location source provided
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.cod === 200) {
        document.querySelector("#location").textContent = `Location: ${data.name}`;
        document.querySelector("#weatherT").textContent = `Temp: ${data.main.temp.toFixed(1)}°C`;
        document.querySelector("#weatherD").textContent = `Condition: ${data.weather[0].description}`;
      }
    })
    .catch(err => console.error("Weather fetch failed:", err));
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
    if (inputs[3].value) data.groq_key = inputs[3].value;
    localStorage.setItem("jarvis_setup", JSON.stringify(data));
    userData = data;
    setupForm.style.display = "none";
    initWeather();
    readOut(`Welcome back, ${data.name}. Systems initialized.`);
    setTimeout(() => {
      try { recognition.start(); } catch (e) { }
    }, 2000);
  } else {
    readOut("Sir, please provide the required identification parameters.");
  }
});

// --- Voice Recognition ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.continuous = true;
recognition.lang = 'en-US';
recognition.interimResults = false; // Ensure we only get final results for command processing

recognition.onstart = () => {
  setJarvisState("listening");
  updateResponse("LISTENING...");
};

recognition.onend = () => {
  if (!isStopping) {
    recognition.start();
  } else {
    setJarvisState(null);
    updateResponse("DEACTIVATED");
  }
};

recognition.onresult = (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
  updateResponse(transcript, true);

  const wakeWords = ["nova", "hello nova", "wakeup nova"];
  let foundWakeWord = wakeWords.find(word => transcript.startsWith(word));

  if (foundWakeWord) {
    // Stage 1: Wake Word Detected
    isAwake = true;
    readOut("Yes sir? I am listening.");
    setNovaState("listening");
    updateResponse("WAITING FOR COMMAND...");

    // We ignore any command that might be in the same transcript to force the two-step flow
    return;
  }

  if (isAwake) {
    // Stage 2: Assistant is awake, process this transcript as a command
    handleCommand(transcript);
    isAwake = false; // Reset to standby after one command
  }
};

// --- Command Handling ---
async function handleCommand(command) {
  setNovaState("processing");

  // Casual/Hardcoded
  if (command.includes("hi nova") || command.includes("hello nova")) {
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

  // Default: Groq LLM Integration
  updateResponse("THINKING...");
  const aiResponse = await getGroqResponse(command);
  readOut(aiResponse);
  updateResponse(aiResponse);
}

// --- Groq AI Integration ---
function getApiKey() {
  // 1. Check userData (saved in localStorage)
  if (userData.groq_key) return userData.groq_key;

  // 2. Check global variable from modules/keys.js
  if (typeof GROQ_API_KEY !== 'undefined') return GROQ_API_KEY;

  return null;
}

async function getGroqResponse(prompt) {
  const apiKey = getApiKey();

  if (!apiKey) {
    setupForm.style.display = "flex";
    return "Sir, my cognitive interface is offline. Please provide a Groq API Key in the system setup and established a link.";
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are Nova, a highly intelligent AI assistant. Respond concisely and professionally."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    }

    const errorData = await response.json();
    const lastError = errorData.error ? errorData.error.message : response.statusText;
    return `Sir, the cognitive interface failed. Detail: ${lastError}`;
  } catch (error) {
    console.error(`Connection failure:`, error);
    return `Sir, a network error occurred (${error.message || 'Check Console'}). Protocol: ${window.location.protocol}. Ensure you are using a Local Server if direct file opening fails.`;
  }
}

// --- Voice Output ---
// Pre-load voices for better reliability
let availableVoices = [];
window.speechSynthesis.onvoiceschanged = () => {
  availableVoices = window.speechSynthesis.getVoices();
};

function readOut(message) {
  if (!message) return;

  const speech = new SpeechSynthesisUtterance();
  speech.text = message;
  speech.volume = 1;
  speech.rate = 0.9;
  speech.pitch = 1;

  // Sync voices if not already loaded
  if (availableVoices.length === 0) {
    availableVoices = window.speechSynthesis.getVoices();
  }

  // Attempt to find a "male" or "English" voice
  let voice = availableVoices.find(v => v.name.includes("Google UK English Male")) ||
    availableVoices.find(v => v.lang.startsWith("en") && v.name.includes("Male")) ||
    availableVoices.find(v => v.lang.startsWith("en")) ||
    availableVoices[0];

  if (voice) speech.voice = voice;

  // Pause recognition while speaking to prevent Jarvis hearing himself
  speech.onstart = () => {
    try { recognition.stop(); } catch (e) { }
  };

  speech.onend = () => {
    try { if (!isStopping) recognition.start(); } catch (e) { }
    setJarvisState(null);
  };

  speech.onerror = (e) => {
    console.error("Speech Error:", e);
    setJarvisState(null);
  };

  window.speechSynthesis.speak(speech);
  updateResponse(message);
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

// Global Deactivate (Optional feature, remains for command handling use)
function deactivateNova() {
  isStopping = true;
  recognition.stop();
}
