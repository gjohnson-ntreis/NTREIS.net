/**
 * gordo-widget.js
 * ---------------
 * Drop-in chat widget for launchpad.html (and any other page in the app).
 * Include with: <script src="gordo-widget.js"><\/script>
 * No build step, no dependencies - just vanilla JS.
 *
 * Matches the existing NTREIS JARVIS navy (#1a2f5e) / orange (#e8651a) theme.
 */

(function () {
  // xAI Grok via JARVIS server (not local Ollama / port 5050).
  // On localhost → :3001. On production same-origin /api.
  // For a future separate launcher domain set window.GORDO_API_BASE = 'https://jarvis.ntreis.net'
  const GORDO_API_URL =
    (typeof window.GORDO_API_BASE === "string" && window.GORDO_API_BASE
      ? String(window.GORDO_API_BASE).replace(/\/$/, "")
      : window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : "") + "/api/grok/chat";

  const sessionId = "sess_" + Math.random().toString(36).slice(2);

  function gordoCurrentUser() {
    const out = {
      email: "",
      name: "",
      memberMlsId: "",
      securityClass: "",
    };
    try {
      const u = JSON.parse(sessionStorage.getItem("ntreis_user") || "{}");
      out.email = u.email || u.preferred_username || u.userPrincipalName || "";
      out.name = u.name || "";
      out.memberMlsId = u.memberMlsId || u.member_mls_id || "";
      out.securityClass = u.securityClass || u.member_mls_security_class || "";
    } catch (_) {}
    if (window.GORDO_USER && typeof window.GORDO_USER === "object") {
      out.email = window.GORDO_USER.email || out.email;
      out.name = window.GORDO_USER.name || out.name;
      out.memberMlsId = window.GORDO_USER.memberMlsId || out.memberMlsId;
      out.securityClass = window.GORDO_USER.securityClass || out.securityClass;
    }
    return out;
  }
  let messages = [
    {
      role: "assistant",
      content:
        "Hello — I’m Gordo, your NTREIS assistant. I can help with NTREIS products and support, Matrix, data access and IDX, forms, and association contacts. How can I assist you today?",
    },
  ];
  let isLoading = false;
  let isOpen = false;

  // ---- Styles ----
  const style = document.createElement("style");
  style.textContent = `
    #gordo-bubble {
      position: fixed; bottom: 24px; right: 24px; width: 58px; height: 58px;
      border-radius: 50%; background: #1a2f5e; color: #fff; border: none;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483000; transition: transform 0.15s ease;
      font-family: 'Montserrat', system-ui, sans-serif;
      isolation: isolate;
    }
    #gordo-bubble:hover { transform: scale(1.06); }
    #gordo-bubble .gordo-mark,
    #gordo-close .gordo-mark,
    #gordo-send .gordo-mark,
    #gordo-mic .gordo-mark {
      display: block !important; font-weight: 800; line-height: 1; color: inherit;
      font-family: 'Montserrat', system-ui, sans-serif; pointer-events: none;
    }
    #gordo-bubble .gordo-mark { font-size: 22px; letter-spacing: -0.04em; color: #F47729; }
    #gordo-close .gordo-mark { font-size: 22px; font-weight: 500; }
    #gordo-send .gordo-mark, #gordo-mic .gordo-mark { font-size: 18px; }
    #gordo-bubble svg, #gordo-panel svg { display: none !important; }
    #gordo-bubble, #gordo-close, #gordo-send, #gordo-mic {
      appearance: none; -webkit-appearance: none; font: inherit;
    }

    #gordo-panel {
      position: fixed; bottom: 24px; right: 24px; width: 360px;
      max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 48px);
      background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.28);
      display: flex; flex-direction: column; overflow: hidden; z-index: 2147483000;
      font-family: 'Montserrat', system-ui, sans-serif; isolation: isolate;
    }
    #gordo-header {
      background: #030c3c; color: #fff; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    #gordo-header-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
    #gordo-header-title .gordo-dot { width: 8px; height: 8px; border-radius: 50%; background: #e8651a; }
    #gordo-close {
      background: rgba(255,255,255,0.12); border: none; color: #fff; cursor: pointer;
      width: 32px; height: 32px; border-radius: 8px; padding: 0;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #gordo-close:hover { background: rgba(255,255,255,0.22); }
    #gordo-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex;
      flex-direction: column; gap: 10px; background: #f4f5f8;
    }
    .gordo-msg {
      max-width: 82%; padding: 10px 14px; border-radius: 14px;
      font-size: 13.5px; line-height: 1.45; white-space: pre-wrap;
    }
    .gordo-msg.user { align-self: flex-end; background: #1a2f5e; color: #fff; }
    .gordo-msg.assistant { align-self: flex-start; background: #eef1f8; color: #1a2135; }
    #gordo-thinking { align-self: flex-start; color: #8490a8; font-size: 12.5px; padding: 4px 8px; }
    #gordo-input-row {
      display: flex; gap: 8px; padding: 12px; border-top: 1px solid #dde0e8; background: #fff;
    }
    #gordo-input {
      flex: 1; border: 1px solid #dde0e8; border-radius: 20px; padding: 10px 14px;
      font-size: 13.5px; outline: none; font-family: inherit;
    }
    #gordo-input:focus { border-color: #1a2f5e; }
    #gordo-send {
      background: #e8651a; border: none; border-radius: 50%; width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      color: #fff; flex-shrink: 0;
    }
    #gordo-send:disabled { opacity: 0.5; cursor: default; }
    #gordo-mic {
      background: #eef1f8; border: 1px solid #dde0e8; border-radius: 50%;
      width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #1a2f5e; flex-shrink: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    #gordo-mic:hover { background: #e8ecf5; }
    #gordo-mic.listening {
      background: #e8651a; border-color: #e8651a; color: #fff;
      box-shadow: 0 0 0 3px rgba(232,101,26,0.28);
      animation: gordo-mic-pulse 1.2s ease-in-out infinite;
    }
    #gordo-mic:disabled { opacity: 0.45; cursor: default; }
    @keyframes gordo-mic-pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(232,101,26,0.28); }
      50% { box-shadow: 0 0 0 7px rgba(232,101,26,0.12); }
    }
    #gordo-voice-hint {
      display: none; padding: 0 12px 8px; font-size: 11px; color: #8490a8; background: #fff;
    }
    #gordo-voice-hint.visible { display: block; }
    #gordo-voice-hint.listening { color: #e8651a; font-weight: 600; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---- Bubble button ----
  const bubble = document.createElement("button");
  bubble.id = "gordo-bubble";
  bubble.setAttribute("aria-label", "Open Gordo chat assistant");
  bubble.innerHTML = `<span class="gordo-mark" style="display:block;font:800 22px Montserrat,system-ui,sans-serif;color:#F47729;line-height:1">G</span>`;
  document.body.appendChild(bubble);

  // ---- Panel (built once, toggled visible/hidden) ----
  const panel = document.createElement("div");
  panel.id = "gordo-panel";
  panel.style.display = "none";
  panel.innerHTML = `
    <div id="gordo-header">
      <div id="gordo-header-title"><span class="gordo-dot"></span> Gordo.ai Assistant</div>
      <button type="button" id="gordo-close" aria-label="Close chat" title="Close">Close</button>
    </div>
    <div id="gordo-messages"></div>
    <div id="gordo-voice-hint" aria-live="polite"></div>
    <div id="gordo-input-row">
      <button type="button" id="gordo-mic" aria-label="Voice input" title="Speak to Gordo" style="display:none">
        <span class="gordo-mark">🎤</span>
      </button>
      <input id="gordo-input" type="text" placeholder="Ask about NTREIS, products, or support..." />
      <button type="button" id="gordo-send" aria-label="Send message">
        <span class="gordo-mark">➤</span>
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector("#gordo-messages");
  const inputEl = panel.querySelector("#gordo-input");
  const sendBtn = panel.querySelector("#gordo-send");
  const closeBtn = panel.querySelector("#gordo-close");
  const micBtn = panel.querySelector("#gordo-mic");
  const voiceHint = panel.querySelector("#gordo-voice-hint");

  function linkifyText(text) {
    const s = String(text || "");
    const frag = document.createDocumentFragment();
    const re = /(https?:\/\/[^\s<>"')\]]+)/g;
    let last = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const a = document.createElement("a");
      a.href = m[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = m[1];
      a.style.color = "#e8651a";
      a.style.wordBreak = "break-all";
      frag.appendChild(a);
      last = m.index + m[1].length;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    return frag;
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    for (const msg of messages) {
      const div = document.createElement("div");
      div.className = `gordo-msg ${msg.role === "user" ? "user" : "assistant"}`;
      if (msg.role === "assistant") div.appendChild(linkifyText(msg.content));
      else div.textContent = msg.content;
      messagesEl.appendChild(div);
    }
    if (isLoading) {
      const thinking = document.createElement("div");
      thinking.id = "gordo-thinking";
      thinking.textContent = "Gordo is thinking...";
      messagesEl.appendChild(thinking);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    if (typeof stopListening === "function") stopListening();
    if (typeof setVoiceHint === "function") setVoiceHint("");

    messages.push({ role: "user", content: text });
    inputEl.value = "";
    isLoading = true;
    renderMessages();

    // Browsers only allow window.open during a user gesture. After await fetch(),
    // a new window.open is usually blocked. Pre-open a blank tab now if this looks
    // like a launch request; navigate it when the API returns a launch URL.
    const maybeLaunch = /\b(launch|open|start|go to|take me to)\b/i.test(text);
    let launchWin = null;
    if (maybeLaunch) {
      try {
        launchWin = window.open("about:blank", "_blank");
        if (launchWin) {
          try {
            launchWin.document.title = "Opening…";
            launchWin.document.body.innerHTML =
              '<p style="font-family:system-ui;padding:24px;color:#4a5168">Opening app…</p>';
          } catch (_) {}
        }
      } catch (_) {
        launchWin = null;
      }
    }

    try {
      // Send recent history (exclude the opening greeting) so multi-turn works on Grok
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const response = await fetch(GORDO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          history,
          user: gordoCurrentUser(),
          site: (window.GORDO_SITE || window.location.hostname || "").toString(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = (data && data.error) || ("Request failed (" + response.status + ")");
        throw new Error(detail);
      }
      let replyText = data.reply || data.content || "No response from Grok.";
      if (data.launch && data.launch.url) {
        const target = data.launch.url;
        let opened = false;
        if (launchWin && !launchWin.closed) {
          try {
            launchWin.location.href = target;
            opened = true;
          } catch (e) {
            console.warn("Gordo launch navigate failed", e);
          }
        }
        if (!opened) {
          // Fallback (may still be blocked if no prior gesture tab)
          try {
            const w = window.open(target, "_blank");
            opened = !!(w && !w.closed);
          } catch (e) {
            console.warn("Gordo launch fallback failed", e);
          }
        }
        if (!opened) {
          replyText =
            "I could not open a new tab (popup blocked). Allow popups for this site, then try again — or use the " +
            (data.launch.name || "app") +
            " tile on the Launchpad.";
        } else if (!/opening/i.test(replyText) && data.launch.name) {
          replyText = "Opening " + data.launch.name + "…";
        }
        launchWin = null;
      } else if (launchWin && !launchWin.closed) {
        try { launchWin.close(); } catch (_) {}
        launchWin = null;
      }
      messages.push({
        role: "assistant",
        content: replyText,
      });
    } catch (err) {
      if (launchWin && !launchWin.closed) {
        try { launchWin.close(); } catch (_) {}
      }
      messages.push({
        role: "assistant",
        content:
          "Sorry, I'm having trouble reaching Grok right now. " +
          (err && err.message ? err.message : "Please try again in a moment."),
      });
    } finally {
      isLoading = false;
      renderMessages();
    }
  }


  // ---- Voice input (Web Speech API) ----
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let baseTranscript = "";

  function setVoiceHint(text, listening) {
    if (!voiceHint) return;
    if (!text) {
      voiceHint.textContent = "";
      voiceHint.classList.remove("visible", "listening");
      return;
    }
    voiceHint.textContent = text;
    voiceHint.classList.add("visible");
    voiceHint.classList.toggle("listening", !!listening);
  }

  function stopListening() {
    isListening = false;
    if (micBtn) {
      micBtn.classList.remove("listening");
      micBtn.setAttribute("aria-pressed", "false");
    }
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.stop();
      } catch (_) {}
    }
  }

  function startListening() {
    if (!SpeechRecognition) {
      setVoiceHint("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (isLoading) return;

    baseTranscript = (inputEl.value || "").trim();
    if (baseTranscript && !/\s$/.test(baseTranscript)) baseTranscript += " ";

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = function () {
      isListening = true;
      if (micBtn) {
        micBtn.classList.add("listening");
        micBtn.setAttribute("aria-pressed", "true");
      }
      setVoiceHint("Listening… say “send” or “enter” when done (or tap the mic)", true);
    };

    recognition.onresult = function (event) {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalChunk) {
        baseTranscript = (baseTranscript + finalChunk).replace(/\s+/g, " ");
        if (baseTranscript && !/\s$/.test(baseTranscript)) baseTranscript += " ";
      }

      // Voice "send" / "enter" / "submit" commits the message without clicking Send
      const combined = (baseTranscript + interim).replace(/\s+/g, " ").trim();
      const sendCmd = /^(.*?)(?:^|\s+)(?:send(?:\s+it)?|enter|submit|go\s+ahead|that'?s\s+it)\s*[.!]?\s*$/i;
      const m = combined.match(sendCmd);
      if (m && event.results[event.results.length - 1].isFinal) {
        let body = (m[1] || "").trim();
        // Also strip a trailing command if STT attached it to baseTranscript earlier
        body = body.replace(/\s+(?:send(?:\s+it)?|enter|submit|go\s+ahead|that'?s\s+it)\s*[.!?]?$/i, "").trim();
        if (body) {
          inputEl.value = body;
          baseTranscript = "";
          stopListening();
          setVoiceHint("");
          sendMessage();
          return;
        }
      }

      inputEl.value = (baseTranscript + interim).replace(/\s+/g, " ").trimStart();
    };

    recognition.onerror = function (event) {
      const err = (event && event.error) || "";
      if (err === "aborted" || err === "no-speech") return;
      if (err === "not-allowed") {
        setVoiceHint("Microphone permission denied. Allow mic access for this site.");
      } else {
        setVoiceHint("Voice error: " + err);
      }
      stopListening();
    };

    recognition.onend = function () {
      if (isListening) {
        try {
          recognition.start();
        } catch (_) {
          stopListening();
          setVoiceHint("");
        }
      } else {
        if (micBtn) {
          micBtn.classList.remove("listening");
          micBtn.setAttribute("aria-pressed", "false");
        }
        setVoiceHint("");
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setVoiceHint("Could not start microphone.");
      stopListening();
    }
  }

  function toggleMic() {
    if (isListening) {
      stopListening();
      setVoiceHint("");
      inputEl.focus();
      return;
    }
    startListening();
  }

  if (micBtn) {
    if (!SpeechRecognition) {
      micBtn.disabled = true;
      micBtn.title = "Voice not supported in this browser";
    }
    micBtn.addEventListener("click", function (e) {
      e.preventDefault();
      toggleMic();
    });
  }

  if (closeBtn) {
    closeBtn.textContent = "Close";
    closeBtn.setAttribute("style",
      "display:inline-flex;align-items:center;justify-content:center;" +
      "margin-left:12px;height:28px;padding:0 10px;border:0;border-radius:6px;" +
      "background:#e8651a;color:#fff;font:700 12px Montserrat,system-ui,sans-serif;" +
      "letter-spacing:.04em;text-transform:uppercase;cursor:pointer;flex-shrink:0;z-index:2;"
    );
  }

  const overlay = document.createElement("div");
  overlay.id = "gordo-overlay";
  overlay.setAttribute("style",
    "display:none;position:fixed;inset:0;background:rgba(3,12,60,0.35);z-index:2147482999;"
  );
  document.body.appendChild(overlay);

  function openPanel() {
    isOpen = true;
    bubble.style.display = "none";
    overlay.style.display = "block";
    panel.style.display = "flex";
    renderMessages();
    try { inputEl.focus(); } catch (_) {}
  }

  function closePanel() {
    stopListening();
    setVoiceHint("");
    isOpen = false;
    overlay.style.display = "none";
    panel.style.display = "none";
    bubble.style.display = "flex";
  }

  bubble.addEventListener("click", openPanel);
  if (closeBtn) closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    closePanel();
  });
  overlay.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (isOpen && e.key === "Escape") closePanel();
  });

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  renderMessages();
})();
