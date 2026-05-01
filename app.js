const fields = {
  agentName: document.querySelector("#agentName"),
  brokerage: document.querySelector("#brokerage"),
  serviceArea: document.querySelector("#serviceArea"),
  bookingLink: document.querySelector("#bookingLink"),
  leadName: document.querySelector("#leadName"),
  location: document.querySelector("#location"),
  budget: document.querySelector("#budget"),
  propertyType: document.querySelector("#propertyType"),
  timeline: document.querySelector("#timeline"),
  financing: document.querySelector("#financing"),
  hasAgent: document.querySelector("#hasAgent"),
  callTime: document.querySelector("#callTime"),
  lastMessage: document.querySelector("#lastMessage"),
};

const smsOutput = document.querySelector("#smsOutput");
const charCount = document.querySelector("#charCount");
const leadScore = document.querySelector("#leadScore");
const missingCount = document.querySelector("#missingCount");
const intentLabel = document.querySelector("#intentLabel");
const routeLabel = document.querySelector("#routeLabel");
const copySms = document.querySelector("#copySms");
const resetDemo = document.querySelector("#resetDemo");
const toast = document.querySelector("#toast");

let selectedSource = "Zillow";
let selectedMode = "auto";

const startingValues = Object.fromEntries(
  Object.entries(fields).map(([key, field]) => [key, field.value]),
);

function value(key) {
  return fields[key].value.trim();
}

function firstName() {
  return value("leadName") || "there";
}

function timelineDays() {
  const timeline = value("timeline");
  return timeline === "unknown" ? Number.POSITIVE_INFINITY : Number(timeline);
}

function buyingSoon() {
  return timelineDays() <= 90;
}

function needsHuman() {
  const message = value("lastMessage").toLowerCase();
  const humanKeywords = [
    "contract",
    "commission",
    "offer",
    "legal",
    "lawsuit",
    "mortgage rate",
    "interest rate",
    "closing cost",
    "inspection clause",
    "pricing strategy",
    "negotiate",
  ];
  return humanKeywords.some((keyword) => message.includes(keyword));
}

function missingFields() {
  return [
    ["location", "What area or neighborhood are you hoping to buy in?"],
    ["budget", "What budget range are you trying to stay within?"],
    ["propertyType", "What type of property are you looking for?"],
    ["timeline", "When are you hoping to buy?"],
    ["financing", "Have you started financing or been pre-approved yet?"],
    ["hasAgent", "Are you already working with a buyer's agent?"],
    ["callTime", "What is the best time for a quick call?"],
  ].filter(([key]) => !value(key) || value(key) === "Unknown");
}

function fitSms(text) {
  if (text.length <= 320) return text;
  return `${text.slice(0, 317).trim()}...`;
}

function agentLabel() {
  const name = value("agentName") || "the agent";
  return name;
}

function buildHandoff() {
  return fitSms(
    `Hi ${firstName()}, ${agentLabel()} can help with that directly. I can pass this along for human follow-up. What is the best time for a quick call?`,
  );
}

function buildBooking() {
  const link = value("bookingLink");
  const time = value("callTime");
  if (time) {
    return fitSms(
      `Hi ${firstName()}, based on your ${value("location") || "target area"} search and ${value("timeline").replace("60", "31-60 days").replace("30", "0-30 days").replace("90", "61-90 days")} timeline, a quick call with ${agentLabel()} would help. Does ${time} still work?`,
    );
  }
  if (link) {
    return fitSms(
      `Hi ${firstName()}, it sounds like you're looking within the next 90 days. ${agentLabel()} can help narrow options quickly. What time works for a quick call? ${link}`,
    );
  }
  return fitSms(
    `Hi ${firstName()}, it sounds like you're looking within the next 90 days. ${agentLabel()} can help narrow options quickly. What time works for a quick call?`,
  );
}

function buildQualify() {
  const missing = missingFields();
  if (missing.length) {
    return fitSms(`Hi ${firstName()}, happy to help. ${missing[0][1]}`);
  }

  if (value("hasAgent") === "Yes") {
    return fitSms(
      `Hi ${firstName()}, thanks for sharing. Since you're already working with an agent, what would be most helpful for ${agentLabel()} to follow up on?`,
    );
  }

  return fitSms(
    `Hi ${firstName()}, thanks. You're looking for a ${value("propertyType").toLowerCase()} around ${value("location")} near ${value("budget")}. What is the best time for a quick call with ${agentLabel()}?`,
  );
}

function buildAuto() {
  if (needsHuman()) return buildHandoff();
  if (buyingSoon() && missingFields().length <= 1 && value("hasAgent") !== "Yes") {
    return buildBooking();
  }
  return buildQualify();
}

function updateScore() {
  leadScore.classList.remove("hot", "needs-human");

  if (needsHuman()) {
    leadScore.textContent = "Needs human";
    leadScore.classList.add("needs-human");
    routeLabel.textContent = "Agent";
    return;
  }

  if (buyingSoon() && value("hasAgent") !== "Yes") {
    leadScore.textContent = "Hot lead";
    leadScore.classList.add("hot");
    routeLabel.textContent = "Call";
    return;
  }

  leadScore.textContent = "Warm lead";
  routeLabel.textContent = "SMS";
}

function updateMetrics() {
  const missing = missingFields().length;
  missingCount.textContent = missing;

  if (timelineDays() <= 90) {
    intentLabel.textContent = "90 days";
  } else if (timelineDays() === Number.POSITIVE_INFINITY) {
    intentLabel.textContent = "Unknown";
  } else {
    intentLabel.textContent = "Later";
  }
}

function generateSms() {
  const builders = {
    auto: buildAuto,
    qualify: buildQualify,
    book: buildBooking,
    handoff: buildHandoff,
  };
  const sms = builders[selectedMode]();
  smsOutput.textContent = sms;
  charCount.textContent = `${sms.length} / 320`;
  charCount.style.color = sms.length > 300 ? "var(--danger)" : "var(--muted)";
  updateScore();
  updateMetrics();
}

function setActiveButton(buttons, target) {
  buttons.forEach((button) => button.classList.toggle("is-active", button === target));
}

document.querySelectorAll(".source-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedSource = button.dataset.source;
    setActiveButton(document.querySelectorAll(".source-option"), button);
    generateSms();
  });
});

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.mode;
    setActiveButton(document.querySelectorAll(".mode-button"), button);
    generateSms();
  });
});

Object.values(fields).forEach((field) => {
  field.addEventListener("input", generateSms);
  field.addEventListener("change", generateSms);
});

copySms.addEventListener("click", async () => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(smsOutput.textContent);
  } else {
    const draft = document.createElement("textarea");
    draft.value = smsOutput.textContent;
    document.body.appendChild(draft);
    draft.select();
    document.execCommand("copy");
    draft.remove();
  }
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 1400);
});

resetDemo.addEventListener("click", () => {
  Object.entries(startingValues).forEach(([key, fieldValue]) => {
    fields[key].value = fieldValue;
  });
  selectedSource = "Zillow";
  selectedMode = "auto";
  setActiveButton(
    document.querySelectorAll(".source-option"),
    document.querySelector('[data-source="Zillow"]'),
  );
  setActiveButton(
    document.querySelectorAll(".mode-button"),
    document.querySelector('[data-mode="auto"]'),
  );
  generateSms();
});

generateSms();
