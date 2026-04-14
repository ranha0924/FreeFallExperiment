/**
 * 자유낙하 물리 계산 엔진
 * 천재교육 고1 통합과학 교과서 기준 공식 사용
 *
 * 핵심 공식 (공기저항 없음):
 *   속력 = 중력가속도 × 시간
 *   낙하 거리 = ½ × 중력가속도 × 시간²
 */

const PLANETS = {
    earth:   { name: '지구', gravity: 9.8,   airDensity: 1.225, color: '#3b82f6' },
    moon:    { name: '달',   gravity: 1.62,  airDensity: 0,     color: '#94a3b8' },
    mars:    { name: '화성', gravity: 3.72,  airDensity: 0.020, color: '#ef4444' },
    jupiter: { name: '목성', gravity: 24.79, airDensity: 1.326, color: '#f59e0b' },
};

const OBJECTS = {
    steel_ball: {
        name: '쇠구슬',
        mass: 0.028,
        radius: 0.01,
        dragCoeff: 0.47,
        color: '#64748b',
        desc: '작고 무거운 금속 구슬'
    },
    basketball: {
        name: '농구공',
        mass: 0.625,
        radius: 0.12,
        dragCoeff: 0.47,
        color: '#f97316',
        desc: '크고 가벼운 공'
    },
    feather: {
        name: '깃털',
        mass: 0.003,
        radius: 0.05,
        dragCoeff: 1.5,
        crossSectionArea: 0.005,
        color: '#a78bfa',
        desc: '매우 가볍고 공기저항이 큰 물체'
    },
    bowling: {
        name: '볼링공',
        mass: 6.0,
        radius: 0.109,
        dragCoeff: 0.47,
        color: '#1e293b',
        desc: '크고 무거운 공'
    },
};

/**
 * 공기저항 수준을 직관적으로 분류 (강 / 중 / 약)
 * 종단속도 기반: 낮을수록 공기저항 영향이 큼
 */
function getAirResistanceLevel(objectKey, planetKey) {
    const obj = OBJECTS[objectKey];
    const planet = PLANETS[planetKey];
    if (!obj || !planet || planet.airDensity === 0) return null;

    const area = obj.crossSectionArea || (Math.PI * obj.radius * obj.radius);
    const vt = Math.sqrt((2 * obj.mass * planet.gravity) / (obj.dragCoeff * planet.airDensity * area));

    if (vt < 5)  return { level: '강', desc: '공기저항이 매우 커서 아주 천천히 떨어져요', terminalDesc: `약 ${vt.toFixed(1)} m/s에서 더 이상 빨라지지 않아요` };
    if (vt < 50) return { level: '중', desc: '공기저항의 영향을 어느 정도 받아요', terminalDesc: `약 ${vt.toFixed(0)} m/s에서 더 이상 빨라지지 않아요` };
    return { level: '약', desc: '공기저항이 작아서 거의 진공처럼 떨어져요', terminalDesc: `약 ${vt.toFixed(0)} m/s까지 빨라질 수 있어요` };
}

/**
 * 시뮬레이션을 미리 돌려서 예상 낙하 시간을 계산
 */
function preComputeFallTime(config) {
    const sim = new FreeFallPhysics(config);
    const dt = 1 / 120;
    const maxIterations = 120 * 600; // 최대 600초
    let iterations = 0;
    while (!sim.landed && iterations < maxIterations) {
        sim.update(dt);
        iterations++;
    }
    return sim.landed ? { time: sim.time, velocity: sim.velocity } : null;
}

/**
 * 자유낙하 물리 상태를 계산하는 클래스
 */
class FreeFallPhysics {
    constructor(config) {
        this.initialHeight = config.height || 100;
        this.gravity = config.gravity || 9.8;
        this.mass = config.mass || 1.0;
        this.airResistance = config.airResistance || false;
        this.dragCoeff = config.dragCoeff || 0.47;
        this.objectRadius = config.objectRadius || 0.05;
        this.crossSectionArea = config.crossSectionArea || null;
        this.airDensity = config.airDensity !== undefined ? config.airDensity : 1.225;

        this.reset();
    }

