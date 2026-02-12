// TargetManager.js
import { TargetExecutor } from "./TargetExecutor.js";
import { getRunScheduler, getAnimationManager, getVisibles } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { SearchUtil } from "./SearchUtil.js";
import { TargetData } from "./TargetData.js";
import { AnimationUtil } from "./AnimationUtil.js";

/**
 * Manages target execution/cycles and updates actual values toward target values.
 * It also delegates animatable style targets to AnimationManager
 */
class TargetManager {
    applyTargetValues(tmodel, activeList = tmodel.activeTargetList.slice(0)) {
        for (const key of activeList) {
            if (!tmodel.isTargetImperative(key)) {
                this.applyTargetValue(tmodel, key);
            }
        }
    }

    applyTargetValue(tmodel, key) {
        const target = tmodel.targets[key];

        if (!TUtil.isDefined(target)) {
            tmodel.removeFromActiveTargets(key);
            return;
        }

        if (tmodel.isExecuted(key) && tmodel.hasUpdatingImperativeTargets(key)) {
            return;
        }

        if (tmodel.isExecuted(key) && tmodel.getTargetStep(key) === tmodel.getTargetSteps(key)) {             
            if (tmodel.isScheduledPending(key)) {
                return;
            }
            const schedulePeriod = TUtil.scheduleExecution(tmodel, key);
            if (schedulePeriod > 0) {
                getRunScheduler().timeSchedule(schedulePeriod, `targetSchedule__${tmodel.oid}__${key}_${schedulePeriod}`);
                return;
            }
        }

        if (!tmodel.isTargetEnabled(key)) {
            if (target.needsReactivation) {
                tmodel.removeFromActiveTargets(key);
            }
            return;
        }

        tmodel.resetScheduleTimeStamp(key);

        TargetExecutor.prepareTarget(tmodel, key);
        TargetExecutor.executeDeclarativeTarget(tmodel, key);
    }

    setActualValues(tmodel, updatingList) {
        if (!updatingList.length) { 
            return;
        }
        
        updatingList = updatingList.slice(0);

        let schedulePeriod = 0;

        for (const key of updatingList) {

            schedulePeriod = TUtil.scheduleExecution(tmodel, key);
            
            if (schedulePeriod > 0) {  
                getRunScheduler().schedule(schedulePeriod, `setActualValues-${tmodel.oid}__${key}_${schedulePeriod}`);
            } else {
                tmodel.resetScheduleTimeStamp(key);
                this.setActualValue(tmodel, key);
            }
        }
                            
        const batch = tmodel.waapiBatch;
        
        if (!batch || !tmodel.hasDom()) {
            tmodel.waapiBatch = undefined;
            return;
        }
                
        getAnimationManager().animate(tmodel, batch, AnimationUtil.getAnimationHooks());
        
        tmodel.waapiBatch = undefined;
    }

    findOriginalTModel(tmodel, originalTargetName) {
        return SearchUtil.findParentByTarget(tmodel, originalTargetName)
                || getVisibles().find(tmodel => tmodel.targets[originalTargetName]);
    }

    fireOnStep(tmodel, key, step) {
        const targetValue = tmodel.targetValues[key]; 
        const theValue = tmodel.getTargetValue(key);
        const steps = tmodel.getTargetSteps(key);
        const target = tmodel.targets[key];

        tmodel.setLastUpdate(key);
        tmodel.setTargetMethodName(key, "value");
        
        const originalTargetName = targetValue.originalTargetName;
        let originalTarget = tmodel.targets[originalTargetName];
        let originalTModel = tmodel;

        tmodel.setTargetMethodName(key, 'value');

        if (!originalTarget && originalTargetName) {
            originalTModel = this.findOriginalTModel(tmodel, originalTargetName);
            originalTarget = originalTModel ? originalTModel.targets[originalTargetName] : null;
        }
        
        let needsRefire = false;

        if (tmodel.isTargetImperative(key)) {
            if (originalTarget) {
                const capKey = TargetUtil.getTargetName(TUtil.capitalizeFirstLetter(key));
                
                if (typeof originalTarget[`on${capKey}Step`] === 'function') {            
                    originalTarget[`on${capKey}Step`].call(originalTModel, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, [`on${capKey}Step`]);
                    needsRefire = true;
                } else if (typeof originalTarget.onImperativeStep === "function") {
                    originalTarget.onImperativeStep.call(originalTModel, key, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, "onImperativeStep");
                    needsRefire = true;
                }
            
                if (originalTarget.activateNextTarget && !originalTarget.activateNextTarget.endsWith('$$') && originalTarget.activateNextTarget.endsWith('$')) {
                    needsRefire = true;   
                    TargetUtil.shouldActivateNextTarget(tmodel, key);
                }
            }
            
        } else {
            needsRefire = TUtil.handleValueChange(tmodel, key); 

            if (target?.activateNextTarget && !target.activateNextTarget.endsWith('$$') && target.activateNextTarget.endsWith('$')) {
                needsRefire = true;   
                TargetUtil.shouldActivateNextTarget(tmodel, key); 
            }
        }
        
        return needsRefire;
    }

