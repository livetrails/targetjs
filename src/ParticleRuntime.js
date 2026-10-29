import { Easing } from "./Easing.js";
import { ParticleUtil } from "./ParticleUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { TUtil } from "./TUtil.js";
import { getRunScheduler } from "./App.js";
import { TargetParser } from "./TargetParser.js";

/**
 * Executes lightweight GPU-child TargetJS runtime behavior.
 *
 * Logical runtime state remains on ParticleTModel so it can participate
 * in normal runtime snapshot/restore.
 */
class ParticleRuntime {
    constructor(tmodel) {
        this.tmodel = tmodel;
        this.activeTargets = [];
        this.restoredMainIndexes = [];
        this.restoredActivationSequences = [];
        this.restoredImperativeExecutions = [];
        this.activeRenderExecutions = new Set();
        this.animationFrameRequested = false; 
        this.startQueue = [];
        this.startQueueIndex = 0;
        this.disposed = false;
        this.animationFrameId = undefined;
        this.loopQueue = [];
        this.queuedLoops = new WeakMap();
        this.runningLoops = new WeakMap();
        this.imperativeCompletionFrame = undefined;
        this.visibilityPaused = false;
        this.restorePending = false;
        this.propertyOwners = new WeakMap();
        this.imperativeSequenceCount = 0;
    }

    registerChild(index, originalTargetName, compiled) {
        const hasRuntime = compiled.runtimeTargets.some(target => target.requiresRuntime !== false);
        
        this.tmodel.childRuntimePrograms[index] = compiled.runtimeTargets;

        this.tmodel.childRuntimeStates[index] = {
            originalTargetName,
            nextTargetIndex: 0,
            activationCount: 0,
            executions: {},
            startRequested: false,
            startQueued: false,
            renderReady: false,
            started: false,
            done: !hasRuntime,
            targetCycles: {},
            loopTargets: {},
            mainFinished: false,
        };

        if (hasRuntime) {
            this.tmodel.pendingGpuChildRuntimeCounts[originalTargetName] = (this.tmodel.pendingGpuChildRuntimeCounts[originalTargetName] || 0) + 1;
        }

        return hasRuntime;
    }
    
    removeChild(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (state) {
            state.cancelled = true;
            state.loopTargets = {};

            if (!state.done) {
                this.complete(index);
            }
        }

        for (const execution of [...this.activeRenderExecutions]) {
            if (execution.index === index) {
                this.activeRenderExecutions.delete(execution);
                execution.cancelled = true;

                const resolve = execution.resolve;
                execution.resolve = undefined;
                resolve?.();

                continue;
            }

            if (execution.index > index) {
                execution.index--;
            }
        }

        this.tmodel.childRuntimePrograms.splice(index, 1);
        this.tmodel.childRuntimeStates.splice(index, 1);
        this.activeTargets.splice(index, 1);

        this.startQueue = this.startQueue
            .slice(this.startQueueIndex)
            .filter(childIndex => childIndex !== index)
            .map(childIndex => childIndex > index ? childIndex - 1 : childIndex);

        this.startQueueIndex = 0;

        this.restoredMainIndexes = this.restoredMainIndexes
            .filter(childIndex => childIndex !== index)
            .map(childIndex => childIndex > index ? childIndex - 1 : childIndex);

        this.restoredActivationSequences = this.restoredActivationSequences
            .filter(item => item.index !== index)
            .map(item => item.index > index ? { ...item, index: item.index - 1 } : item);
    
        this.restoredImperativeExecutions = this.restoredImperativeExecutions
                .filter(item => item.index !== index)
                .map(item => item.index > index ? { ...item, index: item.index - 1 } : item);    
    }
    
    hasPending(key, completionScope = "all") {
        if (completionScope === "none") {
            return false;
        }

        return this.tmodel.childRuntimeStates.some((state, index) => {
            if (!state || (key !== undefined && state.originalTargetName !== key)) {
                return false;
            }

            if (completionScope === "visible" && TargetUtil.shouldIgnoreChildForCompletion(this.tmodel.childHandles[index], "visible")) {
                return false;
            }

            return !state.renderReady || !state.done || Object.keys(this.activeTargets[index] || {}).length > 0;
        });
    }
    
    hasPendingAny(completionScope = "all") {
        return this.hasPending(undefined, completionScope);
    }

    isIntervalTarget(runtimeTarget) {
        return TargetParser.isIntervalTarget(runtimeTarget.target);
    }

    prepareRestore() {
        this.restorePending = true;

        this.restoredMainIndexes = [];
        this.restoredActivationSequences = [];
        this.restoredImperativeExecutions = [];

        for (let index = 0; index < this.tmodel.childRuntimeStates.length; index++) {
            const state = this.tmodel.childRuntimeStates[index];

            if (!state) {
                continue;
            }

            state.executions ??= {};
            state.activationCount ??= 0;
            state.targetCycles ??= {};
            state.loopTargets ??= {};
            state.mainFinished ??= false;

            const executions = Object.values(state.executions);

            const mainExecutions =
                executions.filter(execution =>
                    execution.sequenceId === "main"
                );

            if (!state.done && (state.started || mainExecutions.length)) {
                this.restoredMainIndexes.push(index);
            }

            const activationSequenceIds = [
                ...new Set(
                    executions
                        .map(execution => execution.sequenceId)
                        .filter(sequenceId =>
                            sequenceId?.startsWith("activation:")
                        )
                )
            ];

            for (const sequenceId of activationSequenceIds) {
                this.restoredActivationSequences.push({
                    index,
                    sequenceId
                });
            }

            for (const execution of executions) {
                if (execution.sequenceId?.startsWith("imperative:")) {
                    const lastPart = execution.sequenceId.split(":").pop();
                    const count = Number(lastPart);
                    if (Number.isFinite(count)) {
                        this.imperativeSequenceCount = Math.max(this.imperativeSequenceCount, count);
                    }

                    this.restoredImperativeExecutions.push({
                        index,
                        execution
                    });
                }
            }

            state.started = false;
            state.renderReady = false;
            state.startRequested = false;
        }
    }
    
