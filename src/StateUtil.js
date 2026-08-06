import { TUtil } from "./TUtil.js";

const TMODEL_REF_KEY = "__targetjsTModelRef";

/*
 * These fields are reconstructed separately or must be connected to the
 * current DOM rather than copied from the old tree.
 */
const EXCLUDED_RUNTIME_FIELDS = new Set([
    "_state",
    "targets",
    "targetDefinitions",
    "restoringRuntime",
    "restoredUsesExistingDom",
    
    "type",
    "oid",
    "oidNum",
    "originalId",

    "parent",
    "allChildrenList",
    "allChildrenMap",

    "$dom",
    "viewport",

    "visibilityStatus",
    "currentStatus",
    "dirtyLayout",
    "originWindowEpoch",
    "hasDomNow",
    "isNowVisible",

    "domHeightTimestamp",
    "domWidthTimestamp",

    "lastBatch",
    "waapiBatch",
    "finalKeyframe",
    "finalRawFrame"
]);

const CHILD_OPERATION_FIELDS = [
    "addedChildren",
    "deletedChildren",
    "movedChildren"
];

   
const RUNTIME_TIMESTAMP_FIELDS = new Set([
        "lastUpdate",
        "scheduleTimeStamp",
        "completeTime",
        "creationTime",
        "activationTime",
        "catchupAt",
        "startTime",
        "lastResizeHandledTime"
    ]);
    
const TARGET_RUNTIME_FIELDS = [
    "originalTargetName",
    "originalTModel",
    "invokerTargetName",
    "invokerTModel",
    "fetchAction",
    "childAction",
    "addChildAction"
];

/**
 * Creates and restores in-memory TargetJS runtime snapshots.
 *
 * The snapshot is not JSON serialization. Functions and non-plain class
 * instances remain shared references.
 */
class StateUtil {

    static rebaseRuntimeTimes(value, offset, seen = new WeakSet()) {
        if (!value || typeof value !== "object" || offset === 0 || StateUtil.isTModel(value) || seen.has(value)) {
            return;
        }

        seen.add(value);

        if (value instanceof Map) {
            for (const mapValue of value.values()) {
                StateUtil.rebaseRuntimeTimes(mapValue, offset, seen);
            }

            return;
        }

        if (value instanceof Set) {
            for (const item of value) {
                StateUtil.rebaseRuntimeTimes(item, offset, seen);
            }

            return;
        }

        for (const key of Object.keys(value)) {
            const propertyValue = value[key];

            if (RUNTIME_TIMESTAMP_FIELDS.has(key) && Number.isFinite(propertyValue) && propertyValue > 0) {
                value[key] = propertyValue + offset;
                continue;
            }

            StateUtil.rebaseRuntimeTimes(propertyValue, offset, seen);
        }
    }

    static isPlainObject(value) {
        if (!value || typeof value !== "object") {
            return false;
        }

        const prototype = Object.getPrototypeOf(value);

        return (prototype === Object.prototype || prototype === null);
    }
    
    static cloneUnboundTargets(targets) {
        const cloned = TUtil.cloneTargetDefinition(targets);

        for (const target of Object.values(cloned)) {
            if (!StateUtil.isPlainObject(target)) {
                continue;
            }

            for (const key of Object.keys(target)) {
                const value = target[key];

                if (typeof value === "function" && value.__isBoundTargetMethod) {
                    target[key] = value.__targetjsSource || value;
                }
            }
        }

        return cloned;
    }

    static isTModel(value) {
        return Boolean(
            value &&
            typeof value === "object" &&
            typeof value.oid === "string" &&
            value.targets &&
            typeof value.state === "function" &&
            typeof value.getChildren === "function"
        );
    }

