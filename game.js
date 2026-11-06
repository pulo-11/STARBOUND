const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);

const W = canvas.width;
const H = canvas.height;
const ground = 300;
const STORAGE_KEY = "starbound-player-stats-v2";

let stats = loadStats();
let player, obstacles = [], coins = [], popups = [];
let score = 0, runCoins = 0, speed = 4, frame = 0;
let spawnTimer = 80, coinTimer = 95;
let running = false, paused = false, runSaved = false;
let animationId = null, combo = 0, nextComboBonus = 2;
let musicVolume = 0.35, effectsVolume = 0.65, muted = false;
let audioContext = null, musicTimer = null, musicStep = 0;
let newRecord = false;

function loadStats() {
  try {
    return {
      best: 0,
      totalCoins: 0,
      runs: 0,
      creatures: [],
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    };
  } catch {
    return { best: 0, totalCoins: 0, runs: 0, creatures: [] };
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("Could not save game stats.", error);
  }

  updateStatsDisplay();
}

function updateStatsDisplay() {
  $("home-best").textContent = stats.best;
  $("home-coins").textContent = stats.totalCoins;
  $("home-runs").textContent = stats.runs;
  $("game-best").textContent = stats.best;
}

updateStatsDisplay();

function showScreen(id) {
  ["home-screen", "game-screen"].forEach(screenId =>
    $(screenId).classList.toggle("active", screenId === id)
  );
}

function startGame() {
  cancelAnimationFrame(animationId);
  stopMusic();
  showScreen("game-screen");

  player = {
    x: 90,
    y: ground - 48,
    width: 34,
    height: 48,
    velocityY: 0,
    jumps: 0,
    dunking: false,
    dunkHit: false
  };

  obstacles = [];
  coins = [];
  popups = [];

  score = 0;
  runCoins = 0;
  speed = 4;
  frame = 0;
  spawnTimer = 70;
  coinTimer = 90;
  combo = 0;
  nextComboBonus = 2;

  running = true;
  paused = false;
  runSaved = false;
  newRecord = false;

  $("pause-overlay").classList.remove("show");
  $("game-over").classList.remove("show");
  $("sound-panel").classList.remove("show");
  $("pause-button").textContent = "Ⅱ";

  stats.runs++;
  saveStats();
  updateHUD();
  startMusic();
  draw();
}

function restartGame() {
  startGame();
}

function goHome() {
  if (running) saveRun();

  running = false;
  paused = false;

  cancelAnimationFrame(animationId);
  stopMusic();

  $("pause-overlay").classList.remove("show");
  $("game-over").classList.remove("show");
  $("sound-panel").classList.remove("show");

  showScreen("home-screen");
  updateStatsDisplay();
}

function saveRun() {
  if (runSaved) return;

  runSaved = true;

  const finalScore = Math.floor(score);
  newRecord = finalScore > stats.best;
  stats.best = Math.max(stats.best, finalScore);

  saveStats();
}

function togglePause() {
  if (!running && !paused) return;

  paused = !paused;

  $("pause-overlay").classList.toggle("show", paused);
  $("pause-button").textContent = paused ? "▶" : "Ⅱ";

  if (paused) {
    cancelAnimationFrame(animationId);
    stopMusic();
  } else {
    startMusic();
    draw();
  }
}

/* AUDIO */

function ensureAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") audioContext.resume();

  return audioContext;
}

function tone(frequency, duration = 0.12, type = "square", volume = 0.08, delay = 0) {
  const ac = ensureAudio();

  if (!ac || muted || effectsVolume <= 0) return;

  const oscillator = ac.createOscillator();
  const gain = ac.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ac.currentTime + delay);

  gain.gain.setValueAtTime(0.0001, ac.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, volume * effectsVolume),
    ac.currentTime + delay + 0.012
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ac.currentTime + delay + duration
  );

  oscillator.connect(gain);
  gain.connect(ac.destination);

  oscillator.start(ac.currentTime + delay);
  oscillator.stop(ac.currentTime + delay + duration + 0.02);
}

