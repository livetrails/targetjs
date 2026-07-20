import { TModelUtil } from "./TModelUtil.js";
import { AnimationUtil } from "./AnimationUtil.js";
import { TargetData } from "./TargetData.js";
import { getRunScheduler } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";
import { ScheduleUtil } from "./ScheduleUtil.js";

class AnimationManager {
    
    constructor() {
        this.waapiPoller = { rafId: 0, alive: true };
        this.recordMap = new Map();
        this.isShuttingDown = false;        
        this.toid = 'blank';
    } 
     
    animate(tmodel, batch = AnimationUtil.emptyBatch(), hooks, pausedKeys) {
        if (this.isShuttingDown) {
            return;
        }

        batch.frames.sort((a, b) => a.keyTime - b.keyTime);
 
        if (tmodel.lastBatch) {
            const cutTime = Math.min(TUtil.now() - tmodel.lastBatch.startTime, tmodel.lastBatch.totalDuration);

            tmodel.lastBatch = this.cutLastBatch(tmodel, tmodel.lastBatch, cutTime);

            AnimationUtil.rebaseCutBatchMeta(tmodel, tmodel.lastBatch);

            if (pausedKeys?.size) {
                const pausedFrame = {
                    styleMap: { ...tmodel.lastBatch.frames[0].styleMap },
                    tfMap: { ...tmodel.lastBatch.frames[0].tfMap },
                    keyMeta: new Map(tmodel.lastBatch.frames[0].keyMeta)
                };

                AnimationUtil.addToUpdatingTargets(tmodel, pausedKeys);
                AnimationUtil.removeKeysFromBatch(tmodel.lastBatch, pausedKeys);

                this.callFireOnEndOnConflict(tmodel, tmodel.lastBatch, batch);
                this.mergeBatches(tmodel.lastBatch, batch);

                this.deleteAnimation(tmodel);

                this.fixTModelStyleFromFrame(tmodel, pausedFrame);
            } else {
                this.callFireOnEndOnConflict(tmodel, tmodel.lastBatch, batch);
                this.mergeBatches(tmodel.lastBatch, batch);

                this.deleteAnimation(tmodel);

            }
        }
        
        if (!tmodel.hasDom() || !batch.frames.length || !Object.keys(batch.keyMap).length) {
            return;
        }
         
        const el = tmodel.$dom.getElement();
       
        const totalDuration = Math.max(batch.totalDuration, 1);
       
        const originalKeys = [...new Set(Object.values(batch.keyMap).flatMap(set => [...set]))];
        
        for (const originalKey of originalKeys) {
            this.backfillKeyAcrossFramesUsingMorph(tmodel, originalKey, batch.frames);
        }
        
        let transformAnimation = false;
        
        const keyframes = batch.frames.map(frame => {
            const out = {...frame.styleMap};
            out.offset = frame.keyTime / totalDuration;
            if (Object.keys(frame.tfMap).length) { 
                Object.keys(tmodel.tfMap).forEach(key => {
                    tmodel.tfMap[key] = tmodel.val(key);
                });
                const tfMap = { ...tmodel.tfMap, ...frame.tfMap };                             
                out.transform = TModelUtil.getTransformString(tmodel, tfMap);
                frame.tfMap = tfMap;
                transformAnimation = true;
            }

            AnimationUtil.addUnitsToFrame(out);

            return out;
        });
        
        const compactKeyframes = this.filterRedundantKeyframes(keyframes);
        
        const timing = {
            duration: totalDuration,
            fill: "none",
            iterations: 1,
            easing: batch.easing || "linear"
        };
        
        batch.startTime = TUtil.now();
        
        tmodel.lastBatch = batch;
        tmodel.lastBatch.transformAnimation = transformAnimation;
        
        tmodel.finalKeyframe = compactKeyframes[compactKeyframes.length - 1];
        tmodel.finalRawFrame =  batch.frames[ batch.frames.length - 1];

        let anim = el.animate(compactKeyframes, timing);
        
        for (const originalKey of originalKeys) {
            const cleanKey = TargetUtil.getTargetName(originalKey);
            const recId = this.getRecordId(tmodel, originalKey);
          
            const { originalTModel, originalTargetName } = TargetUtil.getOriginalNames(tmodel, originalKey);
            
            const rec = {
                recId,
                cleanKey,
                originalKey,
                tmodel,
                anim,
                originalTModel, originalTargetName,
                frames: this.collectFramesForKey(batch, cleanKey),
                status: 'playing',
                needsFireOnStep: true,
                hooks
            };    
                
            const targetValue = tmodel.targetValues[originalKey];
            if (targetValue) {   
                tmodel.addToAnimatingMap(originalKey);
                targetValue.status = !targetValue.snapAnimation ? 'updating' : 'done';
            }
            this.recordMap.set(recId, rec);
        }
        
        this.startProgressPoller();
    }
    
