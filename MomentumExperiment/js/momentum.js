/**
 * 탭 2: 운동량 실험 — 당구공 충돌
 * 물리 엔진 + Canvas 렌더러 + UI 컨트롤러 + 차트
 */
import { G, BALL_B_MASS, FRICTION_COEFF, MOMENTUM_PRESETS } from './constants.js';

// ── 물리 ──
class MomentumPhysics {
    constructor(massA, velA) {
        this.massA = massA;
        this.massB = BALL_B_MASS;
        this.velA0 = velA;

        // 1D 완전탄성충돌 결과
        this.velA_after = ((massA - this.massB) * velA) / (massA + this.massB);
        this.velB_after = (2 * massA * velA) / (massA + this.massB);

        // 마찰에 의한 굴러간 거리
        this.rollDistB = (this.velB_after ** 2) / (2 * FRICTION_COEFF * G);
        this.rollDistA = (Math.abs(this.velA_after) ** 2) / (2 * FRICTION_COEFF * G);

        this.momentumA = massA * velA;

        // 애니메이션 상태
        this.time = 0;
        this.phase = 'approach'; // approach → collision → roll → done
        this.collisionFlash = 0;

        // 당구대 좌표 (m 단위)
        this.tableLength = 3.0; // 논리 테이블 길이
        this.ballAx = 0.3;
        this.ballBx = 1.8;
        this.ballBx0 = 1.8;
        this.ballAx0 = 0.3;

        this.currentVelA = velA;
        this.currentVelB = 0;
        this.ballBRolled = 0;

        this.done = false;

        // 접근 시간 계산
        this.approachDist = this.ballBx - this.ballAx - 0.05;
        this.approachTime = this.approachDist / velA;
    }

    update(dt) {
        if (this.done) return;
        this.time += dt;

        if (this.phase === 'approach') {
            this.ballAx += this.currentVelA * dt;
            if (this.ballAx >= this.ballBx - 0.05) {
                this.ballAx = this.ballBx - 0.05;
                this.phase = 'collision';
                this.collisionFlash = 1.0;
                this.currentVelA = this.velA_after;
                this.currentVelB = this.velB_after;
            }
        } else if (this.phase === 'collision') {
            this.collisionFlash -= dt * 4;
            if (this.collisionFlash <= 0) {
                this.collisionFlash = 0;
                this.phase = 'roll';
            }
            // 충돌 순간에도 공 이동
            this._moveRoll(dt);
        } else if (this.phase === 'roll') {
            this._moveRoll(dt);

            // 둘 다 멈추면 완료
            if (Math.abs(this.currentVelA) < 0.01 && Math.abs(this.currentVelB) < 0.01) {
                this.currentVelA = 0;
                this.currentVelB = 0;
                this.done = true;
            }
        }
    }

    _moveRoll(dt) {
        const decel = FRICTION_COEFF * G;

        // 공 A
        if (Math.abs(this.currentVelA) > 0.01) {
            const dir = Math.sign(this.currentVelA);
            this.currentVelA -= dir * decel * dt;
            if (Math.sign(this.currentVelA) !== dir) this.currentVelA = 0;
            this.ballAx += this.currentVelA * dt;
        } else {
            this.currentVelA = 0;
        }

        // 공 B
        if (Math.abs(this.currentVelB) > 0.01) {
            const prevX = this.ballBx;
            this.currentVelB -= decel * dt;
            if (this.currentVelB < 0) this.currentVelB = 0;
            this.ballBx += this.currentVelB * dt;
            this.ballBRolled = this.ballBx - this.ballBx0;
        } else {
            this.currentVelB = 0;
        }
    }
}