function sfx(kind) {
  if (kind === "jump") tone(390, .09, "square", .045);

  if (kind === "double") {
    tone(520, .09, "triangle", .05);
    tone(720, .12, "triangle", .04, .07);
  }

  if (kind === "coin") {
    tone(880, .07, "sine", .05);
    tone(1175, .09, "sine", .04, .06);
  }

  if (kind === "dunk") {
    tone(250, .13, "triangle", .07);
    tone(150, .12, "square", .035, .08);
  }

  if (kind === "bonus") {
    tone(660, .12, "sine", .05);
    tone(880, .16, "sine", .05, .1);
  }

  if (kind === "hit") tone(240, .18, "triangle", .04);

  if (kind === "record") {
    tone(523, .12, "sine", .05);
    tone(659, .12, "sine", .05, .12);
    tone(784, .2, "sine", .05, .24);
  }
}

const melody = [
  392, 494, 587, 494, 440, 523, 659, 523,
  349, 440, 523, 440, 392, 494, 587, 659
];

function musicNote() {
  const ac = ensureAudio();

  if (!ac || muted || musicVolume <= 0 || paused || !running) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "triangle";
  osc.frequency.value = melody[musicStep % melody.length];

  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.025 * musicVolume, ac.currentTime + .04);
  gain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + .42);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start();
  osc.stop(ac.currentTime + .44);

  musicStep++;
}

function startMusic() {
  if (musicTimer || muted || musicVolume <= 0 || !running || paused) return;

  ensureAudio();
  musicNote();

  musicTimer = setInterval(musicNote, 470);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function toggleSoundPanel() {
  $("sound-panel").classList.toggle("show");
}

function toggleMute() {
  muted = !muted;

  $("mute-button").textContent = muted ? "UNMUTE" : "MUTE ALL";

  if (muted) stopMusic();
  else startMusic();
}

$("music-volume").addEventListener("input", event => {
  musicVolume = Number(event.target.value) / 100;

  if (musicVolume === 0) stopMusic();
  else startMusic();
});

$("effects-volume").addEventListener("input", event => {
  effectsVolume = Number(event.target.value) / 100;
});

/* CONTROLS */

function jump() {
  if (!running || paused || !player) return;

  if (player.jumps < 2) {
    player.velocityY = player.jumps === 0 ? -7.5 : -11;
    player.jumps++;
    player.dunking = false;

    sfx(player.jumps === 1 ? "jump" : "double");

    if (player.jumps === 2) {
      addPopup("DOUBLE JUMP!", player.x + 8, player.y - 10, "#fff0b7");
    }
  }
}

function skyDunk() {
  if (!running || paused || !player) return;

  if (player.jumps === 0 || player.y >= ground - player.height - 2) return;

  player.dunking = true;
  player.velocityY = 13;

  sfx("dunk");
}

document.addEventListener("keydown", event => {
  if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Space" || event.code === "ArrowUp") jump();

  if (event.code === "ArrowDown" || event.code === "KeyS") skyDunk();

  if (event.code === "KeyP" || event.code === "Escape") {
    if (running || paused) togglePause();
  }
});

$("jump-button").addEventListener("pointerdown", event => {
  event.preventDefault();
  jump();
});

$("dunk-button").addEventListener("pointerdown", event => {
  event.preventDefault();
  skyDunk();
});

canvas.addEventListener("pointerdown", event => {
  if (!running || paused) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;

  if (x > rect.width * .68) skyDunk();
  else jump();
});

/* SCORE AND POPUPS */

function addPopup(text, x, y, color = "#fff0b7") {
  popups.push({ text, x, y, life: 52, color });
}

function updateHUD() {
  $("score").textContent = Math.floor(score);
  $("coins").textContent = runCoins;
  $("run-coins").textContent = runCoins;
  $("game-best").textContent = stats.best;

  $("difficulty-label").textContent =
    score < 100 ? "EASY" :
    score < 300 ? "WARMING UP" :
    score < 600 ? "QUICK" : "EXPERT";
}

/* BACKGROUND */

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);

  sky.addColorStop(0, "#9885bd");
  sky.addColorStop(1, "#d9a8c9");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff0c7";

  for (let i = 0; i < 13; i++) {
    const x = (i * 137 + 40) % W;
    const y = 34 + (i * 61) % 125;

    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = "#e8c9e6";

  for (let i = 0; i < 4; i++) {
    const x = ((i * 260 - frame * .18) % 1000 + 1000) % 1000;

    ctx.fillRect(x, 190 + (i % 2) * 20, 58, 10);
    ctx.fillRect(x + 13, 182 + (i % 2) * 20, 32, 10);
  }

  // Plain ground: no moving stripes or road markings.
  ctx.fillStyle = "#49365e";
  ctx.fillRect(0, ground, W, H - ground);

  ctx.fillStyle = "#91b991";
  ctx.fillRect(0, ground, W, 6);
}

