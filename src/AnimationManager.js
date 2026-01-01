import { TModelUtil } from "./TModelUtil.js";
import { TargetData } from "./TargetData.js";
import { getRunScheduler } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";

class AnimationManager {
    
    constructor() {
        this.waapiPoller = { rafId: 0, alive: true };
        this.recordMap = new Map();
        this.isShuttingDown = false;        
        this.toid = 'ring_0';
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

    backfillKeyAcrossFramesUsingMorph(tmodel, key, frames) {

        const times = frames.map(f => f.keyTime);

        const idxs = [];
        for (let i = 0; i < frames.length; i++) {
            if (this.getAt(frames[i], key) !== undefined) {
                idxs.push(i);
            }
        }

        if (idxs.length >= 2) {

            for (let m = 0; m < idxs.length - 1; m++) {
                const i0 = idxs[m];
                const i1 = idxs[m + 1];

                const from = this.getAt(frames[i0], key);
                const to = this.getAt(frames[i1], key);

                const meta = frames[i1].keyMeta.get(key);
                const steps = meta.steps;
                const interval = meta.interval;
                const duration = steps * interval;

                const t0 = times[i0];
                const t1 = times[i1];
                
                const u = (t1 - t0) / duration;
                
                for (let i = i0 + 1; i < i1; i++) {
                    const t = times[i];
                    const elapsed = (t - t0);

                    let step = TUtil.limit(Math.round(elapsed / (u * interval)), 0, steps);

                    const v = TModelUtil.morph(tmodel, key, from, to, step, steps);
                    this.setAt(frames[i], key, v);
                    frames[i].keyMeta.set(key, { steps: step, interval });
                }
            }
        }
        
        if (idxs.length) {
            const lastIndex = idxs[idxs.length - 1];
            const lastFrame = frames[lastIndex];
            const lastValue = this.getAt(lastFrame, key);
            for (let i = lastIndex + 1; i < frames.length; i++) {
                this.setAt(frames[i], key, lastValue);
                frames[i].keyMeta.set(key, { steps: 0 });
            }
        }
    }

    animate(tmodel, batch, hooks) {
        if (this.isShuttingDown || !tmodel.hasDom()) {
            return;
        }
                
        const el = tmodel.$dom.getElement();
        
        batch.frames.sort((a, b) => a.keyTime  - b.keyTime);

        if (tmodel.lastBatch) {
            const cutTime =  Math.min(TUtil.now() - tmodel.lastBatch.startTime, tmodel.lastBatch.totalDuration);
                        
            this.cutLastBatch(tmodel, tmodel.lastBatch, cutTime); 
            this.callFireOnEndOnConflict(tmodel, tmodel.lastBatch, batch);
            this.mergeBatches(tmodel.lastBatch, batch);

            this.cancelTModel(tmodel);
        }
        
       const totalDuration = Math.max(batch.totalDuration, 1);
       
       const cleanKeys = Object.keys(batch.keyMap);

        for (const key of cleanKeys) {
            this.backfillKeyAcrossFramesUsingMorph(tmodel, key, batch.frames);
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
                out.transform = TModelUtil.getTransformString(tfMap, tmodel.val('transformOrder'));
                frame.tfMap = tfMap;
                transformAnimation = true;
            }

            this.addUnitsToFrame(out);

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

        const keyMap = batch.keyMap;
                
        for (const cleanKey of cleanKeys) {
            const originalKey = keyMap[cleanKey];
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
                finished: false,
                canceled: false,
                needsFireOnStep: true,
                hooks
            };            

            tmodel.addToAnimatingMap(originalKey, rec);
            this.recordMap.set(recId, rec);
        }
       
        const onDone = () => {

            for (const [recId, rec] of this.recordMap) {
                const { tmodel, cleanKey, originalKey } = rec;
                                
                if (rec.anim !== anim && !rec.canceled) {
                    continue;
                }
                
                const ct = rec.anim.effect?.getComputedTiming?.();
                const isFinished = rec.canceled || rec.anim.playState === 'finished' || rec.anim.playState === 'idle' 
                        || (ct && ct.progress === 1);
                
                if (!isFinished) {
                    continue;
                }

                tmodel.removeFromAnimatingMap(originalKey);
                
                this.recordMap.delete(recId);

                if (!rec.canceled && !rec.finished) {

                    if (tmodel.finalRawFrame) {
                        const value = this.getAt(tmodel.finalRawFrame, cleanKey);
                        this.setAt(tmodel, cleanKey, value);
                        tmodel.val(originalKey, value);
                        const targetValue = tmodel.targetValues[originalKey];
                        if (targetValue) {
                            targetValue.step = tmodel.getTargetSteps(originalKey);
                            targetValue.cycle = Array.isArray(targetValue.valueList) ? targetValue.valueList.length : tmodel.getTargetCycles(originalKey);
                            targetValue.value = value;
                            tmodel.setActual(originalKey, value);
                            
                            tmodel.updateTargetStatus(originalKey);
                        }
                    }                    

                    if (!tmodel.hasAnimatingTargets()) {
                        
                        if (tmodel.finalKeyframe) {
                            if (tmodel.hasDom()) {
                               TModelUtil.fixStyleByAnimation(tmodel, tmodel.finalKeyframe);
                            }
                        }
                        tmodel.lastBatch = undefined;
                        tmodel.pausedBatch = undefined;
                    }
                    
                    rec.finished = true;
                    rec.hooks.fireOnEnd(tmodel, rec.originalKey);
                    
                    getRunScheduler().scheduleOnlyIfEarlier(1, `animate-${tmodel.oid}---${originalKey}`);
                }
            }
        };
        
        anim.addEventListener("finish", onDone);
        anim.addEventListener("cancel", onDone);        

        this.startProgressPoller();
    }
    
