
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);
const W = canvas.width;
const H = canvas.height;

const ui = {
  start: $("startScreen"),
  pause: $("pauseScreen"),
  upgrade: $("upgradeScreen"),
  over: $("gameOverScreen"),
  score: $("score"),
  crystals: $("crystals"),
  wave: $("wave"),
  health: $("healthFill"),
  healthText: $("healthText"),
  best: $("bestScore"),
  mission: $("missionFill"),
  missionText: $("missionText"),
  objective: $("objective"),
  coords: $("coords"),
  sector: $("sectorLabel"),
  rank: $("rank"),
  finalStats: $("finalStats"),
  toast: $("toast")
};

const colors = {
  cyan: "#53f5ff",
  pink: "#ff53c8",
  purple: "#9875ff",
  green: "#54ffb2",
  yellow: "#ffe27a",
  white: "#f2f2ff"
};

let game, player, keys = {};
let shots = [], enemyShots = [], enemies = [];
let crystals = [], particles = [], stars = [], floatingTexts = [];
let obstacles = [];
let lastTime = 0;
let toastTimer = 0;
let audioContext = null;
let soundEnabled = true;
let mouse = { x: W / 2, y: H / 2, down: false };
let touchMove = null;

let best = 0;
try {
  best = Number(localStorage.getItem("neonOdysseyBest")) || 0;
} catch (_) {}
ui.best.textContent = String(best).padStart(6, "0");

function newGame() {
  game = {
    running: true,
    mode: "playing",
    score: 0,
    crystalCount: 0,
    wave: 1,
    target: 5,
    damage: 1,
    speed: 245,
    spawnClock: 0,
    fireClock: 0,
    dashClock: 0,
    dashDuration: 0,
    invulnerable: 0,
    shake: 0,
    time: 0,
    kills: 0,
    totalCrystals: 0
  };

  player = {
    x: W / 2, y: H / 2,
    r: 12,
    health: 100,
    maxHealth: 100,
    angle: 0
  };

  shots = [];
  enemyShots = [];
  enemies = [];
  crystals = [];
  particles = [];
  floatingTexts = [];
  obstacles = [];
  keys = {};
  mouse.down = false;

  makeStars();
  makeObstacles();
  spawnWave();
  hideOverlays();
  updateHUD();
}

function hideOverlays() {
  [ui.start, ui.pause, ui.upgrade, ui.over]
    .forEach(el => el.classList.remove("active"));
}

function makeStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + .2,
      alpha: Math.random() * .7 + .15,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function makeObstacles() {
  obstacles = [];
  const count = Math.min(3 + game.wave, 10);

  for (let i = 0; i < count; i++) {
    const o = {
      x: 50 + Math.random() * (W - 100),
      y: 65 + Math.random() * (H - 130),
      r: 18 + Math.random() * 15
    };

    if (Math.hypot(o.x - player.x, o.y - player.y) < 110) {
      o.x = 45 + Math.random() * (W - 90);
      o.y = 45 + Math.random() * (H - 90);
    }

    obstacles.push(o);
  }
}

function spawnWave() {
  game.target = Math.min(5 + game.wave, 12);
  game.spawnClock = 0;
  game.crystalCount = 0;
  crystals = [];
  enemies = [];
  enemyShots = [];
  shots = [];

  const enemyCount = Math.min(2 + game.wave * 2, 16);

  for (let i = 0; i < enemyCount; i++) {
    spawnEnemy();
  }

  for (let i = 0; i < game.target; i++) {
    spawnCrystal();
  }

  if (game.wave % 3 === 0) spawnEnemy(true);

  game.mode = "playing";
  ui.objective.textContent = game.wave % 3 === 0
    ? "SURVIVE THE SECTOR BOSS"
    : "COLLECT CRYSTALS & SURVIVE";
}

