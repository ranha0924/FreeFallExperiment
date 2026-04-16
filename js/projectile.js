/**
 * 수평 투사 운동 물리 엔진
 * FreeFallPhysics를 내부에 포함하여 수직 운동을 위임하고,
 * 수평 운동(등속 또는 공기저항 포함)을 추가로 계산한다.
 */

class ProjectilePhysics {
    constructor(config) {
        this.horizontalVelocity = config.horizontalVelocity || 20;
        this.initialHorizontalVelocity = this.horizontalVelocity;
        this.horizontalDistance = 0;

        // 공기저항 관련
        this.airResistance = config.airResistance || false;
        this.dragCoeff = config.dragCoeff || 0.47;
        this.airDensity = config.airDensity !== undefined ? config.airDensity : 1.225;
        this.mass = config.mass || 1.0;
        this.objectRadius = config.objectRadius || 0.05;
        this.crossSectionArea = config.crossSectionArea || null;

        // 수직 운동은 FreeFallPhysics에 위임
        this.verticalPhysics = new FreeFallPhysics(config);
    }

    getCrossSectionArea() {
        if (this.crossSectionArea) return this.crossSectionArea;
        return Math.PI * this.objectRadius * this.objectRadius;
    }

    reset() {
        this.verticalPhysics.reset();
        this.horizontalVelocity = this.initialHorizontalVelocity;
        this.horizontalDistance = 0;
    }

    update(dt) {
        if (this.verticalPhysics.landed) return;

        this.verticalPhysics.update(dt);

        if (!this.airResistance) {
            // 공기저항 없음: 수평 속도 일정
            this.horizontalDistance = this.horizontalVelocity * this.verticalPhysics.time;
        } else {
            // 공기저항 있음: 수평 방향도 항력 적용 (RK4)
            const area = this.getCrossSectionArea();
            const b = 0.5 * this.dragCoeff * this.airDensity * area;
            const m = this.mass;

            const accel = (vx) => -(b * vx * Math.abs(vx)) / m;

            const v1 = this.horizontalVelocity;
            const a1 = accel(v1);
            const v2 = v1 + 0.5 * dt * a1;
            const a2 = accel(v2);
            const v3 = v1 + 0.5 * dt * a2;
            const a3 = accel(v3);
            const v4 = v1 + dt * a3;
            const a4 = accel(v4);

            this.horizontalVelocity = v1 + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
            const dx = (dt / 6) * (v1 + 2 * v2 + 2 * v3 + v4);
            this.horizontalDistance += dx;
        }
    }

    get time() { return this.verticalPhysics.time; }
    get velocity() { return this.verticalPhysics.velocity; }
    get currentHeight() { return this.verticalPhysics.currentHeight; }
    get distanceFallen() { return this.verticalPhysics.distanceFallen; }
    get landed() { return this.verticalPhysics.landed; }
    get initialHeight() { return this.verticalPhysics.initialHeight; }
    get gravity() { return this.verticalPhysics.gravity; }

    getState() {
        const vs = this.verticalPhysics.getState();
        return {
            ...vs,
            horizontalVelocity: this.horizontalVelocity,
            horizontalDistance: this.horizontalDistance,
            initialHorizontalVelocity: this.initialHorizontalVelocity,
        };
    }
}