    freezeTModelAtCurrentTime(tmodel) {
        const batch = tmodel.lastBatch;
        
        const cutTime = Math.min(TUtil.now() - batch.startTime, batch.totalDuration);

        this.cutLastBatch(tmodel, batch, cutTime);

        const frame0 = batch.frames[0];
        if (!frame0) {
            return;
        }

        const out = { ...frame0.styleMap };

        const hasTf = Object.keys(frame0.tfMap).length > 0;
        
        if (hasTf) {
            Object.keys(tmodel.tfMap).forEach(key => {
                tmodel.tfMap[key] = tmodel.val(key);
            });
            const tfMap = { ...tmodel.tfMap, ...frame0.tfMap };
            frame0.tfMap = tfMap;
            out.transform = TModelUtil.getTransformString(tfMap, tmodel.val('transformOrder'));
        }

        this.addUnitsToFrame(out);
        
        TModelUtil.fixStyleByAnimation(tmodel, out);
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
                steps: meta?.steps,
                interval: meta?.interval,
                offset: frame.keyTime / total
            });
        }

        out.sort((a, b) => a.time - b.time);
        
        return out.length >= 2 ? out : undefined;
    }
    
    getRecordId(tmodel, key) {
        return `${tmodel.oid}-${key}`;
    }

    addUnitsToFrame(out) {
        for (const k of Object.keys(out)) {
            if (k === 'offset' || k === 'transform') {
                continue;
            }

            let v = out[k];

            if (v === undefined || v === null || Number.isNaN(v)) {
                delete out[k];
                continue;
            }

            if (typeof v === 'number' && TargetData.styleWithUnitMap[k]) {
                if ((k === 'width' || k === 'height') && v < 0) {
                    v = 0;
                }
                
                out[k] = `${v}px`;
            }
        }
    }
    
    startProgressPoller() {
        if (this.waapiPoller.rafId) { 
            return;
        }
                
        this.waapiPoller.alive = true;

        const tick = () => {
            let activeRecords = 0;
            for (const [, record] of this.recordMap) {
                if (!record || record.finished || record.canceled || record.anim?.playState !== 'running') {
                    continue;
                }
                
                activeRecords++;
                
                this.updateTModelFromRecord(record);
                
            } 
            
            if (activeRecords > 0) {
                this.waapiPoller.rafId = requestAnimationFrame(tick);
            } else {
                 this.recordMap.clear();
                this.waapiPoller.alive = false;
                this.waapiPoller.rafId = 0;
            }
        };

        this.waapiPoller.rafId = requestAnimationFrame(tick);
    }
    
    updateTModelFromRecord(record) {
        const { tmodel, originalKey, cleanKey } = record;

        const result = this.getValueFromAnim(record);

        if (!result) {
            return;
        }

        const { value, step } = result;
        
        this.setAt(tmodel, cleanKey, value);
        
        tmodel.val(originalKey, value);
        if (tmodel.targetValues[originalKey]) {
            tmodel.targetValues[originalKey].step = step;
            tmodel.setActual(originalKey, value);

            if (record.needsFireOnStep) {
                const needsRefire = record.hooks.fireOnStep(tmodel, originalKey, step);

                if (!needsRefire) { 
                    record.needsFireOnStep = false;
                }
            }
        }
    }
    
    cancel(record) {
        if (record.canceled) {
            return;
        }
                
        const { recId, originalKey, tmodel, anim } = record;
            
        record.canceled = true;
        anim.cancel();
            
        tmodel.removeFromAnimatingMap(originalKey);

        this.recordMap.delete(recId);
    }
    
    cancelTModel(tmodel) {

        for (const [recId, record] of this.recordMap) {
            if (recId.startsWith(`${tmodel.oid}-`)) {;
                this.cancel(record);
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
            rec.canceled = true;
        }

    }
    
    async cancelAll() {
        this.isShuttingDown = true;
        
        if (this.waapiPoller.rafId) {
            cancelAnimationFrame(this.waapiPoller.rafId);
            this.waapiPoller.rafId = 0;
            this.waapiPoller.alive = false;
        }
        
        const seen = new Set();

        for (const [, record] of this.recordMap) {
            const { tmodel } = record;
                            
            this.updateTModelFromRecord(record);
            
            this.cancel(record);            
            
            if (seen.has(tmodel.oid)) {
                continue;
            }
 
            seen.add(tmodel.oid);
            
            this.freezeTModelAtCurrentTime(tmodel);
            
            tmodel.pausedBatch = tmodel.lastBatch;
            tmodel.lastBatch = undefined;
            tmodel.finalKeyframe = undefined;
            tmodel.finalRawFrame = undefined; 

            tmodel.clearAnimatingMap();
        }
        
        this.recordMap.clear();
    }
    
    async flushOneFrame() {
        await new Promise(requestAnimationFrame);
        this.isShuttingDown = false;
    }
    
    getValueFromAnim(record) {
        const {tmodel, originalKey, anim, frames} = record;
        
        if (!frames) {            
            return;
        }

        const ct = anim.effect?.getComputedTiming?.();
        if (!ct) {
            return;
        }
        
        let p = TUtil.isDefined(ct.progress) ? TUtil.limit(ct.progress, 0, 1) : 1;
        
        const last = frames.length - 1;
        let k = 0;
        if (p <= frames[0].offset) {
            k = 0;
        } else if (p >= frames[last].offset) {
            k = last - 1;
        } else {
            for (let i = 0; i < last; i++) {
                if (p >= frames[i].offset && p < frames[i + 1].offset) {
                    k = i;
                    break;
                }
            }
        }

        const left = frames[k];
        const right = frames[k + 1];

        const from = left.value;
        const to = right.value;

        const segStart = left.offset;
        const segEnd = right.offset;
        const segSpan = segEnd - segStart;
        
        if (segSpan > 0) {
            const u = TUtil.limit((p - segStart) / segSpan, 0, 1);

            let steps = right.steps;

            let step = Math.round(u * steps);
            step = TUtil.limit(step, 0, steps);

            const value = TModelUtil.morph(tmodel, originalKey, from, to, step, steps);

            return { value, step, steps };
        }
    }
    
    cutLastBatch(tmodel, batch, cutTime) {
        
        let i = 0;
        while (i < batch.frames.length && batch.frames[i].keyTime <= cutTime) {
            i++;
        }
                
        const needsInsert = i < batch.frames.length && cutTime !== batch.frames[i].keyTime;
        if (needsInsert) {
            batch.frames.splice(i, 0, {keyTime: cutTime, tfMap: {}, styleMap: {}, keyMeta: new Map()});

            const cleanKeys = Object.keys(batch.keyMap);
            for (const key of cleanKeys) {
                this.backfillKeyAcrossFramesUsingMorph(tmodel, key, batch.frames);
            }
            
            batch.frames = batch.frames.slice(i);
        }

        batch.frames.forEach(frame => {
            frame.keyTime = Math.max(0, frame.keyTime - cutTime);
        });

        batch.totalDuration = batch.frames.length ? batch.frames[batch.frames.length - 1].keyTime : 0;            
    }
    
   callFireOnEndOnConflict(tmodel, lastBatch, newBatch) {
        const newKeyMap = newBatch.keyMap;
        const oldKeyMap = lastBatch.keyMap;
        const newCleanKeys = Object.keys(newKeyMap);

        for (const cleanKey of newCleanKeys) {
            const oldOriginal = oldKeyMap[cleanKey];
            const newOriginal = newKeyMap[cleanKey];
            
            if (oldOriginal && newOriginal && oldOriginal !== newOriginal) {
                const recId = this.getRecordId(tmodel, oldOriginal);
                const oldRec = this.recordMap.get(recId);
                if (oldRec && !oldRec.finished && !oldRec.canceled) {
                    this.updateTModelFromRecord(oldRec);
                    oldRec.finished = true;
                    const targetValue = tmodel.targetValues[oldOriginal];
                    if (targetValue) {
                        targetValue.step = tmodel.getTargetSteps(oldOriginal);
                        targetValue.cycle = Array.isArray(targetValue.valueList) ? targetValue.valueList.length : tmodel.getTargetCycles(oldOriginal);
                        tmodel.updateTargetStatus(oldOriginal);
                    }                    
                    oldRec.hooks.fireOnEnd(oldRec.tmodel, oldOriginal);
                    oldRec.tmodel.removeFromAnimatingMap(oldOriginal);
                    this.recordMap.delete(oldRec.recId);
                }
            }
        }       
   }
   
    mergeBatches(lastBatch, newBatch) {   
        const newCleanKeys = Object.keys(newBatch.keyMap);

        const oldFrames = [];
        for (const frame of lastBatch.frames) {
            for (const key of newCleanKeys) {
                delete frame.styleMap[key];
                delete frame.tfMap[key];
                delete lastBatch.keyMap[key];
                }
                
            if (Object.keys(frame.styleMap).length || Object.keys(frame.tfMap).length) {
                oldFrames.push(frame);
            }
        }
        
        newBatch.frames = [ ...oldFrames, ...newBatch.frames ];
        newBatch.frames.sort((a, b) => a.keyTime - b.keyTime);

        // Merge frames with identical keyTime
        const merged = [];
        for (const f of newBatch.frames) {
            const last = merged[merged.length - 1];
            if (last && last.keyTime === f.keyTime) {
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

        newBatch.keyMap = { ...newBatch.keyMap, ...lastBatch.keyMap };
        newBatch.frames = merged;

        newBatch.totalDuration = newBatch.frames.length ? newBatch.frames[newBatch.frames.length - 1].keyTime : 0; 
    }
    
    pauseTModel(tmodel) {
        const batch = tmodel.lastBatch;
        
        if (!batch) {
            return;
        }

        const cutTime =  Math.min(TUtil.now() - batch.startTime, batch.totalDuration);

        this.cutLastBatch(tmodel, batch, cutTime);

        tmodel.pausedBatch = batch;
        tmodel.lastBatch = undefined;
        
        this.cancelTModel(tmodel);
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
}

export { AnimationManager };
