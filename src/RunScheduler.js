import { TUtil } from "./TUtil.js";
import { tApp, getEvents, getManager, getLocationManager } from "./App.js";

/**
 *  It is responsible for scheduling and managing the execution of TargetJ process cycle. 
 *  It tracks execution timing and maintains statistics for each cycle.
 */

const FRAME_BUDGET_MS = 20;

class RunScheduler {
    static domSteps = [
        () => getManager().createDoms(),
        () => getManager().reattachTModels(),
        () => getManager().relocateTModels(),
        () => getManager().renderTModels(),
        () => getManager().fixAsyncStyles(),
        () => getManager().deleteDoms()
    ];

    constructor() {
        this.nextRuns = [];
        this.domProcessing = 0;
        this.runningFlag = false;
        this.runId = '';
        this.runStartTime = undefined;
        this.runDuration = 0;
        this.rerunId = '';
        this.delayProcess = undefined;
        this.resetting = false;
        this.activeStartTime = undefined;
        this.phase = 0;
        this.runningStep = -1;

    }

    async resetRuns() {
        this.resetting = true;

        await new Promise(resolve => requestAnimationFrame(resolve));

        if (this.delayProcess?.timeoutId) {
            clearTimeout(this.delayProcess.timeoutId);
        }

        this.nextRuns = [];
        this.domProcessing = 0;
        this.runningFlag = false;
        this.runId = '';
        this.runStartTime = undefined;
        this.runDuration = 0;
        this.rerunId = '';
        this.delayProcess = undefined;
        this.resetting = false;
        this.activeStartTime = undefined;
        this.phase = 0;
        this.runningStep = -1;
    }

    scheduleOnlyIfEarlier(delay, runId) {

        const runTime = this.runStartTime + delay;

        if (this.delayProcess && runTime >= this.delayProcess.runTime) {
            return;
        }
        
        this.schedule(delay, runId);
    }

    schedule(delay, runId) {
        if (!tApp.isRunning() || this.resetting || (delay === 0 && this.rerunId)) {
            return;
        }

        if (delay === 0 && tApp.throttle === 0) {
            this.run(delay, runId);
        } else {
            this.delayRun(tApp.throttle === 0 ? delay || 0 : tApp.throttle, runId, this.runStartTime);
        }
    }
    
    timeSchedule(delay, runId) {
        if (!tApp.isRunning() || this.resetting) {
            return;
        }
        this.delayRun(delay, runId, TUtil.now());
    }    
    

    run(delay, runId) {
        if (!tApp.isRunning() || this.resetting) {
            return;
        }

        if (this.runningFlag) {
            if (!this.rerunId) {
                this.rerunId = `rerun ${runId}`;
            }
            return;
        }

        this.rerunId = '';
        this.runId = runId;
        this.runningFlag = true;
        this.runStartTime = TUtil.now();

        if (this.phase === 0) {
            getEvents().captureEvents();
            if (getManager().doneTargets.length) {
                getManager().completeDoneTModels();
                getManager().doneTargets.length = 0;
            }
            tApp.targetManager.applyTargetValues(tApp.tRoot);
            getLocationManager().calculateAll();
            this.phase = 1;
        }

        if (TUtil.now() - this.runStartTime > FRAME_BUDGET_MS) {
            this.defer(runId);
            return;
        }

        if (this.phase === 1) {
            this.runningStep = tApp.manager.analyze();
            this.phase = 2;
        }

        if (TUtil.now() - this.runStartTime > FRAME_BUDGET_MS) {
            this.defer(runId);
            return;
        }

        if (this.phase === 2) {
            getLocationManager().calculateActivated();
            tApp.events.resetEventsOnTimeout();
            this.phase = 3;
        }

        if (TUtil.now() - this.runStartTime > FRAME_BUDGET_MS) {
            this.defer(runId);
            return;
        }

        if (this.phase === 3) {
            if (this.runningStep >= 0) {
                if (this.domProcessing === 0) {
                    this.domOperations(this.runningStep);
                } else if (!this.rerunId) {
                    this.rerunId = `domrun ${runId}`;
                }
            }
            this.phase = 4;
        }

        if (tApp.debugLevel === 1) {
            TUtil.log(true)(`Request from: ${runId} delay: ${delay} runningStep:${this.runningStep} dom:${this.domProcessing} runs:${this.nextRuns.length} D:${this.delayProcess?.delay} events:${getEvents().eventQueue.length}`);
        }

        this.runDuration = TUtil.now() - this.runStartTime;

        if (this.domProcessing === 0) {
            this.needsRerun();
        }
    }

    defer(runId) {
        this.rerunId = `slice-${runId}`;
        
        requestAnimationFrame(() => {
            this.runningFlag = false;
            this.run(0, this.rerunId);
        });
    }

