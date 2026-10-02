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
        TModelUtil.restoreMountedDom($pageDom, checkpoint.domState);

        this.showGpuRestoreVisuals(checkpoint.gpuVisuals);


        tApp.tRoot.$dom = TModelUtil.getRootDom();

        const visibleModels = checkpoint.visibleOids.map(oid => tmodelIdMap[oid]).filter(Boolean);

        const restoredWithDom = this.connectRestoredDoms(visibleModels, models);

        tApp.manager.activatePendingTargetsAfterDom(restoredWithDom, { restoredDoneTargets: true });

        tApp.tRoot.markLayoutDirty("checkpointRestore");
        
        await tApp.start();

        const $restoredPageDom = TModelUtil.getPageDom();

        TModelUtil.restoreMountedDom($restoredPageDom, checkpoint.domState);

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
        const restoredDoms = DomInit.initCacheDoms(visibleModels);
        const restoredWithDom = TUtil.uniqueTModels([...visibleModels, ...restoredDoms]);

        this.normalizeRestoredModels(allModels);

        tApp.manager.visibleOidMap = {};

        for (const tmodel of restoredWithDom) {
            if (tmodel.isIncluded() && tmodel.isVisible()) {
                tApp.manager.visibleOidMap[tmodel.oid] = tmodel;
            }
        }

        return restoredWithDom;
    }

    getGpuVisualClipRect(element) {
        const rect = element.getBoundingClientRect();

        let left = Math.max(0, rect.left);
        let top = Math.max(0, rect.top);
        let right = Math.min(window.innerWidth, rect.right);
        let bottom = Math.min(window.innerHeight, rect.bottom);

        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const parentRect = parent.getBoundingClientRect();

            const clipsX = ["hidden", "clip", "auto", "scroll"].includes(style.overflowX);
            const clipsY = ["hidden", "clip", "auto", "scroll"].includes(style.overflowY);

            if (clipsX) {
                left = Math.max(left, parentRect.left);
                right = Math.min(right, parentRect.right);
            }

            if (clipsY) {
                top = Math.max(top, parentRect.top);
                bottom = Math.min(bottom, parentRect.bottom);
            }

            if (right <= left || bottom <= top) {
                return {
                    left,
                    top,
                    width: 0,
                    height: 0
                };
            }
        }

        return {
            left,
            top,
            width: right - left,
            height: bottom - top
        };
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
            const clipRect = this.getGpuVisualClipRect(canvas);

            if (clipRect.width <= 0 || clipRect.height <= 0) {
                continue;
            }

            const bitmap = await renderer.captureBitmap();

            if (!bitmap) {
                continue;
            }

            visuals[tmodel.oid] = {
                bitmap,
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                clipLeft: clipRect.left,
                clipTop: clipRect.top,
                clipWidth: clipRect.width,
                clipHeight: clipRect.height
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
            if (!visual?.bitmap || visual.clipWidth <= 0 || visual.clipHeight <= 0) {
                continue;
            }

            const clip = document.createElement("div");

            Object.assign(clip.style, {
                position: "absolute",
                left: `${visual.clipLeft}px`,
                top: `${visual.clipTop}px`,
                width: `${visual.clipWidth}px`,
                height: `${visual.clipHeight}px`,
                overflow: "hidden"
            });

            const preview = document.createElement("canvas");

            preview.width = visual.bitmap.width;
            preview.height = visual.bitmap.height;

            Object.assign(preview.style, {
                position: "absolute",
                left: `${visual.left - visual.clipLeft}px`,
                top: `${visual.top - visual.clipTop}px`,
                width: `${visual.width}px`,
                height: `${visual.height}px`,
                display: "block"
            });

            preview.getContext("2d").drawImage(visual.bitmap, 0, 0);

            clip.appendChild(preview);
            overlay.appendChild(clip);
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
