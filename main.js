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
const PLAYER_MAX_HP = 5; // 玩家最大生命值
const ENEMY_MAX_HP = 2; // 敌人最大生命值

// --- 游戏状态 ---
let player = {
  x: WIDTH / 2 - TANK_SIZE / 2,
  y: HEIGHT - TANK_SIZE - 10,
  dir: 'up',
  color: '#4caf50',
  cooldown: 0,
  hp: PLAYER_MAX_HP
};
let bullets = [];
let enemies = [];
let enemyBullets = [];
let score = 0;
let gameOver = false;
let paused = false; // 新增暂停状态
let keys = {};
let lastEnemySpawn = 0;

// --- 地图相关 ---
let currentMap = 'grass';
const mapBgColors = {
  grass: '#b6e59e',
  desert: '#ffe29e',
  snow: '#e0e7ff'
};
let obstacles = [];
const OBSTACLE_SIZE = 32;
const OBSTACLE_TYPES = {
  grass: [{color: '#4caf50', shape: 'circle'}, {color: '#388e3c', shape: 'rect'}],
  desert: [{color: '#bfa14a', shape: 'rect'}, {color: '#d2b48c', shape: 'circle'}],
  snow: [{color: '#fff', shape: 'circle'}, {color: '#b0c4de', shape: 'rect'}]
};

function generateObstacles(map) {
  obstacles = [];
  let count = 8 + Math.floor(Math.random() * 5); // 每张地图8~12个障碍
  for (let i = 0; i < count; i++) {
    let type;
    if (map === 'grass') type = Math.random() < 0.5 ? 'bush' : 'tree';
    else if (map === 'desert') type = Math.random() < 0.5 ? 'rock' : 'cactus';
    else type = Math.random() < 0.5 ? 'snowpile' : 'ice';
    let x = Math.floor(Math.random() * (WIDTH - OBSTACLE_SIZE));
    let y = Math.floor(Math.random() * (HEIGHT - OBSTACLE_SIZE - 60)) + 30;
    // 避免出生点和底部区域
    if ((x > WIDTH/2-60 && x < WIDTH/2+60 && y > HEIGHT-100) || (y < 40)) { i--; continue; }
    obstacles.push({x, y, type});
  }
}

window.selectMap = function(map) {
  currentMap = map;
  document.body.classList.remove('grass-bg', 'desert-bg', 'snow-bg');
  document.body.classList.add(map + '-bg');
  document.getElementById('map-select-modal').style.display = 'none';
  generateObstacles(map);
  draw();
};

// --- 工具函数 ---
function drawTank(x, y, dir, color, hp, maxHp) {
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
  // 血条
  if (typeof hp !== 'undefined' && typeof maxHp !== 'undefined') {
    ctx.save();
    ctx.translate(-TANK_SIZE / 2, -TANK_SIZE / 2 - 12);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, TANK_SIZE, 6);
    ctx.fillStyle = '#f44336';
    ctx.fillRect(0, 0, TANK_SIZE * (hp / maxHp), 6);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(0, 0, TANK_SIZE, 6);
    ctx.restore();
  }
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

