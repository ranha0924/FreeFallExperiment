import { PHYSICS_DT } from './constants.js';

const PLANETS = {
    earth:   { name: '지구', gravity: 9.8,   airDensity: 1.225, color: '#3b82f6' },
    moon:    { name: '달',   gravity: 1.62,  airDensity: 0,     color: '#94a3b8' },
    mars:    { name: '화성', gravity: 3.72,  airDensity: 0.020, color: '#ef4444' },
    jupiter: { name: '목성', gravity: 24.79, airDensity: 1.326, color: '#f59e0b' },
};

const FF_OBJECTS = {
    steel_ball: { name: '쇠구슬', mass: 0.028, radius: 0.01, dragCoeff: 0.47, color: '#94a3b8', desc: '작고 무거운 금속 구슬' },
    basketball: { name: '농구공', mass: 0.625, radius: 0.12, dragCoeff: 0.47, color: '#fb923c', desc: '크고 가벼운 공' },
    feather:    { name: '깃털',   mass: 0.003, radius: 0.05, dragCoeff: 1.5, crossSectionArea: 0.005, color: '#c4b5fd', desc: '매우 가볍고 공기저항이 큰 물체' },
    bowling:    { name: '볼링공', mass: 6.0,   radius: 0.109, dragCoeff: 0.47, color: '#60a5fa', desc: '크고 무거운 공' },
};