function randomEdgePosition() {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * W, y: 10 };
  if (side === 1) return { x: W - 10, y: Math.random() * H };
  if (side === 2) return { x: Math.random() * W, y: H - 10 };
  return { x: 10, y: Math.random() * H };
}

function spawnEnemy(boss = false) {
  let pos = randomEdgePosition();

  for (let i = 0; i < 10; i++) {
    if (Math.hypot(pos.x - player.x, pos.y - player.y) > 170) break;
    pos = randomEdgePosition();
  }

  const roll = Math.random();
  const type = boss ? "boss" :
    roll < .5 ? "drone" : roll < .78 ? "runner" : "shooter";

  const specs = {
    drone:   { r: 12, hp: 2, speed: 75, color: colors.pink, score: 150 },
    runner:  { r: 9, hp: 1, speed: 130, color: colors.yellow, score: 200 },
    shooter: { r: 14, hp: 3, speed: 48, color: colors.purple, score: 250 },
    boss:    { r: 29, hp: 14 + game.wave * 2, speed: 42,
               color: colors.pink, score: 1500 }
  };

  const s = specs[type];

  enemies.push({
    x: pos.x, y: pos.y,
    r: s.r,
    hp: s.hp,
    maxHp: s.hp,
    speed: s.speed + game.wave * 3,
    color: s.color,
    type,
    score: s.score,
    angle: 0,
    phase: Math.random() * 6,
    shootClock: 1 + Math.random() * 1.5,
    hitFlash: 0,
    dead: false
  });
}

function spawnCrystal() {
  let pos = { x: 60, y: 60 };

  for (let i = 0; i < 40; i++) {
    pos = {
      x: 30 + Math.random() * (W - 60),
      y: 35 + Math.random() * (H - 70)
    };

    const nearObstacle = obstacles.some(o =>
      Math.hypot(o.x - pos.x, o.y - pos.y) < o.r + 25
    );

    if (
      !nearObstacle &&
      Math.hypot(player.x - pos.x, player.y - pos.y) > 70
    ) break;
  }

  crystals.push({
    x: pos.x, y: pos.y,
    r: 7,
    phase: Math.random() * 6,
    taken: false
  });
}

function sound(frequency = 500, duration = .07, type = "sine") {
  if (!soundEnabled) return;

  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();

    if (audioContext.state === "suspended") audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      .001, audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (_) {}
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  toastTimer = 1.5;
}

function burst(x, y, color, count = 12, force = 150) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * force + 25;
    const life = .25 + Math.random() * .6;

    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * 3 + 1,
      color,
      life,
      maxLife: life
    });
  }
}

function floatText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: .8 });
}

function circleHitsObstacle(x, y, radius) {
  return obstacles.some(o =>
    Math.hypot(x - o.x, y - o.y) < radius + o.r
  );
}

function movePlayer(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (!length) return;

  dx /= length;
  dy /= length;

  const speed = game.speed * (game.dashDuration > 0 ? 3.1 : 1);
  const nx = Math.max(player.r, Math.min(W - player.r, player.x + dx * speed * dt));
  const ny = Math.max(player.r, Math.min(H - player.r, player.y + dy * speed * dt));

  if (!circleHitsObstacle(nx, player.y, player.r)) player.x = nx;
  if (!circleHitsObstacle(player.x, ny, player.r)) player.y = ny;

  player.angle = Math.atan2(dy, dx);
}

let dt = 0;

