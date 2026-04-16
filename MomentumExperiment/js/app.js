/**
 * 메인 앱 컨트롤러
 * 탭 전환, rAF 루프, 키보드 단축키, 이론 아코디언
 */
import { PHYSICS_DT } from './constants.js';
import { InertiaTab } from './inertia.js';
import { MomentumTab } from './momentum.js';
import { ImpulseTab } from './impulse.js';

export class App {
    constructor() {
        this.currentTab = 'inertia';
        this.tabs = {};
        this.animFrameId = null;
        this.lastTimestamp = null;
        this.accumulator = 0;

        this.init();
    }

    init() {
        // 탭 컨트롤러 생성
        this.tabs.inertia = new InertiaTab();
        this.tabs.momentum = new MomentumTab();
        this.tabs.impulse = new ImpulseTab();

        this.bindTabs();
        this.bindKeyboard();
        this.setupTheoryAccordion();

        // 초기 탭 활성화
        this.tabs.inertia.activate();
    }

    bindTabs() {
        document.querySelectorAll('.mode-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab !== this.currentTab) this.switchTab(tab);
            });
        });
    }

    switchTab(tabName) {
        // 현재 탭 비활성화
        const current = this.tabs[this.currentTab];
        if (current) {
            current.stop();
            current.deactivate();
        }
        this.stopLoop();

        // 탭 버튼 활성화
        document.querySelectorAll('.mode-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 탭 컨텐츠 전환
        document.querySelectorAll('.tab-content').forEach(sec => {
            sec.style.display = sec.id === `tab-${tabName}` ? '' : 'none';
        });

        // 자유낙하 iframe 로드 (최초 1회)
        if (tabName === 'freefall') {
            const iframe = document.getElementById('freefall-iframe');
            if (iframe && iframe.src === 'about:blank') {
                iframe.src = '/freefall/index.html';
            }
        }

        this.currentTab = tabName;
        if (this.tabs[tabName]) this.tabs[tabName].activate();
    }

    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.tabs[this.currentTab].toggleStartPause();
                    break;
                case 'KeyR':
                    e.preventDefault();
                    this.tabs[this.currentTab].reset();
                    break;
                case 'Digit0': this.switchTab('freefall'); break;
                case 'Digit1': this.switchTab('inertia'); break;
                case 'Digit2': this.switchTab('momentum'); break;
                case 'Digit3': this.switchTab('impulse'); break;
            }
        });
    }

    // ── rAF 루프 ──
    startLoop() {
        this.lastTimestamp = null;
        this.accumulator = 0;
        const loop = (ts) => {
            this.animFrameId = requestAnimationFrame(loop);
            if (!this.lastTimestamp) { this.lastTimestamp = ts; return; }

            let wallDt = (ts - this.lastTimestamp) / 1000;
            this.lastTimestamp = ts;
            if (wallDt > 0.1) wallDt = 0.1; // 탭 전환 등으로 인한 큰 dt 방지

            const tab = this.tabs[this.currentTab];
            wallDt *= tab.animationSpeed || 1;

            this.accumulator += wallDt;
            while (this.accumulator >= PHYSICS_DT) {
                tab.update(PHYSICS_DT);
                this.accumulator -= PHYSICS_DT;
            }
            tab.render();

            // 완료 체크
            if (tab.isComplete && tab.isComplete()) {
                this.stopLoop();
                tab.onComplete();
            }
        };
        this.animFrameId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    // ── 이론 아코디언 ──
    setupTheoryAccordion() {
        document.querySelectorAll('.theory-header').forEach(header => {
            header.addEventListener('click', () => {
                const isOpen = header.dataset.open === 'true';
                header.dataset.open = isOpen ? 'false' : 'true';
                const content = header.nextElementSibling;
                content.classList.toggle('open', !isOpen);
            });
        });
    }
}
