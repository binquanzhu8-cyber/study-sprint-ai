const STORAGE_KEY = "study-sprint-ai-state";

const taskForm = document.querySelector("#taskForm");
const taskList = document.querySelector("#taskList");
const taskCounter = document.querySelector("#taskCounter");
const taskTitle = document.querySelector("#taskTitle");
const taskMinutes = document.querySelector("#taskMinutes");
const taskPriority = document.querySelector("#taskPriority");
const taskType = document.querySelector("#taskType");
const coachCard = document.querySelector("#coachCard");
const energyLevel = document.querySelector("#energyLevel");
const planList = document.querySelector("#planList");
const completionRate = document.querySelector("#completionRate");
const remainingMinutes = document.querySelector("#remainingMinutes");
const highPriorityCount = document.querySelector("#highPriorityCount");
const typeChart = document.querySelector("#typeChart");
const exportButton = document.querySelector("#exportButton");
const seedDemoButton = document.querySelector("#seedDemoButton");
const clearDoneButton = document.querySelector("#clearDoneButton");
const generatePlan = document.querySelector("#generatePlan");
const toast = document.querySelector("#toast");

const timerTime = document.querySelector("#timerTime");
const timerProgress = document.querySelector("#timerProgress");
const startTimer = document.querySelector("#startTimer");
const pauseTimer = document.querySelector("#pauseTimer");
const resetTimer = document.querySelector("#resetTimer");
const sessionCounter = document.querySelector("#sessionCounter");
const presetButtons = document.querySelectorAll(".timer-presets button");

const typeLabels = {
  coding: "编程",
  reading: "阅读",
  memory: "背诵",
  writing: "写作",
  review: "复习",
};

const priorityLabels = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};

const priorityScore = {
  high: 3,
  medium: 2,
  low: 1,
};

let state = loadState();
let timer = {
  duration: 25 * 60,
  remaining: 25 * 60,
  running: false,
  intervalId: null,
};

