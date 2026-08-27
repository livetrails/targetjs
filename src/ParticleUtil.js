import { TargetData } from "./TargetData.js";
import { TargetParser } from "./TargetParser.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";

class ParticleUtil {
    static gpuRenderTargets = new Set([
        "x",
        "y",
        "width",
        "height",
        "borderRadius",
        "backgroundColor",
        "rotate"
    ]);

    static gpuRenderAliases = {
        background: "backgroundColor"
    };

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
        return ParticleUtil.gpuChildrenTargets.has(TargetUtil.getTargetName(key));
    }

    static getGpuRenderTargetName(key) {
        const cleanKey = TargetUtil.getTargetName(key);

        return ParticleUtil.gpuRenderAliases[cleanKey] || cleanKey;
    }

    static isGpuRenderTarget(key) {
        return ParticleUtil.gpuRenderTargets.has(
            ParticleUtil.getGpuRenderTargetName(key)
        );
    }

    static isIgnoredGpuStyleTarget(key) {
        const cleanKey = TargetUtil.getTargetName(key);

        return TargetData.styleSet.has(cleanKey) && !ParticleUtil.isGpuRenderTarget(cleanKey);
    }

    static affectsChildLayout(key) {
        return ParticleUtil.childLayoutTargets.has(
            ParticleUtil.getGpuRenderTargetName(key)
        );
    }

    static getGpuTargetMode(key) {
        if (key.endsWith("$$")) {
            return "deferred";
        }

        if (key.endsWith("$")) {
            return "reactive";
        }

        return "immediate";
    }

    static classifyGpuChildTarget(key, value) {
        /*
         * Interval is a property of the target definition, not the target name.
         * Check it before render/style classification.
         */
        if (TargetParser.isIntervalTarget(value)) {
            return "interval";
        }

        if (ParticleUtil.isGpuRenderTarget(key)) {
            return "render";
        }

        if (ParticleUtil.isIgnoredGpuStyleTarget(key)) {
            return "ignoredStyle";
        }

        return "runtime";
    }

    static isTransientRuntimeField(key) {
        return ParticleUtil.transientRuntimeFields.has(key);
    }
    
    static isFunctionBasedGpuValue(value) {
        if (typeof value === "function") {
            return true;
        }

        return TargetParser.isTargetSpecObject(value) && typeof value.value === "function";
    }

    static resolveGpuRenderValue(value, child) {
        if (typeof value === "function") {
            return value.call(child);
        }

        if (!TargetParser.isTargetSpecObject(value)) {
            return value;
        }

        const resolved = { ...value };

        if (typeof resolved.value === "function") {
            resolved.value = resolved.value.call(child);
        }

        return resolved;
    }

    static getGpuInitialRenderValue(value) {
        if (!TargetParser.isTargetSpecObject(value)) {
            return value;
        }

        if (Array.isArray(value.value)) {
            return value.value[0];
        }

        return value.value;
    }

    static setGpuInitialChildValue(child, key, value) {
        if (!child || !TUtil.isDefined(value)) {
            return;
        }

        child.val(key, value);
    }
    
    static createGpuRuntimeTarget(key, value) {
        return {
            key,
            targetName: ParticleUtil.getGpuRenderTargetName(key),
            kind: ParticleUtil.classifyGpuChildTarget(key, value),
            mode: ParticleUtil.getGpuTargetMode(key),
            target: TargetParser.isTargetSpecObject(value) ? { ...value } : { value }
        };
    }

    static requiresGpuChildRuntime(key, value) {
        const mode = ParticleUtil.getGpuTargetMode(key);
        const kind = ParticleUtil.classifyGpuChildTarget(key, value);

        if (kind === "interval" || kind === "runtime") {
            return true;
        }

        if (mode !== "immediate") {
            return true;
        }

        if (!ParticleUtil.isGpuRenderTarget(key)) {
            return false;
        }

        /*
         * A plain render function such as x() or backgroundColor() can simply
         * be resolved immediately. It does not require an animation runtime.
         */
        if (typeof value === "function") {
            return false;
        }

        if (!TargetParser.isTargetSpecObject(value)) {
            return false;
        }

        /*
         * Simple GPU transitions such as:
         *
         * x: {
         *     value: [0, 500],
         *     steps: 100
         * }
         *
         * can continue using the existing bulk GPU transition path.
         *
         * Targets with their own execution timing or function-valued value
         * require the lightweight child runtime.
         */
        return typeof value.value === "function" ||
            TUtil.isDefined(value.interval) ||
            TUtil.isDefined(value.easing) ||
            TUtil.isDefined(value.cycles) ||
            TUtil.isDefined(value.loop);
    }
    
    static compileGpuChildDefinition(child, definition) {
        const renderDefinition = {};
        const runtimeTargets = [];
        const ignoredStyles = [];
        const layoutFunctions = [];

        const entries = Object.entries(definition).map(([key, value]) => {
            return {
                key,
                value,
                kind: ParticleUtil.classifyGpuChildTarget(key, value),
                mode: ParticleUtil.getGpuTargetMode(key),
                targetName: ParticleUtil.getGpuRenderTargetName(key),
                requiresRuntime: ParticleUtil.requiresGpuChildRuntime(key, value)
            };
        });

        /*
         * Resolve ordinary immediate non-function render values first.
         *
         * This seeds width/height/etc. before x() and other functions execute.
         */
        for (const entry of entries) {
            if (
                entry.kind !== "render" ||
                entry.mode !== "immediate" ||
                entry.requiresRuntime ||
                ParticleUtil.isFunctionBasedGpuValue(entry.value)
            ) {
                continue;
            }

            const resolved = ParticleUtil.resolveGpuRenderValue(
                entry.value,
                child
            );

            renderDefinition[entry.targetName] = resolved;

            ParticleUtil.setGpuInitialChildValue(
                child,
                entry.targetName,
                ParticleUtil.getGpuInitialRenderValue(resolved)
            );
        }

        /*
         * Resolve plain immediate function-valued render targets after
         * static dimensions have been initialized.
         *
         * Keep layout functions so they can be recalculated after the
         * parent's first layout.
         */
        for (const entry of entries) {
            if (
                entry.kind !== "render" ||
                entry.mode !== "immediate" ||
                entry.requiresRuntime ||
                !ParticleUtil.isFunctionBasedGpuValue(entry.value)
            ) {
                continue;
            }

            const resolved = ParticleUtil.resolveGpuRenderValue(
                entry.value,
                child
            );

            renderDefinition[entry.targetName] = resolved;

            ParticleUtil.setGpuInitialChildValue(
                child,
                entry.targetName,
                ParticleUtil.getGpuInitialRenderValue(resolved)
            );

            if (ParticleUtil.affectsChildLayout(entry.targetName)) {
                layoutFunctions.push({
                    key: entry.key,
                    targetName: entry.targetName,
                    value: entry.value
                });
            }
        }

        /*
         * Preserve runtime targets in their original code order.
         */
        for (const entry of entries) {
            if (entry.kind === "ignoredStyle") {
                ignoredStyles.push(entry.key);
                continue;
            }

            if (!entry.requiresRuntime) {
                continue;
            }

            runtimeTargets.push(
                ParticleUtil.createGpuRuntimeTarget(
                    entry.key,
                    entry.value
                )
            );

            /*
             * An immediate animated render target needs an initial GPU-visible
             * value, but the animation itself belongs to childRuntimePrograms.
             *
             * Example:
             *
             * y: {
             *     value() { return [0, 500]; },
             *     steps: 30,
             *     interval: 20
             * }
             *
             * renderDefinition gets y: 0.
             */
            if (
                entry.kind === "render" &&
                entry.mode === "immediate"
            ) {
                const resolved = ParticleUtil.resolveGpuRenderValue(
                    entry.value,
                    child
                );

                const initialValue =
                    ParticleUtil.getGpuInitialRenderValue(
                        resolved
                    );

                renderDefinition[entry.targetName] =
                    initialValue;

                ParticleUtil.setGpuInitialChildValue(
                    child,
                    entry.targetName,
                    initialValue
                );
            }
        }

        return {
            renderDefinition,
            runtimeTargets,
            ignoredStyles,
            layoutFunctions
        };
    } 
}

export { ParticleUtil };