    needsRerun() {
        this.phase = 0;
        this.runningFlag = false;
        
        if (this.rerunId) {
            this.defer(`rerun-${this.rerunId}`);
        } else {
            const newDelay = this.nextRuns.length > 0 ? this.nextRuns[0].delay - (TUtil.now() - this.nextRuns[0].insertTime) : undefined;
                        
            if (newDelay === undefined 
                    || getManager().lists.activeTModels.length > 0 
                    || getManager().lists.updatingTModels.length > 0
                    || getLocationManager().activatedList.length > 0) {
                if (getEvents().eventQueue.length > 0) {
                    this.schedule(15, `events-${getEvents().eventQueue.length}`);
                } else if (getLocationManager().activatedList.length > 0) {
                    this.schedule(15, `getManager-locationManager-activatedList`); 
                } else if (getManager().lists.updatingTModels.length > 0) {
                    this.schedule(15, `getManager-needsRerun-updatingTModels`);
                } else if (getManager().lists.activeTModels.length > 0) {
                    const activeTModel = getManager().lists.activeTModels.find(tmodel => {
                        return (
                                tmodel.targetExecutionCount === 0 ||
                                tmodel.activeTargetList
                                .filter(target => !tmodel.isScheduledPending(target))
                                .some(target => tmodel.shouldScheduleRun(target))
                                );
                    });
                    if (activeTModel) {
                        const delay = !this.activeStartTime || TUtil.now() - this.activeStartTime > 15 ? 1 : 15;
                        this.activeStartTime = TUtil.now();
                                                
                        this.schedule(delay, `getManager-needsRerun-${activeTModel.oid}-${activeTModel.activeTargetList}`);
                    }
                }
            } 
        }
    }

    domOperations(runningStep) {
        this.domProcessing = 1;

        if (runningStep === 10) {
            this.domFixStyles();
        } else {
            Promise.all(RunScheduler.domSteps.filter((_, index) => index >= runningStep).map(step => Promise.resolve().then(step)))
                    .then(() => {
                        if (getManager().lists.restyle.length) {
                            this.domFixStyles();
                        } else {
                            this.domProcessing = 0;
                            this.needsRerun();
                        }
                    });
        }
    }

    domFixStyles() {
        this.domProcessing = 2;
        requestAnimationFrame(() => {
            getManager().fixStyles();
            this.domProcessing = 0;
            this.needsRerun();
        });
    }

    setDelayProcess(runId, insertTime, interval, runTime, delay) {
        this.delayProcess = {
            runId,
            insertTime,
            runTime: runTime,
            interval,
            timeoutId: setTimeout(() => {             
                this.delayProcess.timeoutId = undefined;
                this.run(delay, runId);
                this.executeNextRun();
                
                
            }, Math.max(0, delay))
        };    
    }

    executeNextRun() {
        let lastNegativeRun = null;
        let nextValidRun = null;

        while (this.nextRuns.length > 0) {
            const nextRun = this.nextRuns.shift();
            const now = TUtil.now();
            const newDelay = nextRun.delay - (now - nextRun.insertTime);

            if (newDelay < 0) {
                lastNegativeRun = nextRun;
            } else {
                lastNegativeRun = null;
                nextValidRun = nextRun;
                break;
            }
        }

        if (lastNegativeRun) {
            this.setDelayProcess(lastNegativeRun.runId, lastNegativeRun.insertTime, lastNegativeRun.delay, TUtil.now(), 0);
        } else if (nextValidRun) {
            const now = TUtil.now();
            const newDelay = Math.max(1, nextValidRun.delay - (now - nextValidRun.insertTime));              
            this.setDelayProcess(nextValidRun.runId, nextValidRun.insertTime, nextValidRun.delay, now + newDelay, newDelay);
        } else {
            this.delayProcess = undefined;
        }
    }

    delayRun(delay, runId, insertTime) {
        const runTime = insertTime + delay;

        if (!this.delayProcess) {
            this.setDelayProcess(runId, insertTime, delay, runTime, delay);
        } else if (this.delayProcess.timeoutId && runTime < this.delayProcess.runTime) {
            clearTimeout(this.delayProcess.timeoutId);                                 
            this.insertRun(this.delayProcess.runId, this.delayProcess.insertTime, this.delayProcess.interval);
            this.setDelayProcess(runId, insertTime, delay, runTime, delay);
        } else {
            this.insertRun(runId, insertTime, delay);
        }
    }

    insertRun(newRunId, newInsertTime, newDelay) {
        let low = 0, high = this.nextRuns.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const delay = this.nextRuns[mid].delay;
            const insertTime = this.nextRuns[mid].insertTime;
            const diff = (insertTime + delay) - (newInsertTime + newDelay);
            if (diff > 0) {
                high = mid;
            } else if (diff < 0) {
                low = mid + 1;
            } else {
                return;
            }
        }

        this.nextRuns.splice(low, 0, {runId: newRunId, insertTime: newInsertTime, delay: newDelay});
    }
}

export { RunScheduler };
