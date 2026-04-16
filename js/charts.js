/**
 * Chart.js 기반 속도-시간 그래프 관리
 */

class ChartManager {
    constructor() {
        this.velocityChart = null;
        this.initialized = false;
    }

    init() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js를 불러올 수 없습니다. 그래프 기능이 비활성화됩니다.');
            document.querySelectorAll('.chart-fallback').forEach(el => {
                el.style.display = 'flex';
            });
            return;
        }

        const velCtx = document.getElementById('velocity-chart');
        if (velCtx) {
            this.velocityChart = new Chart(velCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: '속도 (m/s)',
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139,92,246,0.1)',
                        fill: true,
                        data: []
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    interaction: { intersect: false, mode: 'index' },
                    scales: {
                        x: {
                            type: 'linear',
                            title: {
                                display: true,
                                text: '시간 (초)',
                                color: '#64748b',
                                font: { size: 13, family: 'system-ui' }
                            },
                            min: 0,
                            ticks: { color: '#94a3b8', font: { size: 11 } },
                            grid: { color: 'rgba(148,163,184,0.15)' },
                            border: { color: '#475569' }
                        },
                        y: {
                            title: {
                                display: true,
                                text: '속도 (m/s)',
                                color: '#64748b',
                                font: { size: 13, family: 'system-ui' }
                            },
                            min: 0,
                            ticks: { color: '#94a3b8', font: { size: 11 } },
                            grid: { color: 'rgba(148,163,184,0.15)' },
                            border: { color: '#475569' }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false,
                            labels: { color: '#cbd5e1', font: { size: 12 } }
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: '#334155',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    elements: {
                        point: { radius: 0, hoverRadius: 4 },
                        line: { borderWidth: 2.5, tension: 0.1 }
                    }
                }
            });
        }

        this.initialized = true;
    }

    /** Y축 눈금을 중력가속도 단위로 설정 (자유낙하 시) */
    setGravityTicks(gravity) {
        if (!this.initialized || !this.velocityChart) return;
        const yAxis = this.velocityChart.options.scales.y;
        if (gravity) {
            yAxis.ticks.stepSize = gravity;
        } else {
            delete yAxis.ticks.stepSize;
        }
        this.velocityChart.update('none');
    }

    /** 데이터 포인트 추가 */
    addDataPoint(time, velocity) {
        if (!this.initialized || !this.velocityChart) return;
        this.velocityChart.data.datasets[0].data.push({
            x: parseFloat(time.toFixed(3)),
            y: parseFloat(velocity.toFixed(2))
        });
    }

    /** 비교 모드용 데이터 포인트 추가 */
    addComparisonDataPoint(time, velA, velB) {
        if (!this.initialized || !this.velocityChart) return;
        this.velocityChart.data.datasets[0].data.push({
            x: parseFloat(time.toFixed(3)),
            y: parseFloat(velA.toFixed(2))
        });
        if (this.velocityChart.data.datasets[1]) {
            this.velocityChart.data.datasets[1].data.push({
                x: parseFloat(time.toFixed(3)),
                y: parseFloat(velB.toFixed(2))
            });
        }
    }

    /** 그래프 갱신 */
    updateCharts() {
        if (!this.initialized || !this.velocityChart) return;
        this.velocityChart.update('none');
    }

    /** 비교 모드 전환 */
    enableComparisonMode(nameA, nameB, colorA, colorB) {
        if (!this.initialized || !this.velocityChart) return;

        const chart = this.velocityChart;
        chart.data.datasets[0].label = nameA;
        chart.data.datasets[0].borderColor = colorA || '#3b82f6';
        chart.data.datasets[0].backgroundColor = (colorA || '#3b82f6') + '20';

        if (chart.data.datasets.length < 2) {
            chart.data.datasets.push({
                label: nameB,
                borderColor: colorB || '#ef4444',
                backgroundColor: (colorB || '#ef4444') + '20',
                fill: true,
                data: []
            });
        } else {
            chart.data.datasets[1].label = nameB;
            chart.data.datasets[1].borderColor = colorB || '#ef4444';
            chart.data.datasets[1].data = [];
        }
        chart.options.plugins.legend.display = true;
        chart.update('none');
    }

    /** 단일 모드로 복귀 */
    disableComparisonMode() {
        if (!this.initialized || !this.velocityChart) return;

        const chart = this.velocityChart;
        while (chart.data.datasets.length > 1) {
            chart.data.datasets.pop();
        }
        chart.data.datasets[0].label = '속도 (m/s)';
        chart.data.datasets[0].borderColor = '#8b5cf6';
        chart.data.datasets[0].backgroundColor = 'rgba(139,92,246,0.1)';
        chart.options.plugins.legend.display = false;
        chart.update('none');
    }

    /** 데이터 초기화 */
    reset() {
        if (!this.initialized || !this.velocityChart) return;
        this.velocityChart.data.datasets.forEach(ds => ds.data = []);
        this.velocityChart.update('none');
    }

    /* ===== 동시 비교 모드 차트 ===== */

    /** 동시 비교 차트 2개 생성 */
    initSimultaneousCharts() {
        if (typeof Chart === 'undefined') return;
        if (this.horizontalVelocityChart) return; // 이미 생성됨

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { intersect: false, mode: 'index' },
            elements: {
                point: { radius: 0, hoverRadius: 4 },
                line: { borderWidth: 2.5, tension: 0.1 }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#cbd5e1', font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + ' m/s'
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: '시간 (초)', color: '#64748b', font: { size: 13 } },
                    min: 0,
                    ticks: { color: '#94a3b8', font: { size: 11 } },
                    grid: { color: 'rgba(148,163,184,0.15)' },
                    border: { color: '#475569' }
                },
                y: {
                    title: { display: true, text: '', color: '#64748b', font: { size: 13 } },
                    min: 0,
                    ticks: { color: '#94a3b8', font: { size: 11 } },
                    grid: { color: 'rgba(148,163,184,0.15)' },
                    border: { color: '#475569' }
                }
            }
        };

        // 수평 속도 차트
        const hCtx = document.getElementById('horizontal-velocity-chart');
        if (hCtx) {
            const hOpts = JSON.parse(JSON.stringify(commonOptions));
            hOpts.scales.y.title.text = '수평 속도 (m/s)';
            this.horizontalVelocityChart = new Chart(hCtx, {
                type: 'line',
                data: {
                    datasets: [
                        { label: 'A (자유낙하)', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: false, data: [] },
                        { label: 'B (수평투사)', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: false, data: [] }
                    ]
                },
                options: hOpts
            });
        }

        // 수직 속도 차트
        const vCtx = document.getElementById('vertical-velocity-chart');
        if (vCtx) {
            const vOpts = JSON.parse(JSON.stringify(commonOptions));
            vOpts.scales.y.title.text = '수직 속도 (m/s)';
            this.verticalVelocityChart = new Chart(vCtx, {
                type: 'line',
                data: {
                    datasets: [
                        { label: 'A (자유낙하)', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: false, data: [], borderWidth: 3 },
                        { label: 'B (수평투사)', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: false, data: [], borderDash: [6, 3], borderWidth: 3 }
                    ]
                },
                options: vOpts
            });
        }
    }

    /** 동시 비교 모드 활성화 */
    enableSimultaneousMode() {
        this.initSimultaneousCharts();
        // 기존 차트 숨기기, 동시비교 차트 보이기
        document.getElementById('charts-section-main').style.display = 'none';
        document.getElementById('charts-section-simultaneous').style.display = 'grid';

        // 차트 리사이즈 (display:none에서 생성된 경우)
        setTimeout(() => {
            if (this.horizontalVelocityChart) this.horizontalVelocityChart.resize();
            if (this.verticalVelocityChart) this.verticalVelocityChart.resize();
        }, 50);
    }

    /** 동시 비교 모드 비활성화 */
    disableSimultaneousMode() {
        document.getElementById('charts-section-main').style.display = '';
        document.getElementById('charts-section-simultaneous').style.display = 'none';
    }

    /** 동시 비교 데이터 포인트 추가 */
    addSimultaneousDataPoint(time, vertVelA, vertVelB, horizVelA, horizVelB) {
        const t = parseFloat(time.toFixed(3));
        if (this.horizontalVelocityChart) {
            this.horizontalVelocityChart.data.datasets[0].data.push({ x: t, y: parseFloat(horizVelA.toFixed(2)) });
            this.horizontalVelocityChart.data.datasets[1].data.push({ x: t, y: parseFloat(horizVelB.toFixed(2)) });
        }
        if (this.verticalVelocityChart) {
            this.verticalVelocityChart.data.datasets[0].data.push({ x: t, y: parseFloat(vertVelA.toFixed(2)) });
            this.verticalVelocityChart.data.datasets[1].data.push({ x: t, y: parseFloat(vertVelB.toFixed(2)) });
        }
    }

    /** 동시 비교 차트 갱신 */
    updateSimultaneousCharts() {
        if (this.horizontalVelocityChart) this.horizontalVelocityChart.update('none');
        if (this.verticalVelocityChart) this.verticalVelocityChart.update('none');
    }

    /** 동시 비교 차트 리셋 */
    resetSimultaneous() {
        if (this.horizontalVelocityChart) {
            this.horizontalVelocityChart.data.datasets.forEach(ds => ds.data = []);
            this.horizontalVelocityChart.update('none');
        }
        if (this.verticalVelocityChart) {
            this.verticalVelocityChart.data.datasets.forEach(ds => ds.data = []);
            this.verticalVelocityChart.update('none');
        }
    }
}
