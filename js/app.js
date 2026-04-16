/**
 * 자유낙하 실험 시뮬레이터 — 메인 앱
 * UI 이벤트, 상태 관리, 시뮬레이션 루프, 결과 요약
 */

class FreeFallApp {
    constructor() {
        this.renderer = new SimulationRenderer('sim-canvas');
        this.charts = new ChartManager();
        this.physics = null;
        this.physicsB = null; // 비교 모드용

        // 상태
        this.running = false;
        this.paused = false;
        this.comparisonMode = false;
        this.simultaneousMode = false;
        this.animFrameId = null;
        this.lastTimestamp = null;
        this.chartUpdateTimer = 0;
        this.PHYSICS_DT = 1 / 120;
        this.accumulator = 0;

        // 동시 비교 모드 상태
        this.simState = {
            projectileB: null,
            animationSpeed: 1.0,
            snapshotMode: false,
            snapshotController: null,
            nextMarkerSecond: 1,
        };

        // 실험 기록
        this.history = [];

        this.init();
    }

    init() {
        this.charts.init();
        this.bindControls();
        this.bindKeyboard();
        this.updateParameterDisplay();
        this.setupInitialState();
        this.renderer.render();
        this.setupTheoryAccordion();

        // CSS Grid 레이아웃 완료 후 캔버스 재렌더링 보장
        setTimeout(() => {
            this.renderer.resize();
            this.renderer.render();
        }, 100);
    }

    /** 초기 상태 설정 */
    setupInitialState() {
        const config = this.getConfigFromUI();
        this.physics = new FreeFallPhysics(config);
        const objectType = document.getElementById('object-type').value;
        this.renderer.setObject(this.physics, objectType);
    }

    /** UI에서 설정값 읽기 */
    getConfigFromUI(suffix = '') {
        const height = parseFloat(document.getElementById('height' + suffix).value);
        const planet = document.getElementById('planet' + suffix).value;
        const gravity = PLANETS[planet]?.gravity || 9.8;
        const airDensity = PLANETS[planet]?.airDensity ?? 1.225;
        const objectType = document.getElementById('object-type' + suffix).value;
        const obj = OBJECTS[objectType] || OBJECTS.steel_ball;
        const airResistance = document.getElementById('air-resistance' + suffix).checked;

        return {
            height,
            gravity,
            mass: obj.mass,
            airResistance: airResistance,
            dragCoeff: obj.dragCoeff,
            objectRadius: obj.radius,
            crossSectionArea: obj.crossSectionArea || null,
            airDensity: airDensity,
        };
    }

    /** 컨트롤 이벤트 바인딩 */
    bindControls() {
        // 시작/일시정지/초기화 버튼
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());

        // 높이 슬라이더
        const heightSlider = document.getElementById('height');
        const heightValue = document.getElementById('height-value');
        heightSlider.addEventListener('input', () => {
            heightValue.textContent = heightSlider.value;
            this.onParameterChange();
        });

        // 행성 선택
        document.getElementById('planet').addEventListener('change', (e) => {
            this.onPlanetChange(e.target.value);
        });

        // 물체 종류
        document.getElementById('object-type').addEventListener('change', (e) => {
            this.onObjectChange(e.target.value);
        });

        // 공기저항 토글
        document.getElementById('air-resistance').addEventListener('change', (e) => {
            this.onAirResistanceChange(e.target.checked);
        });

        // 모드 전환 탭
        document.getElementById('tab-single').addEventListener('click', () => this.switchMode('single'));
        document.getElementById('tab-compare').addEventListener('click', () => this.switchMode('compare'));
        document.getElementById('tab-simultaneous').addEventListener('click', () => this.switchMode('simultaneous'));

        // 비교 모드 컨트롤
        const heightSliderB = document.getElementById('height-b');
        if (heightSliderB) {
            heightSliderB.addEventListener('input', () => {
                document.getElementById('height-b-value').textContent = heightSliderB.value;
                this.onParameterChange();
            });
            document.getElementById('planet-b').addEventListener('change', (e) => {
                this.onPlanetChange(e.target.value, '-b');
            });
            document.getElementById('object-type-b').addEventListener('change', (e) => {
                this.onObjectChange(e.target.value, '-b');
            });
            document.getElementById('air-resistance-b').addEventListener('change', (e) => {
                this.onAirResistanceChange(e.target.checked, '-b');
            });
        }

