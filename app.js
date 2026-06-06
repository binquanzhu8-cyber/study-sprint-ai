const form = document.querySelector("#plannerForm");
const topicInput = document.querySelector("#topic");
const goalInput = document.querySelector("#goal");
const daysInput = document.querySelector("#daysLeft");
const sessionInput = document.querySelector("#sessionLength");
const energyInput = document.querySelector("#energy");
const planTitle = document.querySelector("#planTitle");
const strategyText = document.querySelector("#strategyText");
const taskList = document.querySelector("#taskList");
const completionScore = document.querySelector("#completionScore");
const progressBars = document.querySelector("#progressBars");
const focusInitial = document.querySelector("#focusInitial");
const resetTasksButton = document.querySelector("#resetTasks");
const notesInput = document.querySelector("#notes");
const timerDisplay = document.querySelector("#timerDisplay");
const timerMode = document.querySelector("#timerMode");
const startTimerButton = document.querySelector("#startTimer");
const pauseTimerButton = document.querySelector("#pauseTimer");
const resetTimerButton = document.querySelector("#resetTimer");
const timerFace = document.querySelector(".timer-face");
const gameBoard = document.querySelector("#gameBoard");
const newGameButton = document.querySelector("#newGame");
const matchCount = document.querySelector("#matchCount");
const moveCount = document.querySelector("#moveCount");
const gameMessage = document.querySelector("#gameMessage");

const STORAGE_KEY = "study-sprint-ai-state";
const GAME_CONCEPTS = ["AI", "JS", "UX", "GIT"];

const defaultState = {
  topic: "Calculus review",
  goal: "Prepare for a quiz by reviewing limits, derivatives, and common problem patterns.",
  daysLeft: 3,
  sessionLength: 35,
  energy: "balanced",
  notes: "",
  tasks: [],
};