    pauseAnimations(tmodel, keys) {
        let keySet;

        if (!keys) {
            keySet = new Set(tmodel.animatingMap?.keys() ?? []);
        } else if (keys instanceof Map) {
            keySet = new Set(keys.keys());
        } else {
            keySet = new Set(keys);
        }

        if (!keySet.size) {
            return;
        }

        this.animate(tmodel, AnimationUtil.emptyBatch(), AnimationUtil.getAnimationHooks(), keySet);
    }

    finalizeAnimation(anim) {  
        for (const [recId, rec] of this.recordMap) {
            
            if (rec.anim !== anim) {
                continue;
            }

            if (rec.status === 'playing' || rec.status === 'canceled') {
                continue;
            }

            const { tmodel, originalKey, cleanKey } = rec;
            
            tmodel.removeFromAnimatingMap(originalKey);
            this.recordMap.delete(recId);
               
            this.completeRecord(tmodel, rec, cleanKey, originalKey);

            if (!tmodel.hasAnimatingTargets()) {

                if (tmodel.finalKeyframe) {
                    if (tmodel.hasDom()) {   
                        AnimationUtil.fixStyleByAnimation(tmodel, tmodel.finalKeyframe);
                    }
                }
                tmodel.lastBatch = undefined;
            }

            rec.status = 'complete';
            rec.hooks.fireOnEnd(tmodel, originalKey);

            getRunScheduler().scheduleOnlyIfEarlier(1, `animate-${tmodel.oid}---${originalKey}`);
        }
        
        getRunScheduler().schedule(35, `finalizeAnimation`);
    }
    
    startProgressPoller() {
        if (this.waapiPoller.rafId) { 
            return;
        }

        this.waapiPoller.alive = true;

        const tick = () => {
            const animsToFinalize = new Set();
            const pauseMap = new Map();
            let hasPlaying = false;

            for (const [, record] of this.recordMap) {
                if (record.status === 'canceled' || record.status === 'detached') {
                    continue;
                }

                const { tmodel, originalKey } = record;

                if (record.status !== 'finished' && ScheduleUtil.shouldPauseTarget(tmodel, originalKey)) {
                    let keys = pauseMap.get(tmodel);

                    if (!keys) {
                        keys = new Set();
                        pauseMap.set(tmodel, keys);
                    }

                    keys.add(originalKey);
                    continue;
                }

                if (record.status === 'playing') {
                    hasPlaying = true;
                }

                const ps = record.anim.playState;
                const ct = record.anim.effect?.getComputedTiming?.();
                const progress = ct?.progress ?? 0;
                const finished = ps === "finished" || ps === "idle" || progress >= 0.999999;

                if (finished) {
                    record.status = 'done';
                    animsToFinalize.add(record.anim);
                }

                if (progress > 0 && record.status !== 'finished') {
                    const result = AnimationUtil.updateTModelFromRecord(record);

                    if (result?.status === 'finished') {
                        record.status = 'finished';
                    }
                }
            }

            for (const [tmodel, keys] of pauseMap) {
                this.pauseAnimations(tmodel, keys);
            }

            for (const anim of animsToFinalize) {
                this.finalizeAnimation(anim);
            }

            if (this.recordMap.size > 0 || hasPlaying) {
                this.waapiPoller.rafId = requestAnimationFrame(tick);
            } else {        
                this.waapiPoller.alive = false;
                this.waapiPoller.rafId = 0;
            }
        };

        this.waapiPoller.rafId = requestAnimationFrame(tick);
    }    
    getAt(frame, key) {
        return TargetData.isTransformKey(key) ? frame.tfMap[key] : frame.styleMap[key];
    }

