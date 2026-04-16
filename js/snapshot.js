/**
 * 스냅샷 컨트롤러
 * 시뮬레이션 종료 후 매 1초 단위 스냅샷을 관리하고,
 * 사용자가 단계별로 탐색할 수 있게 한다.
 */

class SnapshotController {
    /**
     * @param {object} params
     * @param {number} params.initialHeight - 초기 높이 (m)
     * @param {number} params.gravity - 중력가속도 (m/s²)
     * @param {number} params.horizontalVelocity - B의 초기 수평속도 (m/s)
     * @param {number} params.totalTime - 총 낙하 시간 (초)
     * @param {boolean} params.airResistance - 공기저항 여부
     * @param {object} params.physicsConfig - FreeFallPhysics 생성 config
     * @param {object} params.projectileConfig - ProjectilePhysics 생성 config
     */
    constructor(params) {
        this.snapshots = [];
        this.currentIndex = 0;
        this.generate(params);
    }

    generate(params) {
        const { physicsConfig, projectileConfig, totalTime } = params;

        // 정밀 재시뮬레이션으로 정확한 1초 단위 데이터 생성
        const physA = new FreeFallPhysics(physicsConfig);
        const projB = new ProjectilePhysics(projectileConfig);
        const dt = 1 / 120;
        const maxSeconds = Math.floor(totalTime);

        // 0초 스냅샷
        this.snapshots.push(this._capture(0, physA, projB));

        let nextSecond = 1;
        while (nextSecond <= maxSeconds && !physA.landed) {
            // 다음 정수 초까지 시뮬레이션 진행
            while (physA.time < nextSecond && !physA.landed) {
                physA.update(dt);
                projB.update(dt);
            }
            if (physA.landed) break;
            this.snapshots.push(this._capture(nextSecond, physA, projB));
            nextSecond++;
        }
    }

    _capture(t, physA, projB) {
        const stA = physA.getState();
        const stB = projB.getState();
        return {
            time: t,
            heightA: stA.currentHeight,
            heightB: stB.currentHeight,
            heightDiff: Math.abs(stA.currentHeight - stB.currentHeight),
            horizontalDistB: stB.horizontalDistance,
            verticalSpeedA: stA.velocity,
            verticalSpeedB: stB.velocity,
            horizontalSpeedB: stB.horizontalVelocity,
        };
    }

    getSnapshotCount() {
        return this.snapshots.length;
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    getCurrentSnapshot() {
        return this.snapshots[this.currentIndex];
    }

    getAllSnapshots() {
        return this.snapshots;
    }

    next() {
        if (this.currentIndex < this.snapshots.length - 1) {
            this.currentIndex++;
        }
        return this.getCurrentSnapshot();
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
        }
        return this.getCurrentSnapshot();
    }

    goTo(index) {
        this.currentIndex = Math.max(0, Math.min(index, this.snapshots.length - 1));
        return this.getCurrentSnapshot();
    }
}
