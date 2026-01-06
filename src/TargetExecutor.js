import { TargetUtil } from "./TargetUtil.js";
import { TargetParser } from "./TargetParser.js";
import { TargetData } from "./TargetData.js";
import { TModel } from "./TModel.js";
import { TUtil } from "./TUtil.js";
import { AnimationUtil } from "./AnimationUtil.js"; 
import { Easing } from "./Easing.js";
import { getLoader, getRunScheduler, getAnimationManager } from "./App.js";

/**
 * It is responsible for executing both declarative and imperative targets.
 */
class TargetExecutor {
    
    static prepareTarget(tmodel, key) {
        TargetUtil.currentTargetName = key;
        TargetUtil.currentTModel = tmodel;
        
        if (tmodel.isExecuted(key) && tmodel.getTargetCycles(key) > 0) {

            if (tmodel.getTargetCycle(key) < tmodel.getTargetCycles(key)) {
                tmodel.incrementTargetCycle(key, tmodel.getTargetCycle(key));
            } else {
                tmodel.resetTargetCycle(key);
            }
            tmodel.resetTargetStep(key);
            tmodel.resetTargetInitialValue(key);       
        }
    }
    
    static executeDeclarativeTarget(tmodel, key) { 
        const cleanKey = TargetUtil.getTargetName(key);
        tmodel.allTargetMap[cleanKey] = key;        
        TargetExecutor.resolveTargetValue(tmodel, key);
        TargetExecutor.updateTarget(tmodel, tmodel.targetValues[key], key, false);
        
        if (tmodel.isTargetDone(key)) {
            TargetUtil.shouldActivateNextTarget(tmodel, key); 
        }
    }
    
    static assignImperativeTargetValue(tmodel, key, originalTargetName, originalTModel) {
        tmodel.targetValues[key] = tmodel.targetValues[key] || TargetUtil.emptyValue();
        const targetValue = tmodel.targetValues[key];
        
        targetValue.isImperative = true;
        targetValue.originalTargetName = originalTargetName;
        targetValue.originalTModel = originalTModel;
          
        const isAnimating = tmodel.animatingMap?.has(key);

        if (isAnimating && tmodel.getTargetSteps(key) > 0) {
            getAnimationManager().cancelKey(tmodel, key);
        }        
        
        return targetValue;
    }

    static executeImperativeTarget(tmodel, key, value, steps, interval, easing, originalTargetName, originalTModel) {
        let targetValue;
        
        if (typeof key === 'string') {
            const cleanKey = TargetUtil.getTargetName(key);
            key = !key.endsWith('+') ? key + "+" : key;
            tmodel.allTargetMap[cleanKey] = key;
        }
        
        if (TargetParser.isListTarget(value)) {
            const vSteps = TUtil.isDefined(value.steps) ? value.steps : steps;
            const vInterval = TUtil.isDefined(value.interval) ? value.interval : interval;
            const vEasing = TUtil.isDefined(value.easing) ? value.easing : easing;            
            
            targetValue = TargetExecutor.assignImperativeTargetValue(tmodel, key, originalTargetName, originalTModel);
            TargetExecutor.assignListTarget(tmodel, key, targetValue, value.list, value.list[0], vSteps, vInterval, vEasing);
        } else if (TargetParser.isTargetSpecObject(value)) {


            const valueArray = TargetParser.getValueStepsCycles(tmodel, value, key);
            let newValue    = valueArray[0];
            let newSteps    = valueArray[1];
            let newInterval = valueArray[2];
            let newEasing   = valueArray[3];

            steps    = TUtil.isDefined(newSteps) ? newSteps : steps;
            interval = TUtil.isDefined(newInterval) ? newInterval : interval;
            easing   = TUtil.isDefined(newEasing) ? newEasing : easing;

            TargetExecutor.executeImperativeTarget(tmodel, key, newValue, steps, interval, easing, originalTargetName, originalTModel);
            return;            
            
        } else if (TargetParser.isObjectTarget(key, value)) {
            const completeValue = TargetData.cssFunctionMap[key] ? { ...TargetData.cssFunctionMap[key], ...value } : value; 
            Object.keys(completeValue).forEach(objectKey => {
                let newValue = completeValue[objectKey];
                let newSteps = steps;
                let newInterval = interval;
                let newEasing = easing;
                
                if (typeof newValue === 'object'  && !TargetParser.isListTarget(newValue)) {
                    const valueArray = TargetParser.getValueStepsCycles(tmodel, completeValue[objectKey], objectKey);
                    newValue = valueArray[0];
                    newSteps = TUtil.isDefined(valueArray[1]) ? valueArray[1] : steps;
                    newInterval = TUtil.isDefined(valueArray[2]) ? valueArray[2] : interval;
                    newEasing   = TUtil.isDefined(valueArray[3]) ? valueArray[3] : easing;
                }

                TargetExecutor.executeImperativeTarget(tmodel, objectKey, newValue, newSteps, newInterval, newEasing, originalTargetName, originalTModel);
            });
        } else {
            if (typeof value === 'object' && !TargetParser.isListTarget(value)) {
                const valueArray = TargetParser.getValueStepsCycles(tmodel, value, key);
                if (value !== valueArray[0]) {
                    value    = valueArray[0];
                    steps    = TUtil.isDefined(valueArray[1]) ? valueArray[1] : steps;
                    interval = TUtil.isDefined(valueArray[2]) ? valueArray[2] : interval;
                    easing   = TUtil.isDefined(valueArray[3]) ? valueArray[3] : easing;
                    TargetExecutor.executeImperativeTarget(tmodel, key, value, steps, interval, easing, originalTargetName, originalTModel);
                } else {
                    targetValue = TargetExecutor.assignImperativeTargetValue(tmodel, key, originalTargetName, originalTModel);
                    TargetExecutor.assignSingleTarget(targetValue, value, undefined, steps, 0, interval, easing);
                    targetValue.step = 0;                    
                }
            } else {
                targetValue = TargetExecutor.assignImperativeTargetValue(tmodel, key, originalTargetName, originalTModel);
                TargetExecutor.assignSingleTarget(targetValue, value, undefined, steps, 0, interval, easing);
                targetValue.step = 0;
            }
        }

        if (targetValue) {
            TargetExecutor.updateTarget(tmodel, targetValue, key, true);
            if (tmodel.isTargetDone(key)) {
                TargetUtil.shouldActivateNextTarget(tmodel, key); 
            }
        }
    }