function update(delta) {
  if (!game || !game.running || game.mode !== "playing") return;

  dt = Math.min(delta, .033);
  game.time += dt;
  game.dashClock = Math.max(0, game.dashClock - dt);
  game.dashDuration = Math.max(0, game.dashDuration - dt);
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  game.shake = Math.max(0, game.shake - dt * 25);
  toastTimer = Math.max(0, toastTimer - dt);

  if (toastTimer === 0) ui.toast.classList.remove("show");

  let dx = 0, dy = 0;

  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;

  if (touchMove) {
    dx += touchMove.x;
    dy += touchMove.y;
  }

  movePlayer(dx, dy);

  if (mouse.down) shoot();

  for (const star of stars) {
    star.phase += dt * 1.8;
  }

  for (const c of crystals) {
    c.phase += dt * 3;

    if (!c.taken && Math.hypot(player.x - c.x, player.y - c.y) < player.r + c.r + 5) {
      c.taken = true;
      game.crystalCount++;
      game.totalCrystals++;
      game.score += 100;
      burst(c.x, c.y, colors.cyan, 16, 170);
      floatText(c.x, c.y - 12, "+100", colors.cyan);
      sound(700 + Math.random() * 300, .1);
      showToast("◆ CRYSTAL ACQUIRED +100");
    }
  }

  crystals = crystals.filter(c => !c.taken);

  for (const s of shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;

    for (const e of enemies) {
      if (e.dead || s.dead) continue;

      if (Math.hypot(s.x - e.x, s.y - e.y) < e.r + s.r) {
        s.dead = true;
        e.hp -= game.damage;
        e.hitFlash = .1;
        burst(s.x, s.y, e.color, 5, 70);

        if (e.hp <= 0) {
          e.dead = true;
          game.score += e.score;
          game.kills++;
          burst(e.x, e.y, e.color, e.type === "boss" ? 55 : 18, 220);
          floatText(e.x, e.y, "+" + e.score, colors.yellow);
          sound(e.type === "boss" ? 90 : 240, .18, "triangle");

          if (e.type === "boss") {
            for (let i = 0; i < 5; i++) spawnCrystal();
            showToast("BOSS DEFEATED! BONUS CRYSTALS!");
          }
        }
      }
    }
  }

  shots = shots.filter(s =>
    !s.dead && s.life > 0 && s.x > -10 && s.x < W + 10 &&
    s.y > -10 && s.y < H + 10
  );

  for (const e of enemies) {
    if (e.dead) continue;

    e.phase += dt * 2;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.shootClock -= dt;

    let vx = player.x - e.x;
    let vy = player.y - e.y;
    let dist = Math.hypot(vx, vy) || 1;

    e.angle = Math.atan2(vy, vx);

    if (e.type === "shooter" || e.type === "boss") {
      const desired = e.type === "boss" ? 185 : 225;

      if (dist > desired + 20) {
        vx /= dist; vy /= dist;
      } else if (dist < desired - 25) {
        vx = -vx / dist; vy = -vy / dist;
      } else {
        vx = -vy / dist * .4;
        vy = vx === 0 ? 0 : (player.x - e.x) / dist * .4;
      }

      if (e.shootClock <= 0 && dist < 440) {
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        const speed = e.type === "boss" ? 190 : 150;
        const spread = e.type === "boss" ? [-.23, 0, .23] : [0];

        for (const offset of spread) {
          enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(a + offset) * speed,
            vy: Math.sin(a + offset) * speed,
            r: e.type === "boss" ? 6 : 4,
            life: 3,
            color: e.color
          });
        }

        e.shootClock = e.type === "boss" ? .85 : 1.8;
      }
    } else {
      vx /= dist;
      vy /= dist;
    }

    const ex = e.x + vx * e.speed * dt;
    const ey = e.y + vy * e.speed * dt;

    if (!circleHitsObstacle(ex, e.y, e.r)) e.x = ex;
    if (!circleHitsObstacle(e.x, ey, e.r)) e.y = ey;

    if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r) {
      damagePlayer(e.type === "boss" ? 22 : 12);

      const knock = Math.atan2(player.y - e.y, player.x - e.x);
      player.x = Math.max(player.r, Math.min(W - player.r, player.x + Math.cos(knock) * 15));
      player.y = Math.max(player.r, Math.min(H - player.r, player.y + Math.sin(knock) * 15));
    }
  }

  enemies = enemies.filter(e => !e.dead);

  for (const s of enemyShots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;

    if (Math.hypot(s.x - player.x, s.y - player.y) < player.r + s.r) {
      s.life = 0;
      damagePlayer(9);
      burst(s.x, s.y, colors.pink, 8, 80);
    }
  }

  enemyShots = enemyShots.filter(s =>
    s.life > 0 && s.x > -20 && s.x < W + 20 &&
    s.y > -20 && s.y < H + 20
  );

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(.04, dt);
    p.vy *= Math.pow(.04, dt);
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);

  for (const f of floatingTexts) {
    f.y -= 25 * dt;
    f.life -= dt;
  }
  floatingTexts = floatingTexts.filter(f => f.life > 0);

  updateHUD();

  if (game.crystalCount >= game.target && enemies.length === 0) {
    sectorCleared();
  }
}