function loadState() {
  const fallback = {
    tasks: [],
    sessions: 0,
  };

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createTask({ title, minutes, priority, type, done = false }) {
  return {
    id: crypto.randomUUID(),
    title,
    minutes: Number(minutes),
    priority,
    type,
    done,
    createdAt: new Date().toISOString(),
  };
}

function render() {
  renderTasks();
  renderInsights();
  renderCoach();
  saveState();
}

function renderTasks() {
  taskCounter.textContent = `${state.tasks.length} 项`;
  taskList.innerHTML = "";

  if (state.tasks.length === 0) {
    taskList.innerHTML = `<div class="task-item"><div class="task-main"><p class="task-title">还没有任务</p><div class="task-meta">添加一个任务开始规划今天。</div></div></div>`;
    return;
  }

  const sortedTasks = [...state.tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    return priorityScore[b.priority] - priorityScore[a.priority] || a.minutes - b.minutes;
  });

  sortedTasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-item ${task.done ? "done" : ""}`;
    item.innerHTML = `
      <input class="task-check" type="checkbox" ${task.done ? "checked" : ""} aria-label="标记 ${escapeHtml(task.title)} 为完成" />
      <div class="task-main">
        <p class="task-title">${escapeHtml(task.title)}</p>
        <div class="task-meta">
          <span class="pill ${task.priority}">${priorityLabels[task.priority]}</span>
          <span>${typeLabels[task.type]}</span>
          <span>${task.minutes} 分钟</span>
        </div>
      </div>
      <button class="delete-button" type="button" aria-label="删除任务">×</button>
    `;

    item.querySelector(".task-check").addEventListener("change", () => toggleTask(task.id));
    item.querySelector(".delete-button").addEventListener("click", () => deleteTask(task.id));
    taskList.append(item);
  });
}

function renderInsights() {
  const total = state.tasks.length;
  const done = state.tasks.filter((task) => task.done).length;
  const remaining = state.tasks
    .filter((task) => !task.done)
    .reduce((sum, task) => sum + task.minutes, 0);
  const highCount = state.tasks.filter((task) => task.priority === "high" && !task.done).length;

  completionRate.textContent = total ? `${Math.round((done / total) * 100)}%` : "0%";
  remainingMinutes.textContent = `${remaining}m`;
  highPriorityCount.textContent = highCount;
  sessionCounter.textContent = `${state.sessions} 轮`;

  const counts = Object.keys(typeLabels).map((type) => ({
    type,
    label: typeLabels[type],
    count: state.tasks.filter((task) => task.type === type).length,
  }));
  const max = Math.max(...counts.map((item) => item.count), 1);

  typeChart.innerHTML = counts
    .map(
      (item) => `
        <div class="chart-row">
          <span>${item.label}</span>
          <div class="chart-bar"><span style="width: ${(item.count / max) * 100}%"></span></div>
          <span>${item.count}</span>
        </div>
      `,
    )
    .join("");
}

function renderCoach() {
  const activeTasks = state.tasks.filter((task) => !task.done);

  if (!activeTasks.length) {
    coachCard.innerHTML = `<h4>先添加几个任务</h4><p>系统会根据任务优先级、预计时间和当前精力状态生成建议。</p>`;
    planList.innerHTML = "";
    return;
  }

  const totalMinutes = activeTasks.reduce((sum, task) => sum + task.minutes, 0);
  const highTasks = activeTasks.filter((task) => task.priority === "high");
  const energy = energyLevel.value;
  const leadTask = recommendOrder(activeTasks, energy)[0];
  const message = buildCoachMessage({ totalMinutes, highTasks, leadTask, energy });

  coachCard.innerHTML = `
    <h4>${escapeHtml(message.title)}</h4>
    <p>${escapeHtml(message.body)}</p>
  `;
}

function buildCoachMessage({ totalMinutes, highTasks, leadTask, energy }) {
  if (energy === "low") {
    return {
      title: "建议从轻量任务热身",
      body: `今天剩余 ${totalMinutes} 分钟。先做“${leadTask.title}”，再把高优先级任务拆成 15 分钟小段。`,
    };
  }

  if (energy === "high" && highTasks.length) {
    return {
      title: "适合先攻克关键任务",
      body: `当前有 ${highTasks.length} 个高优先级任务。建议先完成“${leadTask.title}”，保持连续专注。`,
    };
  }

  return {
    title: "保持稳定节奏",
    body: `剩余任务约 ${totalMinutes} 分钟。按优先级排序，并在每 25 分钟后休息 5 分钟。`,
  };
}

function recommendOrder(tasks, energy) {
  const sorted = [...tasks].sort((a, b) => {
    const priorityDelta = priorityScore[b.priority] - priorityScore[a.priority];
    if (energy === "low") return a.minutes - b.minutes || priorityDelta;
    if (energy === "high") return priorityDelta || b.minutes - a.minutes;
    return priorityDelta || a.minutes - b.minutes;
  });

  return sorted;
}

function generateRecommendedPlan() {
  const activeTasks = state.tasks.filter((task) => !task.done);
  const ordered = recommendOrder(activeTasks, energyLevel.value);

  planList.innerHTML = ordered
    .map((task, index) => {
      const breakText = index > 0 && index % 2 === 0 ? " 完成后休息 5 分钟。" : "";
      return `<li><strong>${escapeHtml(task.title)}</strong>：${task.minutes} 分钟，${priorityLabels[task.priority]}。${breakText}</li>`;
    })
    .join("");

  showToast(ordered.length ? "已生成今日冲刺顺序" : "请先添加任务");
}

function toggleTask(id) {
  state.tasks = state.tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  );
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  render();
  showToast("任务已删除");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function setPreset(minutes) {
  timer.duration = minutes * 60;
  timer.remaining = timer.duration;
  timer.running = false;
  window.clearInterval(timer.intervalId);
  presetButtons.forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.minutes) === minutes);
  });
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timer.remaining / 60);
  const seconds = timer.remaining % 60;
  timerTime.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const circumference = 2 * Math.PI * 52;
  const progress = timer.remaining / timer.duration;
  timerProgress.style.strokeDashoffset = String(circumference * (1 - progress));
}

function tickTimer() {
  if (timer.remaining <= 0) {
    window.clearInterval(timer.intervalId);
    timer.running = false;
    state.sessions += 1;
    saveState();
    renderInsights();
    showToast("专注轮次完成，休息一下");
    timer.remaining = timer.duration;
    updateTimerDisplay();
    return;
  }

  timer.remaining -= 1;
  updateTimerDisplay();
}

function exportPlan() {
  const activeTasks = recommendOrder(
    state.tasks.filter((task) => !task.done),
    energyLevel.value,
  );

  const lines = [
    "# StudySprint AI 今日计划",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    ...activeTasks.map(
      (task, index) =>
        `${index + 1}. ${task.title} - ${task.minutes} 分钟 - ${priorityLabels[task.priority]} - ${typeLabels[task.type]}`,
    ),
  ];

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => showToast("计划已复制到剪贴板"))
    .catch(() => showToast("浏览器不允许复制，请手动查看计划"));
}

function seedDemoData() {
  state.tasks = [
    createTask({ title: "完成 Vibe Coding 项目 README", minutes: 35, priority: "high", type: "writing" }),
    createTask({ title: "录制 3 分钟功能演示流程", minutes: 25, priority: "high", type: "review" }),
    createTask({ title: "复习 JavaScript DOM 操作", minutes: 45, priority: "medium", type: "coding" }),
    createTask({ title: "整理韩语课堂笔记", minutes: 30, priority: "medium", type: "reading" }),
    createTask({ title: "背诵项目介绍中文稿", minutes: 20, priority: "low", type: "memory" }),
  ];
  state.sessions = Math.max(state.sessions, 2);
  render();
  generateRecommendedPlan();
  showToast("演示数据已载入");
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.tasks.push(
    createTask({
      title: taskTitle.value.trim(),
      minutes: taskMinutes.value,
      priority: taskPriority.value,
      type: taskType.value,
    }),
  );
  taskForm.reset();
  taskMinutes.value = 30;
  taskPriority.value = "medium";
  taskType.value = "coding";
  render();
  showToast("任务已添加");
});

energyLevel.addEventListener("change", () => {
  renderCoach();
  generateRecommendedPlan();
});

generatePlan.addEventListener("click", generateRecommendedPlan);
exportButton.addEventListener("click", exportPlan);
seedDemoButton.addEventListener("click", seedDemoData);

clearDoneButton.addEventListener("click", () => {
  state.tasks = state.tasks.filter((task) => !task.done);
  render();
  showToast("已清理完成任务");
});

startTimer.addEventListener("click", () => {
  if (timer.running) return;
  timer.running = true;
  timer.intervalId = window.setInterval(tickTimer, 1000);
});

pauseTimer.addEventListener("click", () => {
  timer.running = false;
  window.clearInterval(timer.intervalId);
});

resetTimer.addEventListener("click", () => {
  timer.running = false;
  window.clearInterval(timer.intervalId);
  timer.remaining = timer.duration;
  updateTimerDisplay();
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => setPreset(Number(button.dataset.minutes)));
});

render();
updateTimerDisplay();