    resumeRestored() {
        if (this.disposed || !this.restorePending || !this.tmodel.isVisible()) {
            return false;
        }

        this.restorePending = false;
        
        const mainIndexes = this.restoredMainIndexes.splice(0);
        const activationSequences = this.restoredActivationSequences.splice(0);
        const imperativeExecutions = this.restoredImperativeExecutions.splice(0);

        for (const index of mainIndexes) {
            this.resumeMainProgram(index);
        }

        for (const { index, sequenceId } of activationSequences) {
            this.resumeActivationSequence(index, sequenceId);
        }

            for (const { index, execution } of imperativeExecutions) {
                this.resumeImperativeExecution(index, execution);
            }

        for (let index = 0; index < this.tmodel.childRuntimeStates.length; index++) {
            const state = this.tmodel.childRuntimeStates[index];

            if (!state || state.done) {
                continue;
            }

            for (const [key, active] of Object.entries(state.loopTargets || {})) {
                if (!active) {
                    continue;
                }

                const targetIndex = Number(key);
                const sequenceId = `loop:${targetIndex}`;
                const execution = state.executions?.[this.getExecutionId(sequenceId, targetIndex)];

                if (execution?.segmentReady && execution.interval > 0) {
                    execution.segmentStartTime = TUtil.now() - execution.step * execution.interval;
                    execution.pausedAt = undefined;
                }

                this.queueLoop(index, targetIndex);
            }
        }

        if (this.tmodel.pendingImperativeCompletions.size) {
            this.queueImperativeCompletion();
        }
    }