/* PLAYER */

function drawBoy() {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const runFrame = Math.floor(frame / 8) % 2;

  // Backpack
  ctx.fillStyle = "#70458f";
  ctx.fillRect(x - 5, y + 24, 10, 17);

  ctx.fillStyle = "#bd83c9";
  ctx.fillRect(x - 4, y + 27, 7, 8);

  // Hair and face
  ctx.fillStyle = "#49302b";
  ctx.fillRect(x + 5, y + 1, 25, 9);
  ctx.fillRect(x + 3, y + 7, 7, 8);
  ctx.fillRect(x + 23, y + 5, 8, 5);

  ctx.fillStyle = "#f2bd8d";
  ctx.fillRect(x + 7, y + 9, 22, 16);

  // Hair fringe
  ctx.fillStyle = "#49302b";
  ctx.fillRect(x + 7, y + 8, 8, 4);
  ctx.fillRect(x + 19, y + 8, 8, 3);

  // Eyes and smile
  ctx.fillStyle = "#382b3b";
  ctx.fillRect(x + 13, y + 15, 2, 3);
  ctx.fillRect(x + 23, y + 15, 2, 3);

  ctx.fillStyle = "#a65d68";
  ctx.fillRect(x + 18, y + 21, 5, 1);

  // Purple jacket
  ctx.fillStyle = "#7952a5";
  ctx.fillRect(x + 5, y + 25, 26, 17);

  ctx.fillStyle = "#b99ad8";
  ctx.fillRect(x + 17, y + 27, 2, 12);

  // Scarf
  ctx.fillStyle = "#e99bc9";
  ctx.fillRect(x + 5, y + 23, 25, 5);
  ctx.fillRect(x + 25, y + 26, 5, 9);

  // Arms
  ctx.fillStyle = "#f2bd8d";
  ctx.fillRect(x + 1, y + 29, 5, 9);
  ctx.fillRect(x + 30, y + 29, 5, 9);

  // Trousers and boots
  ctx.fillStyle = "#39466e";

  if (player.dunking) {
    ctx.fillRect(x + 7, y + 39, 8, 8);
    ctx.fillRect(x + 21, y + 39, 8, 8);
  } else if (player.jumps > 0) {
    ctx.fillRect(x + 7, y + 41, 9, 7);
    ctx.fillRect(x + 21, y + 41, 9, 7);
  } else if (runFrame === 0) {
    ctx.fillRect(x + 7, y + 41, 8, 7);
    ctx.fillRect(x + 21, y + 41, 8, 5);
  } else {
    ctx.fillRect(x + 7, y + 41, 8, 5);
    ctx.fillRect(x + 21, y + 41, 8, 7);
  }

  ctx.fillStyle = "#f3d58d";
  ctx.fillRect(x + 4, y + 46, 12, 3);
  ctx.fillRect(x + 19, y + 46, 12, 3);
}

/* OBSTACLES AND CREATURES */

function chooseObstacleType() {
  const available = ["rock", "bush"];

  if (score >= 20) available.push("slime");
  if (score >= 55) available.push("flyer");
  if (score >= 120) available.push("tower");

  return available[Math.floor(Math.random() * available.length)];
}