    fireOnEnd(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        
        if (!targetValue) {
            return;
        }
        const theValue = tmodel.getTargetValue(key);
        const steps = tmodel.getTargetSteps(key);
        tmodel.setLastUpdate(key);  
        
        const originalTargetName = targetValue.originalTargetName;
        let originalTarget = tmodel.targets[originalTargetName];
        let originalTModel = tmodel;

        if (!originalTarget && originalTargetName) {
            originalTModel = this.findOriginalTModel(tmodel, originalTargetName);
            originalTarget = originalTModel ? originalTModel.targets[originalTargetName] : null;
        }

        const newStatus = this.calculateTargetStatus(tmodel, targetValue, key);
        tmodel.setTargetStatus(key, newStatus); 
        
        if (tmodel.isTargetImperative(key)) { 
            const capKey = TargetUtil.getTargetName(TUtil.capitalizeFirstLetter(key));
            
            if (originalTarget && typeof originalTarget[`on${capKey}End`] === "function") {
                originalTarget[`on${capKey}End`].call(originalTModel, originalTModel.val(key), theValue, steps, steps);
                originalTModel.setTargetMethodName(originalTargetName, [`on${capKey}End`]);
            } else if (originalTarget && typeof originalTarget.onImperativeEnd === "function") {
                originalTarget.onImperativeEnd.call(originalTModel, key, originalTModel.val(key));
                originalTModel.setTargetMethodName(originalTargetName, "onImperativeEnd");
            }
        } else {
            if (!targetValue.valueList && tmodel.getTargetCycle(key) < tmodel.getTargetCycles(key)) {
                tmodel.incrementTargetCycle(key, tmodel.getTargetCycle(key));
                tmodel.resetTargetStep(key);
                tmodel.resetTargetInitialValue(key);
                tmodel.resetTargetExecutionFlag(key);
                TargetExecutor.executeDeclarativeTarget(tmodel, key);
            }

            if (typeof tmodel.targets[key]?.onStepsEnd === "function") {
                tmodel.targets[key].onStepsEnd.call(tmodel, tmodel.getTargetCycle(key));
                tmodel.setTargetMethodName(key, "onStepsEnd");
            }
        }
        
        TargetUtil.shouldActivateNextTarget(tmodel, key);
    }
    
    
    calculateTargetStatus(tmodel, targetValue, key) {

        const cycle = tmodel.getTargetCycle(key);
        const cycles = tmodel.getTargetCycles(key);
        
        if (Array.isArray(targetValue.valueList) && cycle < targetValue.valueList.length - 1) {
            return 'updating';
        } else if (tmodel.isTargetInLoop(key) || cycle < cycles) {
            return 'active';           
        } else {
            return 'done';
        }
    }    

    
    handleWebAnimationAPI(tmodel, cleanKey, key, targetValue, from, to, steps, interval) { 
        const batch = (tmodel.waapiBatch ||= {
            frames: [],
            easing: undefined,            
            keyMap: {},
            totalDuration: 0
        });

        const isTransform = TargetData.isTransformKey(cleanKey);
        
        const getFrameAtTime = (t) => {
            for (let i = 0; i < batch.frames.length; i++) {
                const frame = batch.frames[i];
                if (Math.abs(frame.keyTime - t) < 0.0001) {
                    return frame;
                }
            }
            const frame = { keyTime: t, tfMap: {}, styleMap: {}, keyMeta: new Map() };
            batch.frames.push(frame);
            return frame;
        };

        let keyDuration = 0;

        if (targetValue.valueList && targetValue.valueList.length) {
            const valueList = targetValue.valueList;
            const stepList = targetValue.stepList || [1];
            const intervalList = targetValue.intervalList;
            const step = targetValue.step;
                                                                      
            const frame = getFrameAtTime(0);
            if (isTransform) {
                frame.tfMap[cleanKey] = step > 0 && TUtil.isDefined(tmodel.val(key)) ? tmodel.val(key) : valueList[0];
                tmodel.val(key, frame.tfMap[cleanKey]);
            } else {
                frame.styleMap[cleanKey] = valueList[0];
                tmodel.val(key, frame.styleMap[cleanKey]);
            }            

            for (let i = 1; i < valueList.length; i++) {
                const stepValue = stepList[(i - 1) % stepList.length];
                const intervalValue = intervalList[(i - 1) % intervalList.length];
                const duration = stepValue * intervalValue;
                
                keyDuration += duration;
                
                const frame = getFrameAtTime(keyDuration);
                if (isTransform) {
                    frame.tfMap[cleanKey] = valueList[i];
                } else {
                    frame.styleMap[cleanKey] = valueList[i];
                }
                
                frame.keyMeta.set(cleanKey, { steps: stepValue, interval: intervalValue });
            }

            targetValue.cycle = valueList.length - 1;
        } else {
            interval = interval || 8;
            keyDuration = steps * interval;
                        
            const frame0 = getFrameAtTime(0);
            const frame1 = getFrameAtTime(keyDuration);

            if (isTransform) {
                frame0.tfMap[cleanKey] = from;
                frame1.tfMap[cleanKey] = to;
            } else {
                frame0.styleMap[cleanKey] = from;
                frame1.styleMap[cleanKey] = to;
            }
            
            tmodel.val(key, from);
            frame1.keyMeta.set(cleanKey, { steps: steps, interval: interval });
        }

        if (tmodel.getTargetEasing(key)) {
            batch.easing = tmodel.getTargetEasing(key);
        }

        batch.totalDuration = Math.max(batch.totalDuration, keyDuration);

        (batch.keyMap[cleanKey] ||= new Set()).add(key);

        tmodel.removeFromUpdatingTargets(key);
    }

