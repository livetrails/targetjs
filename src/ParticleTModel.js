import { TModel } from "./TModel.js";
import { TModelFactory } from "./TModelFactory.js";
import { ParticleRenderer } from "./ParticleRenderer.js";
import { ParticleRuntime } from "./ParticleRuntime.js";
import { ParticleUtil } from "./ParticleUtil.js";
import { ParticleChild } from "./ParticleChild.js";
import { TargetParser } from "./TargetParser.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";
import { App, getRunScheduler } from "./App.js";

/**
 * It provides a TModel that can render instanced addChildren values on the GPU.
 */
class ParticleTModel extends TModel {
    constructor(type, targets, oid, options = {}) {
        super(type, targets, oid, options);

        this.childActualValues = [];
        this.childTargetMaps = [];

        this.particleValuesDirty = false;
        this.particleRenderRequested = false;

        this.childHandles = [];
        this.childTargetValues = {};
        this.childTransitions = {};
        this.pendingGpuChildren = {};
        this.pendingImperativeCompletions = new Map();
        
        this.childRuntimePrograms = [];
        this.childRuntimeStates = [];
        this.pendingGpuChildRuntimeCounts = {};

        this.activeChildTransitionKey = undefined;
        this.gpuChildrenEnabled = false;
        this.childGeneration = 0;

        this.layoutEpoch = 0;
        this.completeLayoutEpoch = -1;
        this.layoutCompleteWaiters = [];
        this.particleSyncPromise = undefined;
        this.restoringParticleRuntime = false;

        this.particleRuntime = new ParticleRuntime(this);
        this.particleRenderer = new ParticleRenderer(this);
    }

    async onDomAvailable() {
        if (this.restoringParticleRuntime) {
            return;
        }

        const ready = await this.syncParticleRenderer();

        if (ready) {
            this.particleRuntime.markPendingRenderReady();
        }
    }
    
    async restoreRuntimeDomDerivedState(explodeSource) {
        if (!this.gpuChildrenEnabled || !this.hasDom()) {
            this.restoringParticleRuntime = false;
            return false;
        }

        let restored = false;

        try {
            await this.waitForLayoutComplete();

            restored = await this.syncParticleRenderer();

            if (!restored) {
                return false;
            }

            if (this.explodeChildrenState) {
                restored = await this.restoreExplodeTexture(explodeSource);

                if (!restored) {
                    return false;
                }
            }

            this.particleRuntime.markRenderReady(this.childHandles.map(child => child.index));

            await this.particleRenderer.waitForPresentedFrame();
        } finally {
            this.restoringParticleRuntime = false;
       }

        return restored;
    }
    
    restoreExplodeTexture(explodeSource) {
        if (!this.explodeChildrenState) {
            return Promise.resolve(true);
        }

        if (!explodeSource) {
            return Promise.resolve(false);
        }

        return this.particleRenderer.setExplodeSource({
            bitmap: explodeSource
        });
    }
    
    disposeRuntimeDerivedState() {
        this.particleRuntime?.dispose();
        this.particleRenderer?.destroy();
    }
    
    syncParticleRenderer() {
        if (this.particleSyncPromise) {
            return this.particleSyncPromise;
        }

        this.particleSyncPromise = this.syncParticleRendererNow().finally(() => {
            this.particleSyncPromise = undefined;
        });

        return this.particleSyncPromise;
    }

    async syncParticleRendererNow() {
        if (!this.gpuChildrenEnabled || !this.hasDom()) {
            return false;
        }

        const ready = this.childHandles.length ? await this.particleRenderer.setParticles(this.childHandles) : await this.particleRenderer.init();

        if (!ready) {
            return false;
        }

        const key = this.activeChildTransitionKey;

        if (!key) {
            return true;
        }

        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition) {
            return true;
        }

        const applied = await this.particleRenderer.setTargetParticles(transition.values, transition.steps, transition.generation);

        if (applied && this.childTransitions[targetName] === transition) {
            this.handleSpecialTargetStep(key);
        }