    setAt(frame, key, value) {
        if (TargetData.isTransformKey(key)) {
            frame.tfMap[key] = value;
        } else {
            frame.styleMap[key] = value;
        }
    }
    
    completeRecord(tmodel, record, cleanKey, originalKey) {
        if (tmodel.finalRawFrame) {
            const frames = record.frames;
            const lastFrame = frames && frames[frames.length - 1];
            const value = lastFrame ? lastFrame.value : this.getAt(tmodel.finalRawFrame, cleanKey);                
            this.setAt(tmodel, cleanKey, value);
            tmodel.val(originalKey, value);
            const targetValue = tmodel.targetValues[originalKey];
            if (targetValue) {
                targetValue.step = tmodel.getTargetSteps(originalKey);
                targetValue.valuePointer = targetValue.valueList?.length ?? 0;
                targetValue.value = value;
                tmodel.setActual(originalKey, value);
                if (tmodel.isTargetImperative(originalKey)) {
                    targetValue.cycle = targetValue.cycles;
                }
            }
        }         
    }

    backfillKeyAcrossFramesUsingMorph(tmodel, originalKey, frames) {
        const cleanKey = TargetUtil.getTargetName(originalKey);

        const idxs = [];
        for (let i = 0; i < frames.length; i++) {
            if (this.getAt(frames[i], cleanKey) !== undefined) {
                idxs.push(i);
            }
        }

        if (idxs.length >= 2) {
            for (let m = 0; m < idxs.length - 1; m++) {
                const i0 = idxs[m];
                const i1 = idxs[m + 1];

                const leftFrame = frames[i0];
                const rightFrame = frames[i1];

                const from = this.getAt(leftFrame, cleanKey);
                const to = this.getAt(rightFrame, cleanKey);

                const rightMeta = rightFrame.keyMeta?.get(cleanKey);

                if (!rightMeta) {
                    continue;
                }

                const spanSteps = rightMeta.steps;
                const baseStepOffset = rightMeta.stepOffset || 0;
                const segmentSteps = rightMeta.segmentSteps ?? spanSteps;

                const t0 = leftFrame.keyTime;
                const t1 = rightFrame.keyTime;
                const spanTime = t1 - t0;

                if (!TUtil.isDefined(spanSteps) || spanSteps <= 0 || spanTime <= 0) {
                    continue;
                }

                let previousLogicalStep = baseStepOffset;

                for (let i = i0 + 1; i < i1; i++) {
                    const frame = frames[i];
                    const progress = TUtil.limit((frame.keyTime - t0) / spanTime, 0, 1);

                    const localStep = Math.round(progress * spanSteps);
                    const logicalStep = TUtil.limit(baseStepOffset + localStep, 0, segmentSteps);

                    const stepsFromPreviousFrame = Math.max(logicalStep - previousLogicalStep, 0);

                    const v = TModelUtil.morph(originalKey, from, to, progress);

                    this.setAt(frame, cleanKey, v);

                    frame.keyMeta.set(cleanKey, {
                        ...rightMeta,
                        steps: stepsFromPreviousFrame,
                        stepOffset: previousLogicalStep,
                        segmentSteps,
                        done: false
                    });

                    previousLogicalStep = logicalStep;
                }
            }
        }

        if (idxs.length) {
            const lastIndex = idxs[idxs.length - 1];
            const lastFrame = frames[lastIndex];
            const lastValue = this.getAt(lastFrame, cleanKey);
            const lastMeta = lastFrame.keyMeta?.get(cleanKey);

            if (!lastMeta) {
                return;
            }

            const segmentSteps = lastMeta.segmentSteps ?? lastMeta.steps ?? 0;

            for (let i = lastIndex + 1; i < frames.length; i++) {
                const frame = frames[i];

                this.setAt(frame, cleanKey, lastValue);

                frame.keyMeta.set(cleanKey, {
                    ...lastMeta,
                    steps: 0,
                    stepOffset: segmentSteps,
                    segmentSteps,
                    done: true
                });
            }
        }
    }

