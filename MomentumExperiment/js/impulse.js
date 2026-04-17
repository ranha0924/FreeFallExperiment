/**
 * 탭 3: 충격량 실험 — 달걀 떨어뜨리기
 */
import { G, EGG_MASS, EGG_BREAK_FORCE, SURFACES, IMPULSE_PRESETS } from './constants.js';

// ── 물리 ──
class ImpulsePhysics {
    constructor(height, surfLeftKey, surfRightKey) {
        this.height = height;
        this.surfLeft = { ...SURFACES[surfLeftKey], key: surfLeftKey };
        this.surfRight = { ...SURFACES[surfRightKey], key: surfRightKey };
        this.mass = EGG_MASS;

        this.impactVel = Math.sqrt(2 * G * height);
        this.deltaP = this.mass * this.impactVel;

        this.leftForce = this.deltaP / this.surfLeft.deltaT;
        this.rightForce = this.deltaP / this.surfRight.deltaT;
        this.leftBroken = this.leftForce >= EGG_BREAK_FORCE;
        this.rightBroken = this.rightForce >= EGG_BREAK_FORCE;

        this.time = 0;
        this.eggY = height;
        this.eggVel = 0;
        this.phase = 'falling'; // falling → impact → done
        this.impactTime = 0;
        this.done = false;

        this.fallDuration = Math.sqrt(2 * height / G);
    }

    update(dt) {
        if (this.done) return;
        this.time += dt;

        if (this.phase === 'falling') {
            this.eggVel += G * dt;
            this.eggY -= this.eggVel * dt;
            if (this.eggY <= 0) {
                this.eggY = 0;
                this.eggVel = this.impactVel;
                this.phase = 'impact';
                this.impactTime = 0;
            }
        } else if (this.phase === 'impact') {
            this.impactTime += dt;
            const maxDt = Math.max(this.surfLeft.deltaT, this.surfRight.deltaT);
            if (this.impactTime > maxDt + 0.3) {
                this.done = true;
            }
        }
    }

    getForceTimeData(surfKey) {
        const surf = surfKey === 'left' ? this.surfLeft : this.surfRight;
        const dt = surf.deltaT;
        const impulse = this.deltaP;
        const points = [];
        const n = 100;

        if (surf.profile === 'rect') {
            const f = impulse / dt;
            points.push({ t: 0, F: 0 });
            points.push({ t: 0.0001, F: f });
            for (let i = 1; i < n; i++) {
                points.push({ t: dt * i / n, F: f });
            }
            points.push({ t: dt, F: f });
            points.push({ t: dt + 0.0001, F: 0 });
        } else {
            // 종형 곡선: 면적 = impulse
            const sigma = dt / 4;
            const tc = dt / 2;
            const fPeak = impulse / (sigma * Math.sqrt(2 * Math.PI));
            const totalT = dt * 1.2;
            for (let i = 0; i <= n; i++) {
                const t = (i / n) * totalT;
                const F = fPeak * Math.exp(-((t - tc) ** 2) / (2 * sigma ** 2));
                points.push({ t, F: F < 0.01 ? 0 : F });
            }
        }
        return points;
    }
}