    static updateTarget(tmodel, targetValue, key, enforce) {
         
         tmodel.setLastUpdate(key);

        if (tmodel.getTargetSteps(key) === 0) {
            TargetExecutor.snapActualToTarget(tmodel, key);
        }
        
        targetValue.executionFlag = true;
        targetValue.executionCount++,

        tmodel.addToStyleTargetList(key, enforce);
        tmodel.setTargetMethodName(key, 'value'); 

        const newStatus = TargetExecutor.calculateTargetStatus(tmodel, targetValue, key);
        
        tmodel.setTargetStatus(key, newStatus);
        
        if (!TargetData.ignoreRerun[key] && tmodel.shouldScheduleRun(key)) {
            getRunScheduler().schedule(30, 'updateTarget2-' + tmodel.oid + "-" + key);
        }
    }
    
    static calculateTargetStatus(tmodel, targetValue, key) {

        const cycle = tmodel.getTargetCycle(key);
        const cycles = tmodel.getTargetCycles(key);
        const step = tmodel.getTargetStep(key);
        const steps = tmodel.getTargetSteps(key);
        
        if (targetValue.snapAnimation) {
            return 'done';
        } else if (step < steps) {
            return 'updating';
        } else if (Array.isArray(targetValue.valueList) && cycle < targetValue.valueList.length - 1) {
            return 'updating'; 
       } else if (tmodel.isTargetInLoop(key) || cycle < cycles) {
            return 'active'; 
        } else if (tmodel.targets[key]?.fetchAction && !getLoader().isLoadingSuccessful(tmodel, key)) {
            return 'fetching';            
        } else {
            return 'done';
        }
    }

    static assignListTarget(tmodel, key, targetValue, valueList, initialValue, steps, interval, easing) {
        targetValue.valueList = valueList;
        
        targetValue.stepList = Array.isArray(steps) ? steps : (TUtil.isDefined(steps) && steps > 0 ? [steps] : [1]);
        targetValue.intervalList = Array.isArray(interval) ? interval : (TUtil.isDefined(interval) ? [interval || 8] : [8]);
        targetValue.easingList = Array.isArray(easing) ? easing : (TUtil.isDefined(easing) ? [easing] : [Easing.LINEAR]);

        targetValue.cycle = 1;
        targetValue.value = valueList[1];
        targetValue.initialValue = initialValue;
        targetValue.steps = targetValue.stepList[0];
        targetValue.interval = targetValue.intervalList[0];
        targetValue.easing = targetValue.easingList[0];

        targetValue.step = 0;
        targetValue.cycles = 0;
        targetValue.snapAnimation = false;

        tmodel.val(key, initialValue);
        tmodel.setActual(key, initialValue);
    }

    static assignSingleTarget(targetValue, value, initialValue, steps, cycles, interval, easing) {
        delete targetValue.valueList;
        delete targetValue.stepList;
        delete targetValue.intervalList;
        delete targetValue.easingList;

        targetValue.initialValue = initialValue;
        targetValue.lastValue = targetValue.value;
        targetValue.value = value;
        targetValue.steps = steps || 0;
        targetValue.cycles = cycles || 0;
        targetValue.interval = interval || 0;
        targetValue.easing = easing;
        targetValue.snapAnimation = false;        
    }

    static snapActualToTarget(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        const value = targetValue.value;
        const newValue = typeof value === 'function' ? value.call(tmodel) : value;

        if (tmodel.val(key) === newValue) {
            return;
        }

        if (!tmodel.hasValidAnimation() || !tmodel.canBeAnimated(key)) {
            tmodel.val(key, newValue);
            tmodel.setActual(key, newValue);
            TargetUtil.handleValueChange(tmodel, key);
            return;
        }

        AnimationUtil.overrideAnimatedKeyWithSnap(tmodel, key, newValue);
    }

    static resolveTargetValue(tmodel, key, cycle = tmodel.getTargetCycle(key)) {
        const targetInitial = !tmodel.targetValues[key] && TUtil.isDefined(tmodel.targets[key].initialValue)
            ? tmodel.targets[key].initialValue
            : undefined;

        const valueArray = TargetParser.getValueStepsCycles(tmodel, tmodel.targets[key], key, cycle);

        const newValue    = valueArray[0];
        const newSteps    = valueArray[1] || 0;
        const newInterval = valueArray[2] || 0;     
        const newEasing   = valueArray[3];
        const newCycles   = valueArray[4] || 0;
        
        const targetValue = tmodel.targetValues[key] || TargetUtil.emptyValue();

        tmodel.targetValues[key] = targetValue;
        const easing = TUtil.isDefined(newEasing) ? newEasing : (TUtil.isDefined(tmodel.targets[key].easing) ? tmodel.targets[key].easing : undefined);

        if (TargetParser.isIntervalTarget(newValue)) {
            TargetExecutor.assignSingleTarget(
                targetValue, 
                undefined,
                undefined, 
                0, 
                1,
                newValue.interval,
                easing
            );
        } else if (TargetParser.isChildTarget(key, newValue)) {
                        
            tmodel.addChild(newValue);

            TargetExecutor.assignSingleTarget(
                targetValue, 
                newValue,
                undefined, 
                0, 
                newCycles, 
                newInterval,
                easing
            );        
        } else if (TargetParser.isChildrenTarget(key, newValue)) {
                        
            const values = Array.isArray(newValue) ? newValue : newValue ? [newValue] : [];

            values.forEach(child => {
                tmodel.addChild(child);
                
                TargetUtil.markAddChild(tmodel, TargetUtil.currentTargetName, tmodel.addedChildren[tmodel.addedChildren.length - 1].child);
            });

            TargetExecutor.assignSingleTarget(
                targetValue, 
                newValue, 
                undefined, 
                0, 
                newCycles, 
                newInterval,
                easing
            );
        } else if (TargetParser.isChildObjectTarget(key, tmodel.targets[key])) {
                                    
            const child = new TModel(key, tmodel.targets[key]);
            tmodel.addChild(child);
            
            const filteredValue = Object.fromEntries(
                Object.entries(newValue).filter(([k]) => !TargetData.excludedTargetKeys.has(k))
            );
                                  
            TargetExecutor.assignSingleTarget(
                targetValue, 
                filteredValue,
                undefined, 
                0, 
                newCycles, 
                newInterval,
                easing
            );
        } else if (typeof newValue === 'object' && newValue.asChild === true) {
            const child = new TModel(key, newValue);
            tmodel.addChild(child);
                       
            TargetExecutor.assignSingleTarget(
                targetValue, 
                newValue,
                undefined, 
                0, 
                newCycles, 
                newInterval,
                easing
            );            
            
        } else if (TargetParser.isFetchTarget(key, newValue)) {
            getLoader().fetch(tmodel, newValue);
            
            TargetExecutor.assignSingleTarget(
                targetValue, 
                newValue, 
                undefined, 
                0, 
                newCycles, 
                newInterval,
                easing
            );
        } else if (TargetParser.isFetchImageTarget(key, newValue)) {
            getLoader().fetchImage(tmodel, newValue);
            
            TargetExecutor.assignSingleTarget(
                targetValue, 
                newValue, 
                undefined, 
                0, 
                newCycles, 
                newInterval,
                easing
            );    
        } else if (TargetParser.isListTarget(newValue)) {
            TargetExecutor.assignListTarget(tmodel, key, targetValue, newValue.list, newValue.list[0], newSteps, newInterval, easing);
        } else {
            if (newSteps > 0 && !TUtil.areEqual(tmodel.val(key), newValue, tmodel.targets[key]?.deepEquality ?? false)) {
                tmodel.resetTargetStep(key);
            }
            TargetExecutor.assignSingleTarget(targetValue, newValue, targetInitial, newSteps, newCycles, newInterval, easing);            
        }
    }
}

export { TargetExecutor };
