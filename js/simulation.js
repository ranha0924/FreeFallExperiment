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
        this.padding = { top: 30, bottom: 40, left: 50, right: 20 };
        this.trailLength = 12;

        // 상태
        this.objects = []; // [{physics, trail, color, name, type}]
        this.comparisonMode = false;

        this.setupResize();
        this.resize();
    }

    setupResize() {
        const ro = new ResizeObserver(() => this.resize());
        ro.observe(this.canvas.parentElement);
    }

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
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
                color: '#3b82f6',
                name: OBJECTS[typeA]?.name || '물체 A',
                type: typeA,
                label: 'A'
            },
            {
                physics: physicsB,
                trail: [],
                color: '#ef4444',
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

        ctx.clearRect(0, 0, W, H);

        // 배경
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.7, '#1e293b');
        bgGrad.addColorStop(1, '#334155');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        if (this.objects.length === 0) return;

        const maxHeight = Math.max(...this.objects.map(o => o.physics.initialHeight));

        this.drawGround(ctx, W, H);
        this.drawRuler(ctx, maxHeight);

        if (this.comparisonMode && this.objects.length === 2) {
            this.drawComparisonDivider(ctx, W, H);
            this.drawObject(ctx, this.objects[0], maxHeight, W * 0.3);
            this.drawObject(ctx, this.objects[1], maxHeight, W * 0.7);
            this.drawLabels(ctx, W);
        } else if (this.objects.length >= 1) {
            this.drawObject(ctx, this.objects[0], maxHeight, W * 0.55);
        }
    }

    /** 바닥 그리기 */
    drawGround(ctx, W, H) {
        const groundY = H - this.padding.bottom;
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, groundY, W, this.padding.bottom);

        // 바닥 선
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // "지면" 텍스트
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('지면 (0 m)', W / 2, groundY + 22);
    }

    /** 높이 눈금자 */
    drawRuler(ctx, maxHeight) {
        const rulerX = this.padding.left - 5;
        const tickCount = Math.min(10, Math.ceil(maxHeight / 10));
        const step = maxHeight / tickCount;

        ctx.strokeStyle = '#64748b';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.lineWidth = 1;

        // 수직선
        ctx.beginPath();
        ctx.moveTo(rulerX, this.padding.top);
        ctx.lineTo(rulerX, this.displayHeight - this.padding.bottom);
        ctx.stroke();

        for (let i = 0; i <= tickCount; i++) {
            const heightM = i * step;
            const y = this.heightToY(heightM, maxHeight);

            // 눈금선
            ctx.beginPath();
            ctx.moveTo(rulerX - 6, y);
            ctx.lineTo(rulerX, y);
            ctx.stroke();

            // 높이 라벨
            const label = heightM % 1 === 0 ? heightM + '' : heightM.toFixed(1);
            ctx.fillText(label + ' m', rulerX - 10, y + 4);
        }
    }

    /** 비교 모드 중앙 구분선 */
    drawComparisonDivider(ctx, W, H) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(W / 2, this.padding.top);
        ctx.lineTo(W / 2, H - this.padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /** 비교 모드 라벨 */
    drawLabels(ctx, W) {
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillStyle = '#3b82f6';
        ctx.fillText('물체 A: ' + this.objects[0].name, W * 0.3, 20);

        ctx.fillStyle = '#ef4444';
        ctx.fillText('물체 B: ' + this.objects[1].name, W * 0.7, 20);
    }

    /** 물체 및 잔상 그리기 */
    drawObject(ctx, objData, maxHeight, centerX) {
        const state = objData.physics.getState();
        const y = this.heightToY(state.currentHeight, maxHeight);

        // 잔상 기록
        objData.trail.push({ x: centerX, y });
        if (objData.trail.length > this.trailLength) {
            objData.trail.shift();
        }

        // 잔상 그리기
        for (let i = 0; i < objData.trail.length - 1; i++) {
            const alpha = (i + 1) / objData.trail.length * 0.3;
            const size = this.getObjectSize(objData.type) * (0.5 + 0.5 * (i + 1) / objData.trail.length);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = objData.color;
            ctx.beginPath();
            ctx.arc(objData.trail[i].x, objData.trail[i].y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 물체 본체
        const objSize = this.getObjectSize(objData.type);
        this.drawObjectBody(ctx, centerX, y, objSize, objData);

        // 착지 효과
        if (state.landed) {
            this.drawLandingEffect(ctx, centerX, this.heightToY(0, maxHeight), objData.color);
        }
    }

    /** 물체 종류별 크기 */
    getObjectSize(type) {
        const sizes = {
            steel_ball: 10,
            basketball: 18,
            feather: 12,
            bowling: 20,
        };
        return sizes[type] || 14;
    }

    /** 물체 본체 렌더링 */
    drawObjectBody(ctx, x, y, size, objData) {
        ctx.save();

        if (objData.type === 'feather') {
            // 깃털: 타원 형태, 공기저항 시 좌우 흔들림
            const wobble = objData.physics.airResistance
                ? Math.sin(objData.physics.time * 8) * 5
                : 0;
            ctx.fillStyle = '#a78bfa';
            ctx.beginPath();
            ctx.ellipse(x + wobble, y, size * 0.5, size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            // 구형 물체: 그라데이션 효과
            const grad = ctx.createRadialGradient(
                x - size * 0.3, y - size * 0.3, size * 0.1,
                x, y, size
            );
            grad.addColorStop(0, this.lightenColor(objData.color, 40));
            grad.addColorStop(1, objData.color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // 테두리
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }

    /** 착지 효과 */
    drawLandingEffect(ctx, x, groundY, color) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, groundY, 25, 6, 0, 0, Math.PI * 2);
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
