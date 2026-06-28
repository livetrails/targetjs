// AnimationUtil.js
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";
import { getAnimationManager, getTargetManager } from "./App.js";
import { ScheduleUtil } from "./ScheduleUtil.js"
import { TUtil } from "./TUtil.js";
/**
 * It provides helper functions for Animation.
 */
class AnimationUtil {
    
    static emptyBatch() {
        return {
            frames: [],
            keyMap: {},
            totalDuration: 0
        };
    }
    
    static overrideAnimatedKeyWithSnap(tmodel, keys, values) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const valueList = Array.isArray(values) ? values : [values];
        
        const tfMap0 = {};
        const styleMap0 = {};
        const keyMeta0 = new Map();

        const tfMap1 = {};
        const styleMap1 = {};
        const keyMeta1 = new Map();

        const keyMap = {};
        
        let needsAnimation = false;

        for (let i = 0; i < keyList.length; i++) {
            const key = keyList[i];

            needsAnimation = true;
            
            const value = valueList[i];
            const targetValue = tmodel.targetValues[key];
         
            const cleanKey = TargetUtil.getTargetName(key);

            if (TargetData.isTransformKey(cleanKey)) {
                tfMap0[cleanKey] = value;
                tfMap1[cleanKey] = value;
            } else {
                styleMap0[cleanKey] = value;
                styleMap1[cleanKey] = value;
            }

            keyMeta0.set(cleanKey, { steps: 1, interval: 1 });
            keyMeta1.set(cleanKey, { steps: 1, interval: 1 });

           (keyMap[cleanKey] = new Set()).add(key);

            if (targetValue) {
                targetValue.value = value;
                targetValue.steps = 1;
                targetValue.interval = 0;
                targetValue.snapAnimation = true;
            }
        }
        
        if (!needsAnimation) {
            return;
        }

        const frames = [];


        frames.push({
            keyTime: 0,
            tfMap: tfMap0,
            styleMap: styleMap0,
            keyMeta: keyMeta0
        });

        frames.push({
            keyTime: 1,
            tfMap: tfMap1,
            styleMap: styleMap1,
            keyMeta: keyMeta1
        });

        const batch = {
            frames,
            keyMap,
            totalDuration: 1
        };
                