// ── 렌더러 ──
class ImpulseRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.W = 0; this.H = 0;
        this.setupResize();
        this.resize();
        requestAnimationFrame(() => { this.resize(); this.renderIdle(2); });
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
        if (this.onResized) this.onResized();
    }

    clear() {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, this.H);
        g.addColorStop(0, '#0f172a'); g.addColorStop(0.5, '#1e293b'); g.addColorStop(1, '#334155');
        ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    }

    renderIdle(height) {
        this.clear();
        this._drawScene(height || 2, height || 2, null, null, false, false);
    }

    render(physics) {
        if (!physics) { this.renderIdle(2); return; }
        this.clear();
        const broken = physics.phase === 'impact' || physics.done;
        this._drawScene(
            physics.height, physics.eggY,
            physics.surfLeft, physics.surfRight,
            broken && physics.leftBroken, broken && physics.rightBroken
        );
    }

    _drawScene(maxH, eggY, surfL, surfR, leftBroken, rightBroken) {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        const groundY = H * 0.8;
        const topY = H * 0.08;
        const midX = W / 2;

        // 높이 스케일
        const scale = (groundY - topY) / maxH;
        const eggScreenY = groundY - eggY * scale;

        // 구분선
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(midX, topY); ctx.lineTo(midX, groundY); ctx.stroke();
        ctx.setLineDash([]);

        // 높이 눈금
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'right';
        const step = maxH <= 2 ? 0.5 : 1;
        for (let h = 0; h <= maxH; h += step) {
            const y = groundY - h * scale;
            ctx.fillText(`${h.toFixed(1)}m`, 35, y + 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 20, y); ctx.stroke();
        }

        // 왼쪽 바닥
        const lColor = surfL ? surfL.color : '#6b7280';
        const rColor = surfR ? surfR.color : '#0ea5e9';
        ctx.fillStyle = lColor; ctx.fillRect(40, groundY, midX - 50, 30);
        ctx.fillStyle = rColor; ctx.fillRect(midX + 10, groundY, midX - 50, 30);

        // 바닥 라벨
        ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(surfL ? surfL.name : '콘크리트', (40 + midX - 10) / 2, groundY + 50);
        ctx.fillText(surfR ? surfR.name : '에어백', (midX + 10 + W - 20) / 2, groundY + 50);

        // 달걀 (왼쪽)
        const leftEggX = (40 + midX - 10) / 2;
        const rightEggX = (midX + 10 + W - 20) / 2;

        if (leftBroken) {
            this._drawBrokenEgg(leftEggX, groundY);
        } else {
            this._drawEgg(leftEggX, eggScreenY);
        }

        if (rightBroken) {
            this._drawBrokenEgg(rightEggX, groundY);
        } else {
            this._drawEgg(rightEggX, eggScreenY);
        }
    }

    _drawEgg(x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);
        // 달걀 모양 (타원)
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5; ctx.stroke();
        // 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(-3, -5, 4, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawBrokenEgg(x, y) {
        const ctx = this.ctx;
        // 깨진 노른자
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(x, y - 3, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // 흰자
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(x, y - 2, 24, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // 노른자 중심
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(x, y - 4, 7, 0, Math.PI * 2);
        ctx.fill();
        // 깨진 껍데기 조각
        ctx.fillStyle = '#fef3c7'; ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1;
        [[-12, -8, 0.3], [8, -10, -0.2], [0, -12, 0.5]].forEach(([dx, dy, r]) => {
            ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(r);
            ctx.beginPath();
            ctx.moveTo(-5, 0); ctx.lineTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(2, 3); ctx.lineTo(-3, 2);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
        });
        // 💥
        ctx.fillStyle = '#ef4444'; ctx.font = '16px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('💥', x, y - 25);
    }
}

// ── 차트 관리 ──
class ImpulseChartManager {
    constructor() { this.leftChart = null; this.rightChart = null; }

    createCharts(physics) {
        this.destroy();
        const leftData = physics.getForceTimeData('left');
        const rightData = physics.getForceTimeData('right');

        this.leftChart = this._makeChart('impulse-chart-left', leftData, physics.surfLeft, physics.deltaP);
        this.rightChart = this._makeChart('impulse-chart-right', rightData, physics.surfRight, physics.deltaP);

        // 타이틀 및 노트
        document.getElementById('impulse-chart-left-title').textContent =
            `힘-시간 그래프 — ${physics.surfLeft.name}`;
        document.getElementById('impulse-chart-right-title').textContent =
            `힘-시간 그래프 — ${physics.surfRight.name}`;

        const leftType = physics.surfLeft.profile === 'rect' ? '직사각형 (일정한 힘)' : '종형 곡선 (변하는 힘)';
        const rightType = physics.surfRight.profile === 'rect' ? '직사각형 (일정한 힘)' : '종형 곡선 (변하는 힘)';
        document.getElementById('impulse-chart-left-note').textContent =
            `넓이 = 충격량 = ${physics.deltaP.toFixed(4)} N·s | 최대 힘 = ${physics.leftForce.toFixed(1)} N | ${leftType}`;
        document.getElementById('impulse-chart-right-note').textContent =
            `넓이 = 충격량 = ${physics.deltaP.toFixed(4)} N·s | 최대 힘 = ${physics.rightForce.toFixed(1)} N | ${rightType}`;

        document.getElementById('impulse-charts').style.display = '';
    }

    _makeChart(canvasId, data, surf, impulse) {
        const ctx = document.getElementById(canvasId);
        const color = surf.profile === 'rect' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)';
        const border = surf.profile === 'rect' ? '#ef4444' : '#3b82f6';