class FreeFallPhysics {
    constructor(config) {
        this.initialHeight = config.height;
        this.gravity = config.gravity;
        this.mass = config.mass;
        this.airResistance = config.airResistance || false;
        this.dragCoeff = config.dragCoeff || 0.47;
        this.objectRadius = config.objectRadius || 0.05;
        this.crossSectionArea = config.crossSectionArea || null;
        this.airDensity = config.airDensity ?? 1.225;
        this.reset();
    }
    reset() {
        this.time = 0; this.velocity = 0; this.distanceFallen = 0;
        this.currentHeight = this.initialHeight; this.landed = false;
    }
    getCrossSectionArea() { return this.crossSectionArea || Math.PI * this.objectRadius ** 2; }
    getTerminalVelocity() {
        if (!this.airResistance) return Infinity;
        const A = this.getCrossSectionArea();
        return Math.sqrt((2 * this.mass * this.gravity) / (this.dragCoeff * this.airDensity * A));
    }
    update(dt) {
        if (this.landed) return;
        if (!this.airResistance) {
            this.time += dt;
            this.velocity = this.gravity * this.time;
            this.distanceFallen = 0.5 * this.gravity * this.time ** 2;
            this.currentHeight = this.initialHeight - this.distanceFallen;
        } else {
            const b = 0.5 * this.dragCoeff * this.airDensity * this.getCrossSectionArea();
            const m = this.mass, g = this.gravity;
            const accel = v => g - (b * v * Math.abs(v)) / m;
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
    }
    getState() {
        return { time: this.time, velocity: this.velocity, distanceFallen: this.distanceFallen,
                 currentHeight: this.currentHeight, landed: this.landed, initialHeight: this.initialHeight };
    }
}

class ProjectilePhysics {
    constructor(config) {
        this.horizontalVelocity = config.horizontalVelocity || 20;
        this.initialHorizontalVelocity = this.horizontalVelocity;
        this.horizontalDistance = 0;
        this.airResistance = config.airResistance || false;
        this.dragCoeff = config.dragCoeff || 0.47;
        this.airDensity = config.airDensity ?? 1.225;
        this.mass = config.mass || 1;
        this.objectRadius = config.objectRadius || 0.05;
        this.crossSectionArea = config.crossSectionArea || null;
        this.verticalPhysics = new FreeFallPhysics(config);
    }
    getCrossSectionArea() { return this.crossSectionArea || Math.PI * this.objectRadius ** 2; }
    update(dt) {
        if (this.verticalPhysics.landed) return;
        this.verticalPhysics.update(dt);
        if (!this.airResistance) {
            this.horizontalDistance = this.horizontalVelocity * this.verticalPhysics.time;
        } else {
            const b = 0.5 * this.dragCoeff * this.airDensity * this.getCrossSectionArea();
            const accel = vx => -(b * vx * Math.abs(vx)) / this.mass;
            const v1 = this.horizontalVelocity, a1 = accel(v1);
            const v2 = v1 + 0.5 * dt * a1, a2 = accel(v2);
            const v3 = v1 + 0.5 * dt * a2, a3 = accel(v3);
            const v4 = v1 + dt * a3, a4 = accel(v4);
            this.horizontalVelocity = v1 + (dt / 6) * (a1 + 2*a2 + 2*a3 + a4);
            this.horizontalDistance += (dt / 6) * (v1 + 2*v2 + 2*v3 + v4);
        }
    }
    get time() { return this.verticalPhysics.time; }
    get velocity() { return this.verticalPhysics.velocity; }
    get currentHeight() { return this.verticalPhysics.currentHeight; }
    get landed() { return this.verticalPhysics.landed; }
    get initialHeight() { return this.verticalPhysics.initialHeight; }
    get gravity() { return this.verticalPhysics.gravity; }
    getState() {
        const vs = this.verticalPhysics.getState();
        return { ...vs, horizontalVelocity: this.horizontalVelocity,
                 horizontalDistance: this.horizontalDistance,
                 initialHorizontalVelocity: this.initialHorizontalVelocity };
    }
}

function preComputeFallTime(config) {
    const sim = new FreeFallPhysics(config);
    const dt = 1/120; let iter = 0;
    while (!sim.landed && iter < 120 * 600) { sim.update(dt); iter++; }
    return sim.landed ? { time: sim.time, velocity: sim.velocity } : null;
}

class SnapshotController {
    constructor({ physicsConfig, projectileConfig, totalTime }) {
        this.snapshots = [];
        this.currentIndex = 0;
        const physA = new FreeFallPhysics(physicsConfig);
        const projB = new ProjectilePhysics(projectileConfig);
        const dt = 1/120;
        const maxSec = Math.floor(totalTime);
        this.snapshots.push(this._capture(0, physA, projB));
        let nextSec = 1;
        while (nextSec <= maxSec && !physA.landed) {
            while (physA.time < nextSec && !physA.landed) { physA.update(dt); projB.update(dt); }
            if (physA.landed) break;
            this.snapshots.push(this._capture(nextSec, physA, projB));
            nextSec++;
        }
    }
    _capture(t, physA, projB) {
        const a = physA.getState(), b = projB.getState();
        return { time: t, heightA: a.currentHeight, heightB: b.currentHeight,
                 heightDiff: Math.abs(a.currentHeight - b.currentHeight),
                 horizontalDistB: b.horizontalDistance,
                 verticalSpeedA: a.velocity, verticalSpeedB: b.velocity,
                 horizontalSpeedB: b.horizontalVelocity };
    }
    getAll() { return this.snapshots; }
    count() { return this.snapshots.length; }
    current() { return this.snapshots[this.currentIndex]; }
    next() { if (this.currentIndex < this.snapshots.length - 1) this.currentIndex++; return this.current(); }
    prev() { if (this.currentIndex > 0) this.currentIndex--; return this.current(); }
    goTo(i) { this.currentIndex = Math.max(0, Math.min(i, this.snapshots.length - 1)); return this.current(); }
}

class FreeFallRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.pad = { top: 40, bottom: 60, left: 60, right: 30 };
        this.W = 0; this.H = 0;
        this.mode = 'single';
        this.objects = [];
        this.simA = null; this.simB = null;
        this.maxHDist = 100;
        this.secondMarkers = [];
        this.snapshotMode = false;
        this.snapshotData = null;
        this.snapshotIndex = 0;
        this._setupResize();
        this.resize();
        requestAnimationFrame(() => { this.resize(); this.renderIdle(50); });
    }
    _setupResize() { new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement); }
    resize() {
        const r = this.canvas.parentElement.getBoundingClientRect();
        if (r.width === 0) return;
        this.canvas.width = r.width * this.dpr;
        this.canvas.height = r.height * this.dpr;
        this.canvas.style.width = r.width + 'px';
        this.canvas.style.height = r.height + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.W = r.width; this.H = r.height;
    }
    setSingle(physics, objectType) {
        this.mode = 'single';
        this.objects = [{ physics, color: FF_OBJECTS[objectType]?.color || '#3b82f6', type: objectType }];
    }
    setCompare(physicsA, typeA, physicsB, typeB) {
        this.mode = 'compare';
        this.objects = [
            { physics: physicsA, color: '#60a5fa', type: typeA, label: 'A' },
            { physics: physicsB, color: '#f87171', type: typeB, label: 'B' }
        ];
    }
    setSimultaneous(physA, projB, maxHDist) {
        this.mode = 'simultaneous';
        this.simA = physA; this.simB = projB;
        this.maxHDist = maxHDist || 100;
        this.secondMarkers = [];
        this.snapshotMode = false; this.snapshotData = null; this.snapshotIndex = 0;
    }
    addSecondMarker(time, hA, hB, hDist) { this.secondMarkers.push({ time, heightA: hA, heightB: hB, hDistB: hDist }); }
    setSnapshotMode(snaps, idx) { this.snapshotMode = true; this.snapshotData = snaps; this.snapshotIndex = idx || 0; }
    clearSnapshot() { this.snapshotMode = false; this.snapshotData = null; }
    clear() {
        const g = this.ctx.createLinearGradient(0, 0, 0, this.H);
        g.addColorStop(0, '#0f172a'); g.addColorStop(0.6, '#1e293b'); g.addColorStop(1, '#334155');
        this.ctx.fillStyle = g; this.ctx.fillRect(0, 0, this.W, this.H);
    }
    renderIdle(height) {
        this.clear();
        this._drawGround();
        this._drawRuler(height || 50);
    }
    render() {
        this.clear();
        if (this.mode === 'simultaneous') { this._renderSimultaneous(); return; }
        if (this.objects.length === 0) return;
        const maxH = Math.max(...this.objects.map(o => o.physics.initialHeight));
        this._drawGround();
        this._drawRuler(maxH);
        if (this.mode === 'compare' && this.objects.length === 2) {
            this._drawDivider();
            this._drawObject(this.objects[0], maxH, this.W * 0.3);
            this._drawObject(this.objects[1], maxH, this.W * 0.7);
            this._drawCompareLabels();
        } else {
            this._drawObject(this.objects[0], maxH, this.W * 0.55);
        }
    }
    _heightToY(h, maxH) {
        const top = this.pad.top, bot = this.H - this.pad.bottom;
        return bot - (h / maxH) * (bot - top);
    }
    _drawGround() {
        const ctx = this.ctx, gY = this.H - this.pad.bottom;
        ctx.fillStyle = '#374151'; ctx.fillRect(0, gY, this.W, this.pad.bottom);
        ctx.strokeStyle = '#6ee7b7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(this.W, gY); ctx.stroke();
        ctx.strokeStyle = 'rgba(110,231,183,0.2)'; ctx.lineWidth = 1;
        for (let x = 0; x < this.W; x += 12) {
            ctx.beginPath(); ctx.moveTo(x, gY); ctx.lineTo(x + 10, gY + this.pad.bottom); ctx.stroke();
        }
        ctx.fillStyle = '#9ca3af'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('지면 (0 m)', this.W / 2, gY + 30);
    }
    _drawRuler(maxH) {
        const ctx = this.ctx, rx = this.pad.left - 8;
        const tickCount = Math.min(10, Math.max(5, Math.ceil(maxH / 10)));
        const step = maxH / tickCount;
        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(rx, this.pad.top); ctx.lineTo(rx, this.H - this.pad.bottom); ctx.stroke();
        ctx.fillStyle = '#9ca3af'; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
        for (let i = 0; i <= tickCount; i++) {
            const hm = i * step;
            const y = this._heightToY(hm, maxH);
            ctx.beginPath(); ctx.moveTo(rx - 5, y); ctx.lineTo(rx + 2, y); ctx.stroke();
            const label = hm % 1 === 0 ? hm.toFixed(0) : hm.toFixed(1);
            ctx.fillText(label + ' m', rx - 8, y + 4);
        }
    }
    _drawDivider() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(75,85,99,0.6)'; ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(this.W / 2, this.pad.top); ctx.lineTo(this.W / 2, this.H - this.pad.bottom); ctx.stroke();
        ctx.setLineDash([]);
    }
    _drawCompareLabels() {
        const ctx = this.ctx;
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = '#60a5fa'; ctx.fillText('A: ' + (FF_OBJECTS[this.objects[0].type]?.name || ''), this.W * 0.3, 18);
        ctx.fillStyle = '#f87171'; ctx.fillText('B: ' + (FF_OBJECTS[this.objects[1].type]?.name || ''), this.W * 0.7, 18);
    }
    _drawObject(obj, maxH, cx) {
        const ctx = this.ctx, st = obj.physics.getState();
        const y = this._heightToY(st.currentHeight, maxH);
        const size = ({ steel_ball: 16, basketball: 24, feather: 18, bowling: 28 })[obj.type] || 20;
        if (obj.type === 'feather') {
            const wobble = obj.physics.airResistance ? Math.sin(obj.physics.time * 6) * 8 : 0;
            ctx.fillStyle = '#c4b5fd';
            ctx.beginPath(); ctx.ellipse(cx + wobble, y, size * 0.4, size, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.5; ctx.stroke();
        } else {
            ctx.fillStyle = obj.color;
            ctx.beginPath(); ctx.arc(cx, y, size, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.font = '11px system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(248,250,252,0.7)';
        ctx.fillText(st.currentHeight.toFixed(1) + ' m', cx, y + size + 16);
        if (st.landed) this._drawLandingEffect(cx, this._heightToY(0, maxH), obj.color);
    }
    _drawLandingEffect(x, y, color) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.3; ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, 35, 8, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.4; ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(x, y, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    _hDistToX(d) {
        const leftM = this.pad.left + 50, rightM = this.pad.right + 10;
        return leftM + (d / this.maxHDist) * (this.W - leftM - rightM);
    }
    _renderSimultaneous() {
        if (!this.simA || !this.simB) return;
        const ctx = this.ctx, maxH = this.simA.initialHeight;
        this._drawGround(); this._drawRuler(maxH); this._drawHAxis();
        if (this.snapshotMode && this.snapshotData) { this._renderSnapshot(maxH); return; }
        this._drawSecondMarkers(maxH);
        const stA = this.simA.getState(), stB = this.simB.getState();
        const xA = this._hDistToX(0), yA = this._heightToY(stA.currentHeight, maxH);
        const xB = this._hDistToX(stB.horizontalDistance), yB = this._heightToY(stB.currentHeight, maxH);
        if (!stA.landed) this._drawConnect(xA, yA, xB, yB, null, 'rgba(251,191,36,0.5)');
        this._drawSimBall(xA, yA, 16, '#ef4444', 'A');
        this._drawSimBall(xB, yB, 16, '#3b82f6', 'B');
        ctx.font = '11px system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(248,250,252,0.7)';
        ctx.fillText(stA.currentHeight.toFixed(1) + ' m', xA, yA + 28);
        if (stB.horizontalDistance > 0) ctx.fillText(stB.horizontalDistance.toFixed(1) + ' m', xB, yB + 28);
        this._drawSimLabels();
        const gY = this._heightToY(0, maxH);
        if (stA.landed) this._drawLandingEffect(xA, gY, '#ef4444');
        if (stB.landed) this._drawLandingEffect(xB, gY, '#3b82f6');
    }
    _drawHAxis() {
        const ctx = this.ctx, gY = this.H - this.pad.bottom;
        const lx = this._hDistToX(0), rx = this._hDistToX(this.maxHDist);
        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx, gY); ctx.lineTo(rx, gY); ctx.stroke();
        const ticks = Math.min(8, Math.max(4, Math.ceil(this.maxHDist / 10)));
        const step = this.maxHDist / ticks;
        ctx.fillStyle = '#9ca3af'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
        for (let i = 0; i <= ticks; i++) {
            const d = i * step, x = this._hDistToX(d);
            ctx.beginPath(); ctx.moveTo(x, gY); ctx.lineTo(x, gY + 5); ctx.stroke();
            ctx.fillText(d.toFixed(0) + 'm', x, gY + 16);
        }
    }
    _drawSimBall(x, y, s, c, label) {
        const ctx = this.ctx;
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y); ctx.textBaseline = 'alphabetic';
    }
    _drawConnect(x1, y1, x2, y2, label, color) {
        const ctx = this.ctx;
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        if (label != null) {
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
            ctx.fillText(label, (x1 + x2) / 2, y1 - 8);
        }
        ctx.restore();
    }
    _drawSecondMarkers(maxH) {
        const ctx = this.ctx;
        for (const m of this.secondMarkers) {
            const xA = this._hDistToX(0), xB = this._hDistToX(m.hDistB);
            const yA = this._heightToY(m.heightA, maxH), yB = this._heightToY(m.heightB, maxH);
            ctx.fillStyle = 'rgba(239,68,68,0.5)';
            ctx.beginPath(); ctx.arc(xA, yA, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(59,130,246,0.5)';
            ctx.beginPath(); ctx.arc(xB, yB, 5, 0, Math.PI * 2); ctx.fill();
            this._drawConnect(xA, yA, xB, yB, m.time + '초', 'rgba(251,191,36,0.4)');
        }
    }
    _drawSimLabels() {
        const ctx = this.ctx;
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
        ctx.fillStyle = '#ef4444'; ctx.fillText('● A: 자유낙하', 10, 18);
        ctx.fillStyle = '#3b82f6'; ctx.fillText('● B: 수평 투사', 10, 36);
    }
    _renderSnapshot(maxH) {
        const ctx = this.ctx, snaps = this.snapshotData, idx = this.snapshotIndex;
        for (let i = 0; i <= idx && i < snaps.length; i++) {
            const s = snaps[i], alpha = i === idx ? 1 : 0.3 + 0.4 * (i / snaps.length);
            const xA = this._hDistToX(0), xB = this._hDistToX(s.horizontalDistB);
            const yA = this._heightToY(s.heightA, maxH), yB = this._heightToY(s.heightB, maxH);
            ctx.globalAlpha = alpha;
            this._drawSimBall(xA, yA, i === idx ? 16 : 10, '#ef4444', i === idx ? 'A' : '');
            this._drawSimBall(xB, yB, i === idx ? 16 : 10, '#3b82f6', i === idx ? 'B' : '');
            this._drawConnect(xA, yA, xB, yB, s.time + '초', i === idx ? 'rgba(251,191,36,0.8)' : 'rgba(251,191,36,0.3)');
            ctx.globalAlpha = 1;
        }
        this._drawSimLabels();
    }
}

const $ = id => document.getElementById(id);

export class FreeFallTab {
    constructor() {
        this.renderer = new FreeFallRenderer('freefall-canvas');
        this.mode = 'single';
        this.physics = null;
        this.physicsB = null;
        this.projectileB = null;
        this.snapshotCtrl = null;
        this.running = false;
        this.paused = false;
        this.animationSpeed = 1;
        this.chart = null; this.chartH = null; this.chartV = null;
        this.chartTimer = 0;
        this.nextMarkerSec = 1;
        this._bind();
        this._syncHeightLabels();
    }
    _syncHeightLabels() {
        $('ff-height-val').textContent = $('ff-height').value;
        $('ff-height-b-val').textContent = $('ff-height-b').value;
        $('ff-height-sim-val').textContent = $('ff-height-sim').value;
        $('ff-hvel-val').textContent = $('ff-hvel').value;
    }
    _bind() {
        $('ff-tab-single').onclick = () => this._switchMode('single');
        $('ff-tab-compare').onclick = () => this._switchMode('compare');
        $('ff-tab-simultaneous').onclick = () => this._switchMode('simultaneous');
        $('ff-start').onclick = () => this.start();
        $('ff-pause').onclick = () => this.togglePause();
        $('ff-reset').onclick = () => this.reset();
        $('ff-start-sim').onclick = () => this.start();
        $('ff-pause-sim').onclick = () => this.togglePause();
        $('ff-reset-sim').onclick = () => this.reset();
        $('ff-speed').onchange = e => { this.animationSpeed = parseFloat(e.target.value); };
        $('ff-speed-sim').onchange = e => { this.animationSpeed = parseFloat(e.target.value); };
        $('ff-height').oninput = e => { $('ff-height-val').textContent = e.target.value; this._previewIdle(); };
        $('ff-height-b').oninput = e => { $('ff-height-b-val').textContent = e.target.value; };
        $('ff-height-sim').oninput = e => { $('ff-height-sim-val').textContent = e.target.value; this._previewIdle(); };
        $('ff-hvel').oninput = e => { $('ff-hvel-val').textContent = e.target.value; };
        const applyMoon = (planetId, airId) => {
            const isMoon = $(planetId).value === 'moon';
            $(airId).disabled = isMoon;
            if (isMoon) $(airId).checked = false;
        };
        $('ff-planet').onchange = () => applyMoon('ff-planet', 'ff-air');
        $('ff-planet-b').onchange = () => applyMoon('ff-planet-b', 'ff-air-b');
        $('ff-planet-sim').onchange = () => applyMoon('ff-planet-sim', 'ff-air-sim');
        document.querySelectorAll('[data-ff-preset]').forEach(btn => {
            btn.onclick = () => this._applyPreset(btn.dataset.ffPreset);
        });
        $('ff-snap-prev').onclick = () => this._snapStep(-1);
        $('ff-snap-next').onclick = () => this._snapStep(1);
        $('ff-snap-slider').oninput = e => this._snapGoTo(parseInt(e.target.value));
    }
    activate() {
        this.renderer.resize();
        this._previewIdle();
    }
    deactivate() {}
    _previewIdle() {
        if (this.running) return;
        const h = this.mode === 'simultaneous' ? parseFloat($('ff-height-sim').value) : parseFloat($('ff-height').value);
        if (this.mode === 'simultaneous') {
            const cfg = this._simCfg();
            this.physics = new FreeFallPhysics(cfg.base);
            this.projectileB = new ProjectilePhysics({ ...cfg.base, horizontalVelocity: cfg.hVel });
            const t = preComputeFallTime(cfg.base)?.time || Math.sqrt(2 * cfg.base.height / cfg.base.gravity);
            this.renderer.setSimultaneous(this.physics, this.projectileB, cfg.hVel * t * 1.1);
            this.renderer.render();
        } else {
            this.renderer.renderIdle(h);
        }
    }
    _switchMode(mode) {
        if (this.running) this.reset();
        this.mode = mode;
        ['ff-tab-single', 'ff-tab-compare', 'ff-tab-simultaneous'].forEach(id => $(id).classList.remove('active'));
        $('ff-tab-' + mode).classList.add('active');
        document.querySelector('.canvas-container').classList.toggle('sim-mode', mode === 'simultaneous');
        $('ff-presets').style.display = mode === 'compare' ? '' : 'none';
        $('ff-controls-b').style.display = mode === 'compare' ? '' : 'none';
        $('ff-controls-sim').style.display = mode === 'simultaneous' ? '' : 'none';
        $('ff-controls-a').style.display = mode === 'simultaneous' ? 'none' : '';
        $('ff-single-data').style.display = mode === 'single' ? '' : 'none';
        $('ff-compare-data').style.display = mode === 'compare' ? '' : 'none';
        $('ff-sim-data').style.display = mode === 'simultaneous' ? '' : 'none';
        $('ff-chart-section').style.display = 'none';
        $('ff-sim-charts').style.display = 'none';
        $('ff-snapshot-section').style.display = 'none';
        $('ff-concept').style.display = 'none';
        $('ff-result').style.display = 'none';
        if (this.chart) { this.chart.destroy(); this.chart = null; }
        if (this.chartH) { this.chartH.destroy(); this.chartH = null; }
        if (this.chartV) { this.chartV.destroy(); this.chartV = null; }
        this._previewIdle();
    }
    _cfgA() {
        const planet = PLANETS[$('ff-planet').value];
        const obj = FF_OBJECTS[$('ff-object').value];
        return {
            height: parseFloat($('ff-height').value), gravity: planet.gravity, mass: obj.mass,
            airResistance: $('ff-air').checked && planet.airDensity > 0,
            dragCoeff: obj.dragCoeff, objectRadius: obj.radius,
            crossSectionArea: obj.crossSectionArea || null, airDensity: planet.airDensity,
            _type: $('ff-object').value, _planet: $('ff-planet').value,
        };
    }
    _cfgB() {
        const planet = PLANETS[$('ff-planet-b').value];
        const obj = FF_OBJECTS[$('ff-object-b').value];
        return {
            height: parseFloat($('ff-height-b').value), gravity: planet.gravity, mass: obj.mass,
            airResistance: $('ff-air-b').checked && planet.airDensity > 0,
            dragCoeff: obj.dragCoeff, objectRadius: obj.radius,
            crossSectionArea: obj.crossSectionArea || null, airDensity: planet.airDensity,
            _type: $('ff-object-b').value, _planet: $('ff-planet-b').value,
        };
    }
    _simCfg() {
        const planet = PLANETS[$('ff-planet-sim').value];
        const obj = FF_OBJECTS[$('ff-object-sim').value];
        const base = {
            height: parseFloat($('ff-height-sim').value), gravity: planet.gravity, mass: obj.mass,
            airResistance: $('ff-air-sim').checked && planet.airDensity > 0,
            dragCoeff: obj.dragCoeff, objectRadius: obj.radius,
            crossSectionArea: obj.crossSectionArea || null, airDensity: planet.airDensity,
        };
        return { base, hVel: parseFloat($('ff-hvel').value), objType: $('ff-object-sim').value, planet: $('ff-planet-sim').value };
    }
    start() {
        if (this.running && !this.paused) return;
        if (this.paused) { this.togglePause(); return; }
        $('ff-result').style.display = 'none';
        $('ff-concept').style.display = 'none';
        $('ff-snapshot-section').style.display = 'none';
        this.renderer.clearSnapshot();
        this.chartTimer = 0;
        if (this.mode === 'single') {
            const c = this._cfgA();
            this.physics = new FreeFallPhysics(c);
            this.renderer.setSingle(this.physics, c._type);
            this._initChart('single');
        } else if (this.mode === 'compare') {
            const cA = this._cfgA(), cB = this._cfgB();
            this.physics = new FreeFallPhysics(cA);
            this.physicsB = new FreeFallPhysics(cB);
            this.renderer.setCompare(this.physics, cA._type, this.physicsB, cB._type);
            this._initChart('compare');
        } else {
            const { base, hVel } = this._simCfg();
            this.physics = new FreeFallPhysics(base);
            this.projectileB = new ProjectilePhysics({ ...base, horizontalVelocity: hVel });
            const t = preComputeFallTime(base)?.time || Math.sqrt(2 * base.height / base.gravity);
            this.renderer.setSimultaneous(this.physics, this.projectileB, hVel * t * 1.1);
            this.nextMarkerSec = 1;
            this._initSimCharts();
        }
        this.running = true; this.paused = false;
        this._setButtonsRunning(true);
        window.app.startLoop();
    }
    _setButtonsRunning(running) {
        const isSim = this.mode === 'simultaneous';
        const startId = isSim ? 'ff-start-sim' : 'ff-start';
        const pauseId = isSim ? 'ff-pause-sim' : 'ff-pause';
        $(startId).disabled = running;
        $(pauseId).disabled = !running;
        $(pauseId).textContent = this.paused ? '▶ 재개' : '⏸ 일시정지';
    }
    stop() {
        this.running = false; this.paused = false;
        $('ff-start').disabled = false; $('ff-pause').disabled = true;
        $('ff-start-sim').disabled = false; $('ff-pause-sim').disabled = true;
        $('ff-pause').textContent = '⏸ 일시정지';
        $('ff-pause-sim').textContent = '⏸ 일시정지';
    }
    toggleStartPause() { if (!this.running) this.start(); else this.togglePause(); }
    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;
        const pauseId = this.mode === 'simultaneous' ? 'ff-pause-sim' : 'ff-pause';
        $(pauseId).textContent = this.paused ? '▶ 재개' : '⏸ 일시정지';
        if (this.paused) window.app.stopLoop(); else window.app.startLoop();
    }
    reset() {
        window.app.stopLoop();
        this.physics = null; this.physicsB = null; this.projectileB = null;
        this.snapshotCtrl = null;
        this.running = false; this.paused = false;
        this._setButtonsRunning(false);
        $('ff-result').style.display = 'none';
        $('ff-concept').style.display = 'none';
        $('ff-snapshot-section').style.display = 'none';
        $('ff-chart-section').style.display = 'none';
        $('ff-sim-charts').style.display = 'none';
        if (this.chart) { this.chart.destroy(); this.chart = null; }
        if (this.chartH) { this.chartH.destroy(); this.chartH = null; }
        if (this.chartV) { this.chartV.destroy(); this.chartV = null; }
        this.renderer.secondMarkers = [];
        this.renderer.clearSnapshot();
        $('ff-time').textContent = '0.00 s';
        $('ff-vel').textContent = '0.00 m/s';
        $('ff-dist').textContent = '0.00 m';
        $('ff-hgt').textContent = $('ff-height').value + ' m';
        $('ff-sim-time').textContent = '0.00 s';
        $('ff-delta-row').style.display = 'none';
        this._previewIdle();
    }
    update(dt) {
        if (!this.physics || this.paused) return;
        this.physics.update(dt);
        if (this.mode === 'compare' && this.physicsB) this.physicsB.update(dt);
        if (this.mode === 'simultaneous' && this.projectileB) {
            this.projectileB.update(dt);
            while (this.nextMarkerSec <= this.physics.time && !this.physics.landed) {
                const a = this.physics.getState(), b = this.projectileB.getState();
                this.renderer.addSecondMarker(this.nextMarkerSec, Math.max(0, a.currentHeight), Math.max(0, b.currentHeight), b.horizontalDistance);
                this.nextMarkerSec++;
            }
        }
        this.chartTimer += dt;
        this._updateData();
        if (this.chartTimer >= 0.05) { this.chartTimer = 0; this._updateCharts(); }
    }
    render() { this.renderer.render(); }
    isComplete() {
        if (this.mode === 'compare') return this.physics?.landed && this.physicsB?.landed;
        if (this.mode === 'simultaneous') return this.physics?.landed && this.projectileB?.landed;
        return this.physics?.landed;
    }
    _updateData() {
        if (this.mode === 'single') {
            const s = this.physics.getState();
            $('ff-time').textContent = s.time.toFixed(2) + ' s';
            $('ff-vel').textContent = s.velocity.toFixed(2) + ' m/s';
            $('ff-dist').textContent = s.distanceFallen.toFixed(2) + ' m';
            $('ff-hgt').textContent = Math.max(0, s.currentHeight).toFixed(2) + ' m';
        } else if (this.mode === 'compare') {
            const a = this.physics.getState(), b = this.physicsB.getState();
            const t = Math.max(a.time, b.time);
            $('ff-compare-time').textContent = t.toFixed(2) + ' s';
            const tbl = $('ff-compare-table');
            tbl.querySelector('.vel-a').textContent = a.velocity.toFixed(2);
            tbl.querySelector('.vel-b').textContent = b.velocity.toFixed(2);
            tbl.querySelector('.dist-a').textContent = a.distanceFallen.toFixed(2);
            tbl.querySelector('.dist-b').textContent = b.distanceFallen.toFixed(2);
            tbl.querySelector('.height-a').textContent = a.currentHeight.toFixed(2);
            tbl.querySelector('.height-b').textContent = b.currentHeight.toFixed(2);
            if (a.landed !== b.landed || (a.landed && b.landed)) {
                $('ff-delta-row').style.display = '';
                const diff = Math.abs(a.time - b.time);
                if (a.landed && b.landed) {
                    $('ff-delta-time').textContent = diff < 0.01 ? '거의 동시 착지!' : `물체 ${a.time < b.time ? 'A' : 'B'}가 ${diff.toFixed(2)}초 먼저 도착`;
                } else {
                    $('ff-delta-time').textContent = `물체 ${a.landed ? 'A' : 'B'} 먼저 착지!`;
                }
            }
        } else {
            const a = this.physics.getState(), b = this.projectileB.getState();
            $('ff-sim-time').textContent = a.time.toFixed(2) + ' s';
            const tbl = $('ff-sim-data');
            tbl.querySelector('.sim-height-a').textContent = a.currentHeight.toFixed(2);
            tbl.querySelector('.sim-height-b').textContent = b.currentHeight.toFixed(2);
            tbl.querySelector('.sim-vvel-a').textContent = a.velocity.toFixed(2);
            tbl.querySelector('.sim-vvel-b').textContent = b.velocity.toFixed(2);
            tbl.querySelector('.sim-hvel-a').textContent = '0.00';
            tbl.querySelector('.sim-hvel-b').textContent = b.horizontalVelocity.toFixed(2);
            tbl.querySelector('.sim-hdist-b').textContent = b.horizontalDistance.toFixed(2);
        }
    }
    _updateCharts() {
        if (this.mode === 'single' && this.chart) {
            const s = this.physics.getState();
            this.chart.data.datasets[0].data.push({ x: s.time, y: s.velocity });
            this.chart.update('none');
        } else if (this.mode === 'compare' && this.chart) {
            const a = this.physics.getState(), b = this.physicsB.getState();
            const t = Math.max(a.time, b.time);
            this.chart.data.datasets[0].data.push({ x: a.time, y: a.velocity });
            this.chart.data.datasets[1].data.push({ x: b.time, y: b.velocity });
            this.chart.update('none');
        } else if (this.mode === 'simultaneous' && this.chartH && this.chartV) {
            const a = this.physics.getState(), b = this.projectileB.getState();
            this.chartH.data.datasets[0].data.push({ x: a.time, y: 0 });
            this.chartH.data.datasets[1].data.push({ x: a.time, y: b.horizontalVelocity });
            this.chartV.data.datasets[0].data.push({ x: a.time, y: a.velocity });
            this.chartV.data.datasets[1].data.push({ x: a.time, y: b.velocity });
            this.chartH.update('none'); this.chartV.update('none');
        }
    }
    _initChart(mode) {
        if (this.chart) this.chart.destroy();
        $('ff-chart-section').style.display = '';
        const common = {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { intersect: false, mode: 'index' },
            elements: { point: { radius: 0 }, line: { borderWidth: 2.5, tension: 0.1 } },
            scales: {
                x: { type: 'linear', title: { display: true, text: '시간 (s)', color: '#64748b' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' }, min: 0 },
                y: { title: { display: true, text: '속도 (m/s)', color: '#64748b' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' }, beginAtZero: true }
            },
            plugins: { legend: { display: mode === 'compare', labels: { color: '#cbd5e1' } }, tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#cbd5e1' } }
        };
        const datasets = mode === 'compare'
            ? [
                { label: '물체 A', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, data: [] },
                { label: '물체 B', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, data: [] }
              ]
            : [{ label: '속도 (m/s)', borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, data: [] }];
        this.chart = new Chart($('ff-chart'), { type: 'line', data: { datasets }, options: common });
    }
    _initSimCharts() {
        $('ff-sim-charts').style.display = '';
        const opts = title => ({
            responsive: true, maintainAspectRatio: false, animation: false,
            elements: { point: { radius: 0 }, line: { borderWidth: 2.5, tension: 0.1 } },
            scales: {
                x: { type: 'linear', title: { display: true, text: '시간 (s)', color: '#64748b' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' }, min: 0 },
                y: { title: { display: true, text: title, color: '#64748b' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' }, beginAtZero: true }
            },
            plugins: { legend: { labels: { color: '#cbd5e1' } } }
        });
        if (this.chartH) this.chartH.destroy();
        if (this.chartV) this.chartV.destroy();
        this.chartH = new Chart($('ff-hvel-chart'), {
            type: 'line', data: { datasets: [
                { label: 'A (자유낙하)', borderColor: '#ef4444', data: [] },
                { label: 'B (수평투사)', borderColor: '#3b82f6', data: [] }
            ]}, options: opts('수평 속도 (m/s)')
        });
        this.chartV = new Chart($('ff-vvel-chart'), {
            type: 'line', data: { datasets: [
                { label: 'A (자유낙하)', borderColor: '#ef4444', data: [] },
                { label: 'B (수평투사)', borderColor: '#3b82f6', borderDash: [6, 3], data: [] }
            ]}, options: opts('수직 속도 (m/s)')
        });
    }
    onComplete() {
        this.stop();
        const body = $('ff-result-body'), concept = $('ff-concept'), cbody = $('ff-concept-body');
        if (this.mode === 'single') {
            const s = this.physics.getState();
            body.innerHTML = `<h4 style="color:var(--color-success)">착지 완료!</h4>
                <div class="data-grid" style="margin-top:0.4rem">
                    <div class="data-item"><span class="data-label">낙하 시간</span><span class="data-value accent">${s.time.toFixed(3)} s</span></div>
                    <div class="data-item"><span class="data-label">착지 속도</span><span class="data-value accent">${s.velocity.toFixed(2)} m/s</span></div>
                    <div class="data-item"><span class="data-label">낙하 거리</span><span class="data-value">${s.distanceFallen.toFixed(2)} m</span></div>
                </div>`;
            $('ff-result').style.display = '';
        } else if (this.mode === 'compare') {
            const a = this.physics.getState(), b = this.physicsB.getState();
            const diff = Math.abs(a.time - b.time);
            body.innerHTML = `<h4 style="color:var(--color-success)">비교 실험 완료</h4>
                <p style="margin-top:0.4rem; font-size:0.9rem">
                    A: ${a.time.toFixed(2)}s · ${a.velocity.toFixed(2)} m/s<br>
                    B: ${b.time.toFixed(2)}s · ${b.velocity.toFixed(2)} m/s<br>
                    <strong>${diff < 0.01 ? '거의 동시 착지!' : `시간차: ${diff.toFixed(2)}초`}</strong>
                </p>`;
            $('ff-result').style.display = '';
            cbody.innerHTML = this._compareInsight(a, b);
            concept.style.display = '';
        } else {
            const a = this.physics.getState(), b = this.projectileB.getState();
            body.innerHTML = `<h4 style="color:var(--color-success)">동시 비교 실험 완료</h4>
                <p style="margin-top:0.4rem; font-size:0.9rem">
                    두 물체 모두 ${a.time.toFixed(2)}초에 착지.<br>
                    B의 수평 거리: ${b.horizontalDistance.toFixed(2)} m
                </p>`;
            $('ff-result').style.display = '';
            cbody.innerHTML = `<p class="concept-line"><span class="check">✓</span> 수평 투사한 물체도 자유낙하 물체와 <span class="concept-highlight">같은 시간</span>에 착지했어요.</p>
                <p class="concept-line"><span class="check">✓</span> 수직 방향 운동은 수평 속도와 무관합니다 — <span class="concept-highlight">운동의 독립성</span>.</p>
                <p class="concept-line"><span class="check">✓</span> 두 물체에 작용하는 가속도는 항상 연직 아래 ${this.physics.gravity} m/s².</p>`;
            concept.style.display = '';
            this._setupSnapshot();
        }
    }
    _compareInsight(a, b) {
        const lines = [];
        const planetA = $('ff-planet').value, planetB = $('ff-planet-b').value;
        const airA = $('ff-air').checked, airB = $('ff-air-b').checked;
        const diff = Math.abs(a.time - b.time);
        if (planetA === planetB && !airA && !airB && diff < 0.01) {
            lines.push('<p class="concept-line"><span class="check">✓</span> 질량이 달라도 <span class="concept-highlight">동시에 도착</span>! 진공에서는 모든 물체의 가속도가 같습니다.</p>');
        }
        if (airA !== airB) {
            lines.push(`<p class="concept-line"><span class="check">✓</span> 공기저항이 있는 물체가 더 <span class="concept-highlight">천천히</span> 떨어집니다.</p>`);
        }
        if (planetA !== planetB) {
            const big = PLANETS[planetA].gravity > PLANETS[planetB].gravity ? PLANETS[planetA].name : PLANETS[planetB].name;
            lines.push(`<p class="concept-line"><span class="check">✓</span> 중력가속도가 큰 <span class="concept-highlight">${big}</span>에서 더 빨리 떨어집니다.</p>`);
        }
        if (!lines.length) lines.push('<p class="concept-line">두 물체의 조건이 같아 동일한 결과를 보입니다.</p>');
        return lines.join('');
    }
    _setupSnapshot() {
        const { base, hVel } = this._simCfg();
        const t = preComputeFallTime(base)?.time || Math.sqrt(2 * base.height / base.gravity);
        this.snapshotCtrl = new SnapshotController({ physicsConfig: base, projectileConfig: { ...base, horizontalVelocity: hVel }, totalTime: t });
        const snaps = this.snapshotCtrl.getAll();
        $('ff-snapshot-section').style.display = '';
        $('ff-snap-slider').max = snaps.length - 1;
        $('ff-snap-slider').value = 0;
        this._snapGoTo(0);
        const tbody = $('ff-snap-body');
        tbody.innerHTML = snaps.map(s => `<tr><td>${s.time}초</td><td>${s.heightA.toFixed(1)}</td><td>${s.heightB.toFixed(1)}</td><td>${s.heightDiff.toFixed(2)}</td><td>${s.horizontalDistB.toFixed(1)}</td><td>${s.verticalSpeedA.toFixed(1)}</td><td>${s.verticalSpeedB.toFixed(1)}</td><td>${s.horizontalSpeedB.toFixed(1)}</td></tr>`).join('');
    }
    _snapStep(delta) {
        if (!this.snapshotCtrl) return;
        if (delta > 0) this.snapshotCtrl.next(); else this.snapshotCtrl.prev();
        $('ff-snap-slider').value = this.snapshotCtrl.currentIndex;
        this._snapGoTo(this.snapshotCtrl.currentIndex);
    }
    _snapGoTo(i) {
        if (!this.snapshotCtrl) return;
        const s = this.snapshotCtrl.goTo(i);
        $('ff-snap-label').textContent = s.time + ' 초';
        this.renderer.setSnapshotMode(this.snapshotCtrl.getAll(), i);
        this.renderer.render();
    }
    _applyPreset(preset) {
        this.reset();
        const set = (id, val) => { $(id).value = val; };
        if (preset === 'mass') {
            set('ff-object', 'bowling'); set('ff-object-b', 'feather');
            $('ff-air').checked = false; $('ff-air-b').checked = false;
            set('ff-planet', 'earth'); set('ff-planet-b', 'earth');
            set('ff-height', 50); set('ff-height-b', 50);
        } else if (preset === 'air') {
            set('ff-object', 'feather'); set('ff-object-b', 'feather');
            $('ff-air').checked = false; $('ff-air-b').checked = true;
            set('ff-planet', 'earth'); set('ff-planet-b', 'earth');
            set('ff-height', 50); set('ff-height-b', 50);
        } else if (preset === 'planet') {
            set('ff-object', 'steel_ball'); set('ff-object-b', 'steel_ball');
            $('ff-air').checked = false; $('ff-air-b').checked = false;
            set('ff-planet', 'earth'); set('ff-planet-b', 'moon');
            set('ff-height', 50); set('ff-height-b', 50);
        }
        this._syncHeightLabels();
        ['ff-planet', 'ff-planet-b'].forEach(id => {
            const isMoon = $(id).value === 'moon';
            const airId = id + (id.includes('-b') ? '' : '').replace('-planet-b', '-air-b').replace('-planet', '-air');
        });
        $('ff-air').disabled = $('ff-planet').value === 'moon';
        $('ff-air-b').disabled = $('ff-planet-b').value === 'moon';
    }
}


