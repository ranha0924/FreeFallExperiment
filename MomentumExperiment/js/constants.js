/** 물리 상수 및 설정 데이터 */

export const G = 9.8; // 중력가속도 (m/s²)
export const PHYSICS_DT = 1 / 120; // 고정 타임스텝

// ── 탭1: 관성 ──
export const BUS = {
    length: 12,       // 버스 길이 (m) — 렌더링용
    width: 2.5,
    maxSpeed: 20,     // 주행 속도 (m/s)
};

export const PASSENGERS = [
    { id: 'adult', name: '어른', mass: 70, color: '#3b82f6', labelColor: '#60a5fa' },
    { id: 'child', name: '어린이', mass: 30, color: '#ef4444', labelColor: '#f87171' },
];

export const FORCE_LEVELS = {
    weak:   { label: '약함',  accel: 3 },
    normal: { label: '보통',  accel: 6 },
    strong: { label: '강함',  accel: 10 },
};

export const GRIP_FORCE = 120; // 핸드레일 고정력 (N) — 두 승객 동일

// ── 탭2: 운동량 ──
export const BALL_B_MASS = 0.5;    // 공 B 질량 고정 (kg)
export const FRICTION_COEFF = 0.2; // 마찰계수

export const MOMENTUM_PRESETS = {
    velocity: {
        label: '프리셋 A: 속도 비교',
        desc: '질량이 같으면 속도가 클수록 운동량 크다',
        experiments: [
            { massA: 0.5, velA: 2 },
            { massA: 0.5, velA: 6 },
        ]
    },
    mass: {
        label: '프리셋 B: 질량 비교',
        desc: '속도가 같으면 질량이 클수록 운동량 크다',
        experiments: [
            { massA: 0.1, velA: 5 },
            { massA: 2.0, velA: 5 },
        ]
    }
};

// ── 탭3: 충격량 ──
export const EGG_MASS = 0.06; // 달걀 질량 (kg)
export const EGG_BREAK_FORCE = 50; // 달걀 깨짐 임계 힘 (N)

export const SURFACES = {
    concrete: { name: '콘크리트', deltaT: 0.005, profile: 'rect',  color: '#6b7280', emoji: '🧱' },
    wood:     { name: '나무 바닥', deltaT: 0.02,  profile: 'rect',  color: '#92400e', emoji: '🪵' },
    cushion:  { name: '두꺼운 방석', deltaT: 0.1,   profile: 'bell',  color: '#7c3aed', emoji: '🛋️' },
    airbag:   { name: '에어백/쿠션', deltaT: 0.3,   profile: 'bell',  color: '#0ea5e9', emoji: '🛡️' },
};

export const IMPULSE_PRESETS = {
    contrast: {
        label: '프리셋 1: 같은 충격량, 다른 힘',
        desc: '콘크리트 vs 에어백',
        left: 'concrete', right: 'airbag', height: 2.0
    },
    height: {
        label: '프리셋 2: 높이별 비교',
        desc: '같은 바닥, 다른 높이',
        left: 'wood', right: 'wood', height: 0.5, height2: 4.0
    }
};
