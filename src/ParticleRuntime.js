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
    }

    registerChild(index, targetName, compiled) {
        const hasRuntime = compiled.runtimeTargets.some(target => target.requiresRuntime !== false);
        
        this.tmodel.childRuntimePrograms[index] = compiled.runtimeTargets;

        this.tmodel.childRuntimeStates[index] = {
            ownerTargetName: targetName,
            nextTargetIndex: 0,
            activationCount: 0,
            executions: {},
            startRequested: false,
            startQueued: false,
            renderReady: false,
            started: false,
            done: !hasRuntime
        };

        if (hasRuntime) {
            this.tmodel.pendingGpuChildRuntimeCounts[targetName] = (this.tmodel.pendingGpuChildRuntimeCounts[targetName] || 0) + 1;
        }

        return hasRuntime;
    }
    
    removeChild(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (state) {
            state.cancelled = true;

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

        const targetName = TargetUtil.getTargetName(key);

        return this.tmodel.childRuntimeStates.some((state, index) => {
            if (!state || state.ownerTargetName !== targetName) {
                return false;
            }

            if (completionScope === "visible" && TargetUtil.shouldIgnoreChildForCompletion(this.tmodel.childHandles[index], "visible")) {
                return false;
            }

            return !state.done || Object.keys(this.activeTargets[index] || {}).length > 0;
        });
    }

    isIntervalTarget(runtimeTarget) {
        return TargetParser.isIntervalTarget(runtimeTarget.target);
    }

    prepareRestore() {
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
            .then(() => this.continueActivatedSequence(index, currentTargetIndex + 1, sequenceId))
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
            easing: runtimeTarget.target.easing
        };

        child.targetValues[imperativeKey] = targetValue;
        child.addToUpdatingTargets(imperativeKey);

        const promise = execution.kind === "render"
            ? this.runRenderTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId)
            : this.runRuntimeTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId);

        Promise.resolve(promise)
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                if (this.disposed || child.targetValues[imperativeKey] !== targetValue) {
                    return;
                }

                targetValue.status = "done";
                child.removeFromUpdatingTargets(imperativeKey);

                if (runtimeTarget.originalTargetIsParent && runtimeTarget.originalTargetName) {
                    TargetUtil.shouldActivateNextTarget(this.tmodel, runtimeTarget.originalTargetName, 1, 0, true, "complete");
                }

                getRunScheduler().schedule(1, `gpuImperativeComplete-${child.oid}-${imperativeKey}`);
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

            await this.runTarget(index, runtimeTarget, nextTargetIndex, sequenceId);
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
                this.complete(index);
            });
    }

    resumeExecution(index, execution) {
        const program = this.tmodel.childRuntimePrograms[index];
        const runtimeTarget = program?.[execution.targetIndex];

        if (!runtimeTarget) {
            return Promise.resolve();
        }

        if (execution.kind === "interval") {
            return this.runIntervalTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId);
        }

        if (execution.kind === "render") {
            return this.runRenderTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId);
        }

        if (execution.kind === "runtime") {
            return this.runRuntimeTarget(index, runtimeTarget, execution.targetIndex, execution.sequenceId);
        }

            return Promise.resolve();
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

        const targetName = state.ownerTargetName;
        const count = Math.max(0, (tmodel.pendingGpuChildRuntimeCounts[targetName] || 0) - 1);

        if (count > 0) {
            tmodel.pendingGpuChildRuntimeCounts[targetName] = count;
        } else {
            delete tmodel.pendingGpuChildRuntimeCounts[targetName];
            getRunScheduler().schedule(1, `gpuChildRuntimeComplete-${tmodel.oid}`);
        }

        TargetUtil.cleanupVisibleComplete(tmodel, targetName);

        // Retry the parent pipeline when its GPU children are ready.
        const pendingKey = [...(tmodel.pendingTargets ?? [])].find(key =>
            TargetUtil.getTargetName(key) === targetName
        );

        if (pendingKey && tmodel.isTargetDone(pendingKey) &&
                tmodel.isTargetTreeComplete(pendingKey) === true) {
            TargetUtil.cleanupTarget(tmodel, pendingKey);
            TargetUtil.shouldActivateNextTarget(tmodel, pendingKey);
        }
    }

    queueStart(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state || state.done || state.started) {
            return;
        }

        state.startRequested = true;
    }

    markRenderReady(indexes) {
        for (const index of indexes) {
            const state = this.tmodel.childRuntimeStates[index];

            if (state) {
                state.renderReady = true;
            }
        }

        this.startReady();
    }

    markPendingRenderReady() {
        for (const state of this.tmodel.childRuntimeStates) {
            if (state?.startRequested && !state.started && !state.done) {
                state.renderReady = true;
            }
        }

        this.startReady();
    }

    startReady() {
        if (this.disposed) {
            return;
        }
        
        const tmodel = this.tmodel;

        if (!tmodel.hasDom() || tmodel.completeLayoutEpoch !== tmodel.layoutEpoch) {
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
                this.complete(index);
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

    async runTarget(index, runtimeTarget, targetIndex, sequenceId = "main") {
        if (this.disposed) {
            return;
        }
        
        if (runtimeTarget.requiresRuntime === false) {
            return;
        }        
        
        const child = this.tmodel.childHandles[index];

        if (!child) {
            return;
        }

        if (this.isIntervalTarget(runtimeTarget)) {
            await this.runIntervalTarget(index, runtimeTarget, targetIndex, sequenceId);
            return;
        }

        if (runtimeTarget.renderable) {
            await this.runRenderTarget(index, runtimeTarget, targetIndex, sequenceId);
            return;
        }

        await this.runRuntimeTarget(index, runtimeTarget, targetIndex, sequenceId);
    }
    
    async runRuntimeTarget(index, runtimeTarget, targetIndex, sequenceId = "main") {
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
                
                if (this.disposed) {
                    return;
                }                
            }

            if (!TUtil.isDefined(value)) {
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
            if (!execution.segmentReady) {
                this.prepareRenderSegment(execution, runtimeTarget, child);
            }

            await this.animateExecution(index, execution);

            if (execution.cancelled) {
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

    async runIntervalTarget(index, runtimeTarget, targetIndex, sequenceId) {
        const child = this.tmodel.childHandles[index];
        let execution = this.getExecution(index, sequenceId, targetIndex);

        if (!execution) {
            execution = {
                sequenceId,
                targetIndex,
                kind: "interval",
                interval: Math.max(0, Number(this.resolveOption(runtimeTarget.target.interval, child)) || 0),
                waiting: false,
                startTime: 0
            };

            this.setExecution(index, sequenceId, targetIndex, execution);
        }

        await this.waitForExecution(execution);
        
        if (this.disposed || execution.cancelled) {
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

    async runRenderTarget(index, runtimeTarget, targetIndex, sequenceId = "main") {
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
            if (!execution.segmentReady) {
                this.prepareRenderSegment(execution, runtimeTarget, child);
            }

            await this.animateExecution(index, execution);

            if (execution.cancelled) {
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

        if (!execution.segmentStartTime) {
            execution.segmentStartTime = TUtil.now() - execution.step * execution.interval;
        }

        execution.segmentReady = true;
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
        if (this.disposed || this.animationFrameRequested) {
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

    updateRenderExecutions() {
        if (this.disposed) {
            return;
        }
        
        this.startQueuedPrograms();

        const now = TUtil.now();
        let renderChanged = false;
        let layoutChanged = false;

        for (const execution of this.activeRenderExecutions) {
            const child = this.tmodel.childHandles[execution.index];
            const paused = typeof execution.pauseOn === "function" ? execution.pauseOn.call(child) : execution.pauseOn === true;

            if (paused) {
                execution.pausedAt ??= now;
                continue;
            }

            if (execution.pausedAt !== undefined) {
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

        if (this.startQueueIndex < this.startQueue.length || this.activeRenderExecutions.size) {
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

        await this.runTarget(index, program[startIndex], startIndex, sequenceId);

        if (!this.disposed) {
            await this.continueActivatedSequence(index, startIndex + 1, sequenceId);
        }
    }

    
    cancelImperativeExecution(index, imperativeKey) {
        for (const execution of [...this.activeRenderExecutions]) {
            if (execution.index !== index || execution.imperativeKey !== imperativeKey) {
                continue;
            }

            this.activeRenderExecutions.delete(execution);
            execution.cancelled = true;

            this.clearExecution(index, execution.sequenceId, execution.targetIndex);

            const resolve = execution.resolve;

            execution.resolve = undefined;
            resolve?.();
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

        this.cancelImperativeExecution(index, imperativeKey);
        const target = TargetParser.isTargetSpecObject(rawTarget) ? { ...rawTarget } : { value: rawTarget };

        if (target.steps === undefined) {
            target.steps = steps;
        }

        if (target.interval === undefined) {
            target.interval = interval;
        }

        if (target.easing === undefined) {
            target.easing = easing;
        }

        const [value, parsedSteps, parsedInterval, parsedEasing] = TargetParser.getValueStepsCycles(child, imperativeKey, target, 0);

        const targetValue = {
            isImperative: true,
            originalTargetName,
            originalTModel,
            status: "updating",
            value,
            steps: parsedSteps || 0,
            interval: parsedInterval || 0,
            easing: parsedEasing
        };

        child.targetValues[imperativeKey] = targetValue;
        child.addToUpdatingTargets(imperativeKey);

        const runtimeTarget = {
            targetName: key,
            imperativeKey,
            renderable: ParticleUtil.isGpuTarget(key),

            originalTargetName,
            originalTargetIsParent: originalTModel === this.tmodel,

            target: {
                value: TargetParser.isListTarget(value) ? value.list : value,
                steps: parsedSteps,
                interval: parsedInterval,
                easing: parsedEasing,
                pauseOn: target.pauseOn
            }
        };

        const sequenceId = `imperative:${index}:${imperativeKey}:${TUtil.now()}`;
        const promise = runtimeTarget.renderable
            ? this.runRenderTarget(index, runtimeTarget, 0, sequenceId)
            : this.runRuntimeTarget(index, runtimeTarget, 0, sequenceId);

        promise.finally(() => {
            if (this.disposed || child.targetValues[imperativeKey] !== targetValue) {
                return;
            }

            targetValue.status = "done";
            child.removeFromUpdatingTargets(imperativeKey);

            if (originalTModel && originalTargetName) {
                TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, 1, 0, true, "complete");
            }

            getRunScheduler().schedule(1, `gpuImperativeComplete-${child.oid}-${imperativeKey}`);
        });

        return promise;
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
        const activeTargets = this.activeTargets[index] ??= {};

        const promise = Promise.resolve()
            .then(() => this.runActivatedSequence(index, startIndex, sequenceId))
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                delete activeTargets[activationId];
                if (!this.disposed) {
                    TargetUtil.cleanupVisibleComplete(this.tmodel, state.ownerTargetName);
                }
            });

        activeTargets[activationId] = promise;

        return true;
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