function drawObstacle(o) {
  ctx.save();
  if (currentMap === 'grass') {
    if (o.type === 'bush') {
      // 草丛：多层绿色椭圆
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#4caf50';
      ctx.beginPath(); ctx.ellipse(o.x+16, o.y+18, 16, 10, 0, 0, 2*Math.PI); ctx.fill();
      ctx.fillStyle = '#7cffb2';
      ctx.beginPath(); ctx.ellipse(o.x+20, o.y+14, 12, 8, 0, 0, 2*Math.PI); ctx.fill();
      ctx.fillStyle = '#388e3c';
      ctx.beginPath(); ctx.ellipse(o.x+12, o.y+22, 10, 7, 0, 0, 2*Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (o.type === 'tree') {
      // 树木：棕色树干+绿色树冠
      ctx.fillStyle = '#8d5524';
      ctx.fillRect(o.x+13, o.y+18, 6, 14);
      ctx.beginPath();
      ctx.arc(o.x+16, o.y+18, 12, 0, 2*Math.PI);
      ctx.fillStyle = '#388e3c';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x+10, o.y+16, 7, 0, 2*Math.PI);
      ctx.fillStyle = '#4caf50';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x+22, o.y+16, 6, 0, 2*Math.PI);
      ctx.fillStyle = '#7cffb2';
      ctx.fill();
    }
  } else if (currentMap === 'desert') {
    if (o.type === 'rock') {
      // 石头：不规则椭圆+阴影
      ctx.save();
      ctx.translate(o.x+16, o.y+20);
      ctx.rotate(0.2);
      ctx.fillStyle = '#bfa14a';
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 10, 0, 0, 2*Math.PI); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fffbe0';
      ctx.beginPath(); ctx.ellipse(-3, -3, 6, 3, 0, 0, 2*Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (o.type === 'cactus') {
      // 仙人掌：绿色主干+分支+小刺
      ctx.fillStyle = '#43a047';
      ctx.fillRect(o.x+13, o.y+8, 6, 18);
      ctx.beginPath(); ctx.arc(o.x+16, o.y+8, 6, Math.PI, 2*Math.PI); ctx.fill();
      ctx.fillRect(o.x+8, o.y+16, 5, 7);
      ctx.beginPath(); ctx.arc(o.x+10, o.y+16, 3, Math.PI, 2*Math.PI); ctx.fill();
      ctx.fillRect(o.x+19, o.y+16, 5, 7);
      ctx.beginPath(); ctx.arc(o.x+22, o.y+16, 3, Math.PI, 2*Math.PI); ctx.fill();
      // 小刺
      ctx.strokeStyle = '#e0ffb2'; ctx.lineWidth = 1;
      for(let i=0;i<6;i++) { ctx.beginPath(); ctx.moveTo(o.x+16, o.y+12+i*3); ctx.lineTo(o.x+16+Math.sin(i)*4, o.y+12+i*3+2); ctx.stroke(); }
    }
  } else if (currentMap === 'snow') {
    if (o.type === 'snowpile') {
      // 雪堆：多个白色圆叠加+淡蓝阴影
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(o.x+16, o.y+22, 10, 0, 2*Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+10, o.y+18, 7, 0, 2*Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+22, o.y+18, 6, 0, 2*Math.PI); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#b0c4de';
      ctx.beginPath(); ctx.arc(o.x+16, o.y+28, 8, 0, 2*Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (o.type === 'ice') {
      // 冰块：半透明蓝色矩形+高光
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#b0e0ff';
      ctx.fillRect(o.x+4, o.y+8, 24, 16);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e0f7fa';
      ctx.beginPath(); ctx.moveTo(o.x+8, o.y+10); ctx.lineTo(o.x+20, o.y+10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(o.x+10, o.y+20); ctx.lineTo(o.x+24, o.y+20); ctx.stroke();
    }
  }
  ctx.restore();
}

// --- 玩家操作 ---
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.code === 'Escape') togglePause(); // 只允许Esc键触发暂停
});
document.addEventListener('keyup', e => {
  keys[e.key] = false;
});

function playerMove() {
  if (gameOver || paused) return;
  let oldX = player.x, oldY = player.y;
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
  // 障碍物阻挡
  for (let o of obstacles) {
    if (rectsCollide(player.x, player.y, TANK_SIZE, o.x, o.y, OBSTACLE_SIZE)) {
      player.x = oldX;
      player.y = oldY;
      break;
    }
  }
}

function playerShoot() {
  if (gameOver || paused) return;
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
  enemies.push({ x, y, dir, color: '#f44336', cooldown: Math.random() * 60 + 30, hp: ENEMY_MAX_HP });
}

function moveEnemies() {
  if (paused) return;
  for (let e of enemies) {
    let oldX = e.x, oldY = e.y;
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
    // 障碍物阻挡
    for (let o of obstacles) {
      if (rectsCollide(e.x, e.y, ENEMY_SIZE, o.x, o.y, OBSTACLE_SIZE)) {
        e.x = oldX;
        e.y = oldY;
        e.dir = ['down', 'left', 'right'][Math.floor(Math.random() * 3)];
        break;
      }
    }
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
  if (paused) return;
  for (let b of bullets) {
    b.x += b.dx * BULLET_SPEED;
    b.y += b.dy * BULLET_SPEED;
  }
  // 子弹遇到障碍物消失
  bullets = bullets.filter(b => {
    for (let o of obstacles) {
      if (rectsCollide(b.x - BULLET_SIZE, b.y - BULLET_SIZE, BULLET_SIZE * 2, o.x, o.y, OBSTACLE_SIZE)) {
        return false;
      }
    }
    return b.x > 0 && b.x < WIDTH && b.y > 0 && b.y < HEIGHT;
  });

  for (let b of enemyBullets) {
    b.x += b.dx * ENEMY_BULLET_SPEED;
    b.y += b.dy * ENEMY_BULLET_SPEED;
  }
  enemyBullets = enemyBullets.filter(b => {
    for (let o of obstacles) {
      if (rectsCollide(b.x - BULLET_SIZE, b.y - BULLET_SIZE, BULLET_SIZE * 2, o.x, o.y, OBSTACLE_SIZE)) {
        return false;
      }
    }
    return b.x > 0 && b.x < WIDTH && b.y > 0 && b.y < HEIGHT;
  });
}

// --- 碰撞检测 ---
function checkCollisions() {
  if (paused) return;
  // 玩家子弹打敌人
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    if (b.from !== 'player') continue;
    for (let j = enemies.length - 1; j >= 0; j--) {
      let e = enemies[j];
      if (rectsCollide(b.x - BULLET_SIZE, b.y - BULLET_SIZE, BULLET_SIZE * 2, e.x, e.y, ENEMY_SIZE)) {
        e.hp--;
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          enemies.splice(j, 1);
          score++;
        }
        break;
      }
    }
  }
  // 敌人子弹打玩家
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    let b = enemyBullets[i];
    if (rectsCollide(b.x - BULLET_SIZE, b.y - BULLET_SIZE, BULLET_SIZE * 2, player.x, player.y, TANK_SIZE)) {
      player.hp--;
      enemyBullets.splice(i, 1);
      if (player.hp <= 0) {
        endGame();
      }
    }
  }
  // 敌人撞玩家
  for (let e of enemies) {
    if (rectsCollide(e.x, e.y, ENEMY_SIZE, player.x, player.y, TANK_SIZE)) {
      player.hp = 0;
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
  // 背景
  ctx.fillStyle = mapBgColors[currentMap] || '#b6e59e';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // 障碍物
  for (let o of obstacles) drawObstacle(o);
  // 玩家
  drawTank(player.x, player.y, player.dir, player.color, player.hp, PLAYER_MAX_HP);
  // 敌人
  for (let e of enemies) {
    drawTank(e.x, e.y, e.dir, e.color, e.hp, ENEMY_MAX_HP);
  }
  // 子弹
  for (let b of bullets) drawBullet(b);
  for (let b of enemyBullets) drawBullet(b);
  // 暂停提示
  if (paused && !gameOver) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, HEIGHT / 2 - 40, WIDTH, 80);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '36px 微软雅黑, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏已暂停', WIDTH / 2, HEIGHT / 2 + 12);
    ctx.restore();
  }
}

// --- 主循环 ---
function gameLoop(ts) {
  if (gameOver) return;
  if (!paused) {
    playerMove();
    playerShoot();
    moveEnemies();
    moveBullets();
    checkCollisions();
    draw();
    document.getElementById('score').innerText = '得分：' + score + '  生命：' + player.hp;
    // 敌人生成
    if (!lastEnemySpawn || ts - lastEnemySpawn > ENEMY_SPAWN_INTERVAL) {
      spawnEnemy();
      lastEnemySpawn = ts;
    }
  } else {
    draw();
  }
  requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  const btn = document.getElementById('pause-btn');
  if (btn) btn.innerText = paused ? '继续' : '暂停';
}

// --- 启动游戏 ---
draw();
requestAnimationFrame(gameLoop);

// --- 启动时弹出地图选择 ---
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('map-select-modal').style.display = 'flex';
  document.body.classList.add('grass-bg');
}); 