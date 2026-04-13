/**
 * Chart.js 기반 실시간 그래프 관리
 * 시간-속력, 시간-낙하거리 그래프
 */

class ChartManager {
    constructor() {
        this.velocityChart = null;
        this.distanceChart = null;
        this.initialized = false;
        this.maxPoints = 500;
    }

    init() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js를 불러올 수 없습니다.');
            document.querySelectorAll('.chart-fallback').forEach(el => {
                el.style.display = 'flex';
            });
            return;
        }

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
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
        };

        // 시간-속력 그래프
        const velCtx = document.getElementById('velocity-chart');
        if (velCtx) {
            this.velocityChart = new Chart(velCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: '속력 (m/s)',
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139,92,246,0.1)',
                        fill: true,
                        data: []
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            title: {
                                ...commonOptions.scales.y.title,
                                text: '속력 (m/s)'
                            }
                        }
                    }
                }
            });
        }

        // 시간-낙하거리 그래프
        const distCtx = document.getElementById('distance-chart');
        if (distCtx) {
            this.distanceChart = new Chart(distCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: '낙하 거리 (m)',
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5,150,105,0.1)',
                        fill: true,
                        data: []
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            title: {
                                ...commonOptions.scales.y.title,
                                text: '낙하 거리 (m)'
                            }
                        }
                    }
                }
            });
        }

        this.initialized = true;
    }

    /** 데이터 포인트 추가 */
    addDataPoint(time, velocity, distance) {
        if (!this.initialized) return;

        const point_v = { x: parseFloat(time.toFixed(3)), y: parseFloat(velocity.toFixed(2)) };
        const point_d = { x: parseFloat(time.toFixed(3)), y: parseFloat(distance.toFixed(2)) };

        if (this.velocityChart) {
            this.velocityChart.data.datasets[0].data.push(point_v);
        }
        if (this.distanceChart) {
            this.distanceChart.data.datasets[0].data.push(point_d);
        }
    }

    /** 비교 모드용 데이터 포인트 추가 */
    addComparisonDataPoint(time, velA, distA, velB, distB) {
        if (!this.initialized) return;

        if (this.velocityChart) {
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
        if (this.distanceChart) {
            this.distanceChart.data.datasets[0].data.push({
                x: parseFloat(time.toFixed(3)),
                y: parseFloat(distA.toFixed(2))
            });
            if (this.distanceChart.data.datasets[1]) {
                this.distanceChart.data.datasets[1].data.push({
                    x: parseFloat(time.toFixed(3)),
                    y: parseFloat(distB.toFixed(2))
                });
            }
        }
    }

    /** 그래프 갱신 */
    updateCharts() {
        if (!this.initialized) return;
        if (this.velocityChart) this.velocityChart.update('none');
        if (this.distanceChart) this.distanceChart.update('none');
    }

    /** 비교 모드 전환 */
    enableComparisonMode(nameA, nameB, colorA, colorB) {
        if (!this.initialized) return;

        [this.velocityChart, this.distanceChart].forEach(chart => {
            if (!chart) return;
            chart.data.datasets[0].label = nameA;
            chart.data.datasets[0].borderColor = colorA || '#3b82f6';
            chart.data.datasets[0].backgroundColor = (colorA || '#3b82f6') + '20';

            if (chart.data.datasets.length < 2) {
                const baseLabel = chart === this.velocityChart ? '속력 (m/s)' : '낙하 거리 (m)';
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
        });
    }

    /** 단일 모드로 복귀 */
    disableComparisonMode() {
        if (!this.initialized) return;

        [this.velocityChart, this.distanceChart].forEach(chart => {
            if (!chart) return;
            while (chart.data.datasets.length > 1) {
                chart.data.datasets.pop();
            }
            chart.data.datasets[0].label = chart === this.velocityChart ? '속력 (m/s)' : '낙하 거리 (m)';
            chart.data.datasets[0].borderColor = chart === this.velocityChart ? '#8b5cf6' : '#059669';
            chart.data.datasets[0].backgroundColor = chart === this.velocityChart
                ? 'rgba(139,92,246,0.1)' : 'rgba(5,150,105,0.1)';
            chart.options.plugins.legend.display = false;
            chart.update('none');
        });
    }

    /** 데이터 초기화 */
    reset() {
        if (!this.initialized) return;

        [this.velocityChart, this.distanceChart].forEach(chart => {
            if (!chart) return;
            chart.data.datasets.forEach(ds => ds.data = []);
            chart.update('none');
        });
    }
}