    fixTModelStyleFromFrame(tmodel, frame) {
        if (!tmodel.hasDom() || !frame) {
            return;
        }

        const out = { ...frame.styleMap };

        const hasTf = Object.keys(frame.tfMap).length > 0;

        if (hasTf) {
            Object.keys(tmodel.tfMap).forEach(key => {
                tmodel.tfMap[key] = tmodel.val(key);
            });

            const tfMap = { ...tmodel.tfMap, ...frame.tfMap };
            frame.tfMap = tfMap;

            out.transform = TModelUtil.getTransformString(tmodel, tfMap);
        }

        AnimationUtil.addUnitsToFrame(out);
        AnimationUtil.fixStyleByAnimation(tmodel, out);
    }
    
    freezeTModelAtCurrentTime(tmodel) {        
        if (!tmodel.lastBatch) {
            return;
        }

        const cutTime = Math.min(
            TUtil.now() - tmodel.lastBatch.startTime,
            tmodel.lastBatch.totalDuration
        );

        tmodel.lastBatch = this.cutLastBatch(tmodel, tmodel.lastBatch, cutTime);

        this.fixTModelStyleFromFrame(tmodel, tmodel.lastBatch.frames[0]);
    }

    collectFramesForKey(batch, cleanKey) {
        
        const out = [];
        const total = batch.totalDuration;
        
        for (const frame of batch.frames) {
            
            const value = this.getAt(frame, cleanKey);
            if (value === undefined) {
                continue;
            }

            const meta = frame.keyMeta.get(cleanKey);
                        
            out.push({
                value,
                time: frame.keyTime,
                offset: frame.keyTime / total,
                steps: meta?.steps,
                segmentSteps: meta?.segmentSteps,
                interval: meta?.interval,
                stepOffset: meta?.stepOffset || 0,
                valuePointer: meta?.valuePointer,
                cycle: meta?.cycle,
                done: !!meta?.done
            });
        }

        out.sort((a, b) => a.time - b.time);
                        
        return out.length >= 2 ? out : undefined;
    }
    
    getRecordId(tmodel, key) {
        return `${tmodel.oid}-${key}`;
    }
    
    delete(record) {
        const { recId, originalKey, tmodel, anim } = record;
                            
        anim.cancel();
        
        tmodel.removeFromAnimatingMap(originalKey);
       
        this.recordMap.delete(recId);        
    }
    
    deleteAnimation(tmodel) {
        for (const [recId, record] of this.recordMap) {
            if (recId.startsWith(`${tmodel.oid}-`)) {;
                this.delete(record);
            }
        }
        
        tmodel.lastBatch = undefined;
        tmodel.finalKeyframe = undefined;
        tmodel.finalRawFrame = undefined; 
        
        tmodel.clearAnimatingMap();
    }
    
    cancelKey(tmodel, originalKey) {
        const recId = this.getRecordId(tmodel, originalKey);
        const rec = this.recordMap.get(recId);

        if (rec) {
            rec.status = 'canceled';
        }
    }
    
