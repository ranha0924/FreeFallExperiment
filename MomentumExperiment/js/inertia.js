/**
 * 탭 1: 관성 실험 — 버스 안 승객
 * 물리 엔진 + Canvas 렌더러 + UI 컨트롤러
 */
import { PASSENGERS, FORCE_LEVELS, GRIP_FORCE, BUS } from './constants.js';

// ── 물리 ──
class InertiaPhysics {
    constructor(busState, eventType, forceLevel) {
        this.eventType = eventType;
        this.aBus = FORCE_LEVELS[forceLevel].accel;

        // 초기 조건
        if (eventType === 'start') {
            // 급출발: 버스 0→가속, 승객 정지 상태
            this.busVel = 0;
            this.passengerInitVel = 0;
            this.direction = 1; // 버스 전진 방향
        } else {
            // 급정지: 버스 감속→0, 승객 운동 상태 유지
            this.busVel = busState === 'moving' ? BUS.maxSpeed : 10;
            this.passengerInitVel = this.busVel;
            this.direction = -1; // 버스 감속
        }

        this.busPos = 0;
        this.time = 0;
        this.phase = 'accel'; // 'accel' → 'done'
        this.accelDuration = 1.5; // 가속/감속 지속 시간

        // 승객 상태 (버스 기준 상대 위치)
        this.passengers = PASSENGERS.map(p => ({
            ...p,
            relDisp: 0,    // 상대 변위 (m)
            relVel: 0,     // 상대 속도 (m/s)
            absPos: 0,     // 절대 위치
            absVel: this.passengerInitVel,
        }));

        this.done = false;
    }

    update(dt) {
        if (this.done) return;
        this.time += dt;

        if (this.phase === 'accel' && this.time < this.accelDuration) {
            // 버스 가속/감속 중
            const a = this.aBus * this.direction;
            this.busVel += a * dt;

            // 급정지: 속도 0 이하로 가지 않음
            if (this.eventType === 'stop' && this.busVel <= 0) {
                this.busVel = 0;
                this.phase = 'coast';
            }
            this.busPos += this.busVel * dt;

            // 승객: 핸드레일 고정력에 의한 가속
            for (const p of this.passengers) {
                // 승객에게 작용하는 힘 = 핸드레일 고정력 (버스 운동 방향)
                const forceDir = this.direction; // 버스가 가속하는 방향으로 핸드레일이 끌어줌
                const aPassenger = (GRIP_FORCE / p.mass) * forceDir;

                p.absVel += aPassenger * dt;

                // 급출발: 승객 속도가 버스 속도를 넘지 않음 (핸드레일이 끌어주는 것 이상 안됨)
                if (this.eventType === 'start' && p.absVel > this.busVel) {
                    p.absVel = this.busVel;
                }
                // 급정지: 승객 속도가 0 이하로 떨어지지 않음 (핸드레일이 잡아주는 것)
                if (this.eventType === 'stop' && p.absVel < this.busVel) {
                    p.absVel = this.busVel;
                }

                p.absPos += p.absVel * dt;
                p.relDisp = p.absPos - this.busPos;
            }
        } else if (this.phase === 'accel') {
            this.phase = 'coast';
        }

        if (this.phase === 'coast') {
            // 가속 종료 후: 승객이 서서히 버스와 같은 속도로 수렴
            this.busPos += this.busVel * dt;
            for (const p of this.passengers) {
                // 마찰로 버스 속도에 수렴
                const diff = this.busVel - p.absVel;
                if (Math.abs(diff) > 0.01) {
                    const friction = Math.sign(diff) * Math.min(Math.abs(diff) / dt, GRIP_FORCE / p.mass);
                    p.absVel += friction * dt;
                } else {
                    p.absVel = this.busVel;
                }
                p.absPos += p.absVel * dt;
                p.relDisp = p.absPos - this.busPos;
            }

            // 모든 승객이 버스와 동일 속도면 완료
            const allSynced = this.passengers.every(p => Math.abs(p.absVel - this.busVel) < 0.05);
            if (allSynced && this.time > this.accelDuration + 0.5) {
                this.done = true;
            }
        }
    }
}