// ── 렌더러 ──
class MomentumRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.W = 0; this.H = 0;

        this.setupResize();
        this.resize();
        requestAnimationFrame(() => { this.resize(); this.renderIdle(); });
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
        this.W = rect.width;
        this.H = rect.height;
        if (this.onResized) this.onResized();
    }

    clear() {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, this.H);
        g.addColorStop(0, '#0f172a');
        g.addColorStop(0.5, '#1e293b');
        g.addColorStop(1, '#334155');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
    }

    renderIdle() {
        this.clear();
        this._drawTable();
        this._drawBall(0.3, '#ef4444', 'A', 0.5, 20);
        this._drawBall(1.8, '#3b82f6', 'B', 0.5, 20);
    }

    render(physics) {
        if (!physics) { this.renderIdle(); return; }
        this.clear();
        this._drawTable();

        const radiusA = 12 + physics.massA * 10;
        const radiusB = 12 + physics.massB * 10;

        // 충돌 섬광
        if (physics.collisionFlash > 0) {
            const cx = this._toX(physics.ballBx - 0.025);
            const cy = this.H / 2;
            const r = 40 * physics.collisionFlash;
            const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, `rgba(255,255,200,${physics.collisionFlash})`);
            grad.addColorStop(1, `rgba(255,255,200,0)`);
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this._drawBall(physics.ballAx, '#ef4444', 'A', physics.massA, radiusA);
        this._drawBall(physics.ballBx, '#3b82f6', 'B', physics.massB, radiusB);

        // 공 B 굴러간 거리 표시
        if (physics.ballBRolled > 0.01) {
            const x1 = this._toX(physics.ballBx0);
            const x2 = this._toX(physics.ballBx);
            const y = this.H / 2 + 50;
            this.ctx.strokeStyle = '#fbbf24';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y);
            this.ctx.lineTo(x2, y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            this.ctx.fillStyle = '#fbbf24';
            this.ctx.font = 'bold 13px system-ui';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${physics.ballBRolled.toFixed(2)} m`, (x1 + x2) / 2, y - 8);
        }

        // 속도 화살표
        this._drawVelArrow(physics.ballAx, physics.currentVelA, '#ef4444', radiusA);
        this._drawVelArrow(physics.ballBx, physics.currentVelB, '#3b82f6', radiusB);
    }

    _toX(logicalX) {
        const pad = 60;
        return pad + (logicalX / 3.0) * (this.W - 2 * pad);
    }

    _drawTable() {
        const ctx = this.ctx;
        const pad = 40;
        const tableY = this.H * 0.25;
        const tableH = this.H * 0.5;

        // 당구대 펠트
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.roundRect(pad, tableY, this.W - 2 * pad, tableH, 8);
        ctx.fill();

        // 테두리 (쿠션)
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(pad, tableY, this.W - 2 * pad, tableH, 8);
        ctx.stroke();

        // 중앙선
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(this.W / 2, tableY + 15);
        ctx.lineTo(this.W / 2, tableY + tableH - 15);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _drawBall(logicalX, color, label, mass, radius) {
        const ctx = this.ctx;
        const x = this._toX(logicalX);
        const y = this.H / 2;

        // 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + 3, y + 3, radius, radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 공
        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, color);
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 라벨
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, radius * 0.8)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);

        // 질량 라벨
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '11px system-ui';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${mass}kg`, x, y - radius - 8);
    }

    _drawVelArrow(logicalX, vel, color, radius) {
        if (Math.abs(vel) < 0.05) return;
        const ctx = this.ctx;
        const x = this._toX(logicalX);
        const y = this.H / 2;
        const len = Math.min(Math.abs(vel) * 8, 60) * Math.sign(vel);

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + radius * Math.sign(vel), y);
        ctx.lineTo(x + radius * Math.sign(vel) + len, y);
        ctx.stroke();

        // 화살표 머리
        const tipX = x + radius * Math.sign(vel) + len;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tipX, y);
        ctx.lineTo(tipX - Math.sign(vel) * 8, y - 5);
        ctx.lineTo(tipX - Math.sign(vel) * 8, y + 5);
        ctx.closePath();
        ctx.fill();
    }
}

// ── 차트 관리 ──
class MomentumChartManager {
    constructor() {
        this.chart = null;
    }