    reset() {
        this.time = 0;
        this.velocity = 0;
        this.distanceFallen = 0;
        this.currentHeight = this.initialHeight;
        this.landed = false;
        this.dataLog = [];
        this.logSnapshot();
    }

    logSnapshot() {
        this.dataLog.push({
            time: this.time,
            velocity: this.velocity,
            distance: this.distanceFallen,
            height: this.currentHeight,
        });
    }

    getCrossSectionArea() {
        if (this.crossSectionArea) return this.crossSectionArea;
        return Math.PI * this.objectRadius * this.objectRadius;
    }

    /**
     * 시간 dt만큼 상태 업데이트
     * - 공기저항 없음: 교과서 공식 직접 사용 (해석적 풀이)
     * - 공기저항 있음: RK4 수치 적분 (정밀한 근사)
     */
    update(dt) {
        if (this.landed) return;

        if (!this.airResistance) {
            this.updateIdeal(dt);
        } else {
            this.updateWithDrag(dt);
        }

        if (this.currentHeight <= 0) {
            this.handleLanding();
        }

        this.logSnapshot();
    }

    /**
     * 공기저항 없는 자유낙하 — 교과서 공식 그대로
     * 속력 = 중력가속도 × 시간
     * 낙하 거리 = ½ × 중력가속도 × 시간²
     */
    updateIdeal(dt) {
        this.time += dt;
        this.velocity = this.gravity * this.time;
        this.distanceFallen = 0.5 * this.gravity * this.time * this.time;
        this.currentHeight = this.initialHeight - this.distanceFallen;
    }

    /**
     * 공기저항 있는 낙하 — RK4 수치 적분
     * 알짜힘 = 중력 - 공기저항력
     * 공기저항력 = ½ × 항력계수 × 공기밀도 × 단면적 × 속력²
     */
    updateWithDrag(dt) {
        const area = this.getCrossSectionArea();
        const b = 0.5 * this.dragCoeff * this.airDensity * area;
        const m = this.mass;
        const g = this.gravity;

        // 가속도 함수: a = g - (b × v²) / m
        const accel = (v) => g - (b * v * Math.abs(v)) / m;

        // RK4 적분
        const v1 = this.velocity;
        const a1 = accel(v1);

        const v2 = this.velocity + 0.5 * dt * a1;
        const a2 = accel(v2);

        const v3 = this.velocity + 0.5 * dt * a2;
        const a3 = accel(v3);

        const v4 = this.velocity + dt * a3;
        const a4 = accel(v4);

        const newVelocity = this.velocity + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
        const dy = (dt / 6) * (v1 + 2 * v2 + 2 * v3 + v4);

        this.velocity = Math.max(0, newVelocity);
        this.distanceFallen += dy;
        this.time += dt;
        this.currentHeight = this.initialHeight - this.distanceFallen;
    }

    handleLanding() {
        this.landed = true;
        this.currentHeight = 0;
        this.distanceFallen = this.initialHeight;

        if (!this.airResistance) {
            // 정확한 착지 시간: 시간 = √(2 × 높이 / 중력가속도)
            this.time = Math.sqrt(2 * this.initialHeight / this.gravity);
            this.velocity = this.gravity * this.time;
        }
    }

    /** 이론적 낙하 시간 (공기저항 없음) */
    getTheoreticalTime() {
        return Math.sqrt(2 * this.initialHeight / this.gravity);
    }

    /** 이론적 착지 속력 (공기저항 없음) */
    getTheoreticalFinalVelocity() {
        return this.gravity * this.getTheoreticalTime();
    }

    /** 종단속도 — 중력과 공기저항이 같아지는 속력 */
    getTerminalVelocity() {
        if (!this.airResistance) return Infinity;
        const area = this.getCrossSectionArea();
        return Math.sqrt(
            (2 * this.mass * this.gravity) /
            (this.dragCoeff * this.airDensity * area)
        );
    }

    getState() {
        return {
            time: this.time,
            velocity: this.velocity,
            distanceFallen: this.distanceFallen,
            currentHeight: this.currentHeight,
            landed: this.landed,
            initialHeight: this.initialHeight,
        };
    }
}
