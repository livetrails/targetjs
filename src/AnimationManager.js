import { TModelUtil } from "./TModelUtil.js";
import { AnimationUtil } from "./AnimationUtil.js";
import { TargetData } from "./TargetData.js";
import { getRunScheduler } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";
import { TUtil } from "./TUtil.js";

class AnimationManager {
    
    constructor() {
        this.waapiPoller = { rafId: 0, alive: true };
        this.recordMap = new Map();
        this.isShuttingDown = false;        
        this.toid = 'blank';
    } 
    
    animate(tmodel, batch, hooks) {
        if (this.isShuttingDown || !tmodel.hasDom()) {
            return;
        }
        
        const el = tmodel.$dom.getElement();
        
        batch.frames.sort((a, b) => a.keyTime  - b.keyTime);
        
        this.cancelElementAnimationsForKeys(el, Object.keys(batch.keyMap));

        if (tmodel.lastBatch) {
            const cutTime =  Math.min(TUtil.now() - tmodel.lastBatch.startTime, tmodel.lastBatch.totalDuration);
                        
            this.cutLastBatch(tmodel, tmodel.lastBatch, cutTime); 
            this.callFireOnEndOnConflict(tmodel, tmodel.lastBatch, batch);
            this.mergeBatches(tmodel.lastBatch, batch);

            this.deleteAnimation(tmodel);
        }
        
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
                
            tmodel.addToAnimatingMap(originalKey, rec);
            this.recordMap.set(recId, rec);
        }
               
        const finalize = () => {
            this.finalizeAnimation(anim);
        };

        anim.addEventListener("finish", finalize, { once: true });
        anim.addEventListener("cancel", finalize, { once: true });

        anim.finished.then(finalize).catch(finalize);

        this.startProgressPoller();
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

            if (tmodel.finalRawFrame) {
                const frames = rec.frames;
                const lastFrame = frames && frames[frames.length - 1];
                const value = lastFrame ? lastFrame.value : this.getAt(tmodel.finalRawFrame, cleanKey);                
                this.setAt(tmodel, cleanKey, value);
                tmodel.val(originalKey, value);
                const targetValue = tmodel.targetValues[originalKey];
                if (targetValue) {
                    targetValue.step = tmodel.getTargetSteps(originalKey);
                    targetValue.cycle = Array.isArray(targetValue.valueList) ? targetValue.valueList.length : tmodel.getTargetCycles(originalKey);
                    targetValue.value = value;
                    tmodel.setActual(originalKey, value);
                }
            }                

            if (!tmodel.hasAnimatingTargets()) {

                if (tmodel.finalKeyframe) {
                    if (tmodel.hasDom()) {   
                        AnimationUtil.fixStyleByAnimation(tmodel, tmodel.finalKeyframe);
                    }
                }
                tmodel.lastBatch = undefined;
                tmodel.pausedBatch = undefined;
            }

            rec.status = 'complete';
            rec.hooks.fireOnEnd(tmodel, originalKey);

            getRunScheduler().scheduleOnlyIfEarlier(1, `animate-${tmodel.oid}---${originalKey}`);
        }
    }
    
    startProgressPoller() {
        if (this.waapiPoller.rafId) { 
            return;
        }
                
        this.waapiPoller.alive = true;

        const tick = () => {
            const animsToFinalize = new Set();
            let hasPlaying = false;

            for (const [, record] of this.recordMap) {
                if (record.status === 'canceled') {
                    continue
                } else if (record.status === 'playing') {
                    hasPlaying = true;
                }
                
                this.updateTModelFromRecord(record);
                
                const ps = record.anim.playState;
                const ct = record.anim.effect?.getComputedTiming?.();
                const finished = ps === "finished" || ps === "idle" || (ct && ct.progress >= 0.999999);
                
                if (finished) {
                    record.status = 'done';
                    animsToFinalize.add(record.anim);
                }
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

    backfillKeyAcrossFramesUsingMorph(tmodel, originalKey, frames) {
        const cleanKey = TargetUtil.getTargetName(originalKey);

        const times = frames.map(f => f.keyTime);

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

                const from = this.getAt(frames[i0], cleanKey);
                const to = this.getAt(frames[i1], cleanKey);

                const meta = frames[i1].keyMeta.get(cleanKey);
                if (!meta) {
                    continue;
                }
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

                    const v = TModelUtil.easingMorph(tmodel, originalKey, from, to, step, steps);
                    this.setAt(frames[i], cleanKey, v);
                    frames[i].keyMeta.set(cleanKey, { steps: step, interval });
                }
            }
        }
        
        if (idxs.length) {
            const lastIndex = idxs[idxs.length - 1];
            const lastFrame = frames[lastIndex];
            const lastValue = this.getAt(lastFrame, cleanKey);
            for (let i = lastIndex + 1; i < frames.length; i++) {
                this.setAt(frames[i], cleanKey, lastValue);
                frames[i].keyMeta.set(cleanKey, { steps: 0 });
            }
        }
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
            out.transform = TModelUtil.getTransformString(tmodel, tfMap);
        }

        AnimationUtil.addUnitsToFrame(out);
        
        AnimationUtil.fixStyleByAnimation(tmodel, out);
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
        
        const seen = new Set();

        for (const [, record] of this.recordMap) {
            const { tmodel } = record;
                            
            this.updateTModelFromRecord(record);
            
            this.delete(record);            
            
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
        const {originalKey, anim, frames} = record;
        
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

            const value = TModelUtil.morph(originalKey, from, to, u);
            
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

            const originalKeys = [...new Set(Object.values(batch.keyMap).flatMap(set => [...set]))];
            for (const originalKey of originalKeys) {
              this.backfillKeyAcrossFramesUsingMorph(tmodel, originalKey, batch.frames);
            }
            
            batch.frames = batch.frames.slice(i);
        }

        batch.frames.forEach(frame => {
            frame.keyTime = Math.max(0, frame.keyTime - cutTime);
        });

        batch.totalDuration = batch.frames.length ? batch.frames[batch.frames.length - 1].keyTime : 0;            
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

                if (oldRec && oldRec.status === 'playing') {
                    this.updateTModelFromRecord(oldRec);
                    oldRec.status = 'complete';
                    oldRec.hooks.fireOnEnd(oldRec.tmodel, oldOriginal);
                    oldRec.tmodel.removeFromAnimatingMap(oldOriginal);
                    this.recordMap.delete(recId);
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
        
        this.deleteAnimation(tmodel);
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
    
    cancelElementAnimationsForKeys(el, cleanKeys) {
        if (!el.getAnimations) {
            return;
        }

        const keySet = new Set(cleanKeys);

        for (const anim of el.getAnimations()) {
            const effect = anim.effect;
            if (!effect?.getKeyframes) {
                continue;
            }

            const kfs = effect.getKeyframes();
            let touches = false;

            for (const kf of kfs) {
                for (const k of Object.keys(kf)) {
                    if (keySet.has(k)) {
                        touches = true;
                        break;
                    }
                }
                if (touches) {
                    break;
                }
            }

            if (touches) {
                try { 
                    anim.cancel(); 
                } catch {}
            }
        }
    }

}

export { AnimationManager };
