import { Easing } from "./Easing.js";
import { ParticleUtil } from "./ParticleUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { TUtil } from "./TUtil.js";
import { getRunScheduler } from "./App.js";

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
    }

    registerChild(index, targetName, compiled) {
        const tmodel = this.tmodel;
        const controlledTargets = {};

        for (const runtimeTarget of compiled.runtimeTargets) {
            if (runtimeTarget.kind === "render") {
                controlledTargets[runtimeTarget.targetName] = true;
            }
        }

        const hasRuntime = compiled.runtimeTargets.length > 0;
        const layoutFunctions = compiled.layoutFunctions ?? [];

        tmodel.childRuntimePrograms[index] = compiled.runtimeTargets;
        
        tmodel.childRuntimeStates[index] = {
            controlledTargets,
            ownerTargetName: targetName,
            programIndex: 0,
            activationCount: 0,
            layoutFunctions,
            layoutFunctionsResolved: layoutFunctions.length === 0,

            executions: {},

            startRequested: false,
            renderReady: false,
            started: false,
            done: !hasRuntime,
            pendingCompletion: hasRuntime
        };

        if (hasRuntime) {
            tmodel.pendingGpuChildRuntimeCounts[targetName] = (tmodel.pendingGpuChildRuntimeCounts[targetName] || 0) + 1;
        }

        return hasRuntime;
    }

    hasPending(key) {
        const targetName = TargetUtil.getTargetName(key);

        return (this.tmodel.pendingGpuChildRuntimeCounts[targetName] || 0) > 0;
    }
    
    prepareRestore() {
        this.restoredMainIndexes = [];
        this.restoredActivationSequences = [];

        for (let index = 0; index < this.tmodel.childRuntimeStates.length; index++) {
            const state = this.tmodel.childRuntimeStates[index];

            if (!state) {
                continue;
            }

            state.executions ??= {};
            state.activationCount ??= 0;

            const executions = Object.values(state.executions);
            const mainExecutions = executions.filter(execution => execution.sequenceId === "main");

            /*
             * A main program may be between targets and therefore have no current
             * execution record, so state.started still matters for the main sequence.
             */
            if (!state.done && (state.started || mainExecutions.length)) {
                this.restoredMainIndexes.push(index);
            }

            const activationSequenceIds = [...new Set(
                executions
                    .map(execution => execution.sequenceId)
                    .filter(sequenceId => sequenceId?.startsWith("activation:"))
            )];

            for (const sequenceId of activationSequenceIds) {
                this.restoredActivationSequences.push({
                    index,
                    sequenceId
                });
            }

            /*
             * Promise/timer state belonged to the old ParticleRuntime.
             */
            state.started = false;
            state.renderReady = false;
            state.startRequested = false;
        }
    }
    
    resumeRestored() {
        const mainIndexes = this.restoredMainIndexes.splice(0);
        const activationSequences = this.restoredActivationSequences.splice(0);

        for (const index of mainIndexes) {
            this.resumeMainProgram(index);
        }

        for (const { index, sequenceId } of activationSequences) {
            this.resumeActivationSequence(index, sequenceId);
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

        const promise = Promise.all(executions.map(execution => this.resumeExecution(index, execution))).then(() => {
            return this.continueActivatedSequence(index, currentTargetIndex + 1, sequenceId);
        }).catch(error => {
            console.error(error);
        }).finally(() => {
            delete activeTargets[activationId];
        });

        activeTargets[activationId] = promise;

        return true;
    }
    
    async continueActivatedSequence(index, programIndex, sequenceId) {
        const program = this.tmodel.childRuntimePrograms[index];

        if (!program) {
            return;
        }

        for (; programIndex < program.length; programIndex++) {
            const runtimeTarget = program[programIndex];

            if (runtimeTarget.mode !== "deferred") {
                break;
            }

            await this.runTarget(index, runtimeTarget, programIndex, sequenceId);
        }
    }
    
    resumeMainProgram(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state || state.done || state.started) {
            return;
        }

        state.started = true;

        const runningExecutions = Object.values(state.executions || {}).filter(execution => execution.sequenceId === "main");

        Promise.all(runningExecutions.map(execution => this.resumeExecution(index, execution))).then(() => {
            return this.runProgram(index);
        }).catch(error => {
            console.error(error);
        }).finally(() => {
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

        return Promise.resolve();
    }

    isControlled(index, key) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state) {
            return false;
        }

        const targetName = ParticleUtil.getGpuRenderTargetName(key);

        return state.controlledTargets?.[targetName] === true;
    }

    complete(index) {
        const tmodel = this.tmodel;
        const state = tmodel.childRuntimeStates[index];

        if (!state || state.done) {
            return;
        }

        state.done = true;
        state.started = false;

        if (!state.pendingCompletion) {
            return;
        }

        state.pendingCompletion = false;

        const targetName = state.ownerTargetName;
        const count = Math.max(0, (tmodel.pendingGpuChildRuntimeCounts[targetName] || 0) - 1);

        if (count > 0) {
            tmodel.pendingGpuChildRuntimeCounts[targetName] = count;
            return;
        }

        delete tmodel.pendingGpuChildRuntimeCounts[targetName];

        getRunScheduler().schedule(1, `gpuChildRuntimeComplete-${tmodel.oid}`);
    }

    resolveLayoutFunctions() {
        const tmodel = this.tmodel;
        let changed = false;

        for (let index = 0; index < tmodel.childRuntimeStates.length; index++) {
            const state = tmodel.childRuntimeStates[index];

            if (!state || state.layoutFunctionsResolved || !state.layoutFunctions?.length) {
                continue;
            }

            const child = tmodel.childHandles[index];
            let childChanged = false;

            for (const entry of state.layoutFunctions) {
                const resolved = ParticleUtil.resolveGpuRenderValue(entry.value, child);
                const value = ParticleUtil.getGpuInitialRenderValue(resolved);

                if (tmodel.getChildValue(index, entry.targetName) === value) {
                    continue;
                }

                child.val(entry.targetName, value);

                childChanged = true;
                changed = true;
            }

            if (!childChanged) {
                state.layoutFunctionsResolved = true;
            }
        }

        return changed;
    }

    queueStart(index) {
        const state = this.tmodel.childRuntimeStates[index];

        if (!state || state.done || state.started) {
            return;
        }

        state.startRequested = true;

        this.startReady();
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
        const tmodel = this.tmodel;

        if (!tmodel.hasDom() || tmodel.completeLayoutEpoch !== tmodel.layoutEpoch) {
            return false;
        }

        let started = false;

        for (let index = 0; index < tmodel.childRuntimeStates.length; index++) {
            const state = tmodel.childRuntimeStates[index];

            if (!state || !state.startRequested || !state.renderReady || state.started || state.done) {
                continue;
            }

            state.startRequested = false;

            this.start(index);

            started = true;
        }

        return started;
    }

    start(index) {
        const state = this.tmodel.childRuntimeStates[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !program?.length || state.started || state.done) {
            return;
        }

        state.started = true;
        state.programIndex = 0;

        Promise.resolve(this.runProgram(index)).catch(error => {
            console.error(error);
        }).finally(() => {
            this.complete(index);
        });
    }

    async runProgram(index) {
        const state = this.tmodel.childRuntimeStates[index];
        const program = this.tmodel.childRuntimePrograms[index];

        if (!state || !program) {
            return;
        }

        const immediate = [];

        while (state.programIndex < program.length && program[state.programIndex].mode === "immediate") {
            const targetIndex = state.programIndex++;

            immediate.push(this.runTarget(index, program[targetIndex], targetIndex, "main"));
        }

        if (immediate.length) {
            await Promise.all(immediate);
        }

        while (state.programIndex < program.length) {
            const targetIndex = state.programIndex++;

            await this.runTarget(index, program[targetIndex], targetIndex, "main");
        }
    }

    async runTarget(index, runtimeTarget, targetIndex, sequenceId = "main") {
        const child = this.tmodel.childHandles[index];

        if (!child) {
            return;
        }

        if (runtimeTarget.kind === "interval") {
            await this.runIntervalTarget(index, runtimeTarget, targetIndex, sequenceId);
            return;
        }

        if (runtimeTarget.kind === "render") {
            await this.runRenderTarget(index, runtimeTarget, targetIndex, sequenceId);
            return;
        }

        const value = runtimeTarget.target.value;

        if (typeof value === "function") {
            const result = value.call(child);

            if (result?.then) {
                await result;
            }
        }
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

    async runRenderTarget(index, runtimeTarget, targetIndex, sequenceId = "main") {
        const tmodel = this.tmodel;
        const child = tmodel.childHandles[index];
        const target = runtimeTarget.target;
        const targetName = runtimeTarget.targetName;

        let execution = this.getExecution(index, sequenceId, targetIndex);

        if (!execution) {
            let value = target.value;

            if (typeof value === "function") {
                value = value.call(child);
            }

            const isValueList = Array.isArray(value);
            const values = isValueList ? value : [tmodel.getChildValue(index, targetName), value];

            execution = {
                sequenceId,
                targetIndex,
                kind: "render",
                targetName,
                values,
                isValueList,
                segmentIndex: 0,
                segmentReady: false,
                step: 0,
                waiting: false,
                startTime: 0
            };

            this.setExecution(index, sequenceId, targetIndex, execution);
        }

        while (execution.segmentIndex < execution.values.length - 1) {
            if (!execution.segmentReady) {
                this.prepareRenderSegment(execution, runtimeTarget, child);
            }

            await this.animateExecution(index, execution);

            execution.segmentIndex++;
            execution.segmentReady = false;
            execution.step = 0;
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

        execution.interval = TUtil.isDefined(target.interval)
            ? Math.max(0, Number(this.resolveOption(target.interval, child, segmentIndex)) || 0)
            : execution.isValueList && execution.steps > 0 ? 8 : 0;

        execution.easingName = this.resolveOption(target.easing, child, segmentIndex);
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

    async animateExecution(index, execution) {
        const tmodel = this.tmodel;

        if (execution.steps <= 0) {
            tmodel.setChildValue(index, execution.targetName, execution.to);
            tmodel.requestParticleRender();

            return;
        }

        const easing = execution.easingName ? Easing.easingFunction(execution.easingName) : undefined;

        for (let step = execution.step + 1; step <= execution.steps; step++) {
            if (execution.interval > 0) {
                await this.waitForExecution(execution);
            }

            const progress = step / execution.steps;
            const easedProgress = easing ? easing(progress) : progress;
            const value = TModelUtil.morph(execution.targetName, execution.from, execution.to, easedProgress);

            tmodel.setChildValue(index, execution.targetName, value);

            execution.step = step;

            tmodel.requestParticleRender();
        }
    }

    wait(interval) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(interval) || 0)));
    }

    findTargetIndex(index, key) {
        const program = this.tmodel.childRuntimePrograms[index];

        if (!program) {
            return -1;
        }

        const cleanKey = TargetUtil.getTargetName(key);
        const exactIndex = program.findIndex(target => target.key === key);

        if (exactIndex >= 0) {
            return exactIndex;
        }

        return program.findIndex(target => target.targetName === cleanKey && target.mode === "immediate");
    }

    async runActivatedSequence(index, startIndex, sequenceId) {
        const program = this.tmodel.childRuntimePrograms[index];

        if (!program || startIndex < 0 || startIndex >= program.length) {
            return;
        }

        await this.runTarget(index, program[startIndex], startIndex, sequenceId);
        await this.continueActivatedSequence(index, startIndex + 1, sequenceId);
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

        if (runtimeTarget.kind !== "render" && runtimeTarget.kind !== "runtime") {
            throw new Error(`GPU child target "${key}" cannot be activated.`);
        }

        const activationId = `${runtimeTarget.key}-${++state.activationCount}`;
        const sequenceId = `activation:${activationId}`;
        const activeTargets = this.activeTargets[index] ??= {};

        const promise = Promise.resolve().then(() => {
            return this.runActivatedSequence(index, startIndex, sequenceId);
        }).catch(error => {
            console.error(error);
        }).finally(() => {
            delete activeTargets[activationId];
        });

        activeTargets[activationId] = promise;

        return true;
    }
}

export { ParticleRuntime };