import { TUtil } from "./TUtil.js";
import { tApp, getEvents, getManager, getLocationManager, tRoot } from "./App.js";

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
        this.sliceQueued = false;
    }

    async resetRuns() {
        this.resetting = true;

        await new Promise(resolve => requestAnimationFrame(resolve));

        this.clearDelayProcess();

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
        this.sliceQueued = false;     
    }

    scheduleOnlyIfEarlier(delay, runId) {

        const base = this.runningFlag ? (this.runStartTime ?? TUtil.now()) : TUtil.now();
        const runTime = base + (delay ?? 0);
        
        if (this.delayProcess && runTime >= this.delayProcess.runTime) {
            return;
        }

        this.schedule(delay, runId);
    }

    schedule(delay, runId) {        
        if (!tApp.isRunning() || this.resetting) {
            return;
        }

        const effectiveDelay = (tApp.throttle === 0) ? (delay ?? 0) : tApp.throttle;
        const insertTime = TUtil.now();
        this.delayRun(effectiveDelay, runId, insertTime);
    }

    async run(delay, runId) {
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

        let handedOff = false;

        try {
            if (this.phase === 0) {
                getEvents().captureEvents();
                tApp.targetManager.applyTargetValues(tRoot());
                await getLocationManager().calculateAll();
                this.phase = 1;
            }

            if (TUtil.now() - this.runStartTime > FRAME_BUDGET_MS) {
                handedOff = true;
                this.requestNextSlice(runId);
                return;
            }

            if (this.phase === 1) {  
                this.runningStep = tApp.manager.analyze();
                this.phase = 2;
            }

            if (TUtil.now() - this.runStartTime > FRAME_BUDGET_MS) {
                handedOff = true;
                this.requestNextSlice(runId);
                return;
            }

            if (this.phase === 2) {
                getLocationManager().calculateActivated();
                tApp.events.resetEventsOnTimeout();
                this.phase = 3;
            }

            if (TUtil.now() - this.runStartTime > FRAME_BUDGET_MS) {
                handedOff = true;
                this.requestNextSlice(runId);
                return;
            }

            if (this.phase === 3) {
                if (this.runningStep >= 0) {
                    if (this.domProcessing === 0) {
                        handedOff = true;
                        this.domOperations(this.runningStep);
                    } else if (!this.rerunId) {
                        this.rerunId = `domrun ${runId}`;
                    }
                }
                this.phase = 4;
            }

            this.runDuration = TUtil.now() - this.runStartTime;

            if (this.domProcessing === 0) {
                this.needsRerun();
            }
        } catch (error) {
            this.phase = 0;
            throw error;
        } finally {
            if (!handedOff && this.domProcessing === 0) {
                this.runningFlag = false;
            }
        }
    }

    requestNextSlice(runId) {
        this.runningFlag = false;
        
        if (this.sliceQueued) {
            return;
        }
        
        this.sliceQueued = true;
        requestAnimationFrame(() => {
            this.sliceQueued = false;
            this.schedule(0, `slice-${runId}`);
        });
    }
    
    needsRerun() {
        this.phase = 0;
        this.runningFlag = false;
        
        if (this.rerunId) {
            const id = this.rerunId;
            this.rerunId = '';
            this.schedule(0, `rerun-${id}`);
        } else if (getEvents().eventQueue.length > 0) {
            this.schedule(0, `events-${getEvents().eventQueue.length}`);
        } else {
            const newDelay = this.nextRuns.length > 0 ? this.nextRuns[0].delay - (TUtil.now() - this.nextRuns[0].insertTime) : undefined;

            if (newDelay === undefined 
                    || getManager().lists.activeTModels.length > 0 
                    || getManager().lists.updatingTModels.length > 0
                    || getManager().lists.restyle.length > 0
                    || getManager().lists.reasyncStyle.length > 0
                    || getEvents().eventQueue.length > 0
                    || getLocationManager().activatedList.length > 0) {
                if (getLocationManager().activatedList.length > 0) {
                    this.schedule(1, `getManager-locationManager-activatedList`); 
                } else if (getManager().lists.updatingTModels.length > 0) {
                    this.schedule(1, `getManager-needsRerun-updatingTModels`);
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
        
        this.executeNextRun();
    }

    domOperations(runningStep) {
        this.domProcessing = 1;

        if (runningStep === 10) {
            this.domFixStyles();
            return;
        }

        Promise.all(
            RunScheduler.domSteps
                .filter((_, index) => index >= runningStep)
                .map(step => Promise.resolve().then(step))
        ).then(() => {
            if (getManager().lists.restyle.length) {
                this.domFixStyles();
                return;
            }

            this.domProcessing = 0;
            this.needsRerun();
        }).catch(() => {
            this.domProcessing = 0;
            this.needsRerun();
        });
    }
    
    domFixStyles() {
        this.domProcessing = 2;

        requestAnimationFrame(() => {
            try {
                getManager().fixStyles();
            } finally {
                this.domProcessing = 0;
                this.needsRerun();
            }
        });
    }
    
    clearDelayProcess() {
        if (this.delayProcess?.timeoutId) {
            clearTimeout(this.delayProcess.timeoutId);
            this.delayProcess.timeoutId = undefined;
        }

        this.delayProcess = undefined;
    }
    
    setDelayProcess(runId, insertTime, interval, runTime, delay) {
        const delayProcess = {
            runId,
            insertTime,
            runTime,
            interval,
            delay,
            timeoutId: undefined
        };

        const execute = async () => {
            if (this.delayProcess !== delayProcess) {
                return;
            }

            this.clearDelayProcess();

            try {
                await this.run(delay, runId);
            } finally {
                this.executeNextRun();
            }
        };

        this.delayProcess = delayProcess;
        delayProcess.timeoutId = setTimeout(execute, delay);
        
    }

    executeNextRun() {  
        if (this.runningFlag || this.domProcessing > 0) {
            return;
        }
        
        if (this.delayProcess) {
            if (this.nextRuns.length > 0) {
                const nextRun = this.nextRuns[0];
                const nextRunTime = nextRun.insertTime + nextRun.delay;
                if (nextRunTime < this.delayProcess.runTime) {
                    clearTimeout(this.delayProcess.timeoutId);
                    const remaining = Math.max(0, this.delayProcess.runTime - TUtil.now());
                    this.insertRun(this.delayProcess.runId, TUtil.now(), remaining);
                    this.delayProcess = undefined;
                } else {
                    return;
                }
            } else {
                return;
            }
        }
        
        let runToExecute = null;

        while (this.nextRuns.length > 0) {
            const nextRun = this.nextRuns.shift();
            const now = TUtil.now();
            const newDelay = nextRun.delay - (now - nextRun.insertTime);

            if (newDelay <= 0) {
                runToExecute = nextRun;
            } else {
                this.nextRuns.unshift(nextRun);
                break;
            }
        }

        if (runToExecute) {
            this.setDelayProcess(runToExecute.runId, runToExecute.insertTime, runToExecute.delay, TUtil.now(), 0);
        } else if (this.nextRuns.length > 0) {
            const nextValidRun = this.nextRuns[0];
            const now = TUtil.now();
            const newDelay = Math.max(0, nextValidRun.delay - (now - nextValidRun.insertTime));              

            this.setDelayProcess(nextValidRun.runId, nextValidRun.insertTime, nextValidRun.delay, now + newDelay, newDelay);
        } else {
            this.clearDelayProcess();
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
            const mid = (low + high) >> 1;
            const r = this.nextRuns[mid];

            const diffTime = (r.insertTime + r.delay) - (newInsertTime + newDelay);

            if (diffTime === 0) {
                r.runId += '-' + newRunId;
                return;
            }

            if (diffTime > 0) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        this.nextRuns.splice(low, 0, {
            runId: newRunId,
            insertTime: newInsertTime,
            delay: newDelay
        });
    }
   
    getSnapshot() {
        const now = TUtil.now();
        const runs = [];

        const addRun = run => {
            if (!run) {
                return;
            }

            const runTime = TUtil.isDefined(run.runTime) ? run.runTime: run.insertTime + run.delay;

            runs.push({
                runId: run.runId,
                delay: Math.max(0, runTime - now)
            });
        };

        addRun(this.delayProcess);
        this.nextRuns.forEach(addRun);

        const immediateRuns = runs.filter(run => run.delay === 0);
        const delayedRuns = runs.filter(run => run.delay > 0);

        const result = [];

        if (immediateRuns.length) {
            result.push({
                runId: immediateRuns.map(run => run.runId).join('-'),
                delay: 0
            });
        }

        delayedRuns.forEach(run => {
            result.push(run);
        });

        return result;
    }

    restoreSnapshot(snapshot = []) {
        snapshot.forEach(run => {
            this.schedule(run.delay, `restore-${run.runId}`);
        });
    }    
}

export { RunScheduler };