function createObstacle() {
  const type = chooseObstacleType();

  const obstacle = {
    type,
    x: W + 20,
    y: ground - 30,
    width: 32,
    height: 30,
    phase: Math.random() * 6,
    passed: false
  };

  if (type === "bush") {
    obstacle.width = 40;
    obstacle.height = 28;
    obstacle.y = ground - 28;
  }

  if (type === "slime") {
    obstacle.width = 34;
    obstacle.height = 25;
    obstacle.y = ground - 25;
  }

  if (type === "flyer") {
    obstacle.width = 30;
    obstacle.height = 28;
    obstacle.y = ground - 28;
  }

  if (type === "tower") {
    obstacle.width = 36;
    obstacle.height = 48;
    obstacle.y = ground - 48;
  }

  obstacles.push(obstacle);
}

function drawObstacles() {
  obstacles.forEach(o => {
    const x = Math.round(o.x);

    const y = Math.round(
      o.y + (o.type === "slime" ? Math.sin(frame * .12 + o.phase) * 2 : 0)
    );

    if (o.type === "rock") {
      ctx.fillStyle = "#554666";
      ctx.fillRect(x + 4, y + 9, 25, 21);
      ctx.fillRect(x + 9, y + 1, 17, 13);

      ctx.fillStyle = "#a995bd";
      ctx.fillRect(x + 11, y + 7, 7, 4);
    }

    else if (o.type === "bush") {
      ctx.fillStyle = "#41675d";
      ctx.fillRect(x, y + 11, 40, 17);
      ctx.fillRect(x + 5, y + 2, 14, 17);
      ctx.fillRect(x + 22, y + 5, 13, 14);

      ctx.fillStyle = "#9bc69b";
      ctx.fillRect(x + 9, y + 6, 5, 4);
      ctx.fillRect(x + 27, y + 9, 4, 3);
    }

    else if (o.type === "slime") {
      ctx.fillStyle = "#875caf";
      ctx.fillRect(x + 3, y + 9, 28, 16);
      ctx.fillRect(x + 8, y + 3, 18, 9);

      ctx.fillStyle = "#fff4fc";
      ctx.fillRect(x + 10, y + 12, 4, 4);
      ctx.fillRect(x + 22, y + 12, 4, 4);

      ctx.fillStyle = "#49365e";
      ctx.fillRect(x + 11, y + 13, 2, 3);
      ctx.fillRect(x + 23, y + 13, 2, 3);
    }

    else if (o.type === "flyer") {
      ctx.fillStyle = "#7662a5";
      ctx.fillRect(x + 8, y + 7, 15, 16);
      ctx.fillRect(x + 3, y + 2, 8, 9);
      ctx.fillRect(x + 21, y + 2, 8, 9);

      ctx.fillStyle = "#fff0ad";
      ctx.fillRect(x + 11, y + 12, 3, 3);
      ctx.fillRect(x + 18, y + 12, 3, 3);

      ctx.fillStyle = "#d9b7e9";
      ctx.fillRect(x + 13, y + 21, 7, 4);
    }

    else if (o.type === "tower") {
      ctx.fillStyle = "#59466f";
      ctx.fillRect(x + 5, y + 8, 26, 40);
      ctx.fillRect(x + 10, y + 2, 16, 8);
      ctx.fillRect(x + 14, y - 4, 8, 8);

      ctx.fillStyle = "#a995bd";
      ctx.fillRect(x + 10, y + 14, 5, 5);
      ctx.fillRect(x + 21, y + 26, 5, 5);

      ctx.fillStyle = "#e4c8ef";
      ctx.fillRect(x + 16, y + 11, 4, 22);
    }
  });
}

/* COINS */

function createCoin() {
  coins.push({
    x: W + 10,
    y: ground - 72 - Math.random() * 75,
    radius: 8
  });
}

