/**
 * 운동량과 충격량 실험 시뮬레이터 — 진입점
 */
import Chart from 'chart.js/auto';
import '../css/style.css';
import { App } from './app.js';

// Chart.js를 전역에 노출 (모듈 간 공유)
window.Chart = Chart;

// DOM 로드 후 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