    async deleteAll() {
        this.isShuttingDown = true;
        
        if (this.waapiPoller.rafId) {
            cancelAnimationFrame(this.waapiPoller.rafId);
            this.waapiPoller.rafId = 0;
            this.waapiPoller.alive = false;
        }
        
        const tmodels = new Set();

        for (const [, record] of this.recordMap) {
            tmodels.add(record.tmodel);
        }
        
        for (const tmodel of tmodels) {
            this.freezeTModelAtCurrentTime(tmodel);

            AnimationUtil.detachAnimationsOnDeleteDom(tmodel);
            
            tmodel.lastBatch = undefined;
            tmodel.finalKeyframe = undefined;
            tmodel.finalRawFrame = undefined;             
        }
        
        this.recordMap.clear();
    }
    
    async flushOneFrame() {
        await new Promise(requestAnimationFrame);
        this.isShuttingDown = false;
    }
    
    fillCutFrameFromRecords(tmodel, cutFrame, cutTime, totalDuration) {
        const progress = totalDuration > 0 ? TUtil.limit(cutTime / totalDuration, 0, 1) : 1;

        for (const [, record] of this.recordMap) {
            if (record.tmodel !== tmodel) {
                continue;
            }

            if (record.status === 'canceled' || record.status === 'detached') {
                continue;
            }

            const result = AnimationUtil.getValueFromFrames(record, progress);

            if (!result) {
                continue;
            }

            const { cleanKey, originalKey } = record;
            const targetValue = tmodel.targetValues[originalKey];

            this.setAt(cutFrame, cleanKey, result.value);

            cutFrame.keyMeta.set(cleanKey, {
                steps: result.remainingSteps ?? result.steps ?? targetValue?.steps ?? 0,
                segmentSteps: result.steps ?? targetValue?.steps ?? 0,
                interval: targetValue?.interval ?? 8,
                stepOffset: result.step ?? 0,
                valuePointer: result.valuePointer,
                cycle: result.cycle,
                done: result.status === 'finished'
            });

        }
    }

    cutLastBatch(tmodel, batch, cutTime) {
        
        let i = 0;
        while (i < batch.frames.length && batch.frames[i].keyTime <= cutTime) {
            i++;
        }
        
        const originalDuration = batch.totalDuration;

        const needsInsert = i < batch.frames.length && cutTime !== batch.frames[i].keyTime;
        if (needsInsert) {
            const cutFrame = { keyTime: cutTime, tfMap: {}, styleMap: {}, keyMeta: new Map() };

            batch.frames.splice(i, 0, cutFrame);
            
            

            this.fillCutFrameFromRecords(tmodel, cutFrame, cutTime, originalDuration);

            const originalKeys = [...new Set(
                Object.values(batch.keyMap).flatMap(set => [...set])
            )];

            for (const originalKey of originalKeys) {
                this.backfillKeyAcrossFramesUsingMorph(tmodel, originalKey, batch.frames);
            }

            batch.frames = batch.frames.slice(i);
        }

        batch.frames.forEach(frame => {
            frame.keyTime = Math.max(0, frame.keyTime - cutTime);
        });

        batch.totalDuration = batch.frames.length
            ? batch.frames[batch.frames.length - 1].keyTime
            : 0;

        return batch;
    }
    
    callFireOnEndOnConflict(tmodel, lastBatch, newBatch) {
        const oldMap = lastBatch.keyMap; // cleanKey -> Set
        const newMap = newBatch.keyMap;
        
        for (const cleanKey of Object.keys(newMap)) {
            const oldSet = oldMap[cleanKey];
            const newSet = newMap[cleanKey];
            if (!oldSet || !newSet) {
                continue;
            }

            // Any old originalKey that’s not present anymore should be completed/canceled.
            for (const oldOriginal of oldSet) {
                if (newSet.has(oldOriginal)) {
                    continue;
                }
                
                const recId = this.getRecordId(tmodel, oldOriginal);
                const oldRec = this.recordMap.get(recId);

                if (oldRec) {
                   this.completeRecord(tmodel, oldRec, cleanKey, oldOriginal);
                    oldRec.status = 'complete';
                    oldRec.hooks.fireOnEnd(oldRec.tmodel, oldOriginal);
                    oldRec.tmodel.removeFromAnimatingMap(oldOriginal);
                    this.recordMap.delete(recId);
                }
            }
        }
    }
   
