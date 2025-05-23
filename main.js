// --- 游戏常量 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const TANK_SIZE = 32;
const ENEMY_SIZE = 32;
const BULLET_SIZE = 6;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1.2;
const BULLET_SPEED = 6;
const ENEMY_BULLET_SPEED = 4;
const ENEMY_SPAWN_INTERVAL = 2000; // ms
const MAX_ENEMIES = 5;

// --- 游戏状态 ---
let player = {
  x: WIDTH / 2 - TANK_SIZE / 2,
  y: HEIGHT - TANK_SIZE - 10,
  dir: 'up',
  color: '#4caf50',
  cooldown: 0
};
let bullets = [];
let enemies = [];
let enemyBullets = [];
let score = 0;
let gameOver = false;
let keys = {};
let lastEnemySpawn = 0;

// --- 工具函数 ---
function drawTank(x, y, dir, color) {
  ctx.save();
  ctx.translate(x + TANK_SIZE / 2, y + TANK_SIZE / 2);
  switch (dir) {
    case 'up': ctx.rotate(0); break;
    case 'down': ctx.rotate(Math.PI); break;
    case 'left': ctx.rotate(-Math.PI / 2); break;
    case 'right': ctx.rotate(Math.PI / 2); break;
  }
  // 履带
  ctx.fillStyle = '#444';
  ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, 8, TANK_SIZE); // 左履带
  ctx.fillRect(TANK_SIZE / 2 - 8, -TANK_SIZE / 2, 8, TANK_SIZE); // 右履带
  // 主车身
  ctx.fillStyle = color;
  ctx.fillRect(-TANK_SIZE / 2 + 8, -TANK_SIZE / 2 + 4, TANK_SIZE - 16, TANK_SIZE - 8);
  // 炮塔
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, 2 * Math.PI);
  ctx.fillStyle = (color === '#4caf50') ? '#7cffb2' : '#ffb2b2'; // 玩家/敌人炮塔高亮
  ctx.fill();
  // 炮管
  ctx.save();
  ctx.fillStyle = '#888';
  ctx.fillRect(-3, -TANK_SIZE / 2, 6, 18);
  ctx.restore();
  // 炮塔中心点
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.restore();
}

function drawBullet(b) {
  ctx.save();
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BULLET_SIZE, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

function rectsCollide(ax, ay, as, bx, by, bs) {
  return ax < bx + bs && ax + as > bx && ay < by + bs && ay + as > by;
}

// --- 玩家操作 ---
document.addEventListener('keydown', e => {
  keys[e.key] = true;
});
document.addEventListener('keyup', e => {
  keys[e.key] = false;
});

function playerMove() {
  if (gameOver) return;
  if (keys['ArrowUp'] || keys['w']) {
    player.y -= PLAYER_SPEED;
    player.dir = 'up';
  }
  if (keys['ArrowDown'] || keys['s']) {
    player.y += PLAYER_SPEED;
    player.dir = 'down';
  }
  if (keys['ArrowLeft'] || keys['a']) {
    player.x -= PLAYER_SPEED;
    player.dir = 'left';
  }
  if (keys['ArrowRight'] || keys['d']) {
    player.x += PLAYER_SPEED;
    player.dir = 'right';
  }
  // 边界限制
  player.x = Math.max(0, Math.min(WIDTH - TANK_SIZE, player.x));
  player.y = Math.max(0, Math.min(HEIGHT - TANK_SIZE, player.y));
}

function playerShoot() {
  if (gameOver) return;
  if ((keys[' '] || keys['j']) && player.cooldown <= 0) {
    let bx = player.x + TANK_SIZE / 2;
    let by = player.y + TANK_SIZE / 2;
    let dx = 0, dy = 0;
    switch (player.dir) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }
    bullets.push({ x: bx, y: by, dx, dy, color: '#fff', from: 'player' });
    player.cooldown = 18;
  }
  if (player.cooldown > 0) player.cooldown--;
}

// --- 敌人逻辑 ---
function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return;
  let x = Math.random() * (WIDTH - ENEMY_SIZE);
  let y = 10;
  let dir = ['down', 'left', 'right'][Math.floor(Math.random() * 3)];
  enemies.push({ x, y, dir, color: '#f44336', cooldown: Math.random() * 60 + 30 });
}

