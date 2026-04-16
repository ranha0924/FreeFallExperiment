/**
 * Canvas 기반 자유낙하 시뮬레이션 렌더러
 * 물체의 낙하 애니메이션, 높이 눈금, 바닥, 잔상 표시
 */

class SimulationRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;

        // 렌더링 설정
        this.padding = { top: 50, bottom: 50, left: 60, right: 30 };
        this.trailLength = 15;

        // 상태
        this.objects = [];
        this.comparisonMode = false;
        this.displayWidth = 0;
        this.displayHeight = 0;

        this.setupResize();
        this.resize();

        // CSS Grid 레이아웃 완료 후 재조정
        requestAnimationFrame(() => {
            this.resize();
            this.render();
        });
    }

    setupResize() {
        const ro = new ResizeObserver(() => {
            this.resize();
            this.render();
        });
        ro.observe(this.canvas.parentElement);
    }

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
    }

    /** 시뮬레이션 물체 설정 (단일 모드) */
    setObject(physics, objectType) {
        this.objects = [{
            physics,
            trail: [],
            color: OBJECTS[objectType]?.color || '#3b82f6',
            name: OBJECTS[objectType]?.name || '물체',
            type: objectType
        }];
        this.comparisonMode = false;
    }

    /** 비교 모드 물체 2개 설정 */
    setComparisonObjects(physicsA, typeA, physicsB, typeB) {
        this.objects = [
            {
                physics: physicsA,
                trail: [],
                color: '#60a5fa',
                name: OBJECTS[typeA]?.name || '물체 A',
                type: typeA,
                label: 'A'
            },
            {
                physics: physicsB,
                trail: [],
                color: '#f87171',
                name: OBJECTS[typeB]?.name || '물체 B',
                type: typeB,
                label: 'B'
            }
        ];
        this.comparisonMode = true;
    }

    /** 잔상 초기화 */
    clearTrails() {
        this.objects.forEach(obj => obj.trail = []);
    }

    /** 높이(m)를 캔버스 Y좌표로 변환 */
    heightToY(heightM, maxHeight) {
        const drawTop = this.padding.top;
        const drawBottom = this.displayHeight - this.padding.bottom;
        const drawHeight = drawBottom - drawTop;
        const ratio = heightM / maxHeight;
        return drawBottom - ratio * drawHeight;
    }

    /** 동시 비교 모드 설정 */
    setSimultaneousObjects(physicsA, projectileB, maxHorizontalDist) {
        this.simultaneousMode = true;
        this.comparisonMode = false;
        this.simultaneousA = physicsA;
        this.simultaneousB = projectileB;
        this.maxHorizontalDist = maxHorizontalDist || 100;
        this.secondMarkers = [];
        this.showAccelVectors = true;
        this.snapshotMode = false;
        this.snapshotData = null;
        this.snapshotIndex = 0;
        this.objects = [];
    }

    /** 메인 렌더링 */
    render() {
        const ctx = this.ctx;
        const W = this.displayWidth;
        const H = this.displayHeight;

        if (W === 0 || H === 0) return;

        ctx.clearRect(0, 0, W, H);

        // 배경 그라데이션
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.6, '#1e293b');
        bgGrad.addColorStop(1, '#334155');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        if (this.simultaneousMode) {
            this.renderSimultaneous();
            return;
        }

        if (this.objects.length === 0) {
            this.drawEmptyMessage(ctx, W, H);
            return;
        }

        const maxHeight = Math.max(...this.objects.map(o => o.physics.initialHeight));

        this.drawGround(ctx, W, H);
        this.drawRuler(ctx, maxHeight);
        this.drawStartLine(ctx, maxHeight, W);

        if (this.comparisonMode && this.objects.length === 2) {
            this.drawComparisonDivider(ctx, W, H);
            this.drawObject(ctx, this.objects[0], maxHeight, W * 0.3);
            this.drawObject(ctx, this.objects[1], maxHeight, W * 0.7);
            this.drawLabels(ctx, W);
        } else if (this.objects.length >= 1) {
            this.drawObject(ctx, this.objects[0], maxHeight, W * 0.55);
        }
    }

    /** 빈 상태 메시지 */
    drawEmptyMessage(ctx, W, H) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('실험 조건을 설정한 후 시작 버튼을 눌러주세요', W / 2, H / 2);
    }

    /** 바닥 그리기 */
    drawGround(ctx, W, H) {
        const groundY = H - this.padding.bottom;

        // 바닥 영역
        ctx.fillStyle = '#374151';
        ctx.fillRect(0, groundY, W, this.padding.bottom);

        // 바닥 상단 라인
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // 바닥 패턴 (사선)
        ctx.strokeStyle = 'rgba(110, 231, 183, 0.2)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 12) {
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x + 10, groundY + this.padding.bottom);
            ctx.stroke();
        }

        // "지면" 텍스트
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('지면 (0 m)', W / 2, groundY + 30);
    }

    /** 출발점 가이드 라인 */
    drawStartLine(ctx, maxHeight, W) {
        const startY = this.heightToY(maxHeight, maxHeight);

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(this.padding.left, startY);
        ctx.lineTo(W - this.padding.right, startY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 출발점 라벨
        ctx.fillStyle = '#fbbf24';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('출발', W - this.padding.right - 5, startY - 5);
    }

    /** 높이 눈금자 */
    drawRuler(ctx, maxHeight) {
        const rulerX = this.padding.left - 8;
        const tickCount = Math.min(10, Math.max(5, Math.ceil(maxHeight / 10)));
        const step = maxHeight / tickCount;

        ctx.strokeStyle = '#4b5563';
        ctx.fillStyle = '#9ca3af';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.lineWidth = 1;

        // 수직 바
        ctx.beginPath();
        ctx.moveTo(rulerX, this.padding.top);
        ctx.lineTo(rulerX, this.displayHeight - this.padding.bottom);
        ctx.stroke();

        for (let i = 0; i <= tickCount; i++) {
            const heightM = i * step;
            const y = this.heightToY(heightM, maxHeight);

            ctx.strokeStyle = '#4b5563';
            ctx.beginPath();
            ctx.moveTo(rulerX - 5, y);
            ctx.lineTo(rulerX + 2, y);
            ctx.stroke();

            const label = heightM % 1 === 0 ? heightM.toFixed(0) : heightM.toFixed(1);
            ctx.fillStyle = '#9ca3af';
            ctx.fillText(label + ' m', rulerX - 8, y + 4);
        }
    }

    /** 비교 모드 중앙 구분선 */
    drawComparisonDivider(ctx, W, H) {
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(W / 2, this.padding.top);
        ctx.lineTo(W / 2, H - this.padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /** 비교 모드 라벨 */
    drawLabels(ctx, W) {
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillStyle = '#60a5fa';
        ctx.fillText('A: ' + this.objects[0].name, W * 0.3, 15);

        ctx.fillStyle = '#f87171';
        ctx.fillText('B: ' + this.objects[1].name, W * 0.7, 15);
    }

    /** 물체 및 잔상 그리기 */
    drawObject(ctx, objData, maxHeight, centerX) {
        const state = objData.physics.getState();
        const y = this.heightToY(state.currentHeight, maxHeight);
        const objSize = this.getObjectSize(objData.type);

        // 물체 본체
        this.drawObjectBody(ctx, centerX, y, objSize, objData);

        // 현재 높이 표시 (물체 옆)
        this.drawHeightLabel(ctx, centerX, y, state.currentHeight, objSize);

        // 착지 효과
        if (state.landed) {
            this.drawLandingEffect(ctx, centerX, this.heightToY(0, maxHeight), objData.color);
        }
    }

    /** 물체 종류별 크기 — 큰 사이즈로 잘 보이게 */
    getObjectSize(type) {
        const sizes = {
            steel_ball: 16,
            basketball: 24,
            feather: 18,
            bowling: 28,
        };
        return sizes[type] || 20;
    }

    /** 물체 본체 렌더링 */
    drawObjectBody(ctx, x, y, size, objData) {
        ctx.save();

        if (objData.type === 'feather') {
            // 깃털: 타원 형태
            const wobble = objData.physics.airResistance
                ? Math.sin(objData.physics.time * 6) * 8
                : 0;

            ctx.fillStyle = '#c4b5fd';
            ctx.beginPath();
            ctx.ellipse(x + wobble, y, size * 0.4, size, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#a78bfa';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 중앙선
            ctx.strokeStyle = 'rgba(167,139,250,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + wobble, y - size);
            ctx.lineTo(x + wobble, y + size);
            ctx.stroke();
        } else {
            // 구형 물체 — 단색 원
            const baseColor = this.getVisibleColor(objData.type, objData.color);

            ctx.fillStyle = baseColor;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // 테두리
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    /** 어두운 배경에서 잘 보이는 색상 반환 */
    getVisibleColor(type, fallback) {
        const colors = {
            steel_ball: '#94a3b8',
            basketball: '#fb923c',
            feather: '#c4b5fd',
            bowling: '#60a5fa',
        };
        return colors[type] || fallback;
    }

    /** 높이 라벨 (물체 아래에 표시, 겹침 방지) */
    drawHeightLabel(ctx, x, y, height, objSize) {
        const text = height.toFixed(1) + ' m';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(248,250,252,0.7)';
        ctx.fillText(text, x, y + objSize + 16);
    }

    /** 착지 효과 */
    drawLandingEffect(ctx, x, groundY, color) {
        ctx.save();

        // 충격파 원
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, groundY, 35, 8, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.ellipse(x, groundY, 50, 12, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 바닥 그림자
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, groundY, 20, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /** 색상 밝게 */
    lightenColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + amount);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
        const b = Math.min(255, (num & 0x0000FF) + amount);
        return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    /* ==============================
     * 동시 비교 모드 렌더링
     * ============================== */

    /** 수평 거리를 캔버스 X좌표로 변환 */
    hDistToX(dist) {
        const leftMargin = this.padding.left + 50;
        const rightMargin = this.padding.right + 10;
        const drawWidth = this.displayWidth - leftMargin - rightMargin;
        return leftMargin + (dist / this.maxHorizontalDist) * drawWidth;
    }

    /** 동시 비교 메인 렌더링 */
    renderSimultaneous() {
        const ctx = this.ctx;
        const W = this.displayWidth;
        const H = this.displayHeight;
        const physA = this.simultaneousA;
        const projB = this.simultaneousB;
        if (!physA || !projB) return;

        const maxHeight = physA.initialHeight;

        // 바닥, 눈금
        this.drawGround(ctx, W, H);
        this.drawRuler(ctx, maxHeight);
        this.drawHorizontalAxis(ctx);
        this.drawStartLine(ctx, maxHeight, W);

        // 스냅샷 모드이면 스냅샷 렌더링
        if (this.snapshotMode && this.snapshotData) {
            this.renderSnapshotOverlay(ctx, maxHeight);
            return;
        }

        // 과거 1초 마커 및 연결선
        this.drawSecondMarkers(ctx, maxHeight);

        // 궤적 점선
        this.drawTrajectoryTrail(ctx, maxHeight);

        // 물체 A (자유낙하, 빨간색) — x = 고정 (hDist=0 위치)
        const stateA = physA.getState();
        const xA = this.hDistToX(0);
        const yA = this.heightToY(stateA.currentHeight, maxHeight);
        this.drawSimBall(ctx, xA, yA, 16, '#ef4444', 'A');

        // 물체 B (수평투사, 파란색)
        const stateB = projB.getState();
        const xB = this.hDistToX(stateB.horizontalDistance);
        const yB = this.heightToY(stateB.currentHeight, maxHeight);
        this.drawSimBall(ctx, xB, yB, 16, '#3b82f6', 'B');

        // 현재 수평 연결선 (실시간)
        if (!stateA.landed) {
            this.drawConnectingLine(ctx, xA, yA, xB, yB, null, 'rgba(251,191,36,0.5)');
        }

        // 가속도 벡터
        if (this.showAccelVectors) {
            const g = physA.gravity;
            this.drawAccelVector(ctx, xA, yA, g, '#4ade80');
            this.drawAccelVector(ctx, xB, yB, g, '#4ade80');
        }

        // 높이 & 거리 라벨
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(248,250,252,0.7)';
        ctx.fillText(stateA.currentHeight.toFixed(1) + ' m', xA, yA + 28);
        if (stateB.horizontalDistance > 0) {
            ctx.fillText(stateB.horizontalDistance.toFixed(1) + ' m', xB, yB + 28);
        }

        // 범례
        this.drawSimLabels(ctx, W);

        // 착지 효과
        const groundY = this.heightToY(0, maxHeight);
        if (stateA.landed) this.drawLandingEffect(ctx, xA, groundY, '#ef4444');
        if (stateB.landed) this.drawLandingEffect(ctx, xB, groundY, '#3b82f6');
    }

    /** 동시 비교용 공 그리기 */
    drawSimBall(ctx, x, y, size, color, label) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 라벨
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
        ctx.restore();
    }

    /** 수평 연결 점선 */
    drawConnectingLine(ctx, x1, y1, x2, y2, label, color) {
        ctx.save();
        ctx.strokeStyle = color || 'rgba(251,191,36,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (label !== null && label !== undefined) {
            const mx = (x1 + x2) / 2;
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, mx, y1 - 8);
        }
        ctx.restore();
    }

    /** 매 1초 마커 기록 */
    addSecondMarker(time, heightA, heightB, hDistB) {
        this.secondMarkers.push({ time, heightA, heightB, hDistB });
    }

    /** 1초 마커들 그리기 */
    drawSecondMarkers(ctx, maxHeight) {
        for (let i = 0; i < this.secondMarkers.length; i++) {
            const m = this.secondMarkers[i];
            const yA = this.heightToY(m.heightA, maxHeight);
            const yB = this.heightToY(m.heightB, maxHeight);
            const xA = this.hDistToX(0);
            const xB = this.hDistToX(m.hDistB);

            // 마커 점 (A)
            ctx.fillStyle = 'rgba(239,68,68,0.5)';
            ctx.beginPath();
            ctx.arc(xA, yA, 5, 0, Math.PI * 2);
            ctx.fill();

            // 마커 점 (B)
            ctx.fillStyle = 'rgba(59,130,246,0.5)';
            ctx.beginPath();
            ctx.arc(xB, yB, 5, 0, Math.PI * 2);
            ctx.fill();

            // 연결 점선 + 시간 라벨
            this.drawConnectingLine(ctx, xA, yA, xB, yB, m.time + '초', 'rgba(251,191,36,0.4)');
        }
    }

    /** 궤적 점선 (B의 포물선) */
    drawTrajectoryTrail(ctx, maxHeight) {
        if (this.secondMarkers.length < 2) return;

        // A: 수직 점선
        ctx.save();
        ctx.strokeStyle = 'rgba(239,68,68,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        const xA = this.hDistToX(0);
        ctx.beginPath();
        ctx.moveTo(xA, this.heightToY(this.secondMarkers[0].heightA, maxHeight));
        for (const m of this.secondMarkers) {
            ctx.lineTo(xA, this.heightToY(m.heightA, maxHeight));
        }
        ctx.stroke();

        // B: 포물선 점선
        ctx.strokeStyle = 'rgba(59,130,246,0.3)';
        ctx.beginPath();
        ctx.moveTo(this.hDistToX(this.secondMarkers[0].hDistB),
                    this.heightToY(this.secondMarkers[0].heightB, maxHeight));
        for (const m of this.secondMarkers) {
            ctx.lineTo(this.hDistToX(m.hDistB), this.heightToY(m.heightB, maxHeight));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /** 가속도 벡터 화살표 */
    drawAccelVector(ctx, x, y, g, color) {
        const arrowLen = 35;
        const startY = y + 22;
        const endY = startY + arrowLen;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;

        // 줄기
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();

        // 화살촉
        ctx.beginPath();
        ctx.moveTo(x, endY + 6);
        ctx.lineTo(x - 5, endY);
        ctx.lineTo(x + 5, endY);
        ctx.closePath();
        ctx.fill();

        // 라벨
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('g=' + g + '', x + 8, startY + arrowLen / 2 + 3);
        ctx.restore();
    }

    /** 수평축 눈금 */
    drawHorizontalAxis(ctx) {
        const groundY = this.displayHeight - this.padding.bottom;
        const leftX = this.hDistToX(0);
        const rightX = this.hDistToX(this.maxHorizontalDist);

        // 축 선
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, groundY);
        ctx.lineTo(rightX, groundY);
        ctx.stroke();

        // 눈금
        const tickCount = Math.min(8, Math.max(4, Math.ceil(this.maxHorizontalDist / 10)));
        const step = this.maxHorizontalDist / tickCount;

        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';

        for (let i = 0; i <= tickCount; i++) {
            const dist = i * step;
            const x = this.hDistToX(dist);
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x, groundY + 5);
            ctx.stroke();
            ctx.fillText(dist.toFixed(0) + 'm', x, groundY + 16);
        }
    }

    /** 동시 비교 라벨 */
    drawSimLabels(ctx, W) {
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('● A: 자유낙하', 10, 18);
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('● B: 수평 투사', 10, 35);
    }

    /** 스냅샷 모드 렌더링 */
    renderSnapshotOverlay(ctx, maxHeight) {
        const snapshots = this.snapshotData;
        const idx = this.snapshotIndex;

        for (let i = 0; i <= idx && i < snapshots.length; i++) {
            const s = snapshots[i];
            const alpha = (i === idx) ? 1.0 : 0.3 + 0.4 * (i / snapshots.length);
            const yA = this.heightToY(s.heightA, maxHeight);
            const yB = this.heightToY(s.heightB, maxHeight);
            const xA = this.hDistToX(0);
            const xB = this.hDistToX(s.horizontalDistB);

            // 마커 점
            ctx.globalAlpha = alpha;
            this.drawSimBall(ctx, xA, yA, i === idx ? 16 : 10,
                             '#ef4444', i === idx ? 'A' : '');
            this.drawSimBall(ctx, xB, yB, i === idx ? 16 : 10,
                             '#3b82f6', i === idx ? 'B' : '');

            // 연결선
            this.drawConnectingLine(ctx, xA, yA, xB, yB, s.time + '초',
                i === idx ? 'rgba(251,191,36,0.8)' : 'rgba(251,191,36,0.3)');

            ctx.globalAlpha = 1.0;

            // 시간 번호 라벨
            if (i < idx) {
                ctx.fillStyle = 'rgba(148,163,184,0.7)';
                ctx.font = '10px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(s.time + '', xA - 18, yA + 4);
            }
        }

        // 현재 스냅샷 상세 정보
        if (idx < snapshots.length) {
            const s = snapshots[idx];
            const yA = this.heightToY(s.heightA, maxHeight);
            const xA = this.hDistToX(0);
            const xB = this.hDistToX(s.horizontalDistB);

            ctx.fillStyle = 'rgba(248,250,252,0.8)';
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('높이: ' + s.heightA.toFixed(1) + ' m', xA, yA + 30);
            ctx.fillText(s.horizontalDistB.toFixed(1) + ' m', xB, this.heightToY(s.heightB, maxHeight) + 30);
        }

        // 가속도 벡터 (현재 스냅샷)
        if (this.showAccelVectors && idx < snapshots.length) {
            const s = snapshots[idx];
            const g = this.simultaneousA.gravity;
            const yA = this.heightToY(s.heightA, maxHeight);
            const yB = this.heightToY(s.heightB, maxHeight);
            this.drawAccelVector(ctx, this.hDistToX(0), yA, g, '#4ade80');
            this.drawAccelVector(ctx, this.hDistToX(s.horizontalDistB), yB, g, '#4ade80');
        }

        // 범례
        this.drawSimLabels(ctx, this.displayWidth);
    }

    /** 스냅샷 모드 활성화 */
    setSnapshotMode(snapshots, index) {
        this.snapshotMode = true;
        this.snapshotData = snapshots;
        this.snapshotIndex = index || 0;
    }

    /** 스냅샷 모드 비활성화 */
    clearSnapshotMode() {
        this.snapshotMode = false;
        this.snapshotData = null;
        this.snapshotIndex = 0;
    }

    /** 동시 비교 모드 초기화 */
    clearSimultaneousMode() {
        this.simultaneousMode = false;
        this.simultaneousA = null;
        this.simultaneousB = null;
        this.secondMarkers = [];
        this.snapshotMode = false;
        this.snapshotData = null;
    }
}
