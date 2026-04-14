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
}