function moveEnemies() {
  for (let e of enemies) {
    switch (e.dir) {
      case 'down': e.y += ENEMY_SPEED; break;
      case 'left': e.x -= ENEMY_SPEED; break;
      case 'right': e.x += ENEMY_SPEED; break;
    }
    // 随机转向
    if (Math.random() < 0.01) {
      e.dir = ['down', 'left', 'right'][Math.floor(Math.random() * 3)];
    }
    // 边界反弹
    if (e.x < 0) { e.x = 0; e.dir = 'right'; }
    if (e.x > WIDTH - ENEMY_SIZE) { e.x = WIDTH - ENEMY_SIZE; e.dir = 'left'; }
    if (e.y > HEIGHT - ENEMY_SIZE) { e.y = HEIGHT - ENEMY_SIZE; e.dir = 'down'; }
    // 敌人射击
    if (e.cooldown <= 0) {
      let bx = e.x + ENEMY_SIZE / 2;
      let by = e.y + ENEMY_SIZE / 2;
      let dx = 0, dy = 0;
      switch (e.dir) {
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
      }
      enemyBullets.push({ x: bx, y: by, dx, dy, color: '#ff0', from: 'enemy' });
      e.cooldown = Math.random() * 60 + 60;
    }
    e.cooldown--;
  }
}

// --- 子弹逻辑 ---
function moveBullets() {
  for (let b of bullets) {
    b.x += b.dx * BULLET_SPEED;
    b.y += b.dy * BULLET_SPEED;
  }
  bullets = bullets.filter(b => b.x > 0 && b.x < WIDTH && b.y > 0 && b.y < HEIGHT);

  for (let b of enemyBullets) {
    b.x += b.dx * ENEMY_BULLET_SPEED;
    b.y += b.dy * ENEMY_BULLET_SPEED;
  }
  enemyBullets = enemyBullets.filter(b => b.x > 0 && b.x < WIDTH && b.y > 0 && b.y < HEIGHT);
}

// --- 碰撞检测 ---
function checkCollisions() {
  // 玩家子弹打敌人
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    if (b.from !== 'player') continue;
    for (let j = enemies.length - 1; j >= 0; j--) {
      let e = enemies[j];
      if (rectsCollide(b.x - BULLET_SIZE, b.y - BULLET_SIZE, BULLET_SIZE * 2, e.x, e.y, ENEMY_SIZE)) {
        enemies.splice(j, 1);
        bullets.splice(i, 1);
        score++;
        break;
      }
    }
  }
  // 敌人子弹打玩家
  for (let b of enemyBullets) {
    if (rectsCollide(b.x - BULLET_SIZE, b.y - BULLET_SIZE, BULLET_SIZE * 2, player.x, player.y, TANK_SIZE)) {
      endGame();
    }
  }
  // 敌人撞玩家
  for (let e of enemies) {
    if (rectsCollide(e.x, e.y, ENEMY_SIZE, player.x, player.y, TANK_SIZE)) {
      endGame();
    }
  }
}

function endGame() {
  gameOver = true;
  document.getElementById('game-over').style.display = 'block';
}

// --- 渲染 ---
function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  // 玩家
  drawTank(player.x, player.y, player.dir, player.color);
  // 敌人
  for (let e of enemies) {
    drawTank(e.x, e.y, e.dir, e.color);
  }
  // 子弹
  for (let b of bullets) drawBullet(b);
  for (let b of enemyBullets) drawBullet(b);
}

// --- 主循环 ---
function gameLoop(ts) {
  if (gameOver) return;
  playerMove();
  playerShoot();
  moveEnemies();
  moveBullets();
  checkCollisions();
  draw();
  document.getElementById('score').innerText = '得分：' + score;
  // 敌人生成
  if (!lastEnemySpawn || ts - lastEnemySpawn > ENEMY_SPAWN_INTERVAL) {
    spawnEnemy();
    lastEnemySpawn = ts;
  }
  requestAnimationFrame(gameLoop);
}

// --- 启动游戏 ---
draw();
requestAnimationFrame(gameLoop); 