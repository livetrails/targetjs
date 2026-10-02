import { TargetParser } from "./TargetParser.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";

class ParticleUtil {
    static gpuRenderTargets = new Set(["x", "y", "width", "height", "borderRadius", "backgroundColor", "rotate", "opacity", "scale"]);
    
    static gpuRenderAliases = {
        background: "backgroundColor"
    };

    static childrenTargets = new Set(["addChildren", "children"]);

    static transientRuntimeFields = new Set([
        "particleRenderer", "childHandles", "particleValuesDirty", "particleRenderRequested", "pendingGpuChildren",
        "layoutEpoch", "completeLayoutEpoch", "completeChildrenLayoutState", "layoutCompleteWaiters", 
        "particleSyncPromise", "restoringParticleRuntime"
    ]);
    
    static affectsChildLayout(key) {
        return ["x", "y", "width", "height"].includes(ParticleUtil.getTargetName(key));
    }
    
    static affectsChildFlowLayout(key) {
        return ["width", "height"].includes(ParticleUtil.getTargetName(key));
    }

    static isChildrenTarget(key) {
        return ParticleUtil.childrenTargets.has(TargetUtil.getTargetName(key));
    }

    static getTargetName(key) {
        const cleanKey = TargetUtil.getTargetName(key);

        return ParticleUtil.gpuRenderAliases[cleanKey] || cleanKey;
    }

    static isGpuTarget(key) {
        return ParticleUtil.gpuRenderTargets.has(ParticleUtil.getTargetName(key));
    }

    static getTargetMode(key) {
        if (key.endsWith("$$")) {
            return "deferred";
        }

        if (key.endsWith("$")) {
            return "reactive";
        }

        return "immediate";
    }


    static isTransientRuntimeField(key) {
        return ParticleUtil.transientRuntimeFields.has(key);
    }

    static isFunctionBasedTarget(target) {
        if (typeof target === "function") {
            return true;
        }

        return TargetParser.isTargetSpecObject(target) && typeof target.value === "function";
    }

    static resolveValue(target, child) {
        if (typeof target === "function") {
            return ParticleUtil.resolveValue(target.call(child), child);
        }

        if (!TargetParser.isTargetSpecObject(target)) {
            return target;
        }

        const resolved = { ...target };

        if (typeof resolved.value === "function") {
            resolved.value = ParticleUtil.resolveValue(resolved.value.call(child), child);
        }

        return resolved;
    }

    static getInitialValue(value) {
        if (TargetParser.isValueStepsCycleArray(value)) {
            return value[0];
        }

        if (!TargetParser.isTargetSpecObject(value)) {
            return value;
        }

        if (Array.isArray(value.value)) {
            return value.value[0];
        }

        return value.value;
    }
    
    static setInitialValue(child, key, value) {
        if (!child || !TUtil.isDefined(value)) {
            return;
        }

        child.val(key, value);
    }

    static requiresRuntime(key, target) {
        const mode = ParticleUtil.getTargetMode(key);

        if (!ParticleUtil.isGpuTarget(key) || TargetParser.isIntervalTarget(target)) {
            return true;
        }

        if (mode !== "immediate") {
            return true;
        }

        if (TargetParser.isValueStepsCycleArray(target)) {
            return true;
        }

        if (!TargetParser.isTargetSpecObject(target)) {
            return false;
        }

        return typeof target.value === "function" ||
            typeof target.steps === "function" ||
            TUtil.isDefined(target.interval) ||
            TUtil.isDefined(target.easing) ||
            TUtil.isDefined(target.cycles) ||
            TUtil.isDefined(target.loop) ||
            TUtil.isDefined(target.pauseOn);
    }
    
    static compileChildDefinition(child, definition) {
        const renderDefinition = {};
        const runtimeTargets = [];

        const entries = Object.entries(definition).map(([key, target]) => {
            return {
                key,
                target,
                mode: ParticleUtil.getTargetMode(key),
                targetName: ParticleUtil.getTargetName(key),
                requiresRuntime: ParticleUtil.requiresRuntime(key, target)
            };
        });

        for (const entry of entries) {
            const cleanKey = TargetUtil.getTargetName(entry.key);
            child.allTargetMap[cleanKey] = entry.key;
        }

        for (const entry of entries) {
            if (entry.mode !== "immediate" || ParticleUtil.isFunctionBasedTarget(entry.target)) {
                continue;
            }

            const resolved = ParticleUtil.resolveValue(entry.target, child);
            const initialValue = ParticleUtil.getInitialValue(resolved);

            ParticleUtil.setInitialValue(child, entry.targetName, initialValue);

            if (ParticleUtil.isGpuTarget(entry.key) && !entry.requiresRuntime) {
                renderDefinition[entry.targetName] = resolved;
            }
        }

        for (const entry of entries) {
            if (entry.mode !== "immediate" || !ParticleUtil.isGpuTarget(entry.key) || !ParticleUtil.isFunctionBasedTarget(entry.target)) {
                continue;
            }

            const resolved = ParticleUtil.resolveValue(entry.target, child);

            entry.requiresRuntime = ParticleUtil.requiresRuntime(entry.key, resolved);

            if (entry.requiresRuntime) {
                const initialValue = ParticleUtil.getInitialValue(resolved);

                if (TUtil.isDefined(initialValue)) {
                    renderDefinition[entry.targetName] = initialValue;
                    ParticleUtil.setInitialValue(child, entry.targetName, initialValue);
                }

                continue;
            }

            renderDefinition[entry.targetName] = resolved;
            ParticleUtil.setInitialValue(child, entry.targetName, ParticleUtil.getInitialValue(resolved));

            const resolvedValue = TargetParser.isTargetSpecObject(resolved) ? resolved.value : resolved;

            if (ParticleUtil.affectsChildLayout(entry.targetName) && !Array.isArray(resolvedValue)) {
                runtimeTargets.push({
                    key: entry.key,
                    targetName: entry.targetName,
                    mode: entry.mode,
                    target: TargetParser.isTargetSpecObject(entry.target) ? { ...entry.target } : { value: entry.target },
                    requiresRuntime: false,
                    requiresInitialResolution: false,
                    renderable: true
                });
            }
        }

        for (const entry of entries) {
            if (!entry.requiresRuntime) {
                continue;
            }

            const requiresInitialResolution = entry.mode === "immediate" && ParticleUtil.isGpuTarget(entry.key) && ParticleUtil.isFunctionBasedTarget(entry.target);

            const runtimeTarget = {
                key: entry.key,
                targetName: entry.targetName,
                mode: entry.mode,
                target: TargetParser.isTargetSpecObject(entry.target) ? { ...entry.target } : { value: entry.target },
                requiresRuntime: true,
                requiresInitialResolution,
                renderable: ParticleUtil.isGpuTarget(entry.key)
            };

            runtimeTargets.push(runtimeTarget);

            if (ParticleUtil.isGpuTarget(entry.key) && entry.mode === "immediate" && !ParticleUtil.isFunctionBasedTarget(entry.target)) {
                const resolved = ParticleUtil.resolveValue(entry.target, child);
                const initialValue = ParticleUtil.getInitialValue(resolved);

                renderDefinition[entry.targetName] = initialValue;
                ParticleUtil.setInitialValue(child, entry.targetName, initialValue);
            }
        }

        return {
            renderDefinition,
            runtimeTargets
        };
    }
}

export { ParticleUtil };