        return new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '힘 (N)',
                    data: data.map(d => ({ x: d.t * 1000, y: d.F })),
                    borderColor: border,
                    backgroundColor: color,
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: surf.profile === 'bell' ? 0.4 : 0,
                    stepped: surf.profile === 'rect' ? 'before' : false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: '시간 (ms)', color: '#64748b', font: { size: 12 } },
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(148,163,184,0.15)' },
                        min: 0,
                    },
                    y: {
                        title: { display: true, text: '힘 (N)', color: '#64748b', font: { size: 12 } },
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(148,163,184,0.15)' },
                        beginAtZero: true,
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#cbd5e1',
                        callbacks: {
                            title: (items) => `${items[0].parsed.x.toFixed(2)} ms`,
                            label: (item) => `힘: ${item.parsed.y.toFixed(1)} N`
                        }
                    }
                }
            }
        });
    }

    destroy() {
        if (this.leftChart) { this.leftChart.destroy(); this.leftChart = null; }
        if (this.rightChart) { this.rightChart.destroy(); this.rightChart = null; }
    }
}

// ── 탭 컨트롤러 ──
export class ImpulseTab {
    constructor() {
        this.renderer = new ImpulseRenderer('impulse-canvas');
        this.renderer.onResized = () => {
            if (this.running) return;
            const h = parseFloat(document.getElementById('impulse-height').value);
            this.renderer.renderIdle(h);
        };
        this.chartManager = new ImpulseChartManager();
        this.physics = null;
        this.running = false;
        this.paused = false;
        this.animationSpeed = 1;
        this.bindControls();
    }