        // 비교 프리셋 버튼들
        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => this.applyPreset(btn.dataset.preset));
        });

        // 동시 비교 모드 컨트롤
        this.bindSimultaneousControls();
    }

    /** 동시 비교 컨트롤 바인딩 */
    bindSimultaneousControls() {
        const heightSim = document.getElementById('height-sim');
        if (heightSim) {
            heightSim.addEventListener('input', () => {
                document.getElementById('height-sim-value').textContent = heightSim.value;
                this.onSimParameterChange();
            });
        }

        const hVel = document.getElementById('horizontal-velocity');
        if (hVel) {
            hVel.addEventListener('input', () => {
                document.getElementById('horizontal-velocity-value').textContent = hVel.value;
                this.onSimParameterChange();
            });
        }

        const planetSim = document.getElementById('planet-sim');
        if (planetSim) {
            planetSim.addEventListener('change', (e) => {
                const planet = e.target.value;
                document.getElementById('gravity-display-sim').textContent =
                    (PLANETS[planet]?.gravity || 9.8) + ' m/s²';
                // 달은 공기저항 비활성화
                const airToggle = document.getElementById('air-resistance-sim');
                if (planet === 'moon') {
                    airToggle.checked = false;
                    airToggle.disabled = true;
                } else {
                    airToggle.disabled = false;
                }
                this.onSimParameterChange();
            });
        }

        document.getElementById('object-type-sim')?.addEventListener('change', () => this.onSimParameterChange());
        document.getElementById('air-resistance-sim')?.addEventListener('change', () => this.onSimParameterChange());

        document.getElementById('animation-speed')?.addEventListener('change', (e) => {
            this.simState.animationSpeed = parseFloat(e.target.value);
        });

        // 동시비교 시작/일시정지/초기화
        document.getElementById('btn-start-sim')?.addEventListener('click', () => this.startSimultaneous());
        document.getElementById('btn-pause-sim')?.addEventListener('click', () => this.togglePause());
        document.getElementById('btn-reset-sim')?.addEventListener('click', () => this.resetSimultaneous());

        // 스냅샷 컨트롤
        document.getElementById('btn-snapshot-prev')?.addEventListener('click', () => this.snapshotPrev());
        document.getElementById('btn-snapshot-next')?.addEventListener('click', () => this.snapshotNext());
        document.getElementById('snapshot-slider')?.addEventListener('input', (e) => {
            this.snapshotGoTo(parseInt(e.target.value));
        });
    }

    /** 키보드 단축키 */
    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.simultaneousMode) {
                    if (!this.running) this.startSimultaneous();
                    else this.togglePause();
                } else {
                    if (!this.running) this.start();
                    else this.togglePause();
                }
            } else if (e.code === 'KeyR') {
                if (this.simultaneousMode) this.resetSimultaneous();
                else this.reset();
            }
        });
    }

    /** 행성 변경 */
    onPlanetChange(planet, suffix = '') {
        const planetData = PLANETS[planet];
        if (!planetData) return;

        document.getElementById('gravity-display' + suffix).textContent =
            planetData.gravity + ' m/s²';

        // 달은 대기가 없으므로 공기저항 비활성화
        const airToggle = document.getElementById('air-resistance' + suffix);
        if (planet === 'moon') {
            airToggle.checked = false;
            airToggle.disabled = true;
            this.showTip('달에는 대기가 없어 공기저항이 적용되지 않아요.', 'air-tip' + suffix);
        } else {
            airToggle.disabled = false;
        }

        // B 패널 공기저항 수준 배지 업데이트
        if (suffix) {
            const objectType = document.getElementById('object-type' + suffix).value;
            const airEnabled = airToggle.checked;
            this.updateAirLevelBadge(suffix, objectType, planet, airEnabled);
        }

        this.onParameterChange();
    }

    /** 물체 변경 */
    onObjectChange(objectType, suffix = '') {
        const obj = OBJECTS[objectType];
        if (!obj) return;

        document.getElementById('mass-display' + suffix).textContent =
            obj.mass >= 1 ? obj.mass + ' kg' : (obj.mass * 1000) + ' g';
        document.getElementById('object-desc' + suffix).textContent = obj.desc;

        // B 패널 공기저항 수준 배지 업데이트
        if (suffix) {
            const planet = document.getElementById('planet' + suffix).value;
            const airEnabled = document.getElementById('air-resistance' + suffix).checked;
            this.updateAirLevelBadge(suffix, objectType, planet, airEnabled);
        }

        this.onParameterChange();
    }

    /** 공기저항 토글 */
    onAirResistanceChange(enabled, suffix = '') {
        const tipEl = document.getElementById('air-tip' + suffix);
        if (enabled) {
            tipEl.textContent = '공기저항이 클수록 천천히 떨어져요. 가볍고 넓은 물체일수록 영향이 커요.';
            tipEl.style.display = 'block';
        } else {
            tipEl.textContent = '공기저항이 없으면 질량에 관계없이 모든 물체가 같은 빠르기로 떨어져요.';
            tipEl.style.display = 'block';
        }

        // B 패널 공기저항 수준 배지 업데이트
        if (suffix) {
            const objectType = document.getElementById('object-type' + suffix).value;
            const planet = document.getElementById('planet' + suffix).value;
            this.updateAirLevelBadge(suffix, objectType, planet, enabled);
        }

        this.onParameterChange();
    }

    /** 파라미터 변경 시 */
    onParameterChange() {
        if (this.running) return;
        this.updateParameterDisplay();
        if (this.comparisonMode) {
            this.setupComparison();
        } else {
            this.setupInitialState();
        }
        this.renderer.render();
        this.hideResult();
    }

    /** 파라미터 표시 업데이트 */
    updateParameterDisplay() {
        const planet = document.getElementById('planet').value;
        const objectType = document.getElementById('object-type').value;

        document.getElementById('gravity-display').textContent =
            (PLANETS[planet]?.gravity || 9.8) + ' m/s²';

        const obj = OBJECTS[objectType];
        if (obj) {
            document.getElementById('mass-display').textContent =
                obj.mass >= 1 ? obj.mass + ' kg' : (obj.mass * 1000) + ' g';
            document.getElementById('object-desc').textContent = obj.desc;
        }

        // 예상 낙하 시간 계산
        const height = parseFloat(document.getElementById('height').value);
        const gravity = PLANETS[planet]?.gravity || 9.8;
        const airResistance = document.getElementById('air-resistance').checked;
        const estTimeEl = document.getElementById('est-time');
        const estLabelEl = document.getElementById('est-time-label');

        if (airResistance) {
            const config = this.getConfigFromUI();
            const result = preComputeFallTime(config);
            if (result) {
                estTimeEl.textContent = result.time.toFixed(2) + ' 초';
            } else {
                estTimeEl.textContent = '계산 불가';
            }
            if (estLabelEl) estLabelEl.textContent = '예상 낙하 시간 (공기저항 포함)';
        } else {
            const theoreticalTime = Math.sqrt(2 * height / gravity);
            estTimeEl.textContent = theoreticalTime.toFixed(2) + ' 초';
            if (estLabelEl) estLabelEl.textContent = '예상 낙하 시간 (진공 이론값)';
        }

        // 공기저항 수준 배지 업데이트
        this.updateAirLevelBadge('', objectType, planet, airResistance);
    }

    /** 공기저항 수준 배지 업데이트 */
    updateAirLevelBadge(suffix, objectType, planet, airEnabled) {
        const badgeEl = document.getElementById('air-level-badge' + suffix);
        const displayEl = document.getElementById('air-level-display' + suffix);

        if (badgeEl) {
            if (airEnabled) {
                const levelInfo = getAirResistanceLevel(objectType, planet);
                if (levelInfo) {
                    const colorMap = { '강': '#dc2626', '중': '#d97706', '약': '#059669' };
                    const color = colorMap[levelInfo.level] || '#64748b';
                    badgeEl.innerHTML = `<span class="air-badge" style="--badge-color:${color}">공기저항: ${levelInfo.level}</span><span class="air-badge-desc">${levelInfo.desc}</span><span class="air-badge-desc">${levelInfo.terminalDesc}</span>`;
                    badgeEl.style.display = 'block';
                } else {
                    badgeEl.style.display = 'none';
                }
            } else {
                badgeEl.style.display = 'none';
            }
        }

        if (displayEl) {
            if (airEnabled) {
                const levelInfo = getAirResistanceLevel(objectType, planet);
                if (levelInfo) {
                    displayEl.innerHTML = `<strong>공기저항: ${levelInfo.level}</strong> — ${levelInfo.desc}`;
                    displayEl.style.display = 'block';
                } else {
                    displayEl.style.display = 'none';
                }
            } else {
                displayEl.style.display = 'none';
            }
        }
    }

    /** 시뮬레이션 시작 */
    start() {
        if (this.running && !this.paused) return;

        if (!this.running) {
            // 새로 시작
            if (this.comparisonMode) {
                this.setupComparison();
            } else {
                const config = this.getConfigFromUI();
                this.physics = new FreeFallPhysics(config);
                const objectType = document.getElementById('object-type').value;
                this.renderer.setObject(this.physics, objectType);
            }
            this.charts.reset();
            this.renderer.clearTrails();
            this.hideResult();
            this.accumulator = 0;

            // 공기저항 없으면 Y축을 중력가속도 단위로 설정
            const airRes = document.getElementById('air-resistance').checked;
            const airResB = this.comparisonMode ? document.getElementById('air-resistance-b').checked : false;
            if (!airRes && !airResB) {
                const planetA = document.getElementById('planet').value;
                const planetBVal = this.comparisonMode ? document.getElementById('planet-b').value : planetA;
                if (planetA === planetBVal) {
                    this.charts.setGravityTicks(PLANETS[planetA]?.gravity || 9.8);
                } else {
                    this.charts.setGravityTicks(null);
                }
            } else {
                this.charts.setGravityTicks(null);
            }
        }

        this.running = true;
        this.paused = false;
        this.lastTimestamp = null;

        document.getElementById('btn-start').disabled = true;
        document.getElementById('btn-pause').disabled = false;
        this.disableControls(true);

        this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }

    /** 비교 모드 설정 */
    setupComparison() {
        const configA = this.getConfigFromUI('');
        const configB = this.getConfigFromUI('-b');
        this.physics = new FreeFallPhysics(configA);
        this.physicsB = new FreeFallPhysics(configB);

        const typeA = document.getElementById('object-type').value;
        const typeB = document.getElementById('object-type-b').value;
        this.renderer.setComparisonObjects(this.physics, typeA, this.physicsB, typeB);

        const nameA = OBJECTS[typeA]?.name || '물체 A';
        const nameB = OBJECTS[typeB]?.name || '물체 B';
        this.charts.enableComparisonMode(nameA, nameB, '#3b82f6', '#ef4444');
    }

    /** 일시정지 토글 */
    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;

        const btnId = this.simultaneousMode ? 'btn-pause-sim' : 'btn-pause';
        document.getElementById(btnId).textContent = this.paused ? '계속' : '일시정지';

        if (!this.paused) {
            this.lastTimestamp = null;
            this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
        }
    }

    /** 초기화 */
    reset() {
        this.running = false;
        this.paused = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }

        this.charts.reset();

        if (this.comparisonMode) {
            this.setupComparison();
        } else {
            this.setupInitialState();
        }

        this.renderer.clearTrails();
        this.renderer.render();
        const height = parseFloat(document.getElementById('height').value);
        this.updateDataPanel(0, 0, 0, height);

        // 비교 테이블도 초기화
        const compTable = document.getElementById('comparison-table');
        if (compTable) {
            compTable.querySelector('.vel-a').textContent = '0.00';
            compTable.querySelector('.vel-b').textContent = '0.00';
            compTable.querySelector('.dist-a').textContent = '0.00';
            compTable.querySelector('.dist-b').textContent = '0.00';
            compTable.querySelector('.height-a').textContent = height.toFixed(2);
            compTable.querySelector('.height-b').textContent =
                parseFloat(document.getElementById('height-b').value).toFixed(2);
            const timeCompare = document.getElementById('data-time-compare');
            if (timeCompare) timeCompare.textContent = '0.00 초';
        }

        // 시간차 행 초기화
        const deltaRow = document.getElementById('delta-time-row');
        if (deltaRow) deltaRow.style.display = 'none';

        this.hideResult();

        document.getElementById('btn-start').disabled = false;
        document.getElementById('btn-pause').disabled = true;
        document.getElementById('btn-pause').textContent = '일시정지';
        this.disableControls(false);
    }

    /** 메인 루프 */
    loop(timestamp) {
        if (!this.running || this.paused) return;

        if (this.lastTimestamp === null) {
            this.lastTimestamp = timestamp;
            this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
            return;
        }

        let wallDt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
        this.lastTimestamp = timestamp;

        // 동시비교 모드: 애니메이션 속도 적용
        if (this.simultaneousMode) {
            wallDt *= this.simState.animationSpeed;
        }

        this.accumulator += wallDt;

        // 고정 시간 간격으로 물리 계산
        while (this.accumulator >= this.PHYSICS_DT) {
            this.physics.update(this.PHYSICS_DT);
            if (this.comparisonMode && this.physicsB) {
                this.physicsB.update(this.PHYSICS_DT);
            }
            if (this.simultaneousMode && this.simState.projectileB) {
                this.simState.projectileB.update(this.PHYSICS_DT);
            }
            this.accumulator -= this.PHYSICS_DT;
        }

        // 동시비교 모드: 1초 마커 기록 (실제 물리 상태 사용)
        if (this.simultaneousMode && this.simState.projectileB) {
            const t = this.physics.time;
            while (this.simState.nextMarkerSecond <= t && !this.physics.landed) {
                const stA = this.physics.getState();
                const stB = this.simState.projectileB.getState();
                this.renderer.addSecondMarker(
                    this.simState.nextMarkerSecond,
                    Math.max(0, stA.currentHeight),
                    Math.max(0, stB.currentHeight),
                    stB.horizontalDistance
                );
                this.simState.nextMarkerSecond++;
            }
        }

        // 렌더링
        this.renderer.render();

        // 데이터 패널 & 그래프 업데이트 (20Hz로 제한)
        this.chartUpdateTimer += wallDt;
        if (this.chartUpdateTimer >= 0.05) {
            this.chartUpdateTimer = 0;
            const stateA = this.physics.getState();

            if (this.simultaneousMode && this.simState.projectileB) {
                const stateB = this.simState.projectileB.getState();
                this.updateSimDataPanel(stateA.time, stateA.velocity, stateB.velocity,
                    stateA.currentHeight, 0, stateB.horizontalVelocity, stateB.horizontalDistance);
                this.charts.addSimultaneousDataPoint(stateA.time,
                    stateA.velocity, stateB.velocity, 0, stateB.horizontalVelocity);
                this.charts.updateSimultaneousCharts();
            } else if (this.comparisonMode && this.physicsB) {
                const stateB = this.physicsB.getState();
                this.updateDataPanelComparison(stateA, stateB);
                this.charts.addComparisonDataPoint(
                    stateA.time, stateA.velocity, stateB.velocity
                );
                this.charts.updateCharts();
            } else {
                this.updateDataPanel(
                    stateA.time, stateA.velocity,
                    stateA.distanceFallen, stateA.currentHeight
                );
                this.charts.addDataPoint(stateA.time, stateA.velocity);
                this.charts.updateCharts();
            }
        }

        // 종료 체크
        let allLanded;
        if (this.simultaneousMode) {
            allLanded = this.physics.landed && this.simState.projectileB && this.simState.projectileB.landed;
        } else if (this.comparisonMode) {
            allLanded = this.physics.landed && this.physicsB && this.physicsB.landed;
        } else {
            allLanded = this.physics.landed;
        }

        if (allLanded) {
            if (this.simultaneousMode) {
                this.onSimulationCompleteSimultaneous();
            } else {
                this.onSimulationComplete();
            }
            return;
        }

        // 비교 모드: 한쪽이 먼저 착지하면 시간차 표시 시작
        if (this.comparisonMode && this.physicsB) {
            if (this.physics.landed !== this.physicsB.landed) {
                this.updateDeltaTime();
            }
        }

        this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }

    /** 데이터 패널 업데이트 (단일 모드) */
    updateDataPanel(time, velocity, distance, height) {
        document.getElementById('data-time').textContent = time.toFixed(2) + ' 초';
        document.getElementById('data-velocity').textContent = velocity.toFixed(2) + ' m/s';
        document.getElementById('data-distance').textContent = distance.toFixed(2) + ' m';
        document.getElementById('data-height').textContent = height.toFixed(2) + ' m';
    }

    /** 데이터 패널 업데이트 (비교 모드) */
    updateDataPanelComparison(stateA, stateB) {
        const timeEl = document.getElementById('data-time-compare');
        if (timeEl) timeEl.textContent = Math.max(stateA.time, stateB.time).toFixed(2) + ' 초';

        // 비교 테이블 업데이트
        const compTable = document.getElementById('comparison-table');
        if (compTable) {
            compTable.querySelector('.vel-a').textContent = stateA.velocity.toFixed(2);
            compTable.querySelector('.vel-b').textContent = stateB.velocity.toFixed(2);
            compTable.querySelector('.dist-a').textContent = stateA.distanceFallen.toFixed(2);
            compTable.querySelector('.dist-b').textContent = stateB.distanceFallen.toFixed(2);
            compTable.querySelector('.height-a').textContent = stateA.currentHeight.toFixed(2);
            compTable.querySelector('.height-b').textContent = stateB.currentHeight.toFixed(2);
        }
    }

    /** 시뮬레이션 완료 */
    onSimulationComplete() {
        this.running = false;

        // 최종 데이터 갱신
        const stateA = this.physics.getState();
        if (this.comparisonMode && this.physicsB) {
            const stateB = this.physicsB.getState();
            this.updateDataPanelComparison(stateA, stateB);
            this.charts.addComparisonDataPoint(
                Math.max(stateA.time, stateB.time),
                stateA.velocity, stateB.velocity
            );
            this.showComparisonResult(stateA, stateB);
            this.updateDeltaTime();
        } else {
            this.updateDataPanel(stateA.time, stateA.velocity, stateA.distanceFallen, 0);
            this.charts.addDataPoint(stateA.time, stateA.velocity);
            this.showResult(stateA);
        }
        this.charts.updateCharts();

        document.getElementById('btn-start').disabled = false;
        document.getElementById('btn-pause').disabled = true;
        this.disableControls(false);

        // 실험 기록 저장
        this.saveToHistory(stateA);
    }

    /** 단일 모드 결과 표시 */
    showResult(state) {
        const resultEl = document.getElementById('result-card');
        const planet = document.getElementById('planet').value;
        const objectType = document.getElementById('object-type').value;
        const airRes = document.getElementById('air-resistance').checked;

        resultEl.innerHTML = `
            <h3>실험 결과</h3>
            <div class="result-grid">
                <div class="result-item">
                    <span class="result-label">낙하 시간</span>
                    <span class="result-value">${state.time.toFixed(2)} 초</span>
                </div>
                <div class="result-item">
                    <span class="result-label">착지 속력</span>
                    <span class="result-value">${state.velocity.toFixed(2)} m/s</span>
                </div>
                <div class="result-item">
                    <span class="result-label">낙하 거리</span>
                    <span class="result-value">${state.distanceFallen.toFixed(2)} m</span>
                </div>
            </div>
            <div class="result-conditions">
                <strong>실험 조건:</strong>
                ${PLANETS[planet].name} (중력가속도 ${PLANETS[planet].gravity} m/s²),
                ${OBJECTS[objectType]?.name || '물체'} (${this.formatMass(OBJECTS[objectType]?.mass)}),
                공기저항 ${airRes ? '있음' : '없음'}
            </div>
            <div class="result-insight">
                ${this.getInsight(planet, objectType, airRes, state)}
            </div>
        `;
        resultEl.style.display = 'block';
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /** 비교 결과 표시 */
    showComparisonResult(stateA, stateB) {
        const resultEl = document.getElementById('result-card');
        const planetA = document.getElementById('planet').value;
        const planetB = document.getElementById('planet-b').value;
        const typeA = document.getElementById('object-type').value;
        const typeB = document.getElementById('object-type-b').value;
        const airA = document.getElementById('air-resistance').checked;
        const airB = document.getElementById('air-resistance-b').checked;

        const timeDiff = Math.abs(stateA.time - stateB.time);
        const faster = stateA.time < stateB.time ? 'A' : 'B';

        resultEl.innerHTML = `
            <h3>비교 실험 결과</h3>
            <table class="result-compare-table">
                <thead>
                    <tr>
                        <th>측정값</th>
                        <th style="color:#3b82f6">물체 A (${OBJECTS[typeA]?.name})</th>
                        <th style="color:#ef4444">물체 B (${OBJECTS[typeB]?.name})</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>낙하 시간</td>
                        <td>${stateA.time.toFixed(2)} 초</td>
                        <td>${stateB.time.toFixed(2)} 초</td>
                    </tr>
                    <tr>
                        <td>착지 속력</td>
                        <td>${stateA.velocity.toFixed(2)} m/s</td>
                        <td>${stateB.velocity.toFixed(2)} m/s</td>
                    </tr>
                    <tr>
                        <td>행성</td>
                        <td>${PLANETS[planetA].name}</td>
                        <td>${PLANETS[planetB].name}</td>
                    </tr>
                    <tr>
                        <td>공기저항</td>
                        <td>${airA ? '있음' : '없음'}</td>
                        <td>${airB ? '있음' : '없음'}</td>
                    </tr>
                </tbody>
            </table>
            <div class="result-insight">
                ${this.getComparisonInsight(stateA, stateB, planetA, planetB, typeA, typeB, airA, airB)}
            </div>
        `;
        resultEl.style.display = 'block';
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /** 교육적 관찰 포인트 생성 (단일 모드) */
    getInsight(planet, objectType, airRes, state) {
        const insights = [];

        if (!airRes) {
            insights.push('공기저항이 없으므로 물체의 질량에 관계없이 같은 시간 동안 같은 거리를 낙하해요.');
            insights.push(`이론 낙하 시간: ${this.physics.getTheoreticalTime().toFixed(2)} 초`);
        } else {
            const tv = this.physics.getTerminalVelocity();
            if (state.velocity >= tv * 0.95) {
                insights.push(`이 물체는 약 ${tv.toFixed(1)} m/s에서 더 이상 빨라지지 않았어요. 이 속력을 종단속도라고 해요.`);
            }
            insights.push('공기저항이 클수록 천천히 떨어져요. 가볍고 넓은 물체일수록 공기저항의 영향이 커요.');
        }

        if (planet !== 'earth') {
            const earthTime = Math.sqrt(2 * this.physics.initialHeight / 9.8);
            insights.push(`같은 높이에서 지구(중력가속도 9.8 m/s²)라면 약 ${earthTime.toFixed(2)} 초 만에 도달합니다.`);
        }

        return insights.map(i => `<p>▸ ${i}</p>`).join('');
    }

    /** 교육적 관찰 포인트 생성 (비교 모드) */
    getComparisonInsight(stA, stB, plA, plB, tyA, tyB, arA, arB) {
        const insights = [];
        const timeDiff = Math.abs(stA.time - stB.time);

        // 같은 조건에서 질량만 다를 때
        if (plA === plB && !arA && !arB) {
            if (timeDiff < 0.01) {
                const nameA = OBJECTS[tyA]?.name || '물체 A';
                const nameB = OBJECTS[tyB]?.name || '물체 B';
                const massStrA = this.formatMass(OBJECTS[tyA]?.mass);
                const massStrB = this.formatMass(OBJECTS[tyB]?.mass);
                insights.push(`<strong>핵심 관찰:</strong> 질량이 다른 두 물체(${nameA} ${massStrA}, ${nameB} ${massStrB})가 동시에 도착했어요!`);
                insights.push('무거운 물체는 중력을 더 많이 받지만, 관성(움직이기 어려운 정도)도 크기 때문에 <strong>가속도 = 중력 ÷ 질량 = 중력가속도</strong>로 모두 같아요.');
            }
        }

        // 공기저항 유무 비교
        if (arA !== arB) {
            const withAir = arA ? 'A' : 'B';
            const withoutAir = arA ? 'B' : 'A';
            insights.push(`공기저항이 있는 물체 ${withAir}가 없는 물체 ${withoutAir}보다 더 느리게 떨어졌습니다. 공기저항은 물체의 낙하를 방해합니다.`);
        }

        // 다른 행성 비교
        if (plA !== plB) {
            const gA = PLANETS[plA].gravity;
            const gB = PLANETS[plB].gravity;
            const biggerG = gA > gB ? PLANETS[plA].name : PLANETS[plB].name;
            insights.push(`중력가속도가 큰 ${biggerG}에서 물체가 더 빠르게 떨어집니다. 중력가속도가 클수록 물체에 작용하는 중력이 크기 때문입니다.`);
        }

        if (timeDiff > 0.01) {
            const faster = stA.time < stB.time ? 'A' : 'B';
            insights.push(`물체 ${faster}가 약 ${timeDiff.toFixed(2)} 초 먼저 도달했습니다.`);
        }

        if (insights.length === 0) {
            insights.push('두 물체의 조건이 동일하여 같은 결과를 보입니다.');
        }

        return insights.map(i => `<p>▸ ${i}</p>`).join('');
    }

    /** 결과 카드 숨기기 */
    hideResult() {
        document.getElementById('result-card').style.display = 'none';
    }

    /** 질량을 읽기 좋은 문자열로 변환 */
    formatMass(mass) {
        if (mass === undefined || mass === null) return '알 수 없음';
        if (mass >= 1) return mass + ' kg';
        return Math.round(mass * 1000) + ' g';
    }

    /** 모드 전환 */
    switchMode(mode) {
        this.running = false;
        this.paused = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

        // 이전 동시비교 모드 정리
        if (this.simultaneousMode) {
            this.renderer.clearSimultaneousMode();
            this.charts.disableSimultaneousMode();
            this.hideSimultaneousUI();
        }

        this.comparisonMode = mode === 'compare';
        this.simultaneousMode = mode === 'simultaneous';

        if (!this.simultaneousMode) {
            this.reset();
        }

        // 탭 활성화
        document.getElementById('tab-single').classList.toggle('active', mode === 'single');
        document.getElementById('tab-compare').classList.toggle('active', mode === 'compare');
        document.getElementById('tab-simultaneous').classList.toggle('active', mode === 'simultaneous');

        // 비교 모드 UI
        document.getElementById('controls-b').style.display = this.comparisonMode ? 'block' : 'none';
        document.getElementById('comparison-table').style.display = this.comparisonMode ? 'table' : 'none';
        document.getElementById('preset-buttons').style.display = this.comparisonMode ? 'flex' : 'none';

        // 동시비교 모드 UI
        document.getElementById('controls-simultaneous').style.display = this.simultaneousMode ? 'block' : 'none';
        document.getElementById('simultaneous-data').style.display = this.simultaneousMode ? 'block' : 'none';

        // 기존 컨트롤 & 데이터
        document.getElementById('controls-a').style.display = this.simultaneousMode ? 'none' : '';
        document.getElementById('single-data').style.display =
            (this.comparisonMode || this.simultaneousMode) ? 'none' : 'block';

        if (this.comparisonMode) {
            this.charts.enableComparisonMode('물체 A', '물체 B', '#3b82f6', '#ef4444');
        } else if (this.simultaneousMode) {
            this.charts.enableSimultaneousMode();
            this.resetSimultaneous();
        } else {
            this.charts.disableComparisonMode();
        }
    }

    /** 비교 프리셋 적용 */
    applyPreset(preset) {
        this.reset();

        switch (preset) {
            case 'mass':
                // 볼링공 vs 깃털 (진공) — 질량 2000배 차이, 동시 착지 확인
                document.getElementById('object-type').value = 'bowling';
                document.getElementById('object-type-b').value = 'feather';
                document.getElementById('air-resistance').checked = false;
                document.getElementById('air-resistance-b').checked = false;
                document.getElementById('planet').value = 'earth';
                document.getElementById('planet-b').value = 'earth';
                document.getElementById('height').value = 50;
                document.getElementById('height-b').value = 50;
                this.showTip('볼링공(6kg)과 깃털(3g)을 진공에서 동시에 떨어뜨려요. 질량이 2000배 차이나도 가속도는 같을까요? 공기저항을 켜서도 비교해보세요!');
                break;

            case 'air':
                // 같은 물체, 공기저항 유무 비교
                document.getElementById('object-type').value = 'feather';
                document.getElementById('object-type-b').value = 'feather';
                document.getElementById('air-resistance').checked = false;
                document.getElementById('air-resistance-b').checked = true;
                document.getElementById('planet').value = 'earth';
                document.getElementById('planet-b').value = 'earth';
                document.getElementById('height').value = 50;
                document.getElementById('height-b').value = 50;
                this.showTip('같은 깃털을 공기저항 유무만 다르게 떨어뜨립니다. 차이가 얼마나 날까요?');
                break;

            case 'planet':
                // 지구 vs 달 비교
                document.getElementById('object-type').value = 'steel_ball';
                document.getElementById('object-type-b').value = 'steel_ball';
                document.getElementById('air-resistance').checked = false;
                document.getElementById('air-resistance-b').checked = false;
                document.getElementById('planet').value = 'earth';
                document.getElementById('planet-b').value = 'moon';
                document.getElementById('height').value = 50;
                document.getElementById('height-b').value = 50;
                this.showTip('같은 쇠구슬을 지구와 달에서 각각 떨어뜨립니다. 중력가속도의 차이를 관찰해보세요!');
                break;
        }

        // 표시값 갱신
        document.getElementById('height-value').textContent = document.getElementById('height').value;
        document.getElementById('height-b-value').textContent = document.getElementById('height-b').value;
        this.onPlanetChange(document.getElementById('planet').value);
        this.onPlanetChange(document.getElementById('planet-b').value, '-b');
        this.onObjectChange(document.getElementById('object-type').value);
        this.onObjectChange(document.getElementById('object-type-b').value, '-b');
    }

    /** 안내 팁 표시 */
    showTip(message, targetId = 'tip-message') {
        const tipEl = document.getElementById(targetId);
        if (tipEl) {
            tipEl.textContent = message;
            tipEl.style.display = 'block';
            setTimeout(() => { tipEl.style.display = 'none'; }, 6000);
        }
    }

    /** 컨트롤 비활성화/활성화 */
    disableControls(disabled) {
        const controls = document.querySelectorAll('.controls-panel input, .controls-panel select, .controls-b input, .controls-b select');
        controls.forEach(el => el.disabled = disabled);

        // 컨트롤 재활성화 시 달의 공기저항 비활성화 상태 복원
        if (!disabled) {
            this.applyPlanetAirConstraint('');
            if (this.comparisonMode) this.applyPlanetAirConstraint('-b');
        }
    }

    /** 행성별 공기저항 제약 적용 (달: 대기 없음) */
    applyPlanetAirConstraint(suffix) {
        const planet = document.getElementById('planet' + suffix).value;
        if (planet === 'moon') {
            const airToggle = document.getElementById('air-resistance' + suffix);
            airToggle.checked = false;
            airToggle.disabled = true;
        }
    }

    /** 비교 모드: 도착 시간 차이 표시 */
    updateDeltaTime() {
        const row = document.getElementById('delta-time-row');
        const cell = document.getElementById('delta-time');
        if (!row || !cell || !this.physics || !this.physicsB) return;

        const stateA = this.physics.getState();
        const stateB = this.physicsB.getState();

        if (stateA.landed && stateB.landed) {
            const diff = Math.abs(stateA.time - stateB.time);
            if (diff < 0.01) {
                cell.textContent = '거의 동시 착지!';
            } else {
                const faster = stateA.time < stateB.time ? 'A' : 'B';
                cell.textContent = `물체 ${faster}가 ${diff.toFixed(2)}초 먼저 도착`;
            }
            row.style.display = '';
        } else if (stateA.landed || stateB.landed) {
            const landed = stateA.landed ? 'A' : 'B';
            cell.textContent = `물체 ${landed} 먼저 착지!`;
            row.style.display = '';
        }
    }

    /* ==========================================
     * 동시 비교 실험 모드
     * ========================================== */

    /** 동시 비교 설정값 읽기 */
    getSimConfig() {
        const height = parseFloat(document.getElementById('height-sim').value);
        const planet = document.getElementById('planet-sim').value;
        const gravity = PLANETS[planet]?.gravity || 9.8;
        const airDensity = PLANETS[planet]?.airDensity ?? 1.225;
        const objectType = document.getElementById('object-type-sim').value;
        const obj = OBJECTS[objectType] || OBJECTS.steel_ball;
        const airResistance = document.getElementById('air-resistance-sim').checked;
        const horizontalVelocity = parseFloat(document.getElementById('horizontal-velocity').value);

        const base = {
            height, gravity, mass: obj.mass,
            airResistance, dragCoeff: obj.dragCoeff,
            objectRadius: obj.radius,
            crossSectionArea: obj.crossSectionArea || null,
            airDensity,
        };
        return { base, horizontalVelocity, planet, objectType };
    }

    /** 동시 비교 파라미터 변경 */
    onSimParameterChange() {
        if (this.running) return;
        this.setupSimultaneousPreview();
    }

    /** 동시 비교 미리보기 설정 */
    setupSimultaneousPreview() {
        const { base, horizontalVelocity } = this.getSimConfig();

        this.physics = new FreeFallPhysics(base);
        this.simState.projectileB = new ProjectilePhysics({
            ...base, horizontalVelocity
        });

        // 수평 거리 범위 계산
        const fallResult = preComputeFallTime(base);
        const totalTime = fallResult ? fallResult.time : Math.sqrt(2 * base.height / base.gravity);
        const maxHDist = horizontalVelocity * totalTime * 1.1;

        this.renderer.setSimultaneousObjects(this.physics, this.simState.projectileB, maxHDist);
        this.renderer.render();

        // 데이터 패널 초기화
        this.updateSimDataPanel(0, 0, 0, base.height, 0, horizontalVelocity, 0);
    }

    /** 동시 비교 시작 */
    startSimultaneous() {
        if (this.running && !this.paused) return;

        if (!this.running) {
            const { base, horizontalVelocity } = this.getSimConfig();

            this.physics = new FreeFallPhysics(base);
            this.simState.projectileB = new ProjectilePhysics({
                ...base, horizontalVelocity
            });

            // 수평 거리 범위
            const fallResult = preComputeFallTime(base);
            const totalTime = fallResult ? fallResult.time : Math.sqrt(2 * base.height / base.gravity);
            const maxHDist = horizontalVelocity * totalTime * 1.1;

            this.renderer.setSimultaneousObjects(this.physics, this.simState.projectileB, maxHDist);
            this.renderer.clearSnapshotMode();
            this.charts.resetSimultaneous();
            this.hideResult();
            this.hideSimultaneousUI();
            this.accumulator = 0;
            this.simState.nextMarkerSecond = 1;
            this.simState.animationSpeed = parseFloat(document.getElementById('animation-speed').value);
        }

        this.running = true;
        this.paused = false;
        this.lastTimestamp = null;

        document.getElementById('btn-start-sim').disabled = true;
        document.getElementById('btn-pause-sim').disabled = false;
        this.disableSimControls(true);

        this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }

    /** 동시 비교 초기화 */
    resetSimultaneous() {
        this.running = false;
        this.paused = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

        this.charts.resetSimultaneous();
        this.hideResult();
        this.hideSimultaneousUI();

        this.setupSimultaneousPreview();

        document.getElementById('btn-start-sim').disabled = false;
        document.getElementById('btn-pause-sim').disabled = true;
        document.getElementById('btn-pause-sim').textContent = '일시정지';
        this.disableSimControls(false);
    }

    /** 동시 비교 데이터 패널 업데이트 */
    updateSimDataPanel(time, vvelA, vvelB, heightVal, hvelA, hvelB, hdistB) {
        document.getElementById('data-time-sim').textContent = time.toFixed(2) + ' 초';

        const table = document.getElementById('simultaneous-data');
        if (!table) return;
        table.querySelector('.sim-height-a').textContent = heightVal.toFixed(2);
        table.querySelector('.sim-height-b').textContent = heightVal.toFixed(2);
        table.querySelector('.sim-vvel-a').textContent = vvelA.toFixed(2);
        table.querySelector('.sim-vvel-b').textContent = vvelB.toFixed(2);
        table.querySelector('.sim-hvel-a').textContent = hvelA.toFixed(2);
        table.querySelector('.sim-hvel-b').textContent = hvelB.toFixed(2);
        table.querySelector('.sim-hdist-b').textContent = hdistB.toFixed(2);
    }

    /** 동시 비교 시뮬레이션 완료 */
    onSimulationCompleteSimultaneous() {
        this.running = false;
        const stateA = this.physics.getState();
        const stateB = this.simState.projectileB.getState();

        // 최종 데이터
        this.updateSimDataPanel(stateA.time, stateA.velocity, stateB.velocity,
            0, 0, stateB.horizontalVelocity, stateB.horizontalDistance);
        this.charts.addSimultaneousDataPoint(stateA.time,
            stateA.velocity, stateB.velocity, 0, stateB.horizontalVelocity);
        this.charts.updateSimultaneousCharts();

        // 스냅샷 컨트롤러 생성
        const { base, horizontalVelocity } = this.getSimConfig();
        this.simState.snapshotController = new SnapshotController({
            physicsConfig: base,
            projectileConfig: { ...base, horizontalVelocity },
            totalTime: stateA.time
        });

        // 스냅샷 UI 표시
        this.showSnapshotUI();

        // 개념 요약 표시
        this.showConceptSummary(stateA, stateB);

        document.getElementById('btn-start-sim').disabled = false;
        document.getElementById('btn-pause-sim').disabled = true;
        this.disableSimControls(false);
    }

    /** 스냅샷 UI 표시 */
    showSnapshotUI() {
        const ctrl = this.simState.snapshotController;
        if (!ctrl) return;

        const section = document.getElementById('snapshot-section');
        section.style.display = 'block';

        // 슬라이더 범위 설정
        const slider = document.getElementById('snapshot-slider');
        slider.max = ctrl.getSnapshotCount() - 1;
        slider.value = 0;

        // 테이블 빌드
        this.buildSnapshotTable(ctrl.getAllSnapshots());

        // 첫 스냅샷으로 이동
        this.snapshotGoTo(0);

        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /** 스냅샷 테이블 빌드 */
    buildSnapshotTable(snapshots) {
        const tbody = document.getElementById('snapshot-table-body');
        const airRes = document.getElementById('air-resistance-sim').checked;
        tbody.innerHTML = '';

        snapshots.forEach((s, i) => {
            const row = document.createElement('tr');
            row.id = 'snapshot-row-' + i;

            const diffClass = s.heightDiff < 0.1 ? 'zero-diff' : '';
            const constClass = !airRes ? 'constant-val' : '';

            row.innerHTML = `
                <td>${s.time}초</td>
                <td>${s.heightA.toFixed(1)} m</td>
                <td>${s.heightB.toFixed(1)} m</td>
                <td class="${diffClass}">${s.heightDiff.toFixed(2)} m</td>
                <td>${s.horizontalDistB.toFixed(1)} m</td>
                <td>${s.verticalSpeedA.toFixed(1)} m/s</td>
                <td>${s.verticalSpeedB.toFixed(1)} m/s</td>
                <td class="${constClass}">${s.horizontalSpeedB.toFixed(1)} m/s</td>
            `;
            tbody.appendChild(row);
        });
    }

    /** 스냅샷 네비게이션 */
    snapshotGoTo(index) {
        const ctrl = this.simState.snapshotController;
        if (!ctrl) return;

        ctrl.goTo(index);
        const snap = ctrl.getCurrentSnapshot();

        document.getElementById('snapshot-slider').value = index;
        document.getElementById('snapshot-time-label').textContent = snap.time + ' 초';

        // 테이블 행 하이라이트
        document.querySelectorAll('#snapshot-table-body tr').forEach((row, i) => {
            row.classList.toggle('active-row', i === index);
        });

        // 캔버스를 스냅샷 모드로 렌더
        this.renderer.setSnapshotMode(ctrl.getAllSnapshots(), index);
        this.renderer.render();
    }

    snapshotPrev() {
        const ctrl = this.simState.snapshotController;
        if (!ctrl) return;
        this.snapshotGoTo(ctrl.getCurrentIndex() - 1);
    }

    snapshotNext() {
        const ctrl = this.simState.snapshotController;
        if (!ctrl) return;
        this.snapshotGoTo(ctrl.getCurrentIndex() + 1);
    }

    /** 개념 요약 패널 표시 */
    showConceptSummary(stateA, stateB) {
        const el = document.getElementById('concept-summary');
        const { base, horizontalVelocity } = this.getSimConfig();
        const g = base.gravity;
        const hVel = stateB.horizontalVelocity;
        const airRes = base.airResistance;

        el.innerHTML = `
            <h3>이번 실험에서 확인한 사실</h3>
            <div class="observation">
                <strong>✅ 두 물체는 같은 시각에 같은 높이에 있었습니다.</strong>
                <span class="obs-detail">→ 수평으로 던진 물체의 연직 방향 운동은 자유낙하와 같습니다!</span>
            </div>
            <div class="observation">
                <strong>✅ 물체 B의 수평 속도는 ${airRes ? '공기저항으로 인해 점차 감소했습니다.' : `처음부터 끝까지 ${horizontalVelocity} m/s로 일정했습니다.`}</strong>
                <span class="obs-detail">→ ${airRes ? '공기저항이 수평 속도를 감소시킵니다.' : '중력은 수평 방향으로 작용하지 않습니다!'}</span>
            </div>
            <div class="observation">
                <strong>✅ 두 물체의 연직 방향 속도 그래프가 완전히 일치했습니다.</strong>
                <span class="obs-detail">→ 수평 속도가 있든 없든, 떨어지는 운동은 같습니다!</span>
            </div>
            <div class="observation">
                <strong>✅ 두 물체 모두 아래 방향으로 일정한 크기의 가속도(중력)를 받았습니다.</strong>
                <span class="obs-detail">→ 중력의 방향은 항상 연직 아래이고, 크기는 ${g} m/s²로 일정합니다!</span>
            </div>
        `;
        el.style.display = 'block';
    }

    /** 동시 비교 UI 숨기기 */
    hideSimultaneousUI() {
        document.getElementById('snapshot-section').style.display = 'none';
        document.getElementById('concept-summary').style.display = 'none';
    }

    /** 동시 비교 컨트롤 비활성화/활성화 */
    disableSimControls(disabled) {
        const panel = document.getElementById('controls-simultaneous');
        if (!panel) return;
        panel.querySelectorAll('input, select').forEach(el => {
            el.disabled = disabled;
        });
        if (!disabled) {
            const planet = document.getElementById('planet-sim').value;
            if (planet === 'moon') {
                document.getElementById('air-resistance-sim').disabled = true;
            }
        }
    }

    /** 실험 기록 저장 */
    saveToHistory(state) {
        const planet = document.getElementById('planet').value;
        const objectType = document.getElementById('object-type').value;
        const airRes = document.getElementById('air-resistance').checked;

        this.history.push({
            planet: PLANETS[planet].name,
            object: OBJECTS[objectType]?.name || '물체',
            height: this.physics.initialHeight,
            gravity: this.physics.gravity,
            airResistance: airRes,
            time: state.time,
            finalVelocity: state.velocity,
        });

        this.updateHistoryTable();
    }

    /** 실험 기록 테이블 업데이트 */
    updateHistoryTable() {
        const tbody = document.getElementById('history-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.history.forEach((h, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${h.planet}</td>
                <td>${h.object}</td>
                <td>${h.height} m</td>
                <td>${h.airResistance ? '있음' : '없음'}</td>
                <td>${h.time.toFixed(2)} 초</td>
                <td>${h.finalVelocity.toFixed(2)} m/s</td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('history-section').style.display =
            this.history.length > 0 ? 'block' : 'none';
    }

    /** 이론 섹션 아코디언 */
    setupTheoryAccordion() {
        document.querySelectorAll('.theory-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isOpen = content.style.maxHeight;
                // 모두 닫기
                document.querySelectorAll('.theory-content').forEach(c => {
                    c.style.maxHeight = null;
                    c.previousElementSibling.classList.remove('open');
                });
                // 현재 항목 토글
                if (!isOpen) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    header.classList.add('open');
                }
            });
        });
    }
}

// 앱 실행
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FreeFallApp();
});