        getAnimationManager().animate(tmodel, batch, AnimationUtil.getAnimationHooks());
    }
    
    static fixStyleByAnimation(tmodel, frame) {
        
        if (!tmodel.hasDom()) {
            return;
        }
        
        const keys = Object.keys(frame);
        
        for (const key of keys) {
            if (key === 'offset') {
                continue;
            }
            
            const value = frame[key];
            
            if (value === null) {
                continue;
            }

            let num = value;
            if (typeof value === 'string' && value.endsWith('px')) {
                const parsed = Number(value.slice(0, -2));
                if (!Number.isNaN(parsed)) {
                    num = parsed;
                }
            }

            if (key === 'width') {
                tmodel.styleMap.width = num;
                tmodel.$dom.width(value);
            } else if (key === 'height') {
                tmodel.styleMap.height = num;
                tmodel.$dom.height(value);
            } else if (key === 'transform') {
                tmodel.$dom.transform(value, tmodel.val('transformOrder'));
            } else if (!TargetData.transformMap[key]) {
                tmodel.$dom.style(key, value);
                tmodel.styleMap[key] = num;
            }
        }
    }    
    
    static addUnitsToFrame(out) {
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
    
    static getAnimationHooks() {
        return {
            morph: (tm, key, from, to, step, steps) => TModelUtil.morph(tm, key, from, to, step, steps),
            fireOnStep: (tm, key, step) => getTargetManager().fireOnStep(tm, key, step),
            fireOnEnd: (tm, key) => getTargetManager().fireOnEnd(tm, key)
        };
    }
    
    static addToUpdatingTargets(tmodel, originalKeys) {
        const recordMap = getAnimationManager().recordMap;
        const records = [];

        for (const [, record] of recordMap) {
            if (record.tmodel !== tmodel) {
                continue;
            }

            if (originalKeys && !originalKeys.has(record.originalKey)) {
                continue;
            }

            records.push(record);
        }

        const now = TUtil.now();

        for (const record of records) {
            const { originalKey } = record;
            const targetValue = tmodel.targetValues[originalKey];

            if (!targetValue) {
                continue;
            }


            targetValue.pausedAt = now;

            tmodel.setTargetStatus(originalKey, 'updating');
            tmodel.removeFromAnimatingMap(originalKey);
        }
    }
    
    static addToNODomUpdatingTargets(tmodel, originalKeys) {
        const recordMap = getAnimationManager().recordMap;
        const records = [];

        for (const [, record] of recordMap) {
            if (record.tmodel !== tmodel) {
                continue;
            }

            if (originalKeys && !originalKeys.has(record.originalKey)) {
                continue;
            }

            records.push(record);
        }

        const now = TUtil.now();

        for (const record of records) {
            const { originalKey } = record;
            const targetValue = tmodel.targetValues[originalKey];

            if (!targetValue) {
                continue;
            }

            targetValue.pausedAt = now;

            tmodel.removeFromAnimatingMap(originalKey);
            (tmodel.noDomUpdatingTargets ||= new Set()).add(originalKey);
        }
    }
    
    static removeKeysFromBatch(batch, originalKeys) {
        if (!batch || !originalKeys?.size) {
            return;
        }

        for (const frame of batch.frames) {
            for (const originalKey of originalKeys) {
                const cleanKey = TargetUtil.getTargetName(originalKey);
                delete frame.styleMap[cleanKey];
                delete frame.tfMap[cleanKey];

                if (frame.keyMeta) {
                    frame.keyMeta.delete(cleanKey);
                }
            }
        }

        for (const originalKey of originalKeys) {
            const cleanKey = TargetUtil.getTargetName(originalKey);
            delete batch.keyMap[cleanKey];
        }

        batch.frames = batch.frames.filter(frame => {
            return Object.keys(frame.styleMap).length ||
                   Object.keys(frame.tfMap).length;
        });

        batch.totalDuration = batch.frames.length ? batch.frames[batch.frames.length - 1].keyTime : 0;
    }
        
    static updateTModelFromRecord(record) {
        const { tmodel, originalKey, cleanKey } = record;
        
        if (!tmodel.hasDom()) {
            return;
        }

        const result = AnimationUtil.getValueFromAnim(record);

        if (!result) {
            return;
        }
        
        const { value, step, steps, valuePointer, framePointer } = result;
        
        getAnimationManager().setAt(tmodel, cleanKey, value);
        
        tmodel.val(originalKey, value);
        const targetValue = tmodel.targetValues[originalKey];
        
        if (targetValue) {

            if (TUtil.isDefined(step) && TUtil.isDefined(steps) && steps > 0) {
                targetValue.step = step;
            }

            if (TUtil.isDefined(valuePointer)) {
                targetValue.valuePointer = valuePointer;
            }
      
            tmodel.setActual(originalKey, value);
                
            const fireKey = `${framePointer}:${step}`;


            if (record.needsFireOnStep && step > 0 && steps > 0 && record.lastFireOnStepKey !== fireKey) {
                record.lastFireOnStepKey = fireKey;
                
                const needsRefire = record.hooks.fireOnStep(tmodel, originalKey, step);
                
                if (!needsRefire) { 
                    record.needsFireOnStep = false;
                }
            }
        }
        
        return result;
    }
    
    static getValueFromAnim(record) {
        const { originalKey, anim, frames } = record;
        
        if (!frames) {            
            return;
        }

        const ct = anim.effect?.getComputedTiming?.();
        if (!ct) {
            return;
        }
        
        let p = TUtil.isDefined(ct.progress) ? TUtil.limit(ct.progress, 0, 1) : 1;
        
        const last = frames.length - 1;
        let framePointer = 0;
        if (p <= frames[0].offset) {
            framePointer = 0;
        } else if (p >= frames[last].offset) {
            framePointer = last - 1;
        } else {
            for (let i = 0; i < last; i++) {
                if (p >= frames[i].offset && p < frames[i + 1].offset) {
                    framePointer = i;
                    break;
                }
            }
        }

        const left = frames[framePointer];
        const right = frames[framePointer + 1];

        const from = left.value;
        const to = right.value;

        const segStart = left.offset;
        const segEnd = right.offset;
        const segSpan = segEnd - segStart;
        
        if (segSpan > 0) {
            const u = TUtil.limit((p - segStart) / segSpan, 0, 1);
            const value = TModelUtil.morph(originalKey, from, to, u);

            const segmentSteps = right.steps;
            
            if (!TUtil.isDefined(segmentSteps) || segmentSteps <= 0) {
                return {
                    value,
                    framePointer,
                    from,
                    to,
                    valuePointer: right.valuePointer,
                    status: right.done ? 'finished' : 'playing'
                };
            }
            
            const stepOffset = right.stepOffset || 0;

            let localStep = Math.round(u * segmentSteps);
            localStep = TUtil.limit(localStep, 0, segmentSteps);

            const step = stepOffset + localStep;
            const steps = stepOffset + segmentSteps;

            const status = (step === steps && left.done) || right.done ? 'finished' : 'playing';

            return {
                value,
                step,   
                steps,           
                localStep,        
                segmentSteps,    
                stepOffset,
                valuePointer: right.valuePointer,
                framePointer,
                from,
                to,
                status
            };        
        } 
    }
    
    static detachAnimationsOnDeleteDom(tmodel) {
        const recordMap = getAnimationManager().recordMap;
        const pauseKeys = new Set();
        const catchupKeys = new Set();

        for (const [, record] of recordMap) {
            if (record.tmodel !== tmodel) {
                continue;
            }

            if (ScheduleUtil.shouldPauseTarget(tmodel, record.originalKey)) {
                pauseKeys.add(record.originalKey);
            } else {
                catchupKeys.add(record.originalKey);
            }
        }

        if (pauseKeys.size) {         
            AnimationUtil.addToUpdatingTargets(tmodel, pauseKeys);
        }

        if (catchupKeys.size) {
            AnimationUtil.addToNODomUpdatingTargets(tmodel, catchupKeys);
        }

        AnimationUtil.deleteDetachedRecords(tmodel, new Set([...pauseKeys, ...catchupKeys]));
    }
    
    static deleteDetachedRecords(tmodel, keys) {
        const recordMap = getAnimationManager().recordMap;

        for (const [recId, record] of recordMap) {
            if (record.tmodel !== tmodel) {
                continue;
            }

            if (!keys.has(record.originalKey)) {
                continue;
            }

            record.status = 'detached';

            try {
                record.anim.cancel();
            } catch {}

            tmodel.removeFromAnimatingMap(record.originalKey);
            recordMap.delete(recId);
        }

        tmodel.clearAnimatingMap();
        tmodel.lastBatch = undefined;
        tmodel.finalKeyframe = undefined;
        tmodel.finalRawFrame = undefined;
    }
    
    static rebaseCutBatchMeta(tmodel, batch) {
        if (!batch || !batch.frames?.length) {
            return;
        }

        for (const [cleanKey, originalKeys] of Object.entries(batch.keyMap)) {
            for (const originalKey of originalKeys) {
                const targetValue = tmodel.targetValues[originalKey];

                if (!targetValue) {
                    continue;
                }

                const currentStep = targetValue.step || 0;

                for (let i = 1; i < batch.frames.length; i++) {
                    const frame = batch.frames[i];

                    if (getAnimationManager().getAt(frame, cleanKey) === undefined) {
                        continue;
                    }

                    const meta = frame.keyMeta?.get(cleanKey);

                    if (!meta || !TUtil.isDefined(meta.steps)) {
                        continue;
                    }

                    const oldOffset = meta.stepOffset || 0;
                    const oldTotal = oldOffset + meta.steps;

                    if (currentStep > oldOffset && currentStep < oldTotal) {
                        meta.stepOffset = currentStep;
                        meta.steps = oldTotal - currentStep;
                    }

                    break;
                }
            }
        }
    }
            
    static handleWebAnimationAPI(tmodel, cleanKey, key, targetValue, from, to, valuePointer, step, steps, interval, timeShift, skipStartFrame = false) { 
        const batch = (tmodel.waapiBatch ||= {
            frames: [],
            easing: undefined,            
            keyMap: {},
            totalDuration: 0
        });

        const isTransform = TargetData.isTransformKey(cleanKey);

        const getFrameAtTime = (t) => {
            const shifted = Math.max(0, t + timeShift);

            for (let i = 0; i < batch.frames.length; i++) {
                const frame = batch.frames[i];
                if (Math.abs(frame.keyTime - shifted) < 0.0001) {
                    return frame;
                }
            }
            const frame = { keyTime: shifted, tfMap: {}, styleMap: {}, keyMeta: new Map() };
            batch.frames.push(frame);
            return frame;
        };

        const setFrameValue = (frame, value) => {
            if (isTransform) {
                frame.tfMap[cleanKey] = value;
            } else {
                frame.styleMap[cleanKey] = value;
            }
        };

        let keyDuration = 0;

        if (targetValue.valueList && targetValue.valueList.length) {
            const valueList = targetValue.valueList;
            const stepList = targetValue.stepList || [1];
            const intervalList = targetValue.intervalList || [interval || 8];


            if (!skipStartFrame) {
                const frame0 = getFrameAtTime(0);
                setFrameValue(frame0, from);
            }

            for (let i = valuePointer; i < valueList.length; i++) {
                const segmentSteps = stepList[(i - 1) % stepList.length];
                const intervalValue = intervalList[(i - 1) % intervalList.length] || 8;

                const stepOffset = i === valuePointer ? step : 0;
                const remainingSteps = Math.max(segmentSteps - stepOffset, 0);

                if (remainingSteps <= 0) {
                    continue;
                }

                const duration = remainingSteps * intervalValue;

                keyDuration += duration;

                const frame = getFrameAtTime(keyDuration);

                setFrameValue(frame, valueList[i]);

                frame.keyMeta.set(cleanKey, {
                    steps: remainingSteps,
                    interval: intervalValue,
                    stepOffset,
                    valuePointer: i
                });
            }
        } else {
            interval = interval || 8;

            const remainingSteps = Math.max(steps - step, 0);

            if (remainingSteps <= 0) {
                tmodel.val(key, to);
                targetValue.step = steps;
                return 0;
            }

            keyDuration = remainingSteps * interval;

            if (!skipStartFrame) {
                const frame0 = getFrameAtTime(0);
                setFrameValue(frame0, from);
            }

            const frame1 = getFrameAtTime(keyDuration);

            setFrameValue(frame1, to);

            frame1.keyMeta.set(cleanKey, {
                steps: remainingSteps,
                interval,
                stepOffset: step
            });
        }

        if (keyDuration <= 0) {
            tmodel.removeFromUpdatingTargets(key);
            return 0;
        }

        if (tmodel.getTargetEasing(key)) {
            batch.easing = tmodel.getTargetEasing(key);
        }

        batch.totalDuration = Math.max(0, batch.totalDuration, timeShift + keyDuration);

        (batch.keyMap[cleanKey] ||= new Set()).add(key);

        tmodel.removeFromUpdatingTargets(key);
        tmodel.addToAnimatingMap(key);

        return keyDuration;
    }
}

export { AnimationUtil };
