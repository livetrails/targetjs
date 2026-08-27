import { TModel } from "./TModel.js";
import { TModelFactory } from "./TModelFactory.js";
import { ParticleRenderer } from "./ParticleRenderer.js";
import { TargetParser } from "./TargetParser.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";
import { Child } from "./Child.js";

/**
 * It provides a TModel that can render instanced addChildren values on the GPU.
 */
class ParticleTModel extends TModel {
    static supportedChildTargets = new Set([
        "x",
        "y",
        "width",
        "height",
        "borderRadius",
        "backgroundColor",
        "rotate"
    ]);
    
    static childLayoutTargets = new Set([
        "x",
        "y",
        "width",
        "height"
    ]);

    static gpuChildrenTargets = new Set([
        "addChildren",
        "children"
    ]);
    
    static transientRuntimeFields = new Set([
        "particleRenderer",
        "childHandles",
        "particleValuesDirty",
        "particleRenderRequested",
        "pendingGpuChildren",

        "layoutEpoch",
        "completeLayoutEpoch",
        "completeChildrenLayoutState",
        "layoutCompleteWaiters",
        "particleSyncPromise",
        "restoringParticleRuntime"
    ]);

    static isGpuChildrenTarget(key) {
        return ParticleTModel.gpuChildrenTargets.has(TargetUtil.getTargetName(key));
    }

    constructor(type, targets, oid, options = {}) {
        super(type, targets, oid, options);

        this.particleValues = [];
        this.particleValuesDirty = false;
        this.particleRenderRequested = false;
                
        this.childHandles = [];
        this.childTargetValues = {};
        this.childTransitions = {};
        this.pendingGpuChildren = {};

        this.activeChildTransitionKey = undefined;
        this.gpuChildrenEnabled = false;

        this.layoutEpoch = 0;
        this.completeLayoutEpoch = -1;
        this.layoutCompleteWaiters = [];
        this.particleSyncPromise = undefined;
        this.restoringParticleRuntime = false;

        this.particleRenderer = new ParticleRenderer(this);
    } 

    async onDomReady() {
        if (this.restoringParticleRuntime) {
            return;
        }

        await this.syncParticleRenderer();
    }
    
