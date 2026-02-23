const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const TARGET_LINES = 40;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const COLORS = {
  I: "#33d4ff",
  O: "#f8db46",
  T: "#ae7bff",
  S: "#62dc72",
  Z: "#ff5f67",
  J: "#6086ff",
  L: "#ffa24a",
};

const DEFAULT_CONFIG = {
  das: 110,
  arr: 20,
  sdf: 20,
  are: 0,
  keyLeft: "ArrowLeft",
  keyRight: "ArrowRight",
  keySoft: "ArrowDown",
  keyHard: " ",
  keyCw: "ArrowUp",
  keyCcw: "z",
  keyHold: "c",
};

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");

const linesEl = document.getElementById("lines");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const timeEl = document.getElementById("time");
const messageEl = document.getElementById("message");

const configInputs = {
  das: document.getElementById("das"),
  arr: document.getElementById("arr"),
  sdf: document.getElementById("sdf"),
  are: document.getElementById("are"),
  keyLeft: document.getElementById("keyLeft"),
  keyRight: document.getElementById("keyRight"),
  keySoft: document.getElementById("keySoft"),
  keyHard: document.getElementById("keyHard"),
  keyCw: document.getElementById("keyCw"),
  keyCcw: document.getElementById("keyCcw"),
  keyHold: document.getElementById("keyHold"),
};

let config = { ...DEFAULT_CONFIG };
let board;
let bag;
let queue;
let current;
let hold = null;
let holdLocked = false;
let lines = 0;
let score = 0;
let level = 1;
let running = false;
let paused = false;
let gameOver = false;
let lastDrop = 0;
let startTime = 0;
let timerId;
let lockDelayUntil = 0;
let movement = {
  leftHeld: false,
  rightHeld: false,
  leftPressedAt: 0,
  rightPressedAt: 0,
  leftLastShift: 0,
  rightLastShift: 0,
};

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function loadConfig() {
  const saved = localStorage.getItem("tetrio-practice-config");
  if (!saved) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  const next = {
    das: Number(configInputs.das.value),
    arr: Number(configInputs.arr.value),
    sdf: Number(configInputs.sdf.value),
    are: Number(configInputs.are.value),
    keyLeft: configInputs.keyLeft.value || DEFAULT_CONFIG.keyLeft,
    keyRight: configInputs.keyRight.value || DEFAULT_CONFIG.keyRight,
    keySoft: configInputs.keySoft.value || DEFAULT_CONFIG.keySoft,
    keyHard: configInputs.keyHard.value || DEFAULT_CONFIG.keyHard,
    keyCw: configInputs.keyCw.value || DEFAULT_CONFIG.keyCw,
    keyCcw: configInputs.keyCcw.value || DEFAULT_CONFIG.keyCcw,
    keyHold: configInputs.keyHold.value || DEFAULT_CONFIG.keyHold,
  };
  config = { ...DEFAULT_CONFIG, ...next };
  localStorage.setItem("tetrio-practice-config", JSON.stringify(config));
  messageEl.textContent = "Configを保存しました";
}

function reflectConfigToForm() {
  Object.entries(config).forEach(([k, v]) => {
    if (configInputs[k]) configInputs[k].value = String(v);
  });
}

function normalizeKey(k) {
  return k === "Space" ? " " : k;
}

function keyMatches(actual, configured) {
  const a = normalizeKey(actual);
  const b = normalizeKey(configured);
  return a.toLowerCase() === b.toLowerCase();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function refillBag() {
  bag = shuffle(["I", "O", "T", "S", "Z", "J", "L"]);
}

function popPieceType() {
  if (!bag || bag.length === 0) refillBag();
  return bag.pop();
}

function toPiece(type) {
  return {
    type,
    shape: SHAPES[type].map((row) => [...row]),
    x: Math.floor(COLS / 2) - 2,
    y: 0,
  };
}

function ensureQueue() {
  while (queue.length < 5) queue.push(popPieceType());
}

function spawn() {
  ensureQueue();
  current = toPiece(queue.shift());
  holdLocked = false;
  ensureQueue();
  lockDelayUntil = 0;
  if (collision(current.x, current.y, current.shape)) {
    gameOver = true;
    running = false;
    messageEl.textContent = "Game Over";
  }
}

function rotate(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) rotated[x][rows - 1 - y] = shape[y][x];
  }
  return rotated;
}

