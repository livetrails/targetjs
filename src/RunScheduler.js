import { browser } from "./Browser.js";
import { tApp } from "./App.js";

class RunScheduler {
    constructor() {
        this.nextRuns = [];
        this.runningStep = 0;
        this.runningFlag = false;
        this.runId = '';
        this.rerunId = '';
        this.delayProcess = {};

        this.cycleStats = {
            duration: 0,
            count: 0,
            totalDuration: 0,
            average: 0
        };
    }

    resetRuns() {
        if (this.delayProcess.timeoutId) {
            clearTimeout(this.delayProcess.timeoutId);
        }
        this.nextRuns = [];
        this.runningStep = 0;
        this.runningFlag = false;
        this.runId = '';
        this.rerunId = '';
        this.delayProcess = {};
    }

    resetCycleStats() {
        this.cycleStats.duration = 0;
        this.cycleStats.count = 0;
        this.cycleStats.totalDuration = 0;
        this.cycleStats.average = 0;
    }

    schedule(delay, runId) {
        if (delay === 0 && tApp.throttle === 0) {
            this.run(delay, runId);
        } else {
            const nextRun = this.delay(() => {              
                this.run(delay, runId);
            }, tApp.throttle === 0 ? delay || 0 : tApp.throttle, runId);

            const lastRun = this.nextRuns.length > 0 ? this.nextRuns[this.nextRuns.length - 1] : null;
            const firstRun = this.nextRuns.length > 0 ? this.nextRuns[0] : null;

            if (nextRun && (!lastRun || nextRun.delay > lastRun.delay)) {
                this.nextRuns.push(nextRun);
            } else if (nextRun && firstRun && nextRun.delay <= firstRun.delay) {
                this.nextRuns.shift(nextRun);
            }
        }
    }

    run(delay, runId) {
        if (!tApp.isRunning()) {
            return;
        }

        if (this.runningFlag) {
            this.rerunId = runId;
            return;
        }

        this.runId = runId;
        this.runningFlag = true;


        window.requestAnimationFrame(() => {
            const startStep = this.runningStep;
            const startTime = browser.now();

            while ((browser.now() - startTime) < 25 && this.runningStep < 7 && tApp.isRunning()) {
                switch (this.runningStep) {
                    case 0:
                        tApp.events.captureEvents();
                        if (tApp.manager.doneTargets.length > 0) {
                            tApp.manager.completeDoneTModels();
                            tApp.manager.doneTargets.length = 0;
                        }
                        tApp.locationManager.calculateTargets(tApp.tRoot);
                        tApp.locationManager.calculateAll();
                        tApp.events.resetEventsOnTimeout();
                        break;
                    case 1:
                        tApp.manager.analyze();
                        break;
                    case 2:
                        tApp.manager.createDoms();
                        break;
                    case 3:
                        tApp.manager.renderTModels();
                        tApp.manager.reattachTModels();
                        break;
                    case 4:
                        tApp.manager.fixStyles();
                        break;
                    case 5:
                        if (tApp.manager.lists.invisibleDom.length > 0) {
                            tApp.manager.deleteDoms();
                        }
                        break;
                    case 6:
                        tApp.loader.singleLoad();
                        tApp.loader.groupLoad();
                        tApp.loader.imgLoad();
                        break;
                }

                this.runningStep++;
            }

            const cycleDuration = browser.now() - startTime;
            if (startStep === 0) {
                this.cycleStats.duration = cycleDuration;
            } else {
                this.cycleStats.duration += cycleDuration;
            }

            if (tApp.debugLevel > 0) {
                browser.log(tApp.debugLevel > 0 && this.cycleStats.duration > 10)(
                    `Cycle duration: ${this.cycleStats.duration}, RunId: ${runId}`
                );
                browser.log(tApp.debugLevel > 1)(`Request from: ${runId} delay: ${delay}`);
            }

            if (tApp.debugLevel > 0) {
                browser.log(tApp.debugLevel > 0 && this.cycleStats.duration > 10)(
                    `it took: ${this.cycleStats.duration}, ${runId}`
                );
                browser.log(tApp.debugLevel > 0 && this.cycleStats.duration > 10)(
                    `count: ${tApp.locationManager.locationList}`
                );
                if (delay > 0) {
                    browser.log(tApp.debugLevel > 1)(`request from: ${runId} delay:  ${delay}`);
                }
            }  


            this.runningFlag = false;
            this.runId = '';

            if (this.runningStep !== 7) {
                this.run(0, `rendering: ${runId} ${this.runningStep}`);
            } else {
                this.cycleStats.count++;
                this.cycleStats.totalDuration += this.cycleStats.duration;
                this.cycleStats.average = this.cycleStats.totalDuration / this.cycleStats.count;

                if (this.rerunId) {
                    this.runningStep = 0;
                    const rerunId = this.rerunId;
                    this.rerunId = '';
                    this.run(0, rerunId);
                } else {
                    this.runningStep = 0;
                    this.getNextRun();
                }
            }
        });
    }
    
    setDelayProcess(fn, runId, timeStamp, delay) {
        this.delayProcess = {
            runId,
            timeStamp,
            delay,
            timeoutId: setTimeout(() => {
                fn();
                this.delayProcess = {};
            }, delay)
        };
    }

    delay(fn, delay, runId) {
        const timeStamp = browser.now() + delay;

        let nextRun;

        if (this.delayProcess.timeoutId) {
            if (timeStamp >= this.delayProcess.timeStamp) {
                nextRun = { timeStamp, runId, delay };
            } else {
                const { timeoutId, ...runProcess } = this.delayProcess; // eslint-disable-line no-unused-vars
                nextRun = { ...runProcess };
                clearTimeout(this.delayProcess.timeoutId);
                this.setDelayProcess(fn, runId, timeStamp, delay);
            }
        } else {
            this.setDelayProcess(fn, runId, timeStamp, delay);
        }

        return nextRun;
    }

    getNextRun() {
        if (this.nextRuns.length > 0) {
            const nextRun = this.nextRuns.pop();
            if (nextRun) {
                this.schedule(Math.min(0, nextRun.timeStamp - browser.now()), nextRun.runId);
            }
        }
    }
}

export { RunScheduler };