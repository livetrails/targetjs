// TargetManager.js
import { TargetExecutor } from "./TargetExecutor.js";
import { getRunScheduler, getAnimationManager, getVisibles } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { SearchUtil } from "./SearchUtil.js";
import { ScheduleUtil } from "./ScheduleUtil.js";
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
        
        if (ScheduleUtil.shouldPauseTarget(tmodel, key)) {
            return;
        }
        
        if (tmodel.isExecuted(key) && tmodel.hasUpdatingImperativeTargets(key)) {
            return;
        }

        if (tmodel.isExecuted(key) && tmodel.getTargetStep(key) === tmodel.getTargetSteps(key)) { 
            if (tmodel.isScheduledPending(key)) {
                return;
            }
            const schedulePeriod = ScheduleUtil.scheduleExecution(tmodel, key);          
            if (schedulePeriod > 0) {
                getRunScheduler().schedule(schedulePeriod, `targetSchedule__${tmodel.oid}`);
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
        
        if (!TUtil.isDefined(target.fetchAction)) {
            TargetUtil.shouldActivateNextTarget(tmodel, key); 
        }
    }

    setActualValues(tmodel, updatingList) {
        if (!updatingList.length) { 
            return;
        }
        
        updatingList = updatingList.slice(0);

        let schedulePeriod = 0;

        for (const key of updatingList) {
            if (ScheduleUtil.shouldPauseTarget(tmodel, key)) {
                continue;
            }

            schedulePeriod = ScheduleUtil.scheduleExecution(tmodel, key);
            
            if (schedulePeriod > 0) {  
                getRunScheduler().schedule(schedulePeriod, `setActualValues-${tmodel.oid}`);
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

        const newStatus = this.calculateTargetStatus(tmodel, key);
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
            if (tmodel.getTargetCycle(key) < tmodel.getTargetCycles(key) - 1) {
                tmodel.incrementTargetCycle(key);
                tmodel.resetTargetStep(key);
                tmodel.resetTargetInitialValue(key);
                delete targetValue.valuePointer;
            }
        } else {
            if (tmodel.getTargetCycle(key) < tmodel.getTargetCycles(key) - 1) {
                tmodel.incrementTargetCycle(key);
                tmodel.resetTargetStep(key);
                tmodel.resetTargetInitialValue(key);
                tmodel.resetTargetExecutionFlag(key);
                delete targetValue.valuePointer;
                TargetExecutor.executeDeclarativeTarget(tmodel, key);
            }

            if (typeof tmodel.targets[key]?.onStepsEnd === "function") {
                tmodel.targets[key].onStepsEnd.call(tmodel, tmodel.getTargetCycle(key));
                tmodel.setTargetMethodName(key, "onStepsEnd");
            }
        }

        TargetUtil.shouldActivateNextTarget(tmodel, key);
    }
    
        
    calculateTargetStatus(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        
        if (!targetValue) {
            return;
        }
        
        const valuePointer = tmodel.getValueListPointer(key);
        const cycle = tmodel.getTargetCycle(key);
        const cycles = tmodel.getTargetCycles(key);
        
        if (Array.isArray(targetValue.valueList) && valuePointer < targetValue.valueList.length) {
            return 'updating';
        } else if (tmodel.isTargetImperative(key) && cycle < cycles - 1) { 
            return 'updating';
        } else if (tmodel.isTargetInLoop(key) || cycle < cycles - 1) {
            return 'active';           
        } else {
            return 'done';
        }
    }    

    catchupTargetByElapsed(tmodel, key, { fireEnd = false } = {}) {
        const targetValue = tmodel.targetValues[key];

        if (!targetValue) {
            return { done: false };
        }

        const progress = TUtil.advanceTargetByElapsed(tmodel, key);
        const step = progress.step;
        const valuePointer = progress.valuePointer;
        const cycle = progress.cycle;
        
        const theValue = tmodel.getTargetValue(key);
        const steps = tmodel.getTargetSteps(key);
        const cycles = tmodel.getTargetCycles(key);

        if (progress.done) {          
            const finalValue = targetValue.valueList?.length ? targetValue.valueList[targetValue.valueList.length - 1] : theValue;

            tmodel.val(key, finalValue);
            tmodel.setActual(key, finalValue);
            tmodel.addToStyleTargetList(key);

            targetValue.step = steps;
            targetValue.valuePointer = targetValue.valueList?.length ?? valuePointer;
            targetValue.value = finalValue;
            targetValue.cycle = cycles;

            delete targetValue.catchupAt;

            if (fireEnd) {
                this.fireOnEnd(tmodel, key);
            }

            return {
                done: true,
                step: steps,
                cycle: cycles,
                valuePointer: targetValue.valuePointer
            };
        }

        let initialValue = tmodel.getTargetInitialValue(key);

        if (!TUtil.isDefined(initialValue)) {
            initialValue = this.resolveInitialValue(tmodel, key, theValue);
            tmodel.setTargetInitialValue(key, initialValue);
        }

        const value = step > 0
            ? TModelUtil.easingMorph(tmodel, key, initialValue, theValue, step, steps)
            : initialValue;
                
        tmodel.val(key, value);
        tmodel.setActual(key, value);
        tmodel.addToStyleTargetList(key);

        targetValue.step = step;
        targetValue.valuePointer = valuePointer;
        targetValue.cycle = cycle;
        
        return {
            done: false,
            step,
            cycle,
            valuePointer
        };
    }

    setActualValue(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        if (!targetValue) {
            return;
        }

        if (!this.canUpdateTarget(tmodel, key)) {
            return;
        }
       
        const state = this.getTargetUpdateState(tmodel, key);

        if (!TUtil.isDefined(state.initialValue)) {
            state.initialValue = this.resolveInitialValue(tmodel, key, state.theValue);
            tmodel.setTargetInitialValue(key, state.initialValue);
        }

        const catchup = this.catchupTargetByElapsed(tmodel, key, { fireEnd: true });

        if (catchup.done) {
            getRunScheduler().scheduleOnlyIfEarlier(1, `${tmodel.oid}---${key}-catchup-finished`);
            return;
        }

        const step = catchup.step ?? 0;
        const valuePointer = catchup.valuePointer ?? tmodel.getValueListPointer(key);

        if (tmodel.canBeAnimated(state.cleanKey)) {
            this.animateActualValue(tmodel, key, targetValue, state, step, valuePointer);
        } else {
            this.updateActualValue(tmodel, key, targetValue, state, step, valuePointer);
        }
    }

    canUpdateTarget(tmodel, key) {
        if (!tmodel.isTargetImperative(key) && !tmodel.isTargetEnabled(key)) {
            getRunScheduler().schedule(15, `setActualValue-postpone-${tmodel.oid}`);
            return false;
        }

        return true;
    }

    getTargetUpdateState(tmodel, key) {
        return {
            theValue: tmodel.getTargetValue(key),
            cleanKey: TargetUtil.getTargetName(key),
            steps: tmodel.getTargetSteps(key),
            cycle: tmodel.getTargetCycle(key),
            interval: tmodel.getTargetInterval(key),
            initialValue: tmodel.getTargetInitialValue(key),
            lastUpdateTime: tmodel.getLastUpdate(key),
            now: TUtil.now()
        };
    }

    resolveInitialValue(tmodel, key, theValue) {
        if (TUtil.isDefined(tmodel.val(key))) {
            return tmodel.val(key);
        }

        if (typeof theValue === 'number') {
            return 0;
        }

        return undefined;
    }

    animateActualValue(tmodel, key, targetValue, state, step, valuePointer) {
        if (!tmodel.hasDom()) {
            return;
        }

        const newValue = step > 0 ? TModelUtil.easingMorph(tmodel, key, state.initialValue, state.theValue, step, state.steps) : state.initialValue;

        const cycles = tmodel.isTargetImperative(key) ? tmodel.getTargetCycles(key) : 0;

        const cycleDuration = AnimationUtil.handleWebAnimationAPI(tmodel, state.cleanKey, key, targetValue, newValue, state.theValue, valuePointer, 
                step, state.steps, state.interval, 0);

        for (let c = 1; c < cycles; c++) {
            AnimationUtil.handleWebAnimationAPI(tmodel, state.cleanKey, key, targetValue, newValue, state.theValue, valuePointer, 
                step, state.steps, state.interval, c * cycleDuration, true);
        }
    }  
    
    updateActualValue(tmodel, key, targetValue, state, step, valuePointer) {
        if (step <= state.steps) {
            tmodel.incrementTargetStep(key, state.now, state.lastUpdateTime, state.interval, state.steps);
            const newValue = TModelUtil.easingMorph(tmodel, key, state.initialValue, state.theValue, step, state.steps );
            tmodel.val(key, newValue);
            tmodel.setActual(key, newValue);
            tmodel.addToStyleTargetList(key);

            this.fireOnStep(tmodel, key, step);

            if (tmodel.getTargetStep(key) < state.steps) {
                getRunScheduler().scheduleOnlyIfEarlier(state.interval, `${tmodel.oid}---${key}-${step}/${state.steps}-${state.cycle}-${state.interval}` );
                return;
            }
        }

        this.finishCurrentSegment(tmodel, key, targetValue, state, valuePointer);
    }
    
    finishCurrentSegment(tmodel, key, targetValue, state, valuePointer) {
        tmodel.val(key, state.theValue);
        tmodel.setActual(key, state.theValue);
        tmodel.addToStyleTargetList(key);

        targetValue.step = state.steps;
        tmodel.setLastUpdate(key);

        let scheduleTime = 1;

        if (targetValue.valueList && valuePointer < targetValue.valueList.length) {
            tmodel.incrementValueListPointer(key);
            const nextPointer = tmodel.getValueListPointer(key);
            tmodel.resetTargetStep(key);
            targetValue.initialValue = targetValue.value;
            targetValue.value = targetValue.valueList[nextPointer];
            targetValue.steps = targetValue.stepList[(nextPointer - 1) % targetValue.stepList.length];
            targetValue.interval = Array.isArray(targetValue.intervalList) ? targetValue.intervalList[(nextPointer - 1) % targetValue.intervalList.length] : 0;
            targetValue.easing = targetValue.easingList[(nextPointer - 1) % targetValue.easingList.length];
            scheduleTime = state.interval;
        } else {
            this.fireOnEnd(tmodel, key);
        }

        getRunScheduler().scheduleOnlyIfEarlier(scheduleTime, `${tmodel.oid}---${key}-${state.steps}/${state.steps}-${state.cycle}-${scheduleTime}`);
    }    
}

export { TargetManager };
