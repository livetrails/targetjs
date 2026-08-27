import { TUtil } from "./TUtil.js";
import { tApp, App, getRunScheduler, getLocationManager, getAnimationManager, getLoader } from "./App.js";
import { AnimationUtil } from "./AnimationUtil.js";
import { DomInit } from "./DomInit.js";
import { $Dom } from "./$Dom.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { TModel } from "./TModel.js";
import { StateUtil } from "./StateUtil.js";
/**
 * It enables storing and restoring state.
 */
class StateManager {
    constructor() {
        this.stateCheckpoints = {};
    }
    
    async store(key = "default") {
        this.syncAnimationsForCheckpoint();

        const runSnapshot = getRunScheduler().getSnapshot();

        const $pageDom = TModelUtil.getPageDom();

        const checkpoint = {
            key,
            capturedAt: TUtil.now(),
            html: $pageDom.innerHTML(),
            domState: TModelUtil.captureDomState($pageDom),
            oids: { ...App.oids },
            rootSnapshot: tApp.tRoot.createRuntimeSnapshot(),
            loaderSnapshot: getLoader().createRuntimeSnapshot(),
            visibleOids: Object.keys(tApp.manager.visibleOidMap),
            scrollLeft: $Dom.getWindowScrollLeft() || 0,
            scrollTop: $Dom.getWindowScrollTop() || 0,
            runSnapshot,
            gpuVisuals: await this.captureGpuVisuals()
        };

        this.releaseGpuVisuals(this.stateCheckpoints[key]);
        this.stateCheckpoints[key] = checkpoint;
        
        return checkpoint;
    }

    async restore(key = "default") {
        TargetUtil.currentTargetName = undefined;
        TargetUtil.currentTModel = undefined;

        const checkpoint = this.stateCheckpoints[key];

        if (!checkpoint) {
            return false;
        }

        getLoader().clear();

        await tApp.stop();
        getLocationManager().cancelCurrentCalculation();
        await tApp.reset();

        App.oids = {};
        App.tmodelIdMap = {};

        const timeOffset = TUtil.now() - checkpoint.capturedAt;
        const { root, tmodelIdMap, models } = StateUtil.fromRuntimeSnapshot(checkpoint.rootSnapshot, TModel, { timeOffset });

        tApp.tRoot = root;

        App.oids = { ...checkpoint.oids };
        App.tmodelIdMap = tmodelIdMap;

        getLoader().restoreRuntimeSnapshot(checkpoint.loaderSnapshot, tmodelIdMap);
        
        const $pageDom = TModelUtil.getPageDom();

        $pageDom.innerHTML(checkpoint.html);
        TModelUtil.restoreDomState($pageDom, checkpoint.domState);

        this.showGpuRestoreVisuals(checkpoint.gpuVisuals);


        tApp.tRoot.$dom = TModelUtil.getRootDom();

        const visibleModels = checkpoint.visibleOids.map(oid => tmodelIdMap[oid]).filter(Boolean);

        const restoredWithDom = this.connectRestoredDoms(visibleModels, models);

        tApp.manager.activatePendingTargetsAfterDom(restoredWithDom, { restoredDoneTargets: true });

        tApp.tRoot.markLayoutDirty("checkpointRestore");
        
        await tApp.start();

        const $restoredPageDom = TModelUtil.getPageDom();

        TModelUtil.restoreDomState($restoredPageDom, checkpoint.domState);

        await TModelUtil.restoreScroll(checkpoint);
        await TModelUtil.restoreDomInteractionState($restoredPageDom, checkpoint.domState);

        await Promise.all(
            models.map(tmodel => tmodel.restoreRuntimeDomDerivedState?.())
        );

        this.hideGpuRestoreVisuals();

        getRunScheduler().restoreSnapshot(checkpoint.runSnapshot);

        return true;
    }
    
    syncAnimationsForCheckpoint() {
        const keysByTModel = new Map();

        for (const record of getAnimationManager().recordMap.values()) {
            if (record.status === "canceled" || record.status === "detached") {
                continue;
            }

            AnimationUtil.updateTModelFromRecord(record);

            let keys = keysByTModel.get(record.tmodel);

            if (!keys) {
                keys = new Set();
                keysByTModel.set(record.tmodel, keys);
            }

            keys.add(record.originalKey);
        }

        for (const [tmodel, keys] of keysByTModel) {
            TModelUtil.commitAnimatedStyles(tmodel, keys);
        }
    }