function drawCoins() {
  coins.forEach(c => {
    ctx.fillStyle = "#f7d77f";
    ctx.fillRect(Math.round(c.x - 6), Math.round(c.y - 8), 12, 16);

    ctx.fillStyle = "#fff0b7";
    ctx.fillRect(Math.round(c.x - 2), Math.round(c.y - 5), 4, 10);
  });
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function defeatCreature(obstacle, index) {
  const name = obstacle.type === "slime" ? "MOCHI SLIME" : "GLOW MOTH";

  obstacles.splice(index, 1);
  score += 25;
  combo++;

  const id = obstacle.type;

  if (!stats.creatures.includes(id)) {
    stats.creatures.push(id);
    saveStats();
    addPopup("NEW CREATURE!", player.x + 5, player.y - 24, "#fff0b7");
  }

  addPopup(`${name} +25`, player.x + 8, player.y - 5, "#fff0b7");

  if (combo >= nextComboBonus) {
    const bonus = combo >= 4 ? 50 : 25;

    score += bonus;

    addPopup(`COMBO x${combo}  +${bonus}`, 390, 75, "#ffe89b");

    nextComboBonus = combo + 2;
    sfx("bonus");
  } else {
    sfx("hit");
  }

  updateHUD();
}

/* GAME UPDATE */

function update() {
  frame++;

  player.velocityY += player.dunking ? .9 : .62;
  player.y += player.velocityY;

  if (player.y >= ground - player.height) {
    player.y = ground - player.height;
    player.velocityY = 0;
    player.jumps = 0;
    player.dunking = false;
    player.dunkHit = false;
  }

  speed = Math.min(4 + score / 230, 8.5);

  spawnTimer--;

  if (spawnTimer <= 0) {
    createObstacle();

    const delay = Math.max(66, 132 - score / 15);
    spawnTimer = delay + Math.random() * 35;
  }

  obstacles.forEach(o => {
    o.x -= speed;
  });

  obstacles = obstacles.filter(o => o.x > -60);

  coinTimer--;

  if (coinTimer <= 0) {
    createCoin();
    coinTimer = 95 + Math.random() * 65;
  }

  coins.forEach(c => {
    c.x -= speed;
  });

  coins = coins.filter(c => c.x > -25);

  const playerBox = {
    x: player.x + 5,
    y: player.y + 5,
    width: player.width - 10,
    height: player.height - 7
  };

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];

    const box = {
      x: o.x + 3,
      y: o.y + 3,
      width: o.width - 6,
      height: o.height - 5
    };

    if (overlaps(playerBox, box)) {
      if (player.dunking && (o.type === "slime" || o.type === "flyer")) {
        defeatCreature(o, i);
        continue;
      }

      combo = 0;
      endGame();
      return;
    }
  }

  coins = coins.filter(c => {
    const coinBox = {
      x: c.x - 8,
      y: c.y - 8,
      width: 16,
      height: 16
    };

    if (overlaps(playerBox, coinBox)) {
      runCoins++;
      stats.totalCoins++;
      score += 5;

      addPopup("+5", c.x, c.y - 10, "#fff0b7");
      sfx("coin");
      saveStats();

      return false;
    }

    return true;
  });

  score += .12;

  popups.forEach(p => {
    p.y -= .35;
    p.life--;
  });

  popups = popups.filter(p => p.life > 0);

  updateHUD();
}

/* DRAWING */

function drawPopups() {
  ctx.save();
  ctx.font = "bold 13px Nunito, sans-serif";
  ctx.textAlign = "center";

  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 12);

    ctx.fillStyle = "#49365e";
    ctx.fillText(p.text, p.x + 1, p.y + 1);

    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  });

  ctx.restore();
}

function draw() {
  if (!running || paused) return;

  update();

  drawBackground();
  drawCoins();
  drawObstacles();
  drawBoy();
  drawPopups();

  if (running && !paused) {
    animationId = requestAnimationFrame(draw);
  }
}

function endGame() {
  running = false;

  cancelAnimationFrame(animationId);
  stopMusic();
  sfx("hit");

  saveRun();

  $("final-score").textContent = Math.floor(score);
  $("final-coins").textContent = runCoins;
  $("final-best").textContent = stats.best;

  $("record-message").textContent =
    newRecord && Math.floor(score) > 0 ? "NEW PERSONAL BEST!" : "";

  $("game-over").classList.add("show");

  if (newRecord) sfx("record");
}

function updateSoundButton() {
  $("mute-button").textContent = muted ? "UNMUTE" : "MUTE ALL";
}

updateSoundButton();