    updateChart(records) {
        const ctx = document.getElementById('momentum-chart');
        if (!ctx) return;

        const labels = records.map((_, i) => `실험 ${i + 1}`);
        const momData = records.map(r => r.momentum);
        const distData = records.map(r => r.rollDist);

        if (this.chart) {
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = momData;
            this.chart.data.datasets[1].data = distData;
            this.chart.update('none');
            return;
        }

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: '운동량 (kg·m/s)',
                        data: momData,
                        backgroundColor: 'rgba(59,130,246,0.7)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                    },
                    {
                        label: '굴러간 거리 (m)',
                        data: distData,
                        backgroundColor: 'rgba(249,115,22,0.7)',
                        borderColor: '#f97316',
                        borderWidth: 1,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', font: { size: 11 } },
                        grid: { color: 'rgba(148,163,184,0.15)' },
                    },
                    x: {
                        ticks: { color: '#94a3b8', font: { size: 11 } },
                        grid: { display: false },
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#64748b', font: { size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#e2e8f0',
                        bodyColor: '#cbd5e1',
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}`
                        }
                    }
                }
            }
        });
    }

    destroy() {
        if (this.chart) { this.chart.destroy(); this.chart = null; }
    }
}

// ── 탭 컨트롤러 ──
export class MomentumTab {
    constructor() {
        this.renderer = new MomentumRenderer('momentum-canvas');
        this.renderer.onResized = () => { if (!this.running) this.renderer.renderIdle(); };
        this.chartManager = new MomentumChartManager();
        this.physics = null;
        this.running = false;
        this.paused = false;
        this.animationSpeed = 1;
        this.records = [];
        this.presetRunning = false;
        this.presetQueue = [];

        this.bindControls();
    }

    bindControls() {
        document.getElementById('momentum-start').addEventListener('click', () => this.start());
        document.getElementById('momentum-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('momentum-reset').addEventListener('click', () => this.reset());
        document.getElementById('momentum-speed').addEventListener('change', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
        });

        // 슬라이더 값 표시
        document.getElementById('momentum-mass').addEventListener('input', (e) => {
            document.getElementById('momentum-mass-val').textContent = parseFloat(e.target.value).toFixed(1);
        });
        document.getElementById('momentum-vel').addEventListener('input', (e) => {
            document.getElementById('momentum-vel-val').textContent = parseFloat(e.target.value).toFixed(1);
        });

        // 프리셋
        document.querySelectorAll('#tab-momentum .btn-preset').forEach(btn => {
            btn.addEventListener('click', () => this.runPreset(btn.dataset.preset));
        });
    }

    activate() {
        this.renderer.resize();
        this.renderer.renderIdle();
        requestAnimationFrame(() => { this.renderer.resize(); if (!this.running) this.renderer.renderIdle(); });
    }

    deactivate() {}

    start() {
        if (this.running && !this.paused) return;
        if (this.paused) { this.togglePause(); return; }

        const massA = parseFloat(document.getElementById('momentum-mass').value);
        const velA = parseFloat(document.getElementById('momentum-vel').value);

        this.physics = new MomentumPhysics(massA, velA);
        this.running = true;
        this.paused = false;

        document.getElementById('momentum-start').disabled = true;
        document.getElementById('momentum-pause').disabled = false;
        document.getElementById('momentum-concept').style.display = 'none';

        // 즉시 운동량 표시
        document.getElementById('momentum-pA').textContent = this.physics.momentumA.toFixed(3) + ' kg·m/s';

        window.app.startLoop();
    }

    stop() {
        this.running = false;
        this.paused = false;
        document.getElementById('momentum-start').disabled = false;
        document.getElementById('momentum-pause').disabled = true;
        document.getElementById('momentum-pause').textContent = '⏸ 일시정지';
    }

    toggleStartPause() {
        if (!this.running) this.start();
        else this.togglePause();
    }

    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;
        const btn = document.getElementById('momentum-pause');
        btn.textContent = this.paused ? '▶ 재개' : '⏸ 일시정지';
        if (this.paused) window.app.stopLoop();
        else window.app.startLoop();
    }

    reset() {
        window.app.stopLoop();
        this.physics = null;
        this.running = false;
        this.paused = false;
        this.presetRunning = false;
        this.presetQueue = [];

        document.getElementById('momentum-start').disabled = false;
        document.getElementById('momentum-pause').disabled = true;
        document.getElementById('momentum-pause').textContent = '⏸ 일시정지';
        document.getElementById('momentum-pA').textContent = '0.00 kg·m/s';
        document.getElementById('momentum-vA').textContent = '0.00 m/s';
        document.getElementById('momentum-vB').textContent = '0.00 m/s';
        document.getElementById('momentum-distB').textContent = '0.00 m';

        this.renderer.renderIdle();
    }

    fullReset() {
        this.reset();
        this.records = [];
        this.chartManager.destroy();
        document.getElementById('momentum-chart-section').style.display = 'none';
        document.getElementById('momentum-records').style.display = 'none';
        document.getElementById('momentum-table-body').innerHTML = '';
        document.getElementById('momentum-concept').style.display = 'none';
    }

    update(dt) {
        if (!this.physics || this.paused) return;
        this.physics.update(dt);
        this.updateUI();
    }

    render() {
        this.renderer.render(this.physics);
    }

    updateUI() {
        if (!this.physics) return;
        const ph = this.physics;
        document.getElementById('momentum-vA').textContent = Math.abs(ph.currentVelA).toFixed(2) + ' m/s';
        document.getElementById('momentum-vB').textContent = ph.currentVelB.toFixed(2) + ' m/s';
        document.getElementById('momentum-distB').textContent = ph.ballBRolled.toFixed(3) + ' m';
    }

    isComplete() {
        return this.physics && this.physics.done;
    }

    onComplete() {
        this.stop();
        this.recordExperiment();

        // 프리셋 큐 처리
        if (this.presetQueue.length > 0) {
            const next = this.presetQueue.shift();
            setTimeout(() => {
                document.getElementById('momentum-mass').value = next.massA;
                document.getElementById('momentum-mass-val').textContent = next.massA.toFixed(1);
                document.getElementById('momentum-vel').value = next.velA;
                document.getElementById('momentum-vel-val').textContent = next.velA.toFixed(1);
                this.start();
            }, 800);
        } else {
            this.presetRunning = false;
            this.showConcept();
        }
    }

    recordExperiment() {
        if (!this.physics) return;
        const ph = this.physics;
        const record = {
            massA: ph.massA,
            velA: ph.velA0,
            momentum: ph.momentumA,
            rollDist: ph.rollDistB,
        };
        this.records.push(record);
        this.updateTable();
        this.updateChart();
    }

    updateTable() {
        const tbody = document.getElementById('momentum-table-body');
        tbody.innerHTML = this.records.map((r, i) =>
            `<tr>
                <td>${i + 1}</td>
                <td>${r.massA.toFixed(1)}</td>
                <td>${r.velA.toFixed(1)}</td>
                <td>${r.momentum.toFixed(3)}</td>
                <td>${r.rollDist.toFixed(3)}</td>
            </tr>`
        ).join('');
        document.getElementById('momentum-records').style.display = '';
    }

    updateChart() {
        document.getElementById('momentum-chart-section').style.display = '';
        this.chartManager.updateChart(this.records);
    }

    runPreset(presetKey) {
        const preset = MOMENTUM_PRESETS[presetKey];
        if (!preset) return;

        this.fullReset();
        this.presetRunning = true;
        this.presetQueue = [...preset.experiments.slice(1)];

        const first = preset.experiments[0];
        document.getElementById('momentum-mass').value = first.massA;
        document.getElementById('momentum-mass-val').textContent = first.massA.toFixed(1);
        document.getElementById('momentum-vel').value = first.velA;
        document.getElementById('momentum-vel-val').textContent = first.velA.toFixed(1);

        setTimeout(() => this.start(), 300);
    }

    showConcept() {
        if (this.records.length < 2) {
            // 단일 실험 개념
            const r = this.records[this.records.length - 1];
            document.getElementById('momentum-concept-body').innerHTML = `
                <div class="concept-line"><span class="check">✅</span> 운동량 = 질량 × 속도 = <span class="concept-highlight">${r.massA.toFixed(1)} × ${r.velA.toFixed(1)} = ${r.momentum.toFixed(3)} kg·m/s</span></div>
                <div class="concept-line"><span class="check">✅</span> 공 A의 운동량이 클수록 공 B가 더 멀리 굴러갑니다.</div>
            `;
        } else {
            const r1 = this.records[this.records.length - 2];
            const r2 = this.records[this.records.length - 1];
            const momRatio = (r2.momentum / r1.momentum).toFixed(1);
            const distRatio = (r2.rollDist / r1.rollDist).toFixed(1);

            let insight = '';
            if (Math.abs(r1.massA - r2.massA) < 0.01) {
                // 질량 같음 → 속도 비교
                const velRatio = (r2.velA / r1.velA).toFixed(1);
                insight = `같은 질량이라도 속도가 <span class="concept-highlight">${velRatio}배</span>면 운동량도 <span class="concept-highlight">${momRatio}배</span>`;
            } else if (Math.abs(r1.velA - r2.velA) < 0.01) {
                // 속도 같음 → 질량 비교
                const massRatio = (r2.massA / r1.massA).toFixed(1);
                insight = `같은 속도라도 질량이 <span class="concept-highlight">${massRatio}배</span>면 운동량도 <span class="concept-highlight">${momRatio}배</span>`;
            } else {
                insight = `운동량이 <span class="concept-highlight">${momRatio}배</span> 커지면 공 B의 굴러간 거리도 크게 증가합니다.`;
            }

            document.getElementById('momentum-concept-body').innerHTML = `
                <div class="concept-line"><span class="check">✅</span> 운동량 = 질량 × 속도 (p = mv)</div>
                <div class="concept-line"><span class="check">✅</span> 공 A의 운동량이 클수록 공 B가 더 멀리 굴러갔습니다.</div>
                <div class="concept-line"><span class="check">✅</span> ${insight}</div>
            `;
        }
        document.getElementById('momentum-concept').style.display = '';
        document.getElementById('momentum-concept').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
