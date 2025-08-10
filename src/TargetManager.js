import { TargetExecutor } from "./TargetExecutor.js";
import { getRunScheduler, getVisibles } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { SearchUtil } from "./SearchUtil.js";

/**
 * It is responsible for managing target execution and cycles, as well as updating actual values toward target values.
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
            const schedulePeriod = TargetUtil.scheduleExecution(tmodel, key);
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

        if (tmodel.shouldExecuteCyclesInParallel(key)) {
            let cycles = 0;
            if (tmodel.isExecuted(key)) {
                cycles = tmodel.getTargetCycles(key);
            } else {
                cycles = typeof target.cycles === 'function' ? target.cycles.call(tmodel, 0) : target.cycles || 0;
            }

            const promises = [];
            for (let cycle = 0; cycle <= cycles; cycle++) {
                promises.push(
                    new Promise(resolve => {
                        TargetExecutor.executeDeclarativeTarget(tmodel, key, cycle);
                        resolve();
                    })
                );
            }
            
            Promise.all(promises).then(() => {
                tmodel.targetValues[key].cycle = cycles;
                tmodel.updateTargetStatus(key);
                if (tmodel.shouldScheduleRun(key)) {
                    getRunScheduler().schedule(tmodel.getTargetInterval(key), `targetSchedule__${tmodel.oid}__${key}_rerun`);
                }            
            });
        } else {        
            TargetExecutor.prepareTarget(tmodel, key);
            TargetExecutor.executeDeclarativeTarget(tmodel, key);       
        }
    }
    
    setActualValues(tmodel, updatingList = tmodel.updatingTargetList.slice(0)) {
        let schedulePeriod = 0;
        
        for (const key of updatingList) {
            const lastScheduledTime = tmodel.getScheduleTimeStamp(key); 
            const interval = tmodel.getTargetInterval(key);
            
            if (lastScheduledTime && lastScheduledTime + interval > TUtil.now()) {
                const nextRun = getRunScheduler().nextRuns.length > 0 ? getRunScheduler().nextRuns[0] : undefined;
                if (nextRun && nextRun.delay + nextRun.insertTime < lastScheduledTime + interval) {                
                    continue;
                }
            }  
                        
            if (TargetUtil.isTargetAlreadyUpdating(tmodel, key)) {
                tmodel.updateTargetStatus(key);
                continue;
            }

            schedulePeriod = TargetUtil.scheduleExecution(tmodel, key);

            if (schedulePeriod > 0) {
                getRunScheduler().schedule(schedulePeriod, `setActualValues-${tmodel.oid}__${key}_${schedulePeriod}`);  
            } else {
                tmodel.resetScheduleTimeStamp(key);
                this.setActualValue(tmodel, key);                
            }
        }
    }
    
    findOriginalTModel(tmodel, originalTargetName) {
        return SearchUtil.findParentByTarget(tmodel, originalTargetName) 
            || getVisibles().find(tmodel => tmodel.targets[originalTargetName]);
    }

    setActualValue(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        
        if (!targetValue) {
            return;
        }

        if (!tmodel.isTargetImperative(key) && !tmodel.isTargetEnabled(key)) {
            getRunScheduler().schedule(10, `setActualValue-disabled-${tmodel.oid}__${key}`);
            return;
        }

        let theValue = tmodel.getTargetValue(key);
        let step = tmodel.getTargetStep(key);
        const steps = tmodel.getTargetSteps(key);
        let cycle = tmodel.getTargetCycle(key);
        const interval = tmodel.getTargetInterval(key);
        const oldValue = tmodel.val(key);
        const oldStep = step;
        const oldCycle = cycle;
        let initialValue = tmodel.getTargetInitialValue(key);
        let originalTargetName, originalTarget, originalTModel;
        const capKey = TUtil.capitalizeFirstLetter(key);
        const lastUpdateTime = tmodel.getActualValueLastUpdate(key);
        const now = TUtil.now();
        
        if (step <= steps) {
            if (!TUtil.isDefined(initialValue)) {
                initialValue = TUtil.isDefined(tmodel.val(key)) ? tmodel.val(key) : typeof theValue === 'number' ? 0 : undefined;
                tmodel.setTargetInitialValue(key, initialValue);
            }
            
            const newValue = TModelUtil.morph(tmodel, key, initialValue, theValue, step, steps);

            tmodel.val(key, newValue);
            targetValue.actual = newValue;
            
            tmodel.addToStyleTargetList(key);

            tmodel.setActualValueLastUpdate(key);
            
            tmodel.setTargetMethodName(key, 'value');        

            if (tmodel.isTargetImperative(key)) {
                originalTargetName = targetValue.originalTargetName;
                originalTarget = tmodel.targets[targetValue.originalTargetName];
                originalTModel = tmodel;
                if (!originalTarget) {
                    originalTModel = this.findOriginalTModel(tmodel, originalTargetName);
                    originalTarget = originalTModel ? originalTModel.targets[targetValue.originalTargetName] : null;
                }
                
                if (originalTarget && typeof originalTarget[`on${capKey}Step`] === 'function') {
                    originalTarget[`on${capKey}Step`].call(originalTModel, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, [`on${capKey}Step`]);
                } else if (originalTarget && typeof originalTarget.onImperativeStep === 'function') {
                    originalTarget.onImperativeStep.call(originalTModel, key, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, 'onImperativeStep');
                }
                
            } else {
                TargetUtil.handleValueChange(tmodel, key, tmodel.val(key), oldValue, oldStep, oldCycle);
            }

            tmodel.incrementTargetStep(key, now, lastUpdateTime, interval, steps);

            tmodel.updateTargetStatus(key);
                     
            if (tmodel.getTargetStep(key) < steps) {  
                TargetUtil.shouldActivateNextTarget(tmodel, key);
                getRunScheduler().scheduleOnlyIfEarlier(interval, `${tmodel.oid}---${key}-${step}/${steps}-${cycle}-${interval}`);
                return;
            }
        }

        tmodel.val(key, theValue);
        targetValue.actual = theValue;
        tmodel.addToStyleTargetList(key);
        
        tmodel.setActualValueLastUpdate(key);
        step = tmodel.getTargetStep(key);

        let scheduleTime = 1;

        if (targetValue.valueList && cycle < targetValue.valueList.length - 1) {
            tmodel.incrementTargetCycle(key, tmodel.getTargetCycle(key));
            cycle = tmodel.getTargetCycle(key);
            tmodel.resetTargetStep(key);
            targetValue.initialValue = targetValue.value;
            targetValue.value = targetValue.valueList[cycle];
            targetValue.steps = targetValue.stepList[(cycle - 1) % targetValue.stepList.length];
            targetValue.interval = targetValue.intervalList[(cycle - 1) % targetValue.intervalList.length];
            targetValue.easing = targetValue.easingList[(cycle - 1) % targetValue.easingList.length];
            scheduleTime = interval;
        } else {
            if (tmodel.isTargetImperative(key)) {
                originalTargetName = targetValue.originalTargetName;
                originalTarget = tmodel.targets[targetValue.originalTargetName];
                originalTModel = tmodel;
                if (!originalTarget) {
                    originalTModel = this.findOriginalTModel(tmodel, originalTargetName);
                    originalTarget = originalTModel ? originalTModel.targets[targetValue.originalTargetName] : null;
                }
                
                if (originalTarget && typeof originalTarget[`on${capKey}Step`] === 'function') {
                    originalTarget[`on${capKey}Step`].call(originalTModel, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, [`on${capKey}Step`]);
                } else if (originalTarget && typeof originalTarget.onImperativeStep === 'function') {
                    originalTarget.onImperativeStep.call(originalTModel, key, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, 'onImperativeStep');
                }
                
                if (originalTarget && typeof originalTarget[`on${capKey}End`] === 'function') {
                    originalTarget[`on${capKey}End`].call(originalTModel, originalTModel.val(key), theValue, step, steps);
                    originalTModel.setTargetMethodName(originalTargetName, [`on${capKey}End`]);
                } else if (originalTarget && typeof originalTarget.onImperativeEnd === 'function') {
                    originalTarget.onImperativeEnd.call(originalTModel, key, originalTModel.val(key));
                    originalTModel.setTargetMethodName(originalTargetName, 'onImperativeEnd');
                }
                
            } else {
                if (!targetValue.valueList && tmodel.getTargetCycle(key) < tmodel.getTargetCycles(key)) {
                    tmodel.incrementTargetCycle(key, tmodel.getTargetCycle(key));
                    tmodel.resetTargetStep(key).resetTargetInitialValue(key).resetTargetExecutionFlag(key);
                    
                    TargetExecutor.executeDeclarativeTarget(tmodel, key);
                }

                if (typeof tmodel.targets[key] === 'object' && typeof tmodel.targets[key].onStepsEnd === 'function') {
                    tmodel.targets[key].onStepsEnd.call(tmodel, cycle);
                    tmodel.setTargetMethodName(key, 'onStepsEnd');
                }
            }
        }
        
        tmodel.updateTargetStatus(key);
        
        TargetUtil.cleanupTarget(tmodel, key);

        TargetUtil.shouldActivateNextTarget(tmodel, key); 

        getRunScheduler().scheduleOnlyIfEarlier(scheduleTime, `${tmodel.oid}---${key}-${step}/${steps}-${cycle}-${scheduleTime}`);
    }
}

export { TargetManager };