    setActualValue(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        if (!targetValue) {
            return;
        }

        if (!tmodel.isTargetImperative(key) && !tmodel.isTargetEnabled(key)) {
            getRunScheduler().schedule(15, `setActualValue-postpone-${tmodel.oid}__${key}`);
            return;
        }

        const theValue = tmodel.getTargetValue(key);
        const cleanKey = TargetUtil.getTargetName(key);
        let step = tmodel.getTargetStep(key);
        const steps = tmodel.getTargetSteps(key);
        let cycle = tmodel.getTargetCycle(key);
        const interval = tmodel.getTargetInterval(key);
        let initialValue = tmodel.getTargetInitialValue(key);
            
        const lastUpdateTime = tmodel.getLastUpdate(key);
        const now = TUtil.now();

        
        if (!TUtil.isDefined(initialValue)) {
            initialValue = TUtil.isDefined(tmodel.val(key)) ? tmodel.val(key) : typeof theValue === 'number' ? 0 : undefined;
            tmodel.setTargetInitialValue(key, initialValue);
        }
        
        if (tmodel.canBeAnimated(cleanKey)) {
            if (tmodel.hasDom()) {
                this.handleWebAnimationAPI(tmodel, cleanKey, key, targetValue, initialValue, theValue, steps, interval);
            }
            return;
        }

        if (step <= steps) {
            
            tmodel.incrementTargetStep(key, now, lastUpdateTime, interval, steps);

            const newValue = TModelUtil.easingMorph(tmodel, key, initialValue, theValue, step, steps);
            tmodel.val(key, newValue);
            tmodel.setActual(key, newValue);
            tmodel.addToStyleTargetList(key);

            this.fireOnStep(tmodel, key, step);

            if (tmodel.getTargetStep(key) < steps) {
                getRunScheduler().scheduleOnlyIfEarlier(interval, `${tmodel.oid}---${key}-${step}/${steps}-${cycle}-${interval}`);
                return;
            }
        }

        tmodel.val(key, theValue);
        tmodel.setActual(key, theValue);
        tmodel.addToStyleTargetList(key);
        targetValue.step = steps;
        tmodel.setLastUpdate(key);
        step = steps;
                    
        let scheduleTime = 1;

        if (targetValue.valueList && cycle < targetValue.valueList.length - 1) {
            tmodel.incrementTargetCycle(key, tmodel.getTargetCycle(key));
            cycle = tmodel.getTargetCycle(key);
            tmodel.resetTargetStep(key);
            targetValue.initialValue = targetValue.value;
            targetValue.value = targetValue.valueList[cycle];
            targetValue.steps = targetValue.stepList[(cycle - 1) % targetValue.stepList.length];
            targetValue.interval = Array.isArray(targetValue.intervalList) ? targetValue.intervalList[(cycle - 1) % targetValue.intervalList.length] : 0;
            targetValue.easing = targetValue.easingList[(cycle - 1) % targetValue.easingList.length];
            scheduleTime = interval;
        } else {
            this.fireOnEnd(tmodel, key);        
        }

        getRunScheduler().scheduleOnlyIfEarlier(scheduleTime, `${tmodel.oid}---${key}-${step}/${steps}-${cycle}-${scheduleTime}`);
    }
}

export { TargetManager };