function shoot() {
  if (game.fireClock > 0) return;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  player.angle = angle;

  shots.push({
    x: player.x + Math.cos(angle) * 15,
    y: player.y + Math.sin(angle) * 15,
    vx: Math.cos(angle) * 550,
    vy: Math.sin(angle) * 550,
    r: 3.5,
    life: 1.1,
    dead: false
  });

  game.fireClock = .17;
  sound(330, .035, "square");
}

function damagePlayer(amount) {
  if (player.health <= 0 || game.mode !== "playing" || player.health === player.maxHealth && game.invulnerable > 0) return;
  if (game.invulnerable > 0) return;

  player.health = Math.max(0, player.health - amount);
  game.invulnerable = .65;
  game.shake = 8;
  burst(player.x, player.y, colors.pink, 12, 100);
  sound(100, .15, "sawtooth");
  updateHUD();

  if (player.health <= 0) endGame();
}

function sectorCleared() {
  game.mode = "upgrade";
  sound(550, .2);
  ui.upgrade.classList.add("active");
  showToast("SECTOR CLEARED");
}

function chooseUpgrade(type) {
  if (game.mode !== "upgrade") return;

  if (type === "speed") {
    game.speed *= 1.18;
    showToast("PHASE DRIVE UPGRADED");
  }

  if (type === "health") {
    player.health = Math.min(player.maxHealth, player.health + 35);
    showToast("HULL REPAIRED");
  }

  if (type === "power") {
    game.damage++;
    showToast("PLASMA DAMAGE INCREASED");
  }

  game.wave++;
  player.x = W / 2;
  player.y = H / 2;
  game.invulnerable = 1.5;
  makeObstacles();
  ui.upgrade.classList.remove("active");
  spawnWave();
  updateHUD();
}

function endGame() {
  game.mode = "over";
  game.running = false;

  if (game.score > best) {
    best = game.score;
    try { localStorage.setItem("neonOdysseyBest", String(best)); } catch (_) {}
  }

  ui.best.textContent = String(best).padStart(6, "0");
  ui.finalStats.textContent =
    "Score: " + game.score.toLocaleString() +
    " | Sectors cleared: " + (game.wave - 1) +
    " | Drones defeated: " + game.kills;

  ui.over.classList.add("active");
}

function updateHUD() {
  if (!game || !player) return;

  ui.score.textContent = String(game.score).padStart(6, "0");
  ui.crystals.textContent = game.crystalCount;
  ui.wave.textContent = String(game.wave).padStart(2, "0");
  ui.sector.textContent = String(game.wave).padStart(2, "0");
  ui.health.style.width = (player.health / player.maxHealth * 100) + "%";
  ui.healthText.textContent = Math.ceil(player.health) + "%";
  ui.mission.style.width = Math.min(100, game.crystalCount / game.target * 100) + "%";
  ui.missionText.textContent = game.crystalCount + " / " + game.target + " CRYSTALS COLLECTED";
  ui.coords.textContent = "X: " + Math.round(player.x) + " / Y: " + Math.round(player.y);

  if (game.wave >= 10) ui.rank.textContent = "VOID CONQUEROR";
  else if (game.wave >= 6) ui.rank.textContent = "ELITE EXPLORER";
  else if (game.wave >= 3) ui.rank.textContent = "SECTOR VETERAN";
  else ui.rank.textContent = "ROOKIE EXPLORER";

  ui.objective.textContent = game.wave % 3 === 0
    ? "DEFEAT THE BOSS & COLLECT CRYSTALS"
    : "COLLECT CRYSTALS & SURVIVE";
}

