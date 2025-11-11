// content.js
(() => {
  const container = document.createElement('div');
  container.className = 'cf-container';
  document.documentElement.appendChild(container);

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.pointerEvents = 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const imgSrc = chrome.runtime.getURL('images/heihei.jpg');

  function spawnClickImage(x, y) {
    const img = document.createElement('img');
    img.className = 'cf-click-img';
    img.src = imgSrc;
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    container.appendChild(img);
    requestAnimationFrame(() => {
      img.style.transform = 'translate(-50%, -50%) scale(1.8)';
      img.style.opacity = '0';
    });
    setTimeout(() => img.remove(), 700);
  }

  const particles = [];
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1.2; // 调小幅度
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 50 + Math.random() * 20;
      this.age = 0;
      this.size = 1.5 + Math.random() * 1.5;
      this.color = color;
      this.alpha = 1;
    }
    step() {
      this.vy += 0.03;
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.98;
      this.vy *= 0.98;
      this.age++;
      this.alpha = Math.max(0, 1 - this.age / this.life);
      return this.age < this.life;
    }
    draw(ctx) {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function randomColor() {
    const colors = [
      '#ff3b3b', '#ff6b81', '#ff9f1c', '#ffd60a',
      '#2ecc71', '#42a5ff', '#9b59b6', '#e056fd',
      '#00fff0', '#ff7aff'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function spawnFirework(x, y) {
    const count = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i++) {
      const color = randomColor(); // 每个粒子独立颜色
      particles.push(new Particle(x, y, color));
    }
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p.step()) particles.splice(i, 1);
      else p.draw(ctx);
    }
    requestAnimationFrame(frame);
  }
  frame();

  document.addEventListener('click', (e) => {
    spawnClickImage(e.clientX, e.clientY);
    spawnFirework(e.clientX, e.clientY);
  });
})();