    resumeActivationSequence(index, sequenceId) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state) {
            return false;
        }

        const executions = Object.values(state.executions || {}).filter(execution => execution.sequenceId === sequenceId);

        if (!executions.length) {
            return false;
        }

        const currentTargetIndex = Math.max(...executions.map(execution => execution.targetIndex));
        const activationId = sequenceId.startsWith("activation:") ? sequenceId.slice("activation:".length) : sequenceId;
        const activeTargets = this.activeTargets[index] ??= {};

        const promise = Promise.all(executions.map(execution => this.resumeExecution(index, execution)))
            .then(results => {
                if (results.every(Boolean)) {
                    return this.continueActivatedSequence(index, currentTargetIndex + 1, sequenceId);
                }
            })  
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                delete activeTargets[activationId];
            });

        activeTargets[activationId] = promise;

        return true;
    }
    
    resumeImperativeExecution(index, execution) {
        const child = this.tmodel.childHandles[index];
        const state = this.tmodel.childRuntimeStates[index];
        const runtimeTarget = execution?.imperativeTarget;

        if (!child || !state || !runtimeTarget) {
            return false;
        }

        if (execution.kind !== "render" && execution.kind !== "runtime") {
            return false;
        }

        const imperativeKey = execution.imperativeKey || runtimeTarget.imperativeKey || `${execution.targetName}+`;

        // Resume from the saved animation step rather than from the old absolute clock time.
        if (execution.segmentReady && execution.interval > 0) {
            execution.segmentStartTime = TUtil.now() - execution.step * execution.interval;
            execution.pausedAt = undefined;
        }

        const targetValue = {
            isImperative: true,
            originalTargetName: runtimeTarget.originalTargetName,
            originalTModel: runtimeTarget.originalTargetIsParent ? this.tmodel : undefined,
            status: "updating",
            value: runtimeTarget.target.value,
            steps: runtimeTarget.target.steps || 0,
            interval: runtimeTarget.target.interval || 0,
            easing: runtimeTarget.target.easing,
            cycles: runtimeTarget.target.cycles ?? 1
        };

        child.targetValues[imperativeKey] = targetValue;
        child.addToUpdatingTargets(imperativeKey);
        
        const promise = this.runTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId, targetValue);

        Promise.resolve(promise)
            .catch(error => {
                console.error(error);
                return false;
            })
            .then(completed => {
                if (this.disposed ||
                    child.targetValues[imperativeKey] !== targetValue) {
                    return;
                }

                targetValue.status = completed ? "done" : "cancelled";
                child.removeFromUpdatingTargets(imperativeKey);

                if (completed) {
                    this.queueImperativeCompletion(
                        runtimeTarget.originalTargetIsParent ? this.tmodel : undefined,
                        runtimeTarget.originalTargetName
                    );
                }
            });

        return true;
    }

    async continueActivatedSequence(index, nextTargetIndex, sequenceId) {
        if (this.disposed) {
            return;
        }
        
        const program = this.tmodel.childRuntimePrograms[index];

        if (!program) {
            return;
        }

        for (; !this.disposed && nextTargetIndex < program.length; nextTargetIndex++) { 
            const runtimeTarget = program[nextTargetIndex];

            if (runtimeTarget.mode !== "deferred") {
                break;
            }

            const completed = await this.runTarget(index, runtimeTarget, nextTargetIndex, sequenceId);

            if (!completed) {
                return;
            }        
        }   
    }

    resumeMainProgram(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (this.disposed || !state || state.done || state.started) {
            return;
        }

        state.started = true;

        const runningExecutions = Object.values(state.executions || {}).filter(execution => execution.sequenceId === "main");

        Promise.all(runningExecutions.map(execution => this.resumeExecution(index, execution)))
            .then(() => this.runProgram(index))
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                this.finishMainProgram(index, state);
            });
    }

    resumeExecution(index, execution) {
        const program = this.tmodel.childRuntimePrograms[index];
        const runtimeTarget = program?.[execution.targetIndex];

        if (!runtimeTarget) {
            return Promise.resolve();
        }

        return this.runTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId);
    }
    
    complete(index) {
        if (this.disposed) {
            return;
        }
        
        const tmodel = this.tmodel;
        const state = tmodel.childRuntimeStates[index];

        if (!state || state.done) {
            return;
        }

        state.done = true;
        state.started = false;

        const originalTargetName = state.originalTargetName;
        const count = Math.max(0, (tmodel.pendingGpuChildRuntimeCounts[originalTargetName] || 0) - 1);

        if (count > 0) {
            tmodel.pendingGpuChildRuntimeCounts[originalTargetName] = count;
        } else {
            delete tmodel.pendingGpuChildRuntimeCounts[originalTargetName];
            getRunScheduler().schedule(1, `gpuChildRuntimeComplete-${tmodel.oid}`);
        }

        TargetUtil.cleanupVisibleComplete(tmodel, originalTargetName);

        this.completeOriginalTarget(originalTargetName);
    }
    
    completeOriginalTarget(originalTargetName) {
        const tmodel = this.tmodel;

        if (!tmodel.isTargetDone(originalTargetName) ||
            !tmodel.isTargetTreeComplete(originalTargetName)) {
            return false;
        }

        TargetUtil.cleanupTarget(tmodel, originalTargetName);
        TargetUtil.shouldActivateNextTarget(tmodel, originalTargetName);

        return true;
    }

    queueStart(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state || state.done || state.started) {
            return;
        }

        state.startRequested = true;
    }


    markRenderReady(indexes) {
        const originalTargetNames = new Set();

        for (const index of indexes) {
            const state = this.tmodel.childRuntimeStates[index];

            if (!state) {
                continue;
            }

            state.renderReady = true;
            originalTargetNames.add(state.originalTargetName);
        }

        this.startReady();

        const tmodel = this.tmodel;
        
        for (const originalTargetName of originalTargetNames) {
            this.completeOriginalTarget(originalTargetName);
        }
        
        if (originalTargetNames.size > 0) {
            getRunScheduler().schedule(1,`gpuChildrenRenderReady-${tmodel.oid}`);
        }
    }

    markPendingRenderReady() {
        const indexes = [];

        for (let i = 0; i < this.tmodel.childRuntimeStates.length; i++) {
            const state = this.tmodel.childRuntimeStates[i];

            if (state && !state.renderReady) {
                indexes.push(i);
            }
        }

        this.markRenderReady(indexes);
    }

    startReady() {
        if (this.disposed) {
            return;
        }
        
        const tmodel = this.tmodel;

        if (!tmodel.isVisible() || !tmodel.hasDom() || tmodel.completeLayoutEpoch !== tmodel.layoutEpoch) {
            return false;
        }

        let queued = false;

        for (let index = 0; index < tmodel.childRuntimeStates.length; index++) {
            const state = tmodel.childRuntimeStates[index];

            if (!state || !state.startRequested || !state.renderReady || state.startQueued || state.started || state.done) {
                continue;
            }

            state.startQueued = true;
            this.startQueue.push(index);
            queued = true;
        }

        if (queued) {
            this.requestAnimationFrame();
        }

        return queued;
    }
    
    startQueuedPrograms() {
        const frameStart = TUtil.now();
        let count = 0;

        while (this.startQueueIndex < this.startQueue.length && count < 5000 && TUtil.now() - frameStart < 4) {
            const index = this.startQueue[this.startQueueIndex++];
            const state = this.tmodel.childRuntimeStates[index];

            if (!state) {
                continue;
            }

            state.startQueued = false;

            if (!state.startRequested || !state.renderReady || state.started || state.done) {
                continue;
            }

            state.startRequested = false;
            this.start(index);
            count++;
        }

        if (this.startQueueIndex >= this.startQueue.length) {
            this.startQueue.length = 0;
            this.startQueueIndex = 0;
        }
    }

    start(index) {
        if (this.disposed) {
            return;
        }
                
        const state = this.tmodel.childRuntimeStates[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !program?.length || state.started || state.done) {
            return;
        }

        state.started = true;
        state.nextTargetIndex = 0;

        Promise.resolve(this.runProgram(index))
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                this.finishMainProgram(index, state);
            });
    }

    async runProgram(index) {
        if (this.disposed) {
            return;
        }
        
        const state = this.tmodel.childRuntimeStates[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !program) {
            return;
        }

        const immediate = [];

        while (!state.cancelled && state.nextTargetIndex < program.length && program[state.nextTargetIndex].mode === "immediate") {
            const targetIndex = state.nextTargetIndex++;

            immediate.push(this.runTarget(index, program[targetIndex], targetIndex, "main"));
        }

        if (immediate.length) {
            await Promise.all(immediate);
        }

        if (state.cancelled) {
            return;
        }

        while (!state.cancelled && state.nextTargetIndex < program.length) {
            const targetIndex = state.nextTargetIndex++;

            await this.runTarget(index, program[targetIndex], targetIndex, "main");
        }
    }

    async runTarget(index, runtimeTarget, targetIndex, sequenceId = "main", owner) {
        if (this.disposed || runtimeTarget.requiresRuntime === false) {
            return false;
        }

        const state = this.tmodel.childRuntimeStates[index];
        const child = this.tmodel.childHandles[index];

        if (!state || !child || state.cancelled) {
            return false;
        }

        const targetName = ParticleUtil.getTargetName(runtimeTarget.targetName);
        const automaticLoop = sequenceId.startsWith("loop:");

        if (automaticLoop &&
            this.isTargetUpdating(index, targetName, sequenceId, targetIndex)) {
            this.blockLoop(index, targetIndex);
            return false;
        }

        // Any newly activated target replaces the previous property owner.
        this.cancelPropertyExecutions(index, targetName, sequenceId, targetIndex);

        let owners = this.propertyOwners.get(state);

        if (!owners) {
            owners = new Map();
            this.propertyOwners.set(state, owners);
        }

        const ownership = { sequenceId, targetIndex };
        owners.set(targetName, ownership);

        const cycleKey = this.getExecutionId(sequenceId, targetIndex);
        state.targetCycles ??= {};

        const isCancelled = () =>
            this.disposed ||
            state.cancelled ||
            this.tmodel.childHandles[index] !== child ||
            owners.get(targetName) !== ownership ||
            (owner && child.targetValues[runtimeTarget.imperativeKey] !== owner);

        try {
            while (!isCancelled()) {
                if (this.isIntervalTarget(runtimeTarget)) {
                    await this.runIntervalTarget(index, runtimeTarget, targetIndex, sequenceId, isCancelled);
                } else if (runtimeTarget.renderable) {
                    await this.runRenderTarget(index, runtimeTarget, targetIndex, sequenceId, isCancelled);
                } else {
                    await this.runRuntimeTarget(index, runtimeTarget, targetIndex, sequenceId, isCancelled);
                }

                if (isCancelled()) {
                    return false;
                }

                const completedCycles = (state.targetCycles[cycleKey] || 0) + 1;
                const cycles = this.getTargetCycles(runtimeTarget, child, completedCycles - 1);

                if (completedCycles >= cycles) {
                    break;
                }

                state.targetCycles[cycleKey] = completedCycles;
            }

            if (isCancelled()) {
                return false;
            }

            if (!sequenceId.startsWith("imperative:") &&
                this.isTargetInLoop(runtimeTarget, child)) {
                this.queueLoop(index, targetIndex);
            } else if (automaticLoop) {
                delete state.loopTargets[targetIndex];
                this.completeIfReady(index);
            }

            return true;
        } finally {
            if (owners.get(targetName) === ownership) {
                owners.delete(targetName);
                this.queueBlockedLoops(index, targetName);
            }

            delete state.targetCycles[cycleKey];
        }
    }

    isTargetUpdating(index, key, sequenceId, targetIndex) {
        const state = this.tmodel.childRuntimeStates[index];
        const property = ParticleUtil.getTargetName(key);
        const owner = this.propertyOwners.get(state)?.get(property);

        if (owner &&
            !(owner.sequenceId === sequenceId &&
              owner.targetIndex === targetIndex)) {
            return true;
        }

        return Object.values(state?.executions || {}).some(execution =>
            !execution.cancelled &&
            execution.targetName === property &&
            !(execution.sequenceId === sequenceId &&
              execution.targetIndex === targetIndex)
        );
    }

    blockLoop(index, targetIndex) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state) {
            return;
        }

        (state.blockedLoops ??= {})[targetIndex] = true;
    }

    queueBlockedLoops(index, key) {
        const state = this.tmodel.childRuntimeStates[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !program || state.cancelled || this.disposed ||
            this.isTargetUpdating(index, key)) {
            return;
        }

        const running = this.runningLoops.get(state);

        for (const id of Object.keys(state.blockedLoops || {})) {
            const targetIndex = Number(id);

            if (program[targetIndex]?.targetName !== key ||
                !state.loopTargets?.[targetIndex] ||
                running?.has(targetIndex)) {
                continue;
            }

            delete state.blockedLoops[id];
            this.queueLoop(index, targetIndex);
        }
    }

    cancelPropertyExecutions(index, key, sequenceId, targetIndex) {
        const state = this.tmodel.childRuntimeStates[index];
        const child = this.tmodel.childHandles[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !child) {
            return;
        }

        const property = ParticleUtil.getTargetName(key);
        const owners = this.propertyOwners.get(state);
        const previous = owners?.get(property);

        const rememberLoop = (previousSequence, previousIndex) => {
            if (previousSequence?.startsWith("imperative:")) {
                return;
            }

            const target = program?.[previousIndex];

            if (target?.targetName === property &&
                this.isTargetInLoop(target, child)) {
                state.loopTargets ??= {};
                state.loopTargets[previousIndex] = true;

                this.blockLoop(index, previousIndex);
            }
        };

        if (previous &&
            !(previous.sequenceId === sequenceId &&
              previous.targetIndex === targetIndex)) {
            rememberLoop(previous.sequenceId, previous.targetIndex);
            owners.delete(property);
        }

        // Preserve previously queued loops.
        for (const [id, pending] of Object.entries(state.loopTargets || {})) {
            if (pending && program?.[Number(id)]?.targetName === property) {
                this.blockLoop(index, Number(id));
            }
        }

        // Cancel every previous execution of the same property.
        for (const [id, execution] of Object.entries(state.executions || {})) {
            if (execution.cancelled ||
                execution.targetName !== property ||
                (execution.sequenceId === sequenceId &&
                 execution.targetIndex === targetIndex)) {
                continue;
            }

            rememberLoop(execution.sequenceId, execution.targetIndex);

            execution.cancelled = true;
            execution.cancelWait?.();
            execution.cancelWait = undefined;
            this.activeRenderExecutions.delete(execution);
            delete state.executions[id];

            const resolve = execution.resolve;
            execution.resolve = undefined;
            resolve?.();
        }
    }

    queueLoop(index, targetIndex) {
        const state = this.tmodel.childRuntimeStates[index];

        if (this.disposed || !state || state.cancelled) {
            return;
        }

        state.loopTargets ??= {};
        state.loopTargets[targetIndex] = true;

        const targetName =
            this.tmodel.childRuntimePrograms[index]?.[targetIndex]?.targetName;

        if (targetName && this.isTargetUpdating(index, targetName)) {
            this.blockLoop(index, targetIndex);
            return;
        }

        let queued = this.queuedLoops.get(state);

        if (!queued) {
            queued = new Set();
            this.queuedLoops.set(state, queued);
        }

        if (queued.has(targetIndex)) {
            return;
        }

        queued.add(targetIndex);
        this.loopQueue.push({ state, targetIndex });
        this.requestAnimationFrame();
    }

    startQueuedLoops() {
        const queue = this.loopQueue.splice(0);

        for (const { state, targetIndex } of queue) {
            this.queuedLoops.get(state)?.delete(targetIndex);

            const index = this.tmodel.childRuntimeStates.indexOf(state);

            if (this.disposed || index < 0 || state.cancelled ||
                !state.loopTargets?.[targetIndex]) {
                continue;
            }

            const runtimeTarget =
                this.tmodel.childRuntimePrograms[index]?.[targetIndex];

            if (!runtimeTarget) {
                delete state.loopTargets[targetIndex];
                this.completeIfReady(index);
                continue;
            }

            let running = this.runningLoops.get(state);

            if (!running) {
                running = new Set();
                this.runningLoops.set(state, running);
            }

            if (running.has(targetIndex) ||
                this.isTargetUpdating(index, runtimeTarget.targetName)) {
                this.blockLoop(index, targetIndex);
                continue;
            }

            running.add(targetIndex);

            this.runTarget(index, runtimeTarget, targetIndex, `loop:${targetIndex}`)
                .catch(error => {
                    console.error(error);
                    delete state.loopTargets[targetIndex];

                    const currentIndex =
                        this.tmodel.childRuntimeStates.indexOf(state);

                    if (currentIndex >= 0) {
                        this.completeIfReady(currentIndex);
                    }
                })
                .finally(() => {
                    running.delete(targetIndex);

                    const currentIndex =
                        this.tmodel.childRuntimeStates.indexOf(state);

                    if (currentIndex >= 0) {
                        this.queueBlockedLoops(
                            currentIndex,
                            runtimeTarget.targetName
                        );
                    }
                });
        }
    }

    async runRuntimeTarget(index, runtimeTarget, targetIndex, sequenceId = "main", isCancelled) {
        if (isCancelled()) {
            return;
        }
        const child = this.tmodel.childHandles[index];
        const target = runtimeTarget.target;
        const targetName = runtimeTarget.targetName;

        let execution = this.getExecution(index, sequenceId, targetIndex);

        if (!execution) {
            let value = target.value;

            if (typeof value === "function") {
                value = value.call(child);

                if (value?.then) {
                    value = await value;
                }

                if (isCancelled()) {
                    return;
                }            
            }

            if (isCancelled() || !TUtil.isDefined(value)) {
                return;
            }

            const isValueList = Array.isArray(value);
            const currentValue = child.actualValues[targetName];
            const values = isValueList ? value : [TUtil.isDefined(currentValue) ? currentValue : value, value];

            if (values.length < 2) {
                if (values.length) {
                    child.actualValues[targetName] = values[0];
                }

                return;
            }

            execution = {
                sequenceId,
                targetIndex,
                kind: "runtime",
                targetName,
                imperativeKey: runtimeTarget.imperativeKey,
                values,
                isValueList,
                pauseOn: target.pauseOn,
                segmentIndex: 0,
                segmentReady: false,
                step: 0,
                segmentStartTime: 0,
                waiting: false,
                startTime: 0,

                imperativeTarget: sequenceId.startsWith("imperative:") ? {
                    targetName: runtimeTarget.targetName,
                    imperativeKey: runtimeTarget.imperativeKey,
                    renderable: runtimeTarget.renderable,
                    originalTargetName: runtimeTarget.originalTargetName,
                    originalTargetIsParent:
                        runtimeTarget.originalTargetIsParent,
                    target: { ...runtimeTarget.target }
                } : undefined
            };

            this.setExecution(index, sequenceId, targetIndex, execution);
        }

        while (execution.segmentIndex < execution.values.length - 1) {
            if (execution.cancelled || isCancelled()) {
                return;
            }

            if (!execution.segmentReady) {
                this.prepareRenderSegment(execution, runtimeTarget, child);
            }

            if (execution.cancelled || isCancelled()) {
                return;
            }

            await this.animateExecution(index, execution);

            if (execution.cancelled || isCancelled()) {
                return;
            }

            execution.segmentIndex++;
            execution.segmentReady = false;
            execution.step = 0;
            execution.segmentStartTime = 0;
            execution.waiting = false;
            execution.startTime = 0;
        }

        this.clearExecution(index, sequenceId, targetIndex);
    }

    getExecutionId(sequenceId, targetIndex) {
        return `${sequenceId}:${targetIndex}`;
    }

    getExecution(index, sequenceId, targetIndex) {
        const state = this.tmodel.childRuntimeStates[index];

        return state?.executions?.[this.getExecutionId(sequenceId, targetIndex)];
    }

    setExecution(index, sequenceId, targetIndex, execution) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state) {
            return;
        }

        state.executions ??= {};
        state.executions[this.getExecutionId(sequenceId, targetIndex)] = execution;
    }

    clearExecution(index, sequenceId, targetIndex) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state?.executions) {
            return;
        }

        delete state.executions[this.getExecutionId(sequenceId, targetIndex)];
    }

    async runIntervalTarget(index, runtimeTarget, targetIndex, sequenceId, isCancelled) {
        const child = this.tmodel.childHandles[index];
        let execution = this.getExecution(index, sequenceId, targetIndex);

        if (!execution) {
            execution = {
                sequenceId,
                targetIndex,
                kind: "interval",
                targetName: runtimeTarget.targetName,
                interval: Math.max(0, Number(this.resolveOption(runtimeTarget.target.interval, child)) || 0),
                waiting: false,
                startTime: 0
            };

            this.setExecution(index, sequenceId, targetIndex, execution);
        }

        await Promise.race([
            this.waitForExecution(execution),
            new Promise(resolve => {
                execution.cancelWait = resolve;
            })
        ]);

        execution.cancelWait = undefined;

        if (isCancelled() || execution.cancelled) {
            return;
        }        

        this.clearExecution(index, sequenceId, targetIndex);
    }

    async waitForExecution(execution) {
        let delay = execution.interval;

        if (execution.waiting && execution.startTime > 0) {
            delay = Math.max(0, execution.interval - (TUtil.now() - execution.startTime));
        } else {
            execution.waiting = true;
            execution.startTime = TUtil.now();
        }

        if (delay > 0) {
            await this.wait(delay);
        }

        execution.waiting = false;
        execution.startTime = 0;
    }
    
    resolveInitialTargets() {
        const tmodel = this.tmodel;
        let changed = false;
        let flowLayoutChanged = false;

        for (let index = 0; index < tmodel.childRuntimePrograms.length; index++) {
            const program = tmodel.childRuntimePrograms[index];
            const child = tmodel.childHandles[index];

            if (!program || !child) {
                continue;
            }

            for (const runtimeTarget of program) {
                const isLayoutTarget = runtimeTarget.requiresRuntime === false && ParticleUtil.affectsChildLayout(runtimeTarget.targetName);

                if (!isLayoutTarget && !runtimeTarget.requiresInitialResolution) {
                    continue;
                }

                const resolved = ParticleUtil.resolveValue(runtimeTarget.target, child);
                const value = TargetParser.isTargetSpecObject(resolved) ? resolved.value : resolved;
                const initialValue = Array.isArray(value) ? value[0] : value;

                if (runtimeTarget.requiresInitialResolution) {
                    runtimeTarget.requiresInitialResolution = false;
                    runtimeTarget.initialResolvedValue = value;
                }

                if (tmodel.getChildValue(index, runtimeTarget.targetName) === initialValue) {
                    continue;
                }

                if (!tmodel.setChildValue(index, runtimeTarget.targetName, initialValue, false)) {
                    continue;
                }

                if (ParticleUtil.affectsChildFlowLayout(runtimeTarget.targetName)) {
                    flowLayoutChanged = true;
                }
                changed = true;
            }
        }

        if (flowLayoutChanged) {
            tmodel.invalidateLayout();
        }

        return changed;
    }

    async runRenderTarget(index, runtimeTarget, targetIndex, sequenceId, isCancelled) {
        if (isCancelled()) {
            return;
        }
        const tmodel = this.tmodel;
        const child = tmodel.childHandles[index];
        const target = runtimeTarget.target;
        const targetName = runtimeTarget.targetName;

        let execution = this.getExecution(index, sequenceId, targetIndex);

        if (!execution) {
            let value;

            if (sequenceId === "main" && TUtil.hasProperty(runtimeTarget, "initialResolvedValue")) {
                value = runtimeTarget.initialResolvedValue;
                delete runtimeTarget.initialResolvedValue;
            } else {
                value = target.value;

                if (typeof value === "function") {
                    value = value.call(child);
                }
            }

            const isValueList = Array.isArray(value);
            if (isCancelled()) {
                return;
            }
            const values = isValueList ? value : [tmodel.getChildValue(index, targetName), value];

            execution = {
                sequenceId,
                targetIndex,
                kind: "render",
                targetName,
                imperativeKey: runtimeTarget.imperativeKey,
                values,
                isValueList,
                pauseOn: target.pauseOn,
                segmentIndex: 0,
                segmentReady: false,
                step: 0,
                segmentStartTime: 0,
                waiting: false,
                startTime: 0,

                imperativeTarget: sequenceId.startsWith("imperative:") ? {
                    targetName: runtimeTarget.targetName,
                    imperativeKey: runtimeTarget.imperativeKey,
                    renderable: runtimeTarget.renderable,
                    originalTargetName: runtimeTarget.originalTargetName,
                    originalTargetIsParent: runtimeTarget.originalTargetIsParent,
                    target: { ...runtimeTarget.target }
                }: undefined
            };
                        
            this.setExecution(index, sequenceId, targetIndex, execution);
        }

        while (execution.segmentIndex < execution.values.length - 1) {
            if (isCancelled() || execution.cancelled) {
                return;
            }

            if (!execution.segmentReady) {
                this.prepareRenderSegment(execution, runtimeTarget, child);
            }

            if (isCancelled() || execution.cancelled) {
                return;
            }

            await this.animateExecution(index, execution);

            if (isCancelled() || execution.cancelled) {
                return;
            }

            execution.segmentIndex++;
            execution.segmentReady = false;
            execution.step = 0;
            execution.segmentStartTime = 0;
            execution.waiting = false;
            execution.startTime = 0;
        }

        this.clearExecution(index, sequenceId, targetIndex);
    }

    prepareRenderSegment(execution, runtimeTarget, child) {
        const target = runtimeTarget.target;
        const segmentIndex = execution.segmentIndex;

        execution.from = execution.values[segmentIndex];
        execution.to = execution.values[segmentIndex + 1];
        execution.steps = Math.max(0, Number(this.resolveOption(target.steps, child, segmentIndex)) || 0);

        execution.interval = Math.max(0, Number(this.resolveOption(target.interval, child, segmentIndex)) || 0);

        if (execution.steps > 0 && !execution.interval) {
            execution.interval = 8;
        }

        execution.easingName = this.resolveOption(target.easing, child, segmentIndex);

        execution.segmentReady = true;
    }
    
    isTargetInLoop(runtimeTarget, child) {
        const loop = runtimeTarget.target.loop;

        return (typeof loop === "function" ? loop.call(child, runtimeTarget.key) : loop) === true;
    }

    getTargetCycles(runtimeTarget, child, cycle) {
        const option = runtimeTarget.target.cycles;
        const cycles = typeof option === "function" ? option.call(child, cycle) : option;

        return Math.max(1, Math.floor(Number(cycles) || 1));
    }

    completeIfReady(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state || state.done || !state.mainFinished) {
            return;
        }

        if (Object.values(state.loopTargets || {}).some(Boolean) ||
                Object.keys(this.activeTargets[index] || {}).length > 0) {
            return;
        }

        this.complete(index);
    }
    
    resolveOption(value, child, segmentIndex = 0) {
        if (typeof value === "function") {
            return value.call(child, segmentIndex);
        }

        if (Array.isArray(value)) {
            return value.length ? value[segmentIndex % value.length] : undefined;
        }

        return value;
    }

    animateExecution(index, execution) {
        if (execution.steps <= 0) {
            const changed = this.setExecutionValue(index, execution, execution.to);

            if (changed && execution.kind === "render") {
                this.tmodel.requestParticleRender();
            }

            return Promise.resolve();
        }
        
        return new Promise(resolve => {
            execution.index = index;
            execution.resolve = resolve;

            this.activeRenderExecutions.add(execution);
            this.requestAnimationFrame();
        });
    }
    
    setExecutionValue(index, execution, value) {
        if (execution.kind === "render") {
            return this.tmodel.setChildValue(index, execution.targetName, value, false);
        }

        const child = this.tmodel.childHandles[index];

        if (!child || child.actualValues[execution.targetName] === value) {
            return false;
        }

        child.actualValues[execution.targetName] = value;

        return true;
    }
    
    requestAnimationFrame() {
        if (this.disposed || this.visibilityPaused || !this.tmodel.isVisible() || this.animationFrameRequested) {
            return;
        }

        this.animationFrameRequested = true;

        this.animationFrameId = requestAnimationFrame(() => {
            this.animationFrameId = undefined;
            this.animationFrameRequested = false;

            if (!this.disposed) {
                this.updateRenderExecutions();
            }
        });
    }
    
    finishMainProgram(index, state) {
        if (this.disposed || this.tmodel.childRuntimeStates[index] !== state || state.cancelled) {
            return;
        }

        state.started = false;
        state.mainFinished = true;

        this.completeIfReady(index);
    }

    updateRenderExecutions() {
        if (this.disposed) {
            return;
        }
        
        if (!this.tmodel.isVisible()) {
            this.pauseForVisibility();
            return;
        }

        this.startQueuedPrograms();
        this.startQueuedLoops();

        const now = TUtil.now();
        let renderChanged = false;
        let layoutChanged = false;

        for (const execution of this.activeRenderExecutions) {
            const child = this.tmodel.childHandles[execution.index];
            const paused = typeof execution.pauseOn === "function" ? execution.pauseOn.call(child) : execution.pauseOn === true;

            if (paused) {
                if (execution.segmentStartTime) {
                    execution.pausedAt ??= now;
                }
                continue;
            }

            if (!execution.segmentStartTime) {
                execution.segmentStartTime = now - execution.step * execution.interval;
                execution.pausedAt = undefined;
            } else if (execution.pausedAt !== undefined) {
                execution.segmentStartTime += now - execution.pausedAt;
                execution.pausedAt = undefined;
            }

            const elapsed = now - execution.segmentStartTime;
            const step = execution.interval > 0 ? Math.min(Math.floor(elapsed / execution.interval), execution.steps) : execution.steps;

            if (step <= execution.step) {
                continue;
            }

            const easing = execution.easingName ? Easing.easingFunction(execution.easingName) : undefined;
            const progress = step / execution.steps;
            const easedProgress = easing ? easing(progress) : progress;
            const value = TModelUtil.morph(execution.targetName, execution.from, execution.to, easedProgress);
            const valueChanged = this.setExecutionValue(execution.index, execution, value);

            if (execution.kind === "render" && valueChanged && ParticleUtil.affectsChildFlowLayout(execution.targetName)) {
                layoutChanged = true;
            }

            if (execution.kind === "render") {
                renderChanged ||= valueChanged;
            }

            execution.step = step;

            if (step >= execution.steps) {
                this.activeRenderExecutions.delete(execution);

                const resolve = execution.resolve;
                execution.resolve = undefined;
                resolve();
            }
        }

        if (layoutChanged) {
            this.tmodel.invalidateLayout();
        }

        if (renderChanged) {
            this.tmodel.requestParticleRender();
        }

        if (this.startQueueIndex < this.startQueue.length || this.loopQueue.length || this.activeRenderExecutions.size) {
            this.requestAnimationFrame();
        }
    }
    
    wait(interval) {
        if (this.disposed) {
            return Promise.resolve();
        }

        const delay = Math.max(0, Number(interval) || 0);

        if (delay === 0) {
            return Promise.resolve();
        }

        const deadline = Math.ceil((TUtil.now() + delay) / 4) * 4;

        this.waitBuckets ??= new Map();

        let bucket = this.waitBuckets.get(deadline);

        if (!bucket) {
            bucket = {};

            bucket.promise = new Promise(resolve => {
                bucket.resolve = resolve;

                bucket.timeoutId = setTimeout(() => {
                    this.waitBuckets.delete(deadline);
                    resolve();
                }, Math.max(0, deadline - TUtil.now()));
            });

            this.waitBuckets.set(deadline, bucket);
        }

        return bucket.promise;
    }

    findTargetIndex(index, key) {
        const program = this.tmodel.childRuntimePrograms[index];

        if (!program) {
            return -1;
        }

        const cleanKey = ParticleUtil.getTargetName(key);
        const exactIndex = program.findIndex(target => target.requiresRuntime !== false && target.key === key);

        if (exactIndex >= 0) {
            return exactIndex;
        }

        return program.findIndex(target => target.requiresRuntime !== false && target.targetName === cleanKey && target.mode === "immediate");
    }
    
    async runActivatedSequence(index, startIndex, sequenceId) {
        if (this.disposed) {
            return;
        }
        
        const program = this.tmodel.childRuntimePrograms[index];

        if (this.disposed || !program || startIndex < 0 || startIndex >= program.length) {
            return;
        }

        const completed = await this.runTarget(index, program[startIndex], startIndex, sequenceId);
        
        if (completed && !this.disposed) {
            await this.continueActivatedSequence(index, startIndex + 1, sequenceId);
        }
    }

    setImperativeTarget(index, key, rawTarget, steps, interval, easing, originalTargetName, originalTModel) {
        if (this.disposed) {
            return;
        }

        const child = this.tmodel.childHandles[index];

        if (!child) {
            return;
        }

        const imperativeKey = key.endsWith("+") ? key : `${key}+`;

        // List targets carry their animation options beside the list, not beside a `value` property.
        // Unwrap them without calling TargetParser.getValueStepsCycles(), which requires a full TModel.
        const outerList = TargetParser.isListTarget(rawTarget) ? rawTarget : undefined;
        const target = outerList ? { value: outerList.list } :
            TargetParser.isTargetSpecObject(rawTarget) ? { ...rawTarget } : { value: rawTarget };
        const innerList = TargetParser.isListTarget(target.value) ? target.value : undefined;
        const listOptions = outerList ?? innerList;

        const value = listOptions ? listOptions.list : target.value;
        const parsedSteps = target.steps ?? listOptions?.steps ?? steps ?? 0;
        const parsedInterval = target.interval ?? listOptions?.interval ?? interval ?? 0;
        const parsedEasing = target.easing ?? listOptions?.easing ?? easing;
        const cycles = target.cycles ?? listOptions?.cycles ?? 1;
        const pauseOn = target.pauseOn ?? listOptions?.pauseOn;

        const targetValue = {
            isImperative: true,
            originalTargetName,
            originalTModel,
            status: "updating",
            value,
            steps: parsedSteps || 0,
            interval: parsedInterval || 0,
            easing: parsedEasing,
            cycles
        };

        child.targetValues[imperativeKey] = targetValue;
        child.addToUpdatingTargets(imperativeKey);

        const runtimeTarget = {
            targetName: ParticleUtil.getTargetName(key),
            imperativeKey,
            renderable: ParticleUtil.isGpuTarget(key),

            originalTargetName,
            originalTargetIsParent: originalTModel === this.tmodel,

            target: {
                value,
                steps: parsedSteps,
                interval: parsedInterval,
                easing: parsedEasing,
                cycles,
                pauseOn
            }
        };

        const sequenceId = `imperative:${index}:${imperativeKey}:${++this.imperativeSequenceCount}`;
        const promise = this.runTarget(index, runtimeTarget, 0, sequenceId, targetValue);

        promise.then(completed => {
            if (this.disposed ||
                child.targetValues[imperativeKey] !== targetValue) {
                return;
            }

            targetValue.status = completed ? "done" : "cancelled";
            child.removeFromUpdatingTargets(imperativeKey);

            if (completed) {
                this.queueImperativeCompletion(originalTModel, originalTargetName);
            }
        });

        return promise;
    }

    queueImperativeCompletion(originalTModel, originalTargetName) {
        const pending = this.tmodel.pendingImperativeCompletions;

        if (originalTModel && originalTargetName) {
            let targets = pending.get(originalTModel);

            if (!targets) {
                targets = new Set();
                pending.set(originalTModel, targets);
            }

            targets.add(originalTargetName);
        }

        if (this.imperativeCompletionFrame !== undefined) {
            return;
        }

        this.imperativeCompletionFrame = requestAnimationFrame(() => {
            this.imperativeCompletionFrame = undefined;

            if (this.disposed) {
                return;
            }

            const completions = this.tmodel.pendingImperativeCompletions;
            this.tmodel.pendingImperativeCompletions = new Map();

            for (const [tmodel, targets] of completions) {
                for (const key of targets) {
                    TargetUtil.shouldActivateNextTarget(tmodel, key, 1, 0, true, "complete");
                }
            }

            getRunScheduler().schedule(1, `gpuImperativeComplete-${this.tmodel.oid}`);
        });
    }

    activateTarget(index, key) {
        const state = this.tmodel.childRuntimeStates[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !program) {
            return false;
        }

        const startIndex = this.findTargetIndex(index, key);

        if (startIndex < 0) {
            throw new Error(`GPU child target "${key}" cannot be activated because it is not in the child runtime program.`);
        }

        const runtimeTarget = program[startIndex];

        if (this.isIntervalTarget(runtimeTarget)) {
            throw new Error(`GPU child target "${key}" cannot be activated.`);
        }

        const activationId = `${runtimeTarget.key}-${++state.activationCount}`;
        const sequenceId = `activation:${activationId}`;
        const activeTargets = this.activeTargets[index] ??= {}
        
        if (state.done) {
            state.done = false;
            this.tmodel.pendingGpuChildRuntimeCounts[state.originalTargetName] = (this.tmodel.pendingGpuChildRuntimeCounts[state.originalTargetName] || 0) + 1;
        };

        const promise = Promise.resolve()
            .then(() => this.runActivatedSequence(index, startIndex, sequenceId))
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                delete activeTargets[activationId];

                if (!this.disposed) {
                    this.completeIfReady(index);
                    TargetUtil.cleanupVisibleComplete(this.tmodel, state.originalTargetName);
                }
            });

        activeTargets[activationId] = promise;

        return true;
    }
    
    pauseForVisibility() {
        if (this.disposed || this.visibilityPaused) {
            return;
        }

        this.visibilityPaused = true;

        const now = TUtil.now();

        for (const execution of this.activeRenderExecutions) {
            if (execution.segmentStartTime) {
                execution.pausedAt ??= now;
            }
        }

        if (this.animationFrameId !== undefined) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = undefined;
        }

        this.animationFrameRequested = false;
    }

    resumeForVisibility() {
        if (this.disposed || !this.tmodel.isVisible()) {
            return;
        }

        this.visibilityPaused = false;

        this.resumeRestored();
        this.startReady();

        if (this.startQueueIndex < this.startQueue.length ||
                this.loopQueue.length ||
                this.activeRenderExecutions.size) {
            this.requestAnimationFrame();
        }

        if (this.tmodel.particleValuesDirty || this.tmodel.activeChildTransitionKey) {
            this.tmodel.requestParticleRender();
        }
    }
        
    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        
        if (this.animationFrameId !== undefined) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = undefined;
        }

        this.animationFrameRequested = false;
        this.startQueue.length = 0;
        this.startQueueIndex = 0;
        this.loopQueue.length = 0;
        
        if (this.imperativeCompletionFrame !== undefined) {
            cancelAnimationFrame(this.imperativeCompletionFrame);
            this.imperativeCompletionFrame = undefined;
        }
        
        for (const state of this.tmodel.childRuntimeStates) {
            if (!state) {
                continue;
            }

            state.cancelled = true;

            for (const execution of Object.values(state.executions || {})) {
                execution.cancelled = true;
            }
        }

        for (const execution of this.activeRenderExecutions) {
            execution.cancelled = true;

            const resolve = execution.resolve;
            execution.resolve = undefined;
            resolve?.();
        }

        this.activeRenderExecutions.clear();
        
        for (const bucket of this.waitBuckets?.values() ?? []) {
            clearTimeout(bucket.timeoutId);
            bucket.resolve();
        }

        this.waitBuckets?.clear();        
    }
}

export { ParticleRuntime };