    async restoreRuntimeDomDerivedState() {
        if (!this.gpuChildrenEnabled || !this.hasDom()) {
            this.restoringParticleRuntime = false;
            return false;
        }

        try {
            await this.waitForLayoutComplete();

            const restored = await this.syncParticleRenderer();

            if (!restored) {
                return false;
            }

            await this.particleRenderer.waitForPresentedFrame();

            return true;
        } finally {
            this.restoringParticleRuntime = false;
        }
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

        if (this.particleValues.length) {
            await this.particleRenderer.setParticles(this.particleValues);
        } else {
            await this.particleRenderer.init();
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

        await this.particleRenderer.setTargetParticles(transition.values, transition.steps);

        this.handleSpecialTargetStep(key);

        return true;
    }

    requestParticleRender() {
        if (
            this.restoringParticleRuntime ||
            !this.gpuChildrenEnabled ||
            !this.hasDom() ||
            this.particleRenderRequested
        ) {
            return;
        }

        this.particleRenderRequested = true;

        requestAnimationFrame(() => {
            this.particleRenderRequested = false;

            if (this.particleValuesDirty) {
                this.particleValuesDirty = false;
                this.particleRenderer.updateParticles(this.particleValues);
            } else {
                this.particleRenderer.render();
            }
        });
    }
    
    canRenderChildren(values) {
        values = Array.isArray(values) ? values : [values];

        return values.length > 0 && values.every(value => {
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return false;
            }

            return Object.entries(value).every(([key, propertyValue]) => {
                const cleanKey = TargetUtil.getTargetName(key);

                return key === cleanKey && this.supportsChildTarget(cleanKey) && this.canRenderChildValue(propertyValue);
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
    
    supportsChildTarget(key) {
        return ParticleTModel.supportedChildTargets.has(key);
    }
    
    affectsChildLayout(key) {
        return ParticleTModel.childLayoutTargets.has(TargetUtil.getTargetName(key));
    }

    getChild(index) {
        if (!this.gpuChildrenEnabled || typeof index !== "number") {
            return super.getChild(index);
        }

        return this.childHandles[index];
    }
    
    getChildren() {
        if (!this.gpuChildrenEnabled) {
            return super.getChildren();
        }

        return this.childHandles;
    }

    getChildValue(index, key) {
        return this.particleValues[index]?.[TargetUtil.getTargetName(key)];
    }

    setChildTarget(index, key, target) {
        const targetName = TargetUtil.getTargetName(TargetUtil.currentTargetName);
        const cleanKey = TargetUtil.getTargetName(key);

        if (!targetName) {
            return;
        }

        if (key !== cleanKey || !this.supportsChildTarget(cleanKey)) {
            throw new Error(`GPU child target "${key}" is not supported yet.`);
        }

        const targetValues = this.childTargetValues[targetName] ??= [];
        const childValues = targetValues[index] ??= {};

        childValues[cleanKey] = TargetParser.isTargetSpecObject(target) ? { ...target } : { value: target };
    }

    setChildValue(index, key, value) {
        const cleanKey = TargetUtil.getTargetName(key);
        const childValues = this.particleValues[index];

        if (!childValues || childValues[cleanKey] === value) {
            return;
        }

        childValues[cleanKey] = value;
        this.particleValuesDirty = true;

        if (this.affectsChildLayout(cleanKey)) {
            this.invalidateChildrenLayout();
        }
    
        const child = this.childHandles[index];

        if (child) {
            child.actualValues[cleanKey] = value;
        }
    }

    setChildLayoutValue(index, key, value) {
        const childValues = this.particleValues[index];

        if (!childValues) {
            return;
        }

        const scrollOffset = key === "x" ? this.getScrollLeft() ?? 0 : key === "y" ? this.getScrollTop() ?? 0 : 0;
        const layoutValue = value + scrollOffset;

        if (childValues[key] === layoutValue) {
            return;
        }

        childValues[key] = layoutValue;
        this.particleValuesDirty = true;
    }

    getChildTargetValues(key) {
        return this.childTargetValues[TargetUtil.getTargetName(key)];
    }

    handleChildTargets(key, targetValues, options = {}) {
        const targetName = TargetUtil.getTargetName(key);

        const values = new Array(this.particleValues.length);
        const steps = new Array(this.particleValues.length);

        const defaultSteps = Math.max(0, Number(options.steps) || 0);

        let maxSteps = defaultSteps;

        for (let index = 0; index < this.particleValues.length; index++) {
            const particle = this.particleValues[index];
            const targets = targetValues[index];

            const nextParticle = { ...particle };
            const childSteps = {};

            if (targets) {
                for (const [property, rawTarget] of Object.entries(targets)) {
                    const target = TargetParser.isTargetSpecObject(rawTarget) ? rawTarget : { value: rawTarget };

                    nextParticle[property] = target.value;

                    const propertySteps = target.steps !== undefined ? Math.max(0, Number(target.steps) || 0) : defaultSteps;

                    childSteps[property] = propertySteps;
                    maxSteps = Math.max(maxSteps, propertySteps);
                }
            }

            values[index] = nextParticle;
            steps[index] = childSteps;
        }

        this.childTransitions[targetName] = {
            values,
            steps
        };

        this.activeChildTransitionKey = key;

        if (this.hasDom()) {
            this.particleRenderer.setTargetParticles(values, steps).then(() => {
                if (this.childTransitions[targetName]?.values === values) {
                    this.handleSpecialTargetStep(key);
                }
            });
        }

        return {
            handled: true,
            steps: maxSteps
        };
    }

    handleSpecialTarget(key, value, options = {}) {
        if (!this.gpuChildrenEnabled) {
            return false;
        }

        const targetValues = this.getChildTargetValues(key);

        if (targetValues) {
            return this.handleChildTargets(key, targetValues, options);
        }

        return false;
    }
    
    getRenderScrollLeft() {
        return this.getScrollLeft() || this.getParent().$dom?.getScrollLeft() || 0;
    }
    
    
    getRenderScrollTop() {
        return this.getScrollTop() || this.getParent().$dom?.getScrollTop() || 0;
    }
    
    addChild(child, index = this.addedChildren.length + this.allChildrenList.length) {
        if (
            child &&
            typeof child === "object" &&
            !(child instanceof TModel) &&
            ParticleTModel.isGpuChildrenTarget(TargetUtil.currentTargetName)
        ) {
            const childDefinition = TUtil.cloneTargetDefinition(child);

            if (this.canRenderChildren(childDefinition)) {
                this.addGpuChild(childDefinition);

                return this;
            }
        }

        return super.addChild(child, index);
    }
    
    addGpuChild(definition) {
        const child = this.createGpuChild(definition);

        if (!child) {
            return false;
        }

        const key = TargetUtil.currentTargetName;
        const targetName = TargetUtil.getTargetName(key);
        const index = this.particleValues.length;

        this.gpuChildrenEnabled = true;

        this.particleValues.push(child.initial);

        const handle = new Child(this, index);
        this.childHandles[index] = handle;

        const pending = this.pendingGpuChildren[targetName] ??= {
            key,
            children: []
        };

        pending.children.push({
            index,
            ...child
        });

        this.childrenUpdateFlag = true;
        this.markLayoutDirty("addGpuChild");

        return true;
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

    finalizeChildrenTarget(key, options = {}) {
        if (!ParticleTModel.isGpuChildrenTarget(key)) {
            return false;
        }

        const targetName = TargetUtil.getTargetName(key);
        const pending = this.pendingGpuChildren[targetName];

        if (!pending?.children.length) {
            return false;
        }

        this.invalidateChildrenLayout();

        const defaultSteps = Math.max(0, Number(options.steps) || 0);
        const currentValues = this.particleValues;
        const segmentCount = this.getChildrenSegmentCount(pending.children);

        const segment = this.buildChildTransitionSegment(
            pending.children,
            0,
            currentValues,
            defaultSteps
        );

        delete this.pendingGpuChildren[targetName];

        if (!segment.hasSegment || segment.maxSteps === 0) {
            this.particleValues = segment.values;

            if (this.hasDom()) {
                this.particleRenderer.setParticles(segment.values);
            }

            return {
                handled: true,
                steps: 0
            };
        }

        this.childTransitions[targetName] = {
            children: pending.children,
            segmentIndex: 0,
            segmentCount,
            defaultSteps,

            values: segment.values,
            steps: segment.steps,
            loops: segment.loops,
            hasLoop: segment.hasLoop
        };

        this.activeChildTransitionKey = key;

        return {
            handled: true,
            steps: segment.maxSteps
        };
    }
    
    advanceChildTransitionSegment(key, transition) {
        if (!transition || !Array.isArray(transition.children) || !Number.isInteger(transition.segmentIndex) ||
            !Number.isInteger(transition.segmentCount)) 
        {
            return false;
        }

        const nextSegmentIndex = transition.segmentIndex + 1;

        if (nextSegmentIndex >= transition.segmentCount) {
            return false;
        }

        this.particleValues = transition.values;
        this.particleRenderer.completeTransition();

        const segment = this.buildChildTransitionSegment(
            transition.children,
            nextSegmentIndex,
            this.particleValues,
            transition.defaultSteps
        );

        transition.segmentIndex = nextSegmentIndex;
        transition.values = segment.values;
        transition.steps = segment.steps;
        transition.loops = segment.loops;

        const targetValue = this.targetValues[key];

        if (targetValue) {
            targetValue.steps = segment.maxSteps;
        }

        this.resetTargetStep(key);
        this.resetTargetInitialValue(key);
        this.setTargetStatus(key, "updating");

        if (this.hasDom()) {
            this.particleRenderer.setTargetParticles(segment.values, segment.steps).then(() => {
                if (this.childTransitions[TargetUtil.getTargetName(key)] === transition) {
                    this.handleSpecialTargetStep(key);
                }
            });
        }

        return true;
    }
    
    buildChildTransitionSegment(children, segmentIndex, currentValues, defaultSteps) {
        const values = currentValues.map(value => ({ ...value }));
        const steps = Array.from({ length: currentValues.length }, () => ({}));
        const loops = Array.from({ length: currentValues.length }, () => ({}));

        let maxSteps = 0;
        let hasSegment = false;
        let hasLoop = false;

        for (const child of children) {
            const current = currentValues[child.index];
            const target = { ...current };

            for (const property of Object.keys(child.target)) {
                const valueList = child.valueLists[property];

                if (valueList) {
                    if (segmentIndex >= valueList.length - 1) {
                        continue;
                    }

                    target[property] = valueList[segmentIndex + 1];

                    const propertySteps = this.getChildPropertySteps(child, property, segmentIndex, defaultSteps);

                    steps[child.index][property] = propertySteps;
                    loops[child.index][property] = child.loops[property] === true;

                    maxSteps = Math.max(maxSteps, propertySteps);
                    hasSegment = true;

                    if (child.loops[property]) {
                        hasLoop = true;
                    }

                    continue;
                }

                // A non-list transition only belongs to the first segment.
                if (segmentIndex !== 0 || current[property] === child.target[property]) {
                    continue;
                }

                target[property] = child.target[property];

                const propertySteps = this.getChildPropertySteps(child, property, segmentIndex, defaultSteps);

                steps[child.index][property] = propertySteps;
                loops[child.index][property] = child.loops[property] === true;

                maxSteps = Math.max(maxSteps, propertySteps);
                hasSegment = true;

                if (child.loops[property]) {
                    hasLoop = true;
                }
            }

            values[child.index] = target;
        }

        return {
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

        if (!this.childTransitions[targetName]) {
            return false;
        }

        this.particleRenderer.setTransitionStep(this.getTargetStep(key));

        return true;
    }

    handleSpecialTargetEnd(key) {
        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition) {
            return false;
        }

        if (this.advanceChildTransitionSegment(key, transition)) {
            return true;
        }

        if (transition.hasLoop) {
            this.restartChildTransition(key, transition);
            return true;
        }

        this.particleValues = transition.values;
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

        this.handleSpecialTargetStep(key);

        return true;
    }
    
    shouldCalculateChildren() {
        if (!this.gpuChildrenEnabled) {
            return super.shouldCalculateChildren();
        }

        if (
            this.completeLayoutEpoch === this.layoutEpoch &&
            !this.hasChildrenLayoutStateChanged()
        ) {
            this.currentStatus = undefined;
            this.requestParticleRender();

            return false;
        }

        return super.shouldCalculateChildren();
    }
    
    getChildrenLayoutState() {
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
        this.completeChildrenLayoutState = this.getChildrenLayoutState();

        this.resolveLayoutCompleteWaiters();

        const key = this.activeChildTransitionKey;

        if (!key) {
            return;
        }

        const targetName = TargetUtil.getTargetName(key);
        const transition = this.childTransitions[targetName];

        if (!transition) {
            return;
        }

        transition.values = transition.values.map((target, index) => ({
            ...this.particleValues[index],
            ...target
        }));

        if (this.restoringParticleRuntime || !this.hasDom()) {
            return;
        }

        this.particleRenderer.setParticles(this.particleValues).then(() => {
            return this.particleRenderer.setTargetParticles(transition.values, transition.steps);
        }).then(() => {
            if (this.childTransitions[targetName] === transition) {
                this.handleSpecialTargetStep(key);
            }
        });
    }
    
    hasChildrenLayoutStateChanged() {
        const current = this.getChildrenLayoutState();
        const previous = this.completeChildrenLayoutState;

        if (!previous || current.length !== previous.length) {
            return true;
        }

        return current.some((value, index) => value !== previous[index]);
    }

    invalidateChildrenLayout() {
        this.layoutEpoch++;
    }
    
    getParticleCount() {
        return this.particleValues.length;
    }
    
    excludeRuntimeSnapshotField(key) {
        return ParticleTModel.transientRuntimeFields.has(key);
    }

    restoreRuntimeDerivedState() {
        this.childHandles = this.particleValues.map((value, index) => {
            return new Child(this, index);
        });

        this.particleValuesDirty = false;
        this.particleRenderRequested = false;
        this.pendingGpuChildren = {};

        this.layoutEpoch = 0;
        this.completeLayoutEpoch = 0;
        this.completeChildrenLayoutState = this.getChildrenLayoutState();

        this.layoutCompleteWaiters = [];
        this.particleSyncPromise = undefined;

        this.restoringParticleRuntime = true;

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
    if (!targets) {
        return false;
    }

    for (const [key, target] of Object.entries(targets)) {
        if (!ParticleTModel.isGpuChildrenTarget(key)) {
            continue;
        }

        if (target && typeof target === "object" && TUtil.isDefined(target.instances)) {
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