function drawBackground() {
  ctx.fillStyle = "#070816";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * .5, H * .5, 10, W * .5, H * .5, W * .7);
  glow.addColorStop(0, "#16133b");
  glow.addColorStop(1, "#070816");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#5c58a512";
  ctx.lineWidth = 1;

  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  for (const s of stars) {
    const a = s.alpha * (.65 + Math.sin(s.phase) * .35);
    ctx.fillStyle = `rgba(190,210,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObstacles() {
  for (const o of obstacles) {
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = colors.purple;
    ctx.fillStyle = "#181631";
    ctx.strokeStyle = "#7768be";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const r = o.r * (i % 2 ? .9 : 1.05);
      const x = o.x + Math.cos(a) * r;
      const y = o.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#53f5ff30";
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * .58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCrystals() {
  for (const c of crystals) {
    const r = c.r * (1 + Math.sin(c.phase) * .12);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.phase * .35);
    ctx.shadowBlur = 18;
    ctx.shadowColor = colors.cyan;
    ctx.fillStyle = colors.cyan;

    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r * 1.6);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-1, -r, 2, r * 2);
    ctx.restore();
  }
}

function drawPlayer() {
  if (player.health <= 0) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  if (game.dashDuration > 0) {
    ctx.shadowBlur = 35;
    ctx.shadowColor = colors.cyan;
    ctx.strokeStyle = colors.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, -5);
    ctx.lineTo(-65 - Math.random() * 12, 0);
    ctx.lineTo(-30, 5);
    ctx.stroke();
  }

  if (game.invulnerable > 0 && Math.floor(game.time * 18) % 2 === 0) {
    ctx.globalAlpha = .35;
  }

  ctx.shadowBlur = 20;
  ctx.shadowColor = colors.cyan;

  ctx.fillStyle = "#53f5ff";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.pink;
  ctx.beginPath();
  ctx.arc(-9, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle + Math.PI / 2);
    ctx.shadowBlur = e.type === "boss" ? 30 : 16;
    ctx.shadowColor = e.color;
    ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : "#151328";
    ctx.strokeStyle = e.color;
    ctx.lineWidth = e.type === "boss" ? 3 : 2;

    if (e.type === "runner") {
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 1.5);
      ctx.lineTo(e.r, e.r);
      ctx.lineTo(-e.r, e.r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === "boss") {
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const r = e.r * (i % 2 === 0 ? 1 : .8);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.pink;
      ctx.beginPath();
      ctx.arc(0, 0, 9 + Math.sin(game.time * 7) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * .35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (e.type === "boss" || e.hp < e.maxHp) {
      const width = e.type === "boss" ? 75 : 28;
      ctx.fillStyle = "#ffffff20";
      ctx.fillRect(e.x - width / 2, e.y - e.r - 12, width, 4);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - width / 2, e.y - e.r - 12,
        width * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
}

function drawShots() {
  for (const s of shots) {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors.cyan;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const s of enemyShots) {
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = s.color;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  for (const f of floatingTexts) {
    ctx.globalAlpha = Math.max(0, f.life / .8);
    ctx.fillStyle = f.color;
    ctx.font = "bold 13px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawRadar() {
  const rx = W - 83;
  const ry = H - 78;
  const radius = 45;

  ctx.save();
  ctx.globalAlpha = .85;
  ctx.fillStyle = "#090a1c";
  ctx.strokeStyle = "#53f5ff55";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.arc(rx, ry, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#53f5ff25";
  ctx.beginPath();
  ctx.moveTo(rx - radius, ry);
  ctx.lineTo(rx + radius, ry);
  ctx.moveTo(rx, ry - radius);
  ctx.lineTo(rx, ry + radius);
  ctx.stroke();

  function dot(x, y, color, size) {
    const dx = (x - player.x) / W * radius * 2;
    const dy = (y - player.y) / H * radius * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(rx + dx, ry + dy, size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) dot(e.x, e.y, e.type === "boss" ? colors.pink : "#ff647e", e.type === "boss" ? 4 : 2);
  for (const c of crystals) dot(c.x, c.y, colors.cyan, 2.5);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(rx, ry, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  if (!game) {
    drawBackground();
    return;
  }

  ctx.save();

  if (game.shake > 0) {
    ctx.translate(
      (Math.random() - .5) * game.shake,
      (Math.random() - .5) * game.shake
    );
  }

  drawBackground();
  drawObstacles();
  drawCrystals();
  drawShots();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawRadar();

  ctx.restore();
}

function loop(timestamp) {
  const delta = lastTime ? (timestamp - lastTime) / 1000 : 0;
  lastTime = timestamp;

  if (game && game.running) update(delta);
  render();
  requestAnimationFrame(loop);
}

function startGame() {
  newGame();
  sound(600, .15);
}

function togglePause() {
  if (!game || !game.running) return;

  if (game.mode === "playing") {
    game.mode = "paused";
    ui.pause.classList.add("active");
  } else if (game.mode === "paused") {
    game.mode = "playing";
    ui.pause.classList.remove("active");
  }
}

function dash() {
  if (!game || game.mode !== "playing" || game.dashClock > 0) return;

  game.dashClock = 2.2;
  game.dashDuration = .18;
  game.invulnerable = .25;

  let dx = 0, dy = 0;
  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;

  if (!dx && !dy) {
    dx = Math.cos(player.angle);
    dy = Math.sin(player.angle);
  }

  player.angle = Math.atan2(dy, dx);
  burst(player.x, player.y, colors.cyan, 12, 130);
  sound(180, .12, "sawtooth");
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * W / rect.width;
  mouse.y = (event.clientY - rect.top) * H / rect.height;
}

canvas.addEventListener("pointermove", pointerPosition);

canvas.addEventListener("pointerdown", event => {
  pointerPosition(event);

  if (event.pointerType === "touch") {
    canvas.setPointerCapture(event.pointerId);
    touchMove = null;
  } else {
    mouse.down = true;
    shoot();
  }
});

canvas.addEventListener("pointerup", event => {
  if (event.pointerType !== "touch") mouse.down = false;
  touchMove = null;
});

canvas.addEventListener("pointercancel", () => {
  mouse.down = false;
  touchMove = null;
});

canvas.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("keydown", event => {
  const blocked = [
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"
  ];
  if (blocked.includes(event.code)) event.preventDefault();

  if (event.repeat && ["Escape", "Space"].includes(event.code)) return;

  keys[event.code] = true;

  if (event.code === "Space") dash();
  if (event.code === "Escape") togglePause();
});

window.addEventListener("keyup", event => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  keys = {};
  mouse.down = false;
  if (game && game.mode === "playing") togglePause();
});

$("startBtn").addEventListener("click", startGame);
$("restartBtn").addEventListener("click", startGame);
$("resumeBtn").addEventListener("click", togglePause);

document.querySelectorAll("[data-upgrade]").forEach(button => {
  button.addEventListener("click", () => chooseUpgrade(button.dataset.upgrade));
});

$("soundBtn").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("soundBtn").textContent = soundEnabled ? "♫ SOUND ON" : "♫ SOUND OFF";
  if (soundEnabled) sound(700, .1);
});

window.addEventListener("resize", render);

makeStars();
drawBackground();
requestAnimationFrame(loop);