function collision(nx, ny, shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const bx = nx + x;
      const by = ny + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

function lockPiece() {
  for (let y = 0; y < current.shape.length; y++) {
    for (let x = 0; x < current.shape[y].length; x++) {
      if (!current.shape[y][x]) continue;
      const by = current.y + y;
      const bx = current.x + x;
      if (by >= 0) board[by][bx] = current.type;
    }
  }

  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++;
    }
  }

  if (cleared) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    level = Math.floor(lines / 10) + 1;
    updateStatus();
  }

  if (lines >= TARGET_LINES) {
    running = false;
    const elapsed = formatTime((Date.now() - startTime) / 1000);
    messageEl.textContent = `クリア! 40Lタイム: ${elapsed}`;
    return;
  }

  setTimeout(spawn, Math.max(0, Number(config.are)));
}

function hardDrop() {
  while (!collision(current.x, current.y + 1, current.shape)) {
    current.y++;
    score += 2;
  }
  lockPiece();
  updateStatus();
}

function move(dx, dy) {
  if (collision(current.x + dx, current.y + dy, current.shape)) {
    if (dy === 1) {
      if (!lockDelayUntil) lockDelayUntil = performance.now() + 500;
      else if (performance.now() >= lockDelayUntil) lockPiece();
    }
    return false;
  }
  if (dy === 1) lockDelayUntil = 0;
  current.x += dx;
  current.y += dy;
  return true;
}

function holdPiece() {
  if (holdLocked) return;
  holdLocked = true;
  if (!hold) {
    hold = current.type;
    spawn();
  } else {
    const tmp = hold;
    hold = current.type;
    current = toPiece(tmp);
    if (collision(current.x, current.y, current.shape)) {
      gameOver = true;
      running = false;
      messageEl.textContent = "Game Over";
    }
  }
}

function ghostY() {
  let y = current.y;
  while (!collision(current.x, y + 1, current.shape)) y++;
  return y;
}

function drawCell(ctx, x, y, color, size = BLOCK) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size - 1, size - 1);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawCell(boardCtx, x, y, COLORS[board[y][x]]);
    }
  }

  const gy = ghostY();
  for (let y = 0; y < current.shape.length; y++) {
    for (let x = 0; x < current.shape[y].length; x++) {
      if (!current.shape[y][x]) continue;
      const gx = current.x + x;
      if (gy + y >= 0) {
        boardCtx.fillStyle = "rgba(255,255,255,0.15)";
        boardCtx.fillRect(gx * BLOCK, (gy + y) * BLOCK, BLOCK - 1, BLOCK - 1);
      }
    }
  }

  for (let y = 0; y < current.shape.length; y++) {
    for (let x = 0; x < current.shape[y].length; x++) {
      if (!current.shape[y][x]) continue;
      const by = current.y + y;
      if (by >= 0) drawCell(boardCtx, current.x + x, by, COLORS[current.type]);
    }
  }
}

function drawMini(canvasCtx, pieceType, offsetY = 0) {
  canvasCtx.clearRect(0, offsetY, 120, 60);
  if (!pieceType) return;
  const shape = SHAPES[pieceType];
  const size = 24;
  const offX = (120 - shape[0].length * size) / 2;
  const offYY = offsetY + (60 - shape.length * size) / 2;
  canvasCtx.fillStyle = COLORS[pieceType];
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      canvasCtx.fillRect(offX + x * size, offYY + y * size, size - 1, size - 1);
    }
  }
}

function drawSidebar() {
  nextCtx.clearRect(0, 0, 120, 240);
  for (let i = 0; i < 4; i++) drawMini(nextCtx, queue[i], i * 60);

  holdCtx.clearRect(0, 0, 120, 120);
  drawMini(holdCtx, hold, 30);
}

function dropInterval() {
  return Math.max(70, 800 - (level - 1) * 65);
}

function updateStatus() {
  linesEl.textContent = String(lines);
  scoreEl.textContent = String(score);
  levelEl.textContent = String(level);
}

function formatTime(totalSeconds) {
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!running || paused) return;
    timeEl.textContent = formatTime((Date.now() - startTime) / 1000);
  }, 250);
}