    static isTModelReference(value) {
        return Boolean(StateUtil.isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, TMODEL_REF_KEY));
    }

    static createTModelReference(tmodel) {
        return { [TMODEL_REF_KEY]: tmodel.oid };
    }

    static encodeValue(value, seen = new WeakMap()) {
        if (value === null || value === undefined || typeof value !== "object") {
            return value;
        }

        if (StateUtil.isTModel(value)) {
            return StateUtil.createTModelReference(value);
        }

        if (seen.has(value)) {
            return seen.get(value);
        }

        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        if (value instanceof Map) {
            const copy = new Map();
            seen.set(value, copy);

            for (const [key, mapValue] of value) {
                copy.set(StateUtil.encodeValue(key, seen), StateUtil.encodeValue(mapValue, seen));
            }

            return copy;
        }

        if (value instanceof Set) {
            const copy = new Set();

            seen.set(value, copy);

            for (const item of value) {
                copy.add(StateUtil.encodeValue(item, seen));
            }

            return copy;
        }

        if (Array.isArray(value)) {
            const copy = [];

            seen.set(value, copy);

            for (const item of value) {
                copy.push(StateUtil.encodeValue(item, seen));
            }

            return copy;
        }

        if (!StateUtil.isPlainObject(value)) {
            return value;
        }

        const copy = {};

        seen.set(value, copy);

        for (const [key, propertyValue] of Object.entries(value)) {
            copy[key] = StateUtil.encodeValue(
                propertyValue,
                seen
            );
        }

        return copy;
    }

    static decodeValue(value, tmodelIdMap, seen = new WeakMap()) {
        if (value === null || value === undefined || typeof value !== "object") {
            return value;
        }

        if (StateUtil.isTModelReference(value)) {
            return tmodelIdMap[value[TMODEL_REF_KEY]];
        }

        if (seen.has(value)) {
            return seen.get(value);
        }

        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        if (value instanceof Map) {
            const copy = new Map();

            seen.set(value, copy);

            for (const [key, mapValue] of value) {
                copy.set(StateUtil.decodeValue(key, tmodelIdMap, seen), StateUtil.decodeValue(mapValue, tmodelIdMap, seen));
            }

            return copy;
        }

        if (value instanceof Set) {
            const copy = new Set();

            seen.set(value, copy);

            for (const item of value) {
                copy.add(StateUtil.decodeValue(item, tmodelIdMap, seen));
            }

            return copy;
        }

        if (Array.isArray(value)) {
            const copy = [];

            seen.set(value, copy);

            for (const item of value) {
                copy.push(StateUtil.decodeValue(item, tmodelIdMap, seen));
            }

            return copy;
        }

        if (!StateUtil.isPlainObject(value)) {
            return value;
        }

        const copy = {};

        seen.set(value, copy);

        for (const [key, propertyValue] of Object.entries(value)) {
            copy[key] = StateUtil.decodeValue(propertyValue, tmodelIdMap, seen);
        }

        return copy;
    }

    static resolveTModelReferencesInPlace(value, tmodelIdMap, seen = new WeakSet()) {
        if (value === null || value === undefined || typeof value !== "object") {
            return value;
        }

        if (StateUtil.isTModelReference(value)) {
            return tmodelIdMap[value[TMODEL_REF_KEY]];
        }

        if (seen.has(value)) {
            return value;
        }

        seen.add(value);

        if (value instanceof Date) {
            return value;
        }

        if (value instanceof Map) {
            const entries = [...value.entries()];

            value.clear();

            for (const [key, mapValue] of entries) {
                value.set(StateUtil.resolveTModelReferencesInPlace(key, tmodelIdMap, seen), StateUtil.resolveTModelReferencesInPlace(mapValue, tmodelIdMap, seen));
            }

            return value;
        }

        if (value instanceof Set) {
            const entries = [...value];

            value.clear();

            for (const item of entries) {
                value.add(StateUtil.resolveTModelReferencesInPlace(item, tmodelIdMap, seen));
            }

            return value;
        }

        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
                value[index] = StateUtil.resolveTModelReferencesInPlace(value[index], tmodelIdMap, seen);
            }

            return value;
        }

        if (!StateUtil.isPlainObject(value)) {
            return value;
        }

        for (const key of Object.keys(value)) {
            value[key] = StateUtil.resolveTModelReferencesInPlace(value[key], tmodelIdMap, seen);
        }

        return value;
    }

    static clearMaterializedChildOperations(state) {
        if (!state) {
            return;
        }

        for (const key of CHILD_OPERATION_FIELDS) {
            if (Array.isArray(state[key])) {
                state[key].length = 0;
            } else {
                state[key] = [];
            }
        }

        if (!state.lastChildrenUpdate) {
            state.lastChildrenUpdate = { additions: [], deletions: [] };

            return;
        }

        state.lastChildrenUpdate.additions = [];
        state.lastChildrenUpdate.deletions = [];
    }

    static exportRuntimeState(tmodel) {
        const fields = {};

        for (const key of Object.keys(tmodel)) {
            if (EXCLUDED_RUNTIME_FIELDS.has(key)) {
                continue;
            }

            fields[key] = tmodel[key];
        }

        const runtime = StateUtil.encodeValue({ state: tmodel.state(), fields });

        StateUtil.clearMaterializedChildOperations(runtime.state);

        return runtime;
    }

    static importRuntimeState(tmodel, runtime, tmodelIdMap, { timeOffset = 0 } = {}) {
        const restored = StateUtil.decodeValue(
            runtime,
            tmodelIdMap
        );

        StateUtil.rebaseRuntimeTimes(restored, timeOffset);

        tmodel._state = restored.state || {};

        for (const [key, value] of Object.entries(
            restored.fields || {}
        )) {
            if (EXCLUDED_RUNTIME_FIELDS.has(key)) {
                continue;
            }

            tmodel[key] = value;
        }

        StateUtil.clearMaterializedChildOperations(tmodel._state);

        /*
         * The child tree has already been reconstructed directly.
         */
        tmodel.childrenUpdateFlag = false;

        /*
         * DOM and Web Animation objects belong to the old runtime.
         */
        tmodel.$dom = null;
        tmodel.viewport = undefined;
        tmodel.hasDomNow = false;

        tmodel.lastBatch = undefined;
        tmodel.waapiBatch = undefined;
        tmodel.finalKeyframe = undefined;
        tmodel.finalRawFrame = undefined;

        return tmodel;
    }

    static createRuntimeSnapshot(tmodel) {
        const children = [...tmodel.getChildren()];
        const targetDefinitions = TUtil.cloneTargetDefinition(tmodel.targetDefinitions);

        return {
            oid: tmodel.oid,
            oidNum: tmodel.oidNum ?? 0,
            originalId: tmodel.originalId,
            type: tmodel.type,
            usesExistingDom: tmodel.targets?.domIsland === true || tmodel.targets?.reuseDomDefinition === true || tmodel.originalTargetNames?.includes('$dom'),
            targets: StateUtil.encodeValue(targetDefinitions),
            targetRuntime: StateUtil.exportTargetRuntime(tmodel),
            runtime: StateUtil.exportRuntimeState(tmodel),
            children: children.map(child => StateUtil.createRuntimeSnapshot(child))
        };
    }

    static createWithIdentity(snapshot, TModelClass) {
        if (typeof TModelClass !== "function") {
            throw new TypeError("A TModel constructor is required.");
        }

        const targets = StateUtil.encodeValue(snapshot.targets);

        const tmodel = new TModelClass(snapshot.type, targets, snapshot.oid, {
            restoringRuntime: true,
            usesExistingDom: snapshot.usesExistingDom === true
        });
        
        tmodel.type = snapshot.type;
        tmodel.oid = snapshot.oid;
        tmodel.oidNum = snapshot.oidNum ?? 0;

        if (snapshot.originalId !== undefined) {
            tmodel.originalId = snapshot.originalId;
        } else {
            delete tmodel.originalId;
        }

        /*
         * Tree relationships are restored without using addChild().
         */
        tmodel.parent = undefined;
        tmodel.allChildrenList = [];
        tmodel.allChildrenMap = {};

        return tmodel;
    }

    static attachRestoredChild(parent, child) {
        child.parent = parent;

        parent.allChildrenList.push(child);
        parent.allChildrenMap[child.oid] = child;

        return child;
    }

    static fromRuntimeSnapshot(snapshot, TModelClass, options = {}) {
        if (!snapshot) {
            throw new TypeError(
                "A runtime snapshot is required."
            );
        }

        const tmodelIdMap = {};
        const models = [];
        const imports = [];

        const buildTree = (modelSnapshot, parent) => {
            const tmodel = StateUtil.createWithIdentity(
                modelSnapshot,
                TModelClass
            );

            tmodelIdMap[tmodel.oid] = tmodel;
            models.push(tmodel);

            if (parent) {
                StateUtil.attachRestoredChild(
                    parent,
                    tmodel
                );
            }

            imports.push({
                tmodel,
                runtime: modelSnapshot.runtime,
                targetRuntime: modelSnapshot.targetRuntime
            });

            for (const childSnapshot of modelSnapshot.children || []) {
                buildTree(childSnapshot, tmodel);
            }

            return tmodel;
        };

        const root = buildTree(snapshot, undefined);

        for (const tmodel of models) {
            StateUtil.resolveTModelReferencesInPlace(tmodel.targets, tmodelIdMap);
        }
        
        for (const { tmodel, targetRuntime } of imports) {
            StateUtil.applyTargetRuntime(tmodel, targetRuntime, tmodelIdMap);
        }
        
        for (const { tmodel, runtime } of imports) {
            StateUtil.importRuntimeState(tmodel, runtime, tmodelIdMap, options);
        }

        return { root, tmodelIdMap, models };        
    }
    
    static exportTargetRuntime(tmodel) {
        const result = {};

        for (const [targetName, target] of Object.entries(tmodel.targets)) {
            if (!StateUtil.isPlainObject(target)) {
                continue;
            }

            const runtime = {};

            for (const field of TARGET_RUNTIME_FIELDS) {
                if (Object.prototype.hasOwnProperty.call(target, field)) {
                    runtime[field] = target[field];
                }
            }

            if (Object.keys(runtime).length) {
                result[targetName] = StateUtil.encodeValue(runtime);
            }
        }

        return result;
    }
    
    static applyTargetRuntime(tmodel, encodedTargetRuntime, tmodelIdMap) {
        for (const [targetName, encodedRuntime] of Object.entries(encodedTargetRuntime || {})) {
            const target = tmodel.targets[targetName];

            if (!target) {
                continue;
            }

            const runtime = StateUtil.decodeValue(encodedRuntime, tmodelIdMap);
            Object.assign(target, runtime);
        }
    }
}

export { StateUtil };