// ── 렌더러 ──
class InertiaRenderer {
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
        new ResizeObserver(() => { this.resize(); }).observe(this.canvas.parentElement);
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
        this.drawBus(0, [
            { relDisp: 0, color: '#3b82f6', name: '어른', mass: 70 },
            { relDisp: 0, color: '#ef4444', name: '어린이', mass: 30 },
        ], '정지');
    }

    render(physics) {
        if (!physics) { this.renderIdle(); return; }
        this.clear();

        const label = physics.eventType === 'start' ? '급출발' : '급정지';
        this.drawBus(0, physics.passengers, label);
    }

    drawBus(scroll, passengers, label) {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        const busW = W * 0.75;
        const busH = H * 0.35;
        const busX = (W - busW) / 2;
        const busY = H * 0.35;

        // 도로
        ctx.fillStyle = '#374151';
        ctx.fillRect(0, busY + busH + 20, W, H - busY - busH - 20);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 15]);
        ctx.beginPath();
        ctx.moveTo(0, busY + busH + 45);
        ctx.lineTo(W, busY + busH + 45);
        ctx.stroke();
        ctx.setLineDash([]);

        // 버스 본체
        ctx.fillStyle = '#1e40af';
        ctx.beginPath();
        ctx.roundRect(busX, busY, busW, busH, 12);
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 창문
        const winCount = 5;
        const winW = busW * 0.12;
        const winH = busH * 0.35;
        const winY = busY + busH * 0.1;
        for (let i = 0; i < winCount; i++) {
            const wx = busX + busW * 0.1 + i * (busW * 0.16);
            ctx.fillStyle = 'rgba(186,230,253,0.25)';
            ctx.beginPath();
            ctx.roundRect(wx, winY, winW, winH, 4);
            ctx.fill();
        }

        // 바퀴
        const wheelR = 18;
        const wheelY = busY + busH + 10;
        [busX + busW * 0.2, busX + busW * 0.8].forEach(wx => {
            ctx.fillStyle = '#1f2937';
            ctx.beginPath(); ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#6b7280';
            ctx.beginPath(); ctx.arc(wx, wheelY, 8, 0, Math.PI * 2); ctx.fill();
        });

        // 버스 방향 화살표
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('→ 전진 방향', busX + busW / 2, busY - 10);

        // 라벨
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 16px system-ui';
        ctx.fillText(label, busX + busW / 2, busY + busH + wheelR + 40);

        // 승객 그리기 (버스 내부에 클리핑)
        const pStartX = busX + busW * 0.35; // 승객 시작 위치
        const pSpacing = busW * 0.25;
        const floorY = busY + busH * 0.85;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(busX, busY, busW, busH, 12);
        ctx.clip();

        passengers.forEach((p, i) => {
            const baseX = pStartX + i * pSpacing;
            // relDisp를 픽셀로 변환 (1m = busW * 0.05 정도)
            const scale = busW * 0.04;
            const offsetX = p.relDisp * scale;
            const px = baseX + offsetX;

            const headR = p.mass === 70 ? 16 : 12;
            const bodyH = p.mass === 70 ? 45 : 32;
            const bodyW = p.mass === 70 ? 22 : 16;

            // 몸통
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.roundRect(px - bodyW / 2, floorY - bodyH - headR * 2, bodyW, bodyH, 4);
            ctx.fill();

            // 머리
            ctx.beginPath();
            ctx.arc(px, floorY - bodyH - headR * 2 - headR, headR, 0, Math.PI * 2);
            ctx.fill();

            // 질량 라벨
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${p.mass}kg`, px, floorY - bodyH - headR * 2 - headR - headR - 6);
            ctx.font = '10px system-ui';
            ctx.fillText(p.name, px, floorY - bodyH - headR * 2 - headR - headR - 20);

            // 변위 화살표 (relDisp != 0일 때)
            if (Math.abs(p.relDisp) > 0.05) {
                const arrowLen = Math.abs(offsetX);
                const arrowY = floorY - bodyH / 2 - headR;
                const arrowDir = Math.sign(offsetX);

                ctx.strokeStyle = p.labelColor || p.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(baseX, arrowY);
                ctx.lineTo(baseX + offsetX, arrowY);
                ctx.stroke();

                // 화살표 머리
                ctx.fillStyle = p.labelColor || p.color;
                ctx.beginPath();
                ctx.moveTo(baseX + offsetX, arrowY);
                ctx.lineTo(baseX + offsetX - arrowDir * 8, arrowY - 5);
                ctx.lineTo(baseX + offsetX - arrowDir * 8, arrowY + 5);
                ctx.closePath();
                ctx.fill();

                // 변위 수치
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px ' + 'system-ui';
                ctx.fillText(`${Math.abs(p.relDisp).toFixed(2)}m`, baseX + offsetX / 2, arrowY - 10);
            }
        });

        ctx.restore();

        // 설명 텍스트
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('버스 내부 측면도', busX, busY + busH + wheelR + 65);
    }
}

// ── 탭 컨트롤러 ──
export class InertiaTab {
    constructor() {
        this.renderer = new InertiaRenderer('inertia-canvas');
        this.renderer.onResized = () => { if (!this.running) this.renderer.renderIdle(); };
        this.physics = null;
        this.running = false;
        this.paused = false;
        this.animationSpeed = 1;
        this.maxRelDisp = { adult: 0, child: 0 };

        this.bindControls();
    }

    bindControls() {
        document.getElementById('inertia-start').addEventListener('click', () => this.start());
        document.getElementById('inertia-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('inertia-reset').addEventListener('click', () => this.reset());
        document.getElementById('inertia-speed').addEventListener('change', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
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

        const busState = document.getElementById('inertia-bus-state').value;
        const event = document.getElementById('inertia-event').value;
        const force = document.getElementById('inertia-force').value;

        this.physics = new InertiaPhysics(busState, event, force);
        this.running = true;
        this.paused = false;
        this.maxRelDisp = { adult: 0, child: 0 };

        document.getElementById('inertia-start').disabled = true;
        document.getElementById('inertia-pause').disabled = false;
        document.getElementById('inertia-concept').style.display = 'none';

        window.app.startLoop();
    }

    stop() {
        this.running = false;
        this.paused = false;
        document.getElementById('inertia-start').disabled = false;
        document.getElementById('inertia-pause').disabled = true;
        document.getElementById('inertia-pause').textContent = '⏸ 일시정지';
    }

    toggleStartPause() {
        if (!this.running) this.start();
        else this.togglePause();
    }

    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;
        const btn = document.getElementById('inertia-pause');
        btn.textContent = this.paused ? '▶ 재개' : '⏸ 일시정지';

        if (this.paused) window.app.stopLoop();
        else window.app.startLoop();
    }

    reset() {
        window.app.stopLoop();
        this.physics = null;
        this.running = false;
        this.paused = false;
        this.maxRelDisp = { adult: 0, child: 0 };

        document.getElementById('inertia-start').disabled = false;
        document.getElementById('inertia-pause').disabled = true;
        document.getElementById('inertia-pause').textContent = '⏸ 일시정지';
        document.getElementById('inertia-time').textContent = '0.00 s';
        document.getElementById('inertia-bus-vel').textContent = '0.00 m/s';
        document.getElementById('inertia-adult-disp').textContent = '0.00 m';
        document.getElementById('inertia-child-disp').textContent = '0.00 m';
        document.getElementById('inertia-ratio').style.display = 'none';
        document.getElementById('inertia-concept').style.display = 'none';

        this.renderer.renderIdle();
    }

    update(dt) {
        if (!this.physics || this.paused) return;
        this.physics.update(dt);

        // 최대 변위 추적
        for (const p of this.physics.passengers) {
            const key = p.id;
            const absD = Math.abs(p.relDisp);
            if (absD > this.maxRelDisp[key]) this.maxRelDisp[key] = absD;
        }

        this.updateUI();
    }

    render() {
        this.renderer.render(this.physics);
    }

    updateUI() {
        if (!this.physics) return;
        const ph = this.physics;
        document.getElementById('inertia-time').textContent = ph.time.toFixed(2) + ' s';
        document.getElementById('inertia-bus-vel').textContent = ph.busVel.toFixed(2) + ' m/s';

        const adult = ph.passengers.find(p => p.id === 'adult');
        const child = ph.passengers.find(p => p.id === 'child');
        document.getElementById('inertia-adult-disp').textContent = Math.abs(adult.relDisp).toFixed(2) + ' m';
        document.getElementById('inertia-child-disp').textContent = Math.abs(child.relDisp).toFixed(2) + ' m';

        if (Math.abs(adult.relDisp) > 0.01 && Math.abs(child.relDisp) > 0.01) {
            const ratio = Math.abs(adult.relDisp) / Math.abs(child.relDisp);
            document.getElementById('inertia-ratio').style.display = '';
            document.getElementById('inertia-ratio-val').textContent =
                `어른 : 어린이 = ${ratio.toFixed(1)} : 1`;
        }
    }

    isComplete() {
        return this.physics && this.physics.done;
    }

    onComplete() {
        this.stop();
        this.showConcept();
    }

    showConcept() {
        const ph = this.physics;
        const event = ph.eventType === 'start' ? '급출발' : '급정지';
        const dir = ph.eventType === 'start' ? '뒤쪽' : '앞쪽';
        const adultD = this.maxRelDisp.adult.toFixed(2);
        const childD = this.maxRelDisp.child.toFixed(2);
        const ratio = (this.maxRelDisp.adult / Math.max(this.maxRelDisp.child, 0.001)).toFixed(1);

        const body = document.getElementById('inertia-concept-body');
        body.innerHTML = `
            <div class="concept-line"><span class="check">✅</span> 버스가 <span class="concept-highlight">[${event}]</span>하자 승객들은 <span class="concept-highlight">[${dir}]</span>으로 쏠렸습니다.
                <span class="sub">→ 승객은 원래의 운동 상태를 유지하려 했습니다 = 관성!</span></div>
            <div class="concept-line"><span class="check">✅</span> 어른(70kg)이 <span class="concept-highlight">${adultD}m</span>, 어린이(30kg)가 <span class="concept-highlight">${childD}m</span> 쏠렸습니다.
                <span class="sub">→ 어른이 약 <span class="concept-highlight">${ratio}배</span> 더 쏠림: 질량이 클수록 관성이 커서 원래 상태를 더 강하게 유지합니다.</span></div>
            <div class="concept-line"><span class="check">✅</span> <strong>관성의 크기 = 물체의 질량</strong></div>
        `;
        document.getElementById('inertia-concept').style.display = '';
        document.getElementById('inertia-concept').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