    bindControls() {
        document.getElementById('impulse-start').addEventListener('click', () => this.start());
        document.getElementById('impulse-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('impulse-reset').addEventListener('click', () => this.reset());
        document.getElementById('impulse-speed').addEventListener('change', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
        });
        document.getElementById('impulse-height').addEventListener('input', (e) => {
            document.getElementById('impulse-height-val').textContent = parseFloat(e.target.value).toFixed(1);
        });

        // 바닥 변경 시 라벨 업데이트
        ['impulse-surface-left', 'impulse-surface-right'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updateSurfaceLabels());
        });

        // 프리셋
        document.querySelectorAll('#tab-impulse .btn-preset').forEach(btn => {
            btn.addEventListener('click', () => this.runPreset(btn.dataset.preset));
        });

        this.updateSurfaceLabels();
    }

    updateSurfaceLabels() {
        const lk = document.getElementById('impulse-surface-left').value;
        const rk = document.getElementById('impulse-surface-right').value;
        document.getElementById('imp-left-surface').textContent = SURFACES[lk].name;
        document.getElementById('imp-right-surface').textContent = SURFACES[rk].name;
    }

    activate() {
        this.renderer.resize();
        const h = parseFloat(document.getElementById('impulse-height').value);
        this.renderer.renderIdle(h);
        requestAnimationFrame(() => {
            this.renderer.resize();
            if (!this.running) {
                const h2 = parseFloat(document.getElementById('impulse-height').value);
                this.renderer.renderIdle(h2);
            }
        });
    }

    deactivate() {}

    start() {
        if (this.running && !this.paused) return;
        if (this.paused) { this.togglePause(); return; }

        const height = parseFloat(document.getElementById('impulse-height').value);
        const surfL = document.getElementById('impulse-surface-left').value;
        const surfR = document.getElementById('impulse-surface-right').value;

        this.physics = new ImpulsePhysics(height, surfL, surfR);
        this.running = true; this.paused = false;

        document.getElementById('impulse-start').disabled = true;
        document.getElementById('impulse-pause').disabled = false;
        document.getElementById('impulse-concept').style.display = 'none';
        document.getElementById('impulse-charts').style.display = 'none';

        window.app.startLoop();
    }

    stop() {
        this.running = false; this.paused = false;
        document.getElementById('impulse-start').disabled = false;
        document.getElementById('impulse-pause').disabled = true;
        document.getElementById('impulse-pause').textContent = '⏸ 일시정지';
    }

    toggleStartPause() {
        if (!this.running) this.start();
        else this.togglePause();
    }

    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;
        document.getElementById('impulse-pause').textContent = this.paused ? '▶ 재개' : '⏸ 일시정지';
        if (this.paused) window.app.stopLoop(); else window.app.startLoop();
    }

    reset() {
        window.app.stopLoop();
        this.physics = null;
        this.running = false; this.paused = false;

        document.getElementById('impulse-start').disabled = false;
        document.getElementById('impulse-pause').disabled = true;
        document.getElementById('impulse-pause').textContent = '⏸ 일시정지';
        document.getElementById('impulse-concept').style.display = 'none';
        document.getElementById('impulse-charts').style.display = 'none';

        // 테이블 초기화
        ['vel', 'dp', 'impulse', 'dt', 'force', 'status'].forEach(k => {
            document.getElementById(`imp-left-${k}`).textContent = '—';
            document.getElementById(`imp-right-${k}`).textContent = '—';
        });

        const h = parseFloat(document.getElementById('impulse-height').value);
        this.renderer.renderIdle(h);
        this.chartManager.destroy();
    }

    update(dt) {
        if (!this.physics || this.paused) return;
        this.physics.update(dt);
    }

    render() {
        this.renderer.render(this.physics);
    }

    isComplete() { return this.physics && this.physics.done; }

    onComplete() {
        this.stop();
        this.updateComparisonTable();
        this.chartManager.createCharts(this.physics);
        this.showConcept();
    }

    updateComparisonTable() {
        const ph = this.physics;
        const v = ph.impactVel.toFixed(2);
        const dp = ph.deltaP.toFixed(4);

        document.getElementById('imp-left-vel').textContent = v + ' m/s';
        document.getElementById('imp-right-vel').textContent = v + ' m/s';
        document.getElementById('imp-left-dp').textContent = dp + ' kg·m/s';
        document.getElementById('imp-right-dp').textContent = dp + ' kg·m/s';
        document.getElementById('imp-left-impulse').textContent = dp + ' N·s';
        document.getElementById('imp-right-impulse').textContent = dp + ' N·s';
        document.getElementById('imp-left-dt').textContent = ph.surfLeft.deltaT + ' s';
        document.getElementById('imp-right-dt').textContent = ph.surfRight.deltaT + ' s';

        const lf = document.getElementById('imp-left-force');
        const rf = document.getElementById('imp-right-force');
        lf.textContent = ph.leftForce.toFixed(1) + ' N';
        rf.textContent = ph.rightForce.toFixed(1) + ' N';
        lf.className = ph.leftBroken ? 'force-danger' : 'force-safe';
        rf.className = ph.rightBroken ? 'force-danger' : 'force-safe';

        document.getElementById('imp-left-status').textContent = ph.leftBroken ? '💥 깨짐' : '✨ 안 깨짐';
        document.getElementById('imp-right-status').textContent = ph.rightBroken ? '💥 깨짐' : '✨ 안 깨짐';
    }

    showConcept() {
        const ph = this.physics;
        const ratio = (ph.leftForce / ph.rightForce).toFixed(1);
        document.getElementById('impulse-concept-body').innerHTML = `
            <div class="concept-line"><span class="check">✅</span> 두 달걀은 같은 속도(<span class="concept-highlight">${ph.impactVel.toFixed(2)} m/s</span>)로 착지했습니다.
                <span class="sub">→ 운동량 변화 = 충격량은 같았습니다! (<span class="concept-highlight">${ph.deltaP.toFixed(4)} N·s</span>)</span></div>
            <div class="concept-line"><span class="check">✅</span> 하지만 충돌 시간이 달랐습니다.
                <span class="sub">${ph.surfLeft.name}: <span class="concept-highlight">${ph.surfLeft.deltaT}초</span> → 힘 <span class="concept-highlight">${ph.leftForce.toFixed(1)}N</span></span>
                <span class="sub">${ph.surfRight.name}: <span class="concept-highlight">${ph.surfRight.deltaT}초</span> → 힘 <span class="concept-highlight">${ph.rightForce.toFixed(1)}N</span></span></div>
            <div class="concept-line"><span class="check">✅</span> 힘-시간 그래프의 넓이는 두 경우 모두 같았습니다.
                <span class="sub">→ 넓이 = 충격량 = <span class="concept-highlight">${ph.deltaP.toFixed(4)} N·s</span></span></div>
            <div class="concept-line"><span class="check">✅</span> <strong>시간을 늘리면 힘이 줄어듭니다!</strong>
                <span class="sub">→ 이것이 바로 에어백, 범퍼, 안전모의 원리입니다.</span></div>
        `;
        document.getElementById('impulse-concept').style.display = '';
        document.getElementById('impulse-concept').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    runPreset(key) {
        const preset = IMPULSE_PRESETS[key];
        if (!preset) return;
        this.reset();

        document.getElementById('impulse-height').value = preset.height;
        document.getElementById('impulse-height-val').textContent = preset.height.toFixed(1);
        document.getElementById('impulse-surface-left').value = preset.left;
        document.getElementById('impulse-surface-right').value = preset.right;
        this.updateSurfaceLabels();

        setTimeout(() => this.start(), 300);
    }
}