let state = loadState();
let timer = {
  total: state.sessionLength * 60,
  remaining: state.sessionLength * 60,
  intervalId: null,
  running: false,
};
let game = createGame();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { ...defaultState, tasks: generateTasks(defaultState) };
  }

  try {
    const parsed = JSON.parse(saved);
    const merged = { ...defaultState, ...parsed };
    return {
      ...merged,
      tasks: Array.isArray(merged.tasks) && merged.tasks.length ? merged.tasks : generateTasks(merged),
    };
  } catch {
    return { ...defaultState, tasks: generateTasks(defaultState) };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateTasks(input) {
  const minutes = Number(input.sessionLength);
  const days = Number(input.daysLeft);
  const topic = input.topic.trim() || "the topic";
  const intensity =
    input.energy === "tired"
      ? "light recovery"
      : input.energy === "focused"
        ? "deep work"
        : "steady practice";

  return [
    {
      title: `Map the exam scope for ${topic}`,
      detail: `Spend ${Math.max(10, Math.round(minutes * 0.35))} minutes turning the goal into a checklist.`,
      chip: "Diagnose",
      done: false,
    },
    {
      title: "Study the weakest concept first",
      detail: `Use one ${intensity} session before doing mixed questions.`,
      chip: "Focus",
      done: false,
    },
    {
      title: "Complete active recall practice",
      detail: "Answer questions without notes, then correct mistakes immediately.",
      chip: "Recall",
      done: false,
    },
    {
      title: `Build a ${days}-day review rhythm`,
      detail: "End each day by choosing the next smallest useful task.",
      chip: "Schedule",
      done: false,
    },
    {
      title: "Write a final explanation in your own words",
      detail: "This becomes your demo evidence and review summary.",
      chip: "Reflect",
      done: false,
    },
  ];
}

function createStrategy(input) {
  const goal = input.goal.trim();
  const energyAdvice = {
    tired: "Keep the plan lighter: shorter drills, more examples, and a quick win at the start.",
    balanced: "Use a balanced loop: diagnose, learn, practice, and reflect after each session.",
    focused: "Use deeper sessions: solve harder problems first and reserve the end for error analysis.",
  };

  return `${energyAdvice[input.energy]} Your goal is: ${goal} With ${input.daysLeft} day(s) left, the best path is to protect attention, practice actively, and finish with a visible summary of what improved.`;
}

function render() {
  topicInput.value = state.topic;
  goalInput.value = state.goal;
  daysInput.value = state.daysLeft;
  sessionInput.value = state.sessionLength;
  energyInput.value = state.energy;
  notesInput.value = state.notes;

  planTitle.textContent = `${state.topic || "Study"} sprint`;
  strategyText.textContent = createStrategy(state);
  focusInitial.textContent = (state.topic || "S").trim().charAt(0).toUpperCase();

  taskList.innerHTML = "";
  state.tasks.forEach((task, index) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " done" : ""}`;
    item.innerHTML = `
      <input type="checkbox" aria-label="Mark ${task.title} complete" ${task.done ? "checked" : ""} />
      <span class="task-text">
        <strong>${escapeHtml(task.title)}</strong>
        <small>${escapeHtml(task.detail)}</small>
      </span>
      <span class="task-chip">${escapeHtml(task.chip)}</span>
    `;
    item.querySelector("input").addEventListener("change", (event) => {
      state.tasks[index].done = event.target.checked;
      saveState();
      renderProgress();
      item.classList.toggle("done", event.target.checked);
    });
    taskList.appendChild(item);
  });

  renderProgress();
  resetTimer();
}

function renderProgress() {
  const completed = state.tasks.filter((task) => task.done).length;
  const percent = state.tasks.length ? Math.round((completed / state.tasks.length) * 100) : 0;
  completionScore.textContent = `${percent}%`;

  const days = Math.max(1, Math.min(7, Number(state.daysLeft)));
  progressBars.innerHTML = "";
  for (let day = 1; day <= days; day += 1) {
    const planned = Math.min(100, Math.round((percent * day) / days + (day - 1) * 8));
    const row = document.createElement("div");
    row.className = "progress-row";
    row.innerHTML = `
      <span>Day ${day}</span>
      <span class="bar-track"><span class="bar-fill" style="width: ${planned}%"></span></span>
      <span>${planned}%</span>
    `;
    progressBars.appendChild(row);
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(timer.remaining);
  const elapsed = timer.total - timer.remaining;
  const progress = timer.total ? Math.round((elapsed / timer.total) * 100) : 0;
  timerFace.style.setProperty("--timer-progress", `${progress}%`);
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timerMode.textContent = "Running";
  timer.intervalId = window.setInterval(() => {
    timer.remaining -= 1;
    updateTimerDisplay();
    if (timer.remaining <= 0) {
      pauseTimer();
      timerMode.textContent = "Done";
    }
  }, 1000);
}

function pauseTimer() {
  window.clearInterval(timer.intervalId);
  timer.running = false;
  timerMode.textContent = timer.remaining === timer.total ? "Ready" : "Paused";
}

function resetTimer() {
  pauseTimer();
  timer.total = Number(state.sessionLength) * 60;
  timer.remaining = timer.total;
  timerMode.textContent = "Ready";
  updateTimerDisplay();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createGame() {
  const cards = shuffle([...GAME_CONCEPTS, ...GAME_CONCEPTS]).map((label, index) => ({
    id: `${label}-${index}`,
    label,
    flipped: false,
    matched: false,
  }));

  return {
    cards,
    flippedIndexes: [],
    locked: false,
    moves: 0,
    matches: 0,
  };
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function renderGame() {
  gameBoard.innerHTML = "";
  matchCount.textContent = game.matches;
  moveCount.textContent = game.moves;

  game.cards.forEach((card, index) => {
    const button = document.createElement("button");
    button.className = `match-card${card.flipped ? " flipped" : ""}${card.matched ? " matched" : ""}`;
    button.type = "button";
    button.textContent = card.flipped || card.matched ? card.label : "?";
    button.setAttribute("aria-label", card.flipped || card.matched ? `${card.label} card` : "Hidden concept card");
    button.disabled = card.matched || game.locked;
    button.addEventListener("click", () => flipCard(index));
    gameBoard.appendChild(button);
  });
}

function flipCard(index) {
  const card = game.cards[index];
  if (game.locked || card.flipped || card.matched) return;

  card.flipped = true;
  game.flippedIndexes.push(index);
  gameMessage.textContent = "Good pick. Find its matching concept.";
  renderGame();

  if (game.flippedIndexes.length === 2) {
    checkMatch();
  }
}

function checkMatch() {
  const [firstIndex, secondIndex] = game.flippedIndexes;
  const firstCard = game.cards[firstIndex];
  const secondCard = game.cards[secondIndex];
  game.moves += 1;

  if (firstCard.label === secondCard.label) {
    firstCard.matched = true;
    secondCard.matched = true;
    game.matches += 1;
    game.flippedIndexes = [];
    gameMessage.textContent =
      game.matches === GAME_CONCEPTS.length
        ? `You cleared the board in ${game.moves} moves. Back to the sprint.`
        : "Nice match. Keep going.";
    renderGame();
    return;
  }

  game.locked = true;
  gameMessage.textContent = "Not a pair yet. Try another memory path.";
  renderGame();

  window.setTimeout(() => {
    firstCard.flipped = false;
    secondCard.flipped = false;
    game.flippedIndexes = [];
    game.locked = false;
    gameMessage.textContent = "Find matching study concepts to recharge your focus.";
    renderGame();
  }, 720);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  state = {
    ...state,
    topic: topicInput.value.trim(),
    goal: goalInput.value.trim(),
    daysLeft: Number(daysInput.value),
    sessionLength: Number(sessionInput.value),
    energy: energyInput.value,
  };
  state.tasks = generateTasks(state);
  saveState();
  render();
});

resetTasksButton.addEventListener("click", () => {
  state.tasks = generateTasks(state);
  saveState();
  render();
});

notesInput.addEventListener("input", () => {
  state.notes = notesInput.value;
  saveState();
});

startTimerButton.addEventListener("click", startTimer);
pauseTimerButton.addEventListener("click", pauseTimer);
resetTimerButton.addEventListener("click", resetTimer);
newGameButton.addEventListener("click", () => {
  game = createGame();
  gameMessage.textContent = "New board ready. Find all four concept pairs.";
  renderGame();
});

render();
renderGame();