    mergeBatches(lastBatch, newBatch) {
        const newCleanKeys = new Set(Object.keys(newBatch.keyMap));

        const oldFrames = [];

        for (const frame of lastBatch.frames) {
            for (const key of newCleanKeys) {
                delete frame.styleMap[key];
                delete frame.tfMap[key];
                frame.keyMeta?.delete(key);
            }

            if (Object.keys(frame.styleMap).length || Object.keys(frame.tfMap).length) {
                oldFrames.push(frame);
            }
        }

        const oldKeyMap = {};

        for (const [key, set] of Object.entries(lastBatch.keyMap)) {
            if (!newCleanKeys.has(key)) {
                oldKeyMap[key] = set;
            }
        }

        newBatch.frames = [...oldFrames, ...newBatch.frames];
        newBatch.frames.sort((a, b) => a.keyTime - b.keyTime);

        const merged = [];

        for (const f of newBatch.frames) {
            const last = merged[merged.length - 1];

            if (last && Math.abs(last.keyTime - f.keyTime) < 0.0001) {
                Object.assign(last.styleMap, f.styleMap);
                Object.assign(last.tfMap, f.tfMap);

                if (f.keyMeta) {
                    for (const [k, v] of f.keyMeta) {
                        last.keyMeta.set(k, v);
                    }
                }
            } else {
                merged.push(f);
            }
        }

        newBatch.keyMap = { ...oldKeyMap, ...newBatch.keyMap };

        newBatch.frames = merged;

        newBatch.totalDuration = newBatch.frames.length ? newBatch.frames[newBatch.frames.length - 1].keyTime : 0;
    } 
    
    areFramesEqual(a, b) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        if (keysA.length !== keysB.length) {
            return false;
        }

        for (const k of keysA) {
            if (k === 'offset') {
                continue;
            }
            if (a[k] !== b[k]) {
                return false;
            }
        }

        return true;
    }
    
    filterRedundantKeyframes(keyframes) {
        if (keyframes.length <= 2) {
            return keyframes;
        }

        const filtered = [keyframes[0]];

        for (let i = 1; i < keyframes.length - 1; i++) {
            const prev = filtered[filtered.length - 1];
            const curr = keyframes[i];

            if (!this.areFramesEqual(prev, curr)) {
                filtered.push(curr);
            }
        }

        filtered.push(keyframes[keyframes.length - 1]);

        return filtered;
    }
        
    rebaseAutoLayoutTransform(tmodel, tfUpdates) {
        if (!tmodel.lastBatch) {
            return false;
        }

        const cutTime = Math.min(
            TUtil.now() - tmodel.lastBatch.startTime,
            tmodel.lastBatch.totalDuration
        );

        const batch = this.cutLastBatch(tmodel, tmodel.lastBatch, cutTime);

        AnimationUtil.rebaseCutBatchMeta(tmodel, batch);

        for (const frame of batch.frames) {
            for (const [key, value] of Object.entries(tfUpdates)) {
                frame.tfMap[key] = value;
            }
        }

        for (const [key, value] of Object.entries(tfUpdates)) {
            tmodel.tfMap[key] = value;
            tmodel.val(key, value);
            tmodel.actualValues[key] = value;
        }

        this.deleteAnimation(tmodel);

        this.animate(tmodel, batch, AnimationUtil.getAnimationHooks());

        return true;
    }    
}

export { AnimationManager };