function handleAutoShift(now) {
  if (movement.leftHeld) {
    const arr = Math.max(0, Number(config.arr));
    if (now - movement.leftPressedAt >= Number(config.das)) {
      if (arr === 0) {
        while (move(-1, 0));
      } else if (now - movement.leftLastShift >= arr) {
        move(-1, 0);
        movement.leftLastShift = now;
      }
    }
  }

  if (movement.rightHeld) {
    const arr = Math.max(0, Number(config.arr));
    if (now - movement.rightPressedAt >= Number(config.das)) {
      if (arr === 0) {
        while (move(1, 0));
      } else if (now - movement.rightLastShift >= arr) {
        move(1, 0);
        movement.rightLastShift = now;
      }
    }
  }
}

function loop(ts) {
  if (running && !paused && !gameOver) {
    handleAutoShift(ts);
    if (ts - lastDrop > dropInterval()) {
      move(0, 1);
      lastDrop = ts;
    }
    drawBoard();
    drawSidebar();
  }
  requestAnimationFrame(loop);
}

function reset() {
  board = createBoard();
  bag = [];
  queue = [];
  hold = null;
  lines = 0;
  score = 0;
  level = 1;
  running = false;
  paused = false;
  gameOver = false;
  startTime = Date.now();
  lastDrop = 0;
  lockDelayUntil = 0;
  messageEl.textContent = "";
  updateStatus();
  timeEl.textContent = "00:00";
  spawn();
  drawBoard();
  drawSidebar();
}


function handleAction(action) {
  if (!running || paused || gameOver) return;
  if (action === "left") move(-1, 0);
  if (action === "right") move(1, 0);
  if (action === "down") {
    const repeats = Math.max(1, Number(config.sdf));
    for (let i = 0; i < repeats; i++) {
      if (!move(0, 1)) break;
      score += 1;
    }
  }
  if (action === "hard") hardDrop();
  if (action === "cw") {
    const rotated = rotate(current.shape);
    if (!collision(current.x, current.y, rotated)) current.shape = rotated;
  }
  if (action === "ccw") {
    let rev = current.shape;
    rev = rotate(rotate(rotate(rev)));
    if (!collision(current.x, current.y, rev)) current.shape = rev;
  }
  if (action === "hold") holdPiece();
  updateStatus();
  drawBoard();
  drawSidebar();
}

function startGame() {
  if (gameOver || lines >= TARGET_LINES) reset();
  running = true;
  paused = false;
  startTime = Date.now();
  messageEl.textContent = "";
  startTimer();
}

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("pauseBtn").addEventListener("click", () => {
  if (!running) return;
  paused = !paused;
});
document.getElementById("resetBtn").addEventListener("click", reset);
document.getElementById("saveConfigBtn").addEventListener("click", saveConfig);
document.getElementById("resetConfigBtn").addEventListener("click", () => {
  config = { ...DEFAULT_CONFIG };
  reflectConfigToForm();
  localStorage.removeItem("tetrio-practice-config");
  messageEl.textContent = "Configを初期化しました";
});

document.addEventListener("keydown", (e) => {
  if (!running || paused || gameOver) return;

  if (keyMatches(e.key, config.keyLeft)) {
    if (!movement.leftHeld) {
      move(-1, 0);
      movement.leftHeld = true;
      movement.leftPressedAt = performance.now();
      movement.leftLastShift = performance.now();
    }
  }

  if (keyMatches(e.key, config.keyRight)) {
    if (!movement.rightHeld) {
      move(1, 0);
      movement.rightHeld = true;
      movement.rightPressedAt = performance.now();
      movement.rightLastShift = performance.now();
    }
  }

  if (keyMatches(e.key, config.keySoft)) handleAction("down");
  if (keyMatches(e.key, config.keyHard)) handleAction("hard");
  if (keyMatches(e.key, config.keyCw)) handleAction("cw");
  if (keyMatches(e.key, config.keyCcw)) handleAction("ccw");
  if (keyMatches(e.key, config.keyHold)) handleAction("hold");
});

document.addEventListener("keyup", (e) => {
  if (keyMatches(e.key, config.keyLeft)) movement.leftHeld = false;
  if (keyMatches(e.key, config.keyRight)) movement.rightHeld = false;
});


document.querySelectorAll(".touch-btn").forEach((btn) => {
  const action = btn.dataset.action;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleAction(action);
  });
});

config = loadConfig();
reflectConfigToForm();
reset();
requestAnimationFrame(loop);