    normalizeRestoredModels(tmodels) {
        const uniqueModels = TUtil.uniqueTModels(tmodels);

        for (const tmodel of uniqueModels) {
            const animatingKeys = new Set(tmodel.getAnimatingTargets());

            if (animatingKeys.size && tmodel.hasDom()) {
                TModelUtil.commitAnimatedStyles(tmodel, animatingKeys);
            }

            tmodel.viewport = undefined;
            tmodel.visibilityStatus = undefined;
            tmodel.currentStatus = "new";
            tmodel.originWindowEpoch = -1;

            tmodel.domHeightTimestamp = 0;
            tmodel.domWidthTimestamp = 0;

            tmodel.dirtyLayout = false;
            tmodel.markLayoutDirty("stateRestore");
        }

        TargetUtil.convertAnimatingTargetsToUpdating(uniqueModels);

        return uniqueModels;
    }

    connectRestoredDoms(visibleModels, allModels) {
        const newVisibles = DomInit.initCacheDoms(visibleModels);
        const restoredWithDom = TUtil.uniqueTModels([...visibleModels, ...newVisibles]);

        this.normalizeRestoredModels(allModels);

        tApp.manager.visibleOidMap = {};

        for (const tmodel of restoredWithDom) {
            if (tmodel.isIncluded()) {
                tApp.manager.visibleOidMap[tmodel.oid] = tmodel;
            }
        }

        return restoredWithDom;
    }
    
    async captureGpuVisuals() {
        const visuals = {};

        for (const tmodel of Object.values(App.tmodelIdMap)) {
            const renderer = tmodel.particleRenderer;
            const canvas = renderer?.canvas;

            if (!canvas || !tmodel.gpuChildrenEnabled) {
                continue;
            }

            const rect = canvas.getBoundingClientRect();
            const bitmap = await renderer.captureBitmap();

            if (!bitmap) {
                continue;
            }

            visuals[tmodel.oid] = {
                bitmap,
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };
        }

        return visuals;
    }
    
    showGpuRestoreVisuals(visuals) {
        this.hideGpuRestoreVisuals();

        if (!Object.keys(visuals || {}).length) {
            return;
        }

        const overlay = document.createElement("div");

        overlay.setAttribute("data-targetjs-gpu-restore-overlay", "true");

        Object.assign(overlay.style, {
            position: "fixed",
            left: "0px",
            top: "0px",
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: "2147483647"
        });

        for (const visual of Object.values(visuals)) {
            if (!visual?.bitmap) {
                continue;
            }

            const preview = document.createElement("canvas");

            preview.width = visual.bitmap.width;
            preview.height = visual.bitmap.height;

            Object.assign(preview.style, {
                position: "absolute",
                left: `${visual.left}px`,
                top: `${visual.top}px`,
                width: `${visual.width}px`,
                height: `${visual.height}px`,
                display: "block"
            });

            const context = preview.getContext("2d");

            context.drawImage(visual.bitmap, 0, 0);
            
            overlay.appendChild(preview);
        }

        document.body.appendChild(overlay);

        return overlay;
    } 
    
    hideGpuRestoreVisuals() {
        document.querySelector('[data-targetjs-gpu-restore-overlay="true"]')?.remove();
    }
    
    releaseGpuVisuals(checkpoint) {
        for (const visual of Object.values(checkpoint?.gpuVisuals || {})) {
            visual?.bitmap?.close?.();
        }
    }

    has(key = "default") {
        return Boolean(this.stateCheckpoints[key]);
    }

    get(key = "default") {
        return this.stateCheckpoints[key];
    }
    
    toggle(key = "default") {
        return this.has(key) ? this.restore(key) : this.store(key);
    }

    clear(key = "default") {
        const checkpoint = this.stateCheckpoints[key];

        if (!checkpoint) {
            return false;
        }

        this.releaseGpuVisuals(checkpoint);

        delete this.stateCheckpoints[key];

        return true;
    }

    clearAll() {
        for (const checkpoint of Object.values(this.stateCheckpoints)) {
            this.releaseGpuVisuals(checkpoint);
        }

        this.stateCheckpoints = {};
    }
}

export { StateManager };