        return applied;
    }

    requestParticleRender() {
        if (this.restoringParticleRuntime || !this.gpuChildrenEnabled ||
                !this.isVisible() || !this.hasDom() || this.particleRenderRequested) {
            return;
        }

        this.particleRenderRequested = true;

        requestAnimationFrame(() => {
            this.particleRenderRequested = false;

            if (!this.isVisible() || !this.hasDom()) {
                return;
            }

            if (this.activeChildTransitionKey) {
                this.particleRenderer.render();
                return;
            }

            if (this.particleValuesDirty) {
                this.particleValuesDirty = false;
                this.particleRenderer.updateParticles(this.childHandles);
            } else {
                this.particleRenderer.render();
            }
        });
    }
    
    onVisibilityChange(visible) {
        if (this.restoringParticleRuntime) {
            return;
        }

        if (visible) {
            this.particleRuntime.resumeForVisibility();
        } else {
            this.particleRuntime.pauseForVisibility();
        }
    }
    
    getChildrenRenderer() {
        if (!TUtil.webGpuAvailable) {
            return "dom";
        }
        
        const target = this.targets[TargetUtil.currentTargetName];

        return target?.renderer || "auto";
    }

    canRenderChildren(values) {
        values = Array.isArray(values) ? values : [values];

        return values.length > 0 && values.every(value => {
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return false;
            }

            return Object.entries(value).every(([key, propertyValue]) => {
                const cleanKey = TargetUtil.getTargetName(key);

                return key === cleanKey && ParticleUtil.isGpuTarget(cleanKey) && this.canRenderChildValue(propertyValue);
            });
        });
    }

    canRenderChildValue(value) {
        if (typeof value === "function") {
            return false;
        }

        if (!TargetParser.isTargetSpecObject(value)) {
            return true;
        }

        if (typeof value.value === "function") {
            return false;
        }

        if (Array.isArray(value.value)) {
            return value.value.length >= 2;
        }

        return true;
    }

    affectsChildLayout(key) {
        return ParticleUtil.affectsChildLayout(key);
    }

    getChild(index) {
        if (!this.gpuChildrenEnabled || typeof index !== "number") {
            return super.getChild(index);
        }

        return this.childHandles[index];
    }

    getChildren() {
        const children = super.getChildren();

        return this.gpuChildrenEnabled ? [...children, ...this.childHandles] : children;
    }

    getChildValue(index, key) {
        const child = this.childHandles[index];

        if (!child) {
            return;
        }

        const cleanKey = ParticleUtil.getTargetName(key);

        if ((cleanKey === "x" || cleanKey === "y") && !child.allTargetMap[cleanKey]) {
            return child[cleanKey];
        }

        return child.actualValues[cleanKey];
    }

    setChildTarget(index, key, target, steps, interval, easing) {
        const originalTargetName = TargetUtil.currentTargetName;
        const originalTModel = TargetUtil.currentTModel;
        const cleanKey = ParticleUtil.getTargetName(key);
        const child = this.childHandles[index];

        if (!child) {
            return;
        }
        
        if (originalTModel && originalTargetName && originalTModel !== this) {
            TargetUtil.markChildAction( originalTModel, originalTargetName, child);
        }

        child.allTargetMap[cleanKey] = key;
        this.childTargetMaps[index] = child.allTargetMap;

        // Collect imperative assignments issued synchronously by a sequential parent target.
        // TargetExecutor calls handleSpecialTarget() after evaluating the parent function.
        if (originalTModel === this && typeof originalTargetName === "string" && originalTargetName.endsWith("$$") &&
                this.targets[originalTargetName] && this.targetValues[originalTargetName]?.status !== "done") {
            const targetName = TargetUtil.getTargetName(originalTargetName);
            const targetValues = this.childTargetValues[targetName] ??= [];
            const childTargets = targetValues[index] ??= {};
            const specification = TargetParser.isTargetSpecObject(target) ? { ...target } : { value: target };

            if (specification.steps === undefined && steps !== undefined) {
                specification.steps = steps;
            }

            if (specification.interval === undefined && interval !== undefined) {
                specification.interval = interval;
            }

            if (specification.easing === undefined && easing !== undefined) {
                specification.easing = easing;
            }

            childTargets[cleanKey] = specification;
            return;
        }

        this.particleRuntime.setImperativeTarget(
            index,
            cleanKey,
            target,
            steps,
            interval,
            easing,
            originalTargetName,
            originalTModel
        );
    }

    setChildValue(index, key, value, invalidateLayout = true) {
        const child = this.childHandles[index];

        if (!child) {
            return false;
        }

        const cleanKey = ParticleUtil.getTargetName(key);

        if (child.actualValues[cleanKey] === value) {
            return false;
        }

        child.actualValues[cleanKey] = value;

        if (ParticleUtil.isGpuTarget(cleanKey)) {
            this.particleValuesDirty = true;
        }

        if (invalidateLayout && this.affectsChildLayout(cleanKey)) {
            this.invalidateLayout();
        }

        return true;
    }

    getChildTargetValues(key) {
        return this.childTargetValues[TargetUtil.getTargetName(key)];
    }

    handleChildTargets(key, targetValues, options = {}) {
        const targetName = TargetUtil.getTargetName(key);
        const defaultSteps = Math.max(0, Number(options.steps) || 0);
        const children = [];
        let handledNonGpu = false;

        for (let index = 0; index < targetValues.length; index++) {
            const targets = targetValues[index];
            const child = this.childHandles[index];

            if (!targets || !child) {
                continue;
            }

            const transitionChild = {
                index,
                target: {},
                steps: {},
                loops: {},
                valueLists: {}
            };

            for (const [property, rawTarget] of Object.entries(targets)) {
                const targetProperty = ParticleUtil.getTargetName(property);

                if (!ParticleUtil.isGpuTarget(targetProperty)) {
                    const [value, steps] = TargetParser.getValueStepsCycles(child,targetProperty, rawTarget, 0);

                    if (!steps) {
                        this.setChildValue(index, targetProperty, value);
                        handledNonGpu = true;
                    }

                    continue;
                }

                const [value, parsedSteps] = TargetParser.getValueStepsCycles(child, targetProperty, rawTarget, 0);

                const hasOwnSteps =
                    TUtil.isDefined(rawTarget?.steps) ||
                    TargetParser.isValueStepsCycleArray(rawTarget?.value);

                const propertySteps = hasOwnSteps ? parsedSteps : defaultSteps;

                if (TargetParser.isListTarget(value)) {
                    transitionChild.valueLists[targetProperty] = value.list;
                    transitionChild.target[targetProperty] = value.list[1];
                } else {
                    transitionChild.target[targetProperty] = value;
                }

                transitionChild.steps[targetProperty] = propertySteps;
                transitionChild.loops[targetProperty] = rawTarget?.loop === true;
            }

            if (Object.keys(transitionChild.target).length) {
                children.push(transitionChild);
            }
        }

        if (!children.length) {
            if (!handledNonGpu) {
                return false;
            }

            delete this.childTargetValues[targetName];

            return {
                handled: true,
                steps: 0
            };
        }

        const segmentCount = this.getChildrenSegmentCount(children);
        const segment = this.buildChildTransitionSegment(children, 0, defaultSteps);

        this.commitImmediateChildTransitionValues(children, segment.values, segment.steps);

        if (!segment.hasSegment || segment.maxSteps === 0) {
            this.commitChildTransitionSegment(children, segment.values, segment.steps);
            delete this.childTargetValues[targetName];

            this.particleValuesDirty = true;
            this.requestParticleRender();

            return {
                handled: true,
                steps: 0
            };
        }

        const transition = {
            children,
            segmentIndex: 0,
            segmentCount,
            defaultSteps,
            initialValues: segment.initialValues,
            values: segment.values,
            steps: segment.steps,
            loops: segment.loops,
            hasLoop: segment.hasLoop,
            generation: this.childGeneration
        };

        this.childTransitions[targetName] = transition;
        this.activeChildTransitionKey = key;

        this.addChildTransitionLayoutTargets(transition);

        if (this.hasDom()) {
            this.particleRenderer.setTargetParticles(segment.values, segment.steps, transition.generation).then(applied => {
                if (applied && this.childTransitions[targetName] === transition) {
                    this.handleSpecialTargetStep(key);
                }
            });
        }

        return {
            handled: true,
            steps: segment.maxSteps
        };
    }

    commitChildTransitionSegment(children, values, steps) {
        for (const transitionChild of children) {
            const index = transitionChild.index;
            const child = this.childHandles[index];
            const childSteps = steps?.[index];

            if (!child || !childSteps) {
                continue;
            }

            let layoutChanged = false;

            for (const property of Object.keys(childSteps)) {
                child.actualValues[property] = values[index]?.[property];

                if (ParticleUtil.affectsChildLayout(property)) {
                    child.removeFromNoDomUpdatingTargets(property);
                    layoutChanged = true;
                }
            }

            if (layoutChanged) {
                child.actualValues.isVisible = child.calcVisibility();
            }
        }
    }

    canBatchChildTarget(property, specification) {
        if (!ParticleUtil.isGpuTarget(property) || !TargetParser.isTargetSpecObject(specification)) {
            return false;
        }

        // The WebGPU shader interpolates scalar values and colors linearly. Other animation
        // options need ParticleRuntime, which resolves each property's execution separately.
        if (specification.interval !== undefined || specification.easing !== undefined || specification.pauseOn !== undefined ||
                specification.loop !== undefined || specification.cycles !== undefined) {
            return false;
        }

        if (specification.steps !== undefined && (!Number.isFinite(specification.steps) || specification.steps < 0)) {
            return false;
        }

        if (property === "backgroundColor") {
            return typeof specification.value === "string";
        }

        return typeof specification.value === "number" && Number.isFinite(specification.value);
    }

    handleSpecialTarget(key) {
        if (!this.gpuChildrenEnabled) {
            return false;
        }

        const targetName = TargetUtil.getTargetName(key);
        const targetValues = this.childTargetValues[targetName];

        if (!targetValues) {
            return false;
        }

        delete this.childTargetValues[targetName];

        for (let index = 0; index < targetValues.length; index++) {
            for (const [property, specification] of Object.entries(targetValues[index] || {})) {
            this.particleRuntime.setImperativeTarget(index, property, specification, undefined, undefined, undefined, key, this);
            }
        }

        return false;
    }

    getRenderScrollLeft() {
        return  this.$dom?.getScrollLeft() || this.getScrollLeft() || 0;
    }

    getRenderScrollTop() {
        return  this.$dom?.getScrollTop() || this.getScrollTop() || 0;
    }    

    addChild(child, index = this.addedChildren.length + this.allChildrenList.length) {
        if (child && typeof child === "object" && !(child instanceof TModel) && ParticleUtil.isChildrenTarget(TargetUtil.currentTargetName)) {
            const renderer = this.getChildrenRenderer();

            if (renderer !== "dom") {
                const childDefinition = TUtil.cloneTargetDefinition(child);

                if (renderer === "gpu" || this.canRenderChildren(childDefinition)) {
                    this.addGpuChild(childDefinition);

                    return this;
                }
            }
        }

        return super.addChild(child, index);
    }

    addGpuChild(definition) {
        const originalTargetName = TargetUtil.currentTargetName;
        const index = this.childHandles.length;

        this.gpuChildrenEnabled = true;

        const handle = new ParticleChild(this, index);
        handle.oid = `${this.oid}_${this.childGeneration}`;
        
        this.childHandles[index] = handle;
        this.childActualValues[index] = handle.actualValues;
        this.childTargetMaps[index] = handle.allTargetMap;

        try {
            const compiled = this.prepareInitialGpuChildRuntime(ParticleUtil.compileChildDefinition(handle, definition), definition);
            const child = this.createGpuChild(compiled.renderDefinition);

            if (!child) {
                this.childHandles.pop();
                this.childActualValues.pop();
                this.childTargetMaps.pop();

                return false;
            }

            Object.assign(handle.actualValues, child.initial);

            this.childActualValues[index] = handle.actualValues;
            this.childTargetMaps[index] = handle.allTargetMap;

            this.particleRuntime.registerChild(index, originalTargetName, compiled);

            const pending = this.pendingGpuChildren[originalTargetName] ??= {
                key: originalTargetName,
                children: []
            };

            pending.children.push({
                index,
                ...child
            });

            this.childGeneration++;
            this.childrenUpdateFlag = true;
            this.markLayoutDirty("addGpuChild");

            App.tmodelIdMap[handle.oid] = handle;

            return true;
        } catch (error) {
            this.childHandles.pop();
            this.childActualValues.pop();
            this.childTargetMaps.pop();
            this.childRuntimePrograms.pop();
            this.childRuntimeStates.pop();

            throw error;
        }
    }
    
    prepareInitialGpuChildRuntime(compiled, definition) {
        for (const [key, specification] of Object.entries(definition)) {
            if (TargetUtil.getTargetName(key) !== key || !TargetParser.isTargetSpecObject(specification) || !ParticleUtil.isGpuTarget(key)) {
                continue;
            }

            const value = specification.value;
            const hasValues = Array.isArray(value) && value.length > 1;
            const steps = specification.steps;
            const hasSteps = Array.isArray(steps) ? steps.some(step => Number(step) > 0) : Number(steps) > 0;

            if (!hasValues && !hasSteps) {
                continue;
            }

            // Function-valued targets are already compiled for ParticleRuntime.
            if (typeof value === "function") {
                continue;
            }

            const targetName = ParticleUtil.getTargetName(key);
            const initialValue = TUtil.isDefined(specification.initialValue)
                ? specification.initialValue : hasValues ? value[0] : value;

            const runtimeTarget = compiled.runtimeTargets.find(target => target.key === key && target.mode === "immediate");

            // Initial animations belong to the child, not to the parent's GPU transition.
            compiled.renderDefinition[targetName] = initialValue;

            if (runtimeTarget) {
                runtimeTarget.requiresRuntime = true;
                runtimeTarget.requiresInitialResolution = false;
                runtimeTarget.renderable = true;
                runtimeTarget.target = { ...specification };
            } else {
                compiled.runtimeTargets.push({
                    key,
                    targetName,
                    mode: "immediate",
                    target: { ...specification },
                    requiresRuntime: true,
                    requiresInitialResolution: false,
                    renderable: true
                });
            }
        }

        return compiled;
    }


    removeChild(child) {
        if (!this.gpuChildrenEnabled || !(child instanceof ParticleChild)) {
            return super.removeChild(child);
        }

        const index = this.childHandles.indexOf(child);

        if (index < 0) {
            return;
        }

        if (App.tmodelIdMap[child.oid] === child) {
            delete App.tmodelIdMap[child.oid];
        }

        this.particleRuntime.removeChild(index);

        this.childHandles.splice(index, 1);
        this.childActualValues.splice(index, 1);
        this.childTargetMaps.splice(index, 1);

        this.removeChildFromTransitions(index);

        for (const targetValues of Object.values(this.childTargetValues)) {
            targetValues?.splice(index, 1);
        }

        child.index = -1;

        for (let i = index; i < this.childHandles.length; i++) {
            this.childHandles[i].index = i;
        }

        this.childGeneration++;
        this.particleValuesDirty = true;
        this.invalidateLayout();
        this.markLayoutDirty("removeGpuChild");
        this.requestParticleRender();

        return this;
    }

    removeChildFromTransitions(index) {
        for (const transition of Object.values(this.childTransitions)) {
            transition.initialValues?.splice(index, 1);
            transition.values?.splice(index, 1);
            transition.steps?.splice(index, 1);
            transition.loops?.splice(index, 1);

            if (transition.children) {
                transition.children = transition.children.filter(child => child.index !== index);

                for (const child of transition.children) {
                    if (child.index > index) {
                        child.index--;
                    }
                }
            }
        }

        for (const pending of Object.values(this.pendingGpuChildren)) {
            if (!pending?.children) {
                continue;
            }

            pending.children = pending.children.filter(child => child.index !== index);

            for (const child of pending.children) {
                if (child.index > index) {
                    child.index--;
                }
            }
        }
    }

    isTargetEnabled(key) {
        const target = this.targets[key];

        if (ParticleUtil.isChildrenTarget(key) && target?.waitForChildren === true &&
                this.isExecuted(key) && this.particleRuntime.hasPending(key)) {
            return false;
        }

        return super.isTargetEnabled(key);
    }

    activateGpuChildTarget(index, key) {
        return this.particleRuntime.activateTarget(index, key);
    }

    createGpuChild(definition) {
        const initial = {};
        const target = {};
        const steps = {};
        const loops = {};
        const valueLists = {};

        let hasTransition = false;

        for (const [property, value] of Object.entries(definition)) {
            const resolved = this.resolveInitialChildProperty(value);

            if (!resolved) {
                return;
            }

            initial[property] = resolved.initialValue;
            target[property] = resolved.targetValue;

            if (resolved.steps !== undefined) {
                steps[property] = resolved.steps;
            }

            if (resolved.valueList) {
                valueLists[property] = resolved.valueList;
            }

            if (resolved.loop) {
                loops[property] = true;
            }

            if (resolved.valueList?.length > 1 || resolved.initialValue !== resolved.targetValue) {
                hasTransition = true;
            }
        }

        return {
            initial,
            target,
            steps,
            loops,
            valueLists,
            hasTransition
        };
    }

    finalizeChildrenTarget(key) {
        if (!ParticleUtil.isChildrenTarget(key) && !TargetParser.isExplodeChildrenTarget(key)) {
            return false;
        }

        const pending = this.pendingGpuChildren[key];

        if (!pending?.children.length) {
            return false;
        }

        this.invalidateLayout();
        delete this.pendingGpuChildren[key];

        const childIndexes = pending.children.map(child => child.index);

        const runtimeIndexes = childIndexes.filter(index => {
            const state = this.childRuntimeStates[index];
            return state && !state.done;
        });

        for (const index of runtimeIndexes) {
            this.particleRuntime.queueStart(index);
        }

        if (this.hasDom()) {
            const particlesReady = this.particleRenderer.setParticles(this.childHandles);

            const renderReady = TargetParser.isExplodeChildrenTarget(key) && this.explodeCapturePromise
                ? Promise.all([particlesReady, this.explodeCapturePromise])
                : Promise.all([particlesReady]);

            renderReady.then(results => {
                if (results.some(result => result !== true)) {
                    return;
                }

                this.particleRuntime.markRenderReady(childIndexes);
            }).catch(error => console.error(error));
        }

        return {
            handled: true,
            steps: 0
        };
    }

    addChildTransitionLayoutTargets(transition) {
        for (const transitionChild of transition.children) {
            const index = transitionChild.index;
            const child = this.childHandles[index];
            const childSteps = transition.steps?.[index];

            if (!child || !childSteps) {
                continue;
            }

            for (const [property, steps] of Object.entries(childSteps)) {
                if (steps > 0 && ParticleUtil.affectsChildLayout(property)) {
                    child.addToNoDomUpdatingTargets(property);
                }
            }
        }
    }

    catchupChildLayoutTargets(child) {
        if (!child?.noDomUpdatingTargets?.size || child.index < 0) {
            return false;
        }

        const key = this.activeChildTransitionKey;

        if (!key) {
            return false;
        }

        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition || transition.generation !== this.childGeneration) {
            return false;
        }

        const index = child.index;
        const initialValues = transition.initialValues?.[index];
        const targetValues = transition.values?.[index];
        const childSteps = transition.steps?.[index];

        if (!initialValues || !targetValues || !childSteps) {
            return false;
        }

        const currentStep = Math.max(0, Number(this.getTargetStep(key)) || 0);
        let changed = false;

        for (const property of [...child.noDomUpdatingTargets]) {
            if (!ParticleUtil.affectsChildLayout(property)) {
                child.removeFromNoDomUpdatingTargets(property);
                continue;
            }

            const initialValue = initialValues[property];
            const targetValue = targetValues[property];
            const steps = Math.max(0, Number(childSteps[property]) || 0);

            if (!TUtil.isDefined(initialValue) || !TUtil.isDefined(targetValue)) {
                child.removeFromNoDomUpdatingTargets(property);
                continue;
            }

            const progress = steps === 0 ? 1 : Math.min(1, currentStep / steps);
            const value = initialValue + (targetValue - initialValue) * progress;

            if (child.actualValues[property] !== value) {
                child.actualValues[property] = value;
                changed = true;
            }

            if (progress === 1) {
                child.removeFromNoDomUpdatingTargets(property);
            }
        }

        return changed;
    }

    advanceChildTransitionSegment(key, transition) {
        if (!transition || !Array.isArray(transition.children) || !Number.isInteger(transition.segmentIndex) || !Number.isInteger(transition.segmentCount)) {
            return false;
        }

        const nextSegmentIndex = transition.segmentIndex + 1;

        if (nextSegmentIndex >= transition.segmentCount) {
            return false;
        }

        this.commitChildTransitionSegment(transition.children, transition.values, transition.steps);
        this.particleRenderer.completeTransition();

        const segment = this.buildChildTransitionSegment(transition.children, nextSegmentIndex, transition.defaultSteps);

        transition.segmentIndex = nextSegmentIndex;
        transition.initialValues = segment.initialValues;
        transition.values = segment.values;
        transition.steps = segment.steps;
        transition.loops = segment.loops;

        this.commitImmediateChildTransitionValues(transition.children, segment.values, segment.steps);
        this.addChildTransitionLayoutTargets(transition);

        const targetValue = this.targetValues[key];

        if (targetValue) {
            targetValue.steps = segment.maxSteps;
        }

        this.resetTargetStep(key);
        this.resetTargetInitialValue(key);
        this.setTargetStatus(key, "updating");

        if (this.hasDom()) {
            this.particleRenderer.setTargetParticles(segment.values, segment.steps, transition.generation).then(applied => {
                if (applied && this.childTransitions[TargetUtil.getTargetName(key)] === transition) {                  
                    this.handleSpecialTargetStep(key);
                } 
            });
        }

        return true;
    }

    buildChildTransitionSegment(children, segmentIndex, defaultSteps) {
        const initialValues = new Array(this.childHandles.length);
        const values = this.childHandles.map(child => child?.actualValues);
        const steps = new Array(this.childHandles.length);
        const loops = new Array(this.childHandles.length);

        let maxSteps = 0;
        let hasSegment = false;
        let hasLoop = false;

        for (const transitionChild of children) {
            const index = transitionChild.index;
            const child = this.childHandles[index];

            if (!child) {
                continue;
            }

            const current = {
                ...child.actualValues,
                x: this.getChildValue(index, "x"),
                y: this.getChildValue(index, "y")
            };
            let initial;
            let target;
            let childSteps;
            let childLoops;

            for (const property of Object.keys(transitionChild.target)) {
                const valueList = transitionChild.valueLists[property];
                let value;

                if (valueList) {
                    if (segmentIndex >= valueList.length - 1) {
                        continue;
                    }

                    value = valueList[segmentIndex + 1];
                } else {
                    if (segmentIndex !== 0 || current[property] === transitionChild.target[property]) {
                        continue;
                    }

                    value = transitionChild.target[property];
                }

                const propertySteps = this.getChildPropertySteps(transitionChild, property, segmentIndex, defaultSteps);

                initial ||= {};
                target ||= { ...current };
                childSteps ||= {};
                childLoops ||= {};

                initial[property] = current[property];
                target[property] = value;
                childSteps[property] = propertySteps;
                childLoops[property] = transitionChild.loops[property] === true;

                maxSteps = Math.max(maxSteps, propertySteps);
                hasSegment = true;

                if (childLoops[property]) {
                    hasLoop = true;
                }
            }

            if (target) {
                initialValues[index] = initial;
                values[index] = target;
                steps[index] = childSteps;
                loops[index] = childLoops;
            }
        }

        return {
            initialValues,
            values,
            steps,
            loops,
            maxSteps,
            hasSegment,
            hasLoop
        };
    }

    getChildPropertySteps(child, property, segmentIndex, defaultSteps) {
        const steps = child.steps[property];

        if (Array.isArray(steps)) {
            if (!steps.length) {
                return defaultSteps;
            }

            return Math.max(0, Number(steps[segmentIndex % steps.length]) || 0);
        }

        return steps !== undefined ? Math.max(0, Number(steps) || 0) : defaultSteps;
    }

    getChildSegmentCount(child) {
        let count = 0;

        for (const valueList of Object.values(child.valueLists)) {
            count = Math.max(count, valueList.length - 1);
        }

        return count;
    }

    getChildrenSegmentCount(children) {
        let count = 0;

        for (const child of children) {
            count = Math.max(count, this.getChildSegmentCount(child));
        }

        return count;
    }

    getActiveChildTransition() {
        if (!this.activeChildTransitionKey) {
            return;
        }

        const targetName = TargetUtil.getTargetName(this.activeChildTransitionKey);

        return this.childTransitions[targetName];
    }

    handleSpecialTargetStep(key) {
        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition || transition.generation !== this.childGeneration) {
            return false;
        }

        if (this.isVisible()) {
            this.particleRenderer.setTransitionStep(this.getTargetStep(key));
        }

        return true;
    }

    handleSpecialTargetEnd(key) {
        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition) {
            return false;
        }

        if (transition.generation !== this.childGeneration) {
            this.particleRenderer.completeTransition();

            delete this.childTransitions[targetName];
            delete this.childTargetValues[targetName];

            if (this.activeChildTransitionKey === key) {
                this.activeChildTransitionKey = undefined;
            }

            this.particleValuesDirty = true;
            this.requestParticleRender();

            return true;
        }

        if (this.advanceChildTransitionSegment(key, transition)) {
            return true;
        }

        if (transition.hasLoop) {
            this.restartChildTransition(key, transition);
            return true;
        }

        this.commitChildTransitionSegment(transition.children, transition.values, transition.steps);
        this.particleRenderer.completeTransition();

        delete this.childTransitions[targetName];
        delete this.childTargetValues[targetName];

        if (this.activeChildTransitionKey === key) {
            this.activeChildTransitionKey = undefined;
        }

        return true;
    }

    resolveInitialChildProperty(value) {
        if (!TargetParser.isTargetSpecObject(value)) {
            return {
                initialValue: value,
                targetValue: value,
                valueList: undefined,
                steps: undefined,
                loop: false
            };
        }

        const targetValue = value.value;

        const steps = Array.isArray(value.steps)
            ? value.steps.map(step => Math.max(0, Number(step) || 0))
            : value.steps !== undefined
                ? Math.max(0, Number(value.steps) || 0)
                : undefined;

        const loop = value.loop === true;

        if (Array.isArray(targetValue)) {
            if (targetValue.length < 2) {
                return;
            }

            return {
                initialValue: targetValue[0],
                targetValue: targetValue[1],
                valueList: [...targetValue],
                steps,
                loop
            };
        }

        return {
            initialValue: targetValue,
            targetValue,
            valueList: undefined,
            steps: 0,
            loop
        };
    }

    restartChildTransition(key, transition) {
        if (!transition?.hasLoop) {
            return false;
        }

        this.resetTargetStep(key);
        this.resetTargetInitialValue(key);
        this.setTargetStatus(key, "updating");

        this.addChildTransitionLayoutTargets(transition);
        this.handleSpecialTargetStep(key);

        return true;
    }

    shouldBeBracketed() {
        if (this.gpuChildrenEnabled) {
            return false;
        }

        return super.shouldBeBracketed();
    }

    shouldCalculateChildren() {
        if (!this.gpuChildrenEnabled) {
            return super.shouldCalculateChildren();
        }

        if (!this.getDirtyLayout() && this.completeLayoutEpoch === this.layoutEpoch && !this.hasLayoutStateChanged()) {
            this.currentStatus = undefined;
            this.requestParticleRender();

            return false;
        }

        return super.shouldCalculateChildren();
    }

    getLayoutState() {
        return [
            this.getWidth(),
            this.getHeight(),
            this.val("gap"),
            this.getPaddingTop(),
            this.getPaddingRight(),
            this.getPaddingBottom(),
            this.getPaddingLeft(),
            this.getContainerOverflowMode()
        ];
    }

    markLayoutComplete(epoch) {        
        if (epoch !== this.layoutEpoch) {
            return;
        }

        this.completeLayoutEpoch = epoch;
        this.completeLayoutState = this.getLayoutState();

        if (this.particleRuntime.resolveInitialTargets()) {
            this.requestParticleRender();

            if (this.completeLayoutEpoch !== this.layoutEpoch) {
                getRunScheduler().schedule(0, `particleInitialTargets-${this.oid}`);
                return;
            }
        }
        
        this.particleRenderer.updateCanvasLayerWidthHeight();

        this.resolveLayoutCompleteWaiters();
        this.particleRuntime.startReady();

        const key = this.activeChildTransitionKey;

        if (!key) {
            return;
        }

        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition) {
            return;
        }

        const layoutProperties = ["x", "y", "width", "height"];

        for (let index = 0; index < this.childHandles.length; index++) {
            const child = this.childHandles[index];

            if (!child) {
                continue;
            }

            let target = transition.values[index];

            if (!target || target === child.actualValues) {
                target = { ...child.actualValues };
                transition.values[index] = target;
            }

            const childSteps = transition.steps[index] ??= {};

            for (const property of layoutProperties) {
                if (Object.prototype.hasOwnProperty.call(childSteps, property)) {
                    continue;
                }

                const value = this.getChildValue(index, property);

                if (!TUtil.isDefined(value)) {
                    continue;
                }

                target[property] = value;
                childSteps[property] = 0;
            }
        }

        if (transition.generation !== this.childGeneration || this.restoringParticleRuntime || !this.hasDom()) {
            return;
        }

        const isCurrentTransition = () => {
            return this.activeChildTransitionKey === key &&
                this.childTransitions[targetName] === transition &&
                transition.generation === this.childGeneration;
        };

        this.particleRenderer.setTargetParticles(transition.values, transition.steps, transition.generation).then(applied => {
            if (applied && isCurrentTransition()) {               
                this.handleSpecialTargetStep(key);
            }
        });
    }

    commitImmediateChildTransitionValues(children, values, steps) {
        let changed = false;

        for (const transitionChild of children) {
            const index = transitionChild.index;
            const child = this.childHandles[index];
            const childSteps = steps?.[index];

            if (!child || !childSteps) {
                continue;
            }

            let layoutChanged = false;

            for (const [property, propertySteps] of Object.entries(childSteps)) {
                if (propertySteps !== 0) {
                    continue;
                }

                const value = values[index]?.[property];

                if (child.actualValues[property] === value) {
                    continue;
                }

                child.actualValues[property] = value;
                changed = true;

                if (ParticleUtil.affectsChildLayout(property)) {
                    layoutChanged = true;
                }
            }

            if (layoutChanged) {
                child.actualValues.isVisible = child.calcVisibility();
            }
        }

        return changed;
    }

    hasLayoutStateChanged() {
        const current = this.getLayoutState();
        const previous = this.completeLayoutState;

        if (!previous || current.length !== previous.length) {
            return true;
        }

        return current.some((value, index) => value !== previous[index]);
    }

    invalidateLayout() {
        this.layoutEpoch++;
    }

    getParticleCount() {
        return this.childHandles.length;
    }

    getRuntimeSnapshotFields() {
        return {
            childHandleRuntimeStates: this.childHandles.map(child => ({
                oid: child.oid,
                x: child.x,
                y: child.y,
                targets: child.targets,
                targetValues: child.targetValues,
                updatingTargetList: [...child.updatingTargetList],
                activeTargetList: [...child.activeTargetList],
                activatedTargets: [...child.activatedTargets],
                noDomUpdatingTargets: child.noDomUpdatingTargets ? new Set(child.noDomUpdatingTargets) : undefined,
                pendingTargets: child.pendingTargets
            }))
        };
    }

    excludeRuntimeSnapshotField(key) {
        return ParticleUtil.isTransientRuntimeField(key);
    }
    
    restoreRuntimeDerivedState() {
        this.particleRenderer.destroy();

        this.childActualValues ||= [];
        this.childTargetMaps ||= [];
        const childHandleRuntimeStates = this.childHandleRuntimeStates || [];

        this.childHandles = this.childActualValues.map((values, index) => {
            const child = new ParticleChild(this, index);
            const runtimeState = childHandleRuntimeStates[index];
            child.oid = runtimeState?.oid ?? child.oid;
            
            const targetMap = this.childTargetMaps[index] || {};

            Object.assign(child.actualValues, values);
            Object.assign(child.allTargetMap, targetMap);
            
            child.x = runtimeState?.x ?? child.x;
            child.y = runtimeState?.y ?? child.y;

            if (runtimeState) {
                Object.assign(child.targets, runtimeState.targets);
                Object.assign(child.targetValues, runtimeState.targetValues);

                for (const key of runtimeState.updatingTargetList || []) {
                    child.updatingTargetList.push(key);
                    child.updatingTargetMap[key] = true;
                }

                child.activeTargetList.push(...(runtimeState.activeTargetList || []));
                child.activatedTargets.push(...(runtimeState.activatedTargets || []));

                child.noDomUpdatingTargets = runtimeState.noDomUpdatingTargets
                    ? new Set(runtimeState.noDomUpdatingTargets)
                    : undefined;

                child.pendingTargets = runtimeState.pendingTargets ?? false;
            }

            this.childActualValues[index] = child.actualValues;
            this.childTargetMaps[index] = child.allTargetMap;

            return child;
        });

        delete this.childHandleRuntimeStates;

        this.childGeneration = Number.isInteger(this.childGeneration) ? this.childGeneration : 0;
        this.particleValuesDirty = false;
        this.particleRenderRequested = false;
        this.pendingGpuChildren = {};

        this.layoutEpoch = 0;
        this.completeLayoutEpoch = -1;
        this.completeLayoutState = undefined;

        this.layoutCompleteWaiters = [];
        this.particleSyncPromise = undefined;

        this.restoringParticleRuntime = true;

        this.particleRuntime = new ParticleRuntime(this);
        this.particleRuntime.prepareRestore();

        this.particleRenderer = new ParticleRenderer(this);
    }

    waitForLayoutComplete() {
        if (this.completeLayoutEpoch === this.layoutEpoch) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.layoutCompleteWaiters.push(resolve);
        });
    }

    resolveLayoutCompleteWaiters() {
        const waiters = this.layoutCompleteWaiters.splice(0);

        for (const resolve of waiters) {
            resolve();
        }
    }
}

function isParticleTModel(targets) {
    if (!targets || !TUtil.webGpuAvailable) {
        return false;
    }

    for (const [key, target] of Object.entries(targets)) {
        if (TargetParser.isExplodeChildrenTarget(key)) {
            if (target?.renderer !== "dom") {
                return true;
            }

            continue;
        }

        if (!ParticleUtil.isChildrenTarget(key)) {
            continue;
        }

        if (!target || typeof target !== "object") {
            continue;
        }

        if (target.renderer === "gpu") {
            return true;
        }

        if (target.renderer === "dom") {
            continue;
        }

        if (TUtil.isDefined(target.instances)) {
            return true;
        }
    }

    return false;
}

function createParticleTModel(type, targets, oid, options = {}) {
    return new ParticleTModel(type, targets, oid, options);
}

TModelFactory.register(isParticleTModel, createParticleTModel);

export { ParticleTModel };