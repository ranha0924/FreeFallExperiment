/**
 * 탭 0: 자유낙하 실험
 * 기존 자유낙하 시뮬레이터를 통합 탭으로 포팅
 */
import { PHYSICS_DT } from './constants.js';

const PLANETS = {
    earth:   { name: '지구', gravity: 9.8,   airDensity: 1.225, color: '#3b82f6' },
    moon:    { name: '달',   gravity: 1.62,  airDensity: 0,     color: '#94a3b8' },
    mars:    { name: '화성', gravity: 3.72,  airDensity: 0.020, color: '#ef4444' },
    jupiter: { name: '목성', gravity: 24.79, airDensity: 1.326, color: '#f59e0b' },
};

const FF_OBJECTS = {
    steel_ball: { name: '쇠구슬', mass: 0.028, radius: 0.01, dragCoeff: 0.47, color: '#64748b' },
    basketball: { name: '농구공', mass: 0.625, radius: 0.12, dragCoeff: 0.47, color: '#f97316' },
    feather:    { name: '깃털',   mass: 0.003, radius: 0.05, dragCoeff: 1.5, crossSectionArea: 0.005, color: '#a78bfa' },
    bowling:    { name: '볼링공', mass: 6.0,   radius: 0.109, dragCoeff: 0.47, color: '#1e293b' },
};

// ── 물리 ──
class FreeFallPhysics {
    constructor(config) {
        this.initialHeight = config.height;
        this.gravity = config.gravity;
        this.mass = config.mass;
        this.airResistance = config.airResistance;
        this.dragCoeff = config.dragCoeff;
        this.objectRadius = config.objectRadius;
        this.crossSectionArea = config.crossSectionArea || null;
        this.airDensity = config.airDensity;

        this.time = 0;
        this.velocity = 0;
        this.distanceFallen = 0;
        this.currentHeight = this.initialHeight;
        this.landed = false;
        this.dataLog = [];
    }

    getCrossSectionArea() {
        return this.crossSectionArea || (Math.PI * this.objectRadius ** 2);
    }

    update(dt) {
        if (this.landed) return;
        if (!this.airResistance) {
            this.time += dt;
            this.velocity = this.gravity * this.time;
            this.distanceFallen = 0.5 * this.gravity * this.time ** 2;
            this.currentHeight = this.initialHeight - this.distanceFallen;
        } else {
            const area = this.getCrossSectionArea();
            const b = 0.5 * this.dragCoeff * this.airDensity * area;
            const m = this.mass;
            const g = this.gravity;
            const accel = (v) => g - (b * v * Math.abs(v)) / m;

            const v1 = this.velocity, a1 = accel(v1);
            const v2 = v1 + 0.5 * dt * a1, a2 = accel(v2);
            const v3 = v1 + 0.5 * dt * a2, a3 = accel(v3);
            const v4 = v1 + dt * a3, a4 = accel(v4);

            this.velocity = Math.max(0, v1 + (dt / 6) * (a1 + 2*a2 + 2*a3 + a4));
            this.distanceFallen += (dt / 6) * (v1 + 2*v2 + 2*v3 + v4);
            this.time += dt;
            this.currentHeight = this.initialHeight - this.distanceFallen;
        }

        if (this.currentHeight <= 0) {
            this.landed = true;
            this.currentHeight = 0;
            this.distanceFallen = this.initialHeight;
            if (!this.airResistance) {
                this.time = Math.sqrt(2 * this.initialHeight / this.gravity);
                this.velocity = this.gravity * this.time;
            }
        }

        this.dataLog.push({ time: this.time, velocity: this.velocity });
    }
}

// ── 렌더러 ──
class FreeFallRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.W = 0; this.H = 0;
        this.setupResize();
        this.resize();
        requestAnimationFrame(() => { this.resize(); this.renderIdle(100); });
    }

    setupResize() {
        new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0) return;
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.W = rect.width; this.H = rect.height;
    }

    clear() {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, this.H);
        g.addColorStop(0, '#0f172a'); g.addColorStop(0.5, '#1e293b'); g.addColorStop(1, '#334155');
        ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    }

    renderIdle(height) { this.clear(); this._drawScene(height, height, '#3b82f6', false); }

    render(physics, color) {
        if (!physics) return this.renderIdle(100);
        this.clear();
        this._drawScene(physics.initialHeight, physics.currentHeight, color, physics.landed);
    }

    _drawScene(maxH, currH, color, landed) {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        const pad = { top: 40, bottom: 60, left: 60, right: 30 };
        const groundY = H - pad.bottom;
        const topY = pad.top;
        const drawH = groundY - topY;

        // 바닥
        ctx.fillStyle = '#374151';
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.strokeStyle = '#6ee7b7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

        // 높이 눈금
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
        const step = maxH <= 20 ? 5 : maxH <= 50 ? 10 : maxH <= 100 ? 20 : 50;
        for (let h = 0; h <= maxH; h += step) {
            const y = groundY - (h / maxH) * drawH;
            ctx.fillText(`${h}m`, pad.left - 8, y + 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        }

        // 물체
        const objY = groundY - (currH / maxH) * drawH;
        const objX = W / 2;
        const r = 16;

        if (landed) {
            // 착지 효과
            ctx.strokeStyle = 'rgba(110,231,183,0.4)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(objX, groundY, 25, Math.PI, 0); ctx.stroke();
        }

        const grad = ctx.createRadialGradient(objX - r * 0.3, objY - r * 0.3, 0, objX, objY, r);
        grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, color); grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(objX, objY, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    }
}

// ── 탭 컨트롤러 ──
export class FreeFallTab {
    constructor() {
        this.renderer = new FreeFallRenderer('freefall-canvas');
        this.physics = null;
        this.running = false;
        this.paused = false;
        this.animationSpeed = 1;
        this.chart = null;
        this.chartTimer = 0;
        this.bindControls();
    }

    bindControls() {
        document.getElementById('ff-start').addEventListener('click', () => this.start());
        document.getElementById('ff-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('ff-reset').addEventListener('click', () => this.reset());
        document.getElementById('ff-speed').addEventListener('change', e => { this.animationSpeed = parseFloat(e.target.value); });
        document.getElementById('ff-height').addEventListener('input', e => {
            document.getElementById('ff-height-val').textContent = e.target.value;
        });
        // 달에서 공기저항 비활성화
        document.getElementById('ff-planet').addEventListener('change', e => {
            const airToggle = document.getElementById('ff-air');
            if (e.target.value === 'moon') { airToggle.checked = false; airToggle.disabled = true; }
            else { airToggle.disabled = false; }
        });
    }

    activate() { this.renderer.resize(); this.renderer.renderIdle(parseFloat(document.getElementById('ff-height').value)); }
    deactivate() {}

    start() {
        if (this.running && !this.paused) return;
        if (this.paused) { this.togglePause(); return; }

        const height = parseFloat(document.getElementById('ff-height').value);
        const planetKey = document.getElementById('ff-planet').value;
        const objKey = document.getElementById('ff-object').value;
        const airRes = document.getElementById('ff-air').checked;
        const planet = PLANETS[planetKey];
        const obj = FF_OBJECTS[objKey];

        this.physics = new FreeFallPhysics({
            height, gravity: planet.gravity, mass: obj.mass,
            airResistance: airRes && planet.airDensity > 0,
            dragCoeff: obj.dragCoeff, objectRadius: obj.radius,
            crossSectionArea: obj.crossSectionArea, airDensity: planet.airDensity,
        });
        this.objColor = obj.color;
        this.running = true; this.paused = false; this.chartTimer = 0;

        document.getElementById('ff-start').disabled = true;
        document.getElementById('ff-pause').disabled = false;
        document.getElementById('ff-result').style.display = 'none';
        this._initChart();
        window.app.startLoop();
    }

    stop() {
        this.running = false; this.paused = false;
        document.getElementById('ff-start').disabled = false;
        document.getElementById('ff-pause').disabled = true;
        document.getElementById('ff-pause').textContent = '⏸ 일시정지';
    }

    toggleStartPause() { if (!this.running) this.start(); else this.togglePause(); }

    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;
        document.getElementById('ff-pause').textContent = this.paused ? '▶ 재개' : '⏸ 일시정지';
        if (this.paused) window.app.stopLoop(); else window.app.startLoop();
    }

    reset() {
        window.app.stopLoop();
        this.physics = null; this.running = false; this.paused = false;
        document.getElementById('ff-start').disabled = false;
        document.getElementById('ff-pause').disabled = true;
        document.getElementById('ff-pause').textContent = '⏸ 일시정지';
        document.getElementById('ff-time').textContent = '0.00 s';
        document.getElementById('ff-vel').textContent = '0.00 m/s';
        document.getElementById('ff-dist').textContent = '0.00 m';
        document.getElementById('ff-hgt').textContent = document.getElementById('ff-height').value + ' m';
        document.getElementById('ff-result').style.display = 'none';
        document.getElementById('ff-chart-section').style.display = 'none';
        if (this.chart) { this.chart.destroy(); this.chart = null; }
        this.renderer.renderIdle(parseFloat(document.getElementById('ff-height').value));
    }

    update(dt) {
        if (!this.physics || this.paused) return;
        this.physics.update(dt);
        this.chartTimer += dt;

        const ph = this.physics;
        document.getElementById('ff-time').textContent = ph.time.toFixed(2) + ' s';
        document.getElementById('ff-vel').textContent = ph.velocity.toFixed(2) + ' m/s';
        document.getElementById('ff-dist').textContent = ph.distanceFallen.toFixed(2) + ' m';
        document.getElementById('ff-hgt').textContent = Math.max(0, ph.currentHeight).toFixed(2) + ' m';

        if (this.chart && this.chartTimer >= 0.05) {
            this.chartTimer = 0;
            this.chart.data.datasets[0].data.push({ x: ph.time, y: ph.velocity });
            this.chart.update('none');
        }
    }

    render() { this.renderer.render(this.physics, this.objColor); }

    isComplete() { return this.physics && this.physics.landed; }

    onComplete() {
        this.stop();
        const ph = this.physics;
        document.getElementById('ff-result-time').textContent = ph.time.toFixed(3) + ' s';
        document.getElementById('ff-result-vel').textContent = ph.velocity.toFixed(2) + ' m/s';
        document.getElementById('ff-result').style.display = '';
    }

    _initChart() {
        if (this.chart) this.chart.destroy();
        document.getElementById('ff-chart-section').style.display = '';
        const ctx = document.getElementById('ff-chart');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{ label: '속도 (m/s)', borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, data: [], pointRadius: 0, borderWidth: 2 }] },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: { type: 'linear', title: { display: true, text: '시간 (s)', color: '#64748b' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' }, min: 0 },
                    y: { title: { display: true, text: '속도 (m/s)', color: '#64748b' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' }, beginAtZero: true }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#cbd5e1' } }
            }
        });
    }
}
