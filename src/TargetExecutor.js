import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { TUtil } from "./TUtil.js";
import { Easing } from "./Easing.js";
import { getEvents } from "./App.js";

/**
 * It is responsible for executing both declarative and imperative targets.
 */
class TargetExecutor {
    
    static executeDeclarativeTarget(tmodel, key, cycle) { 
        TargetExecutor.resolveTargetValue(tmodel, key, cycle);
        TargetExecutor.updateTarget(tmodel, tmodel.targetValues[key], key);

        TargetUtil.shouldActivateNextTarget(tmodel, key);     
    }

    static executeImperativeTarget(tmodel, key, value, steps, interval, easing, originalTargetName, originalTModel) {
        tmodel.targetValues[key] = tmodel.targetValues[key] || TargetUtil.emptyValue();
        const targetValue = tmodel.targetValues[key];

        targetValue.isImperative = true;
        targetValue.originalTargetName = originalTargetName;
        targetValue.originalTModel = originalTModel;

        if (TargetUtil.isListTarget(value)) {
            TargetExecutor.assignListTarget(targetValue, value.list, value.list[0], steps, interval, easing);
        } else if (TargetUtil.isObjectTarget(key, value)) {
            const completeValue = TargetData.cssFunctionMap[key] ? { ...TargetData.cssFunctionMap[key], ...value } : value; 
            Object.keys(completeValue).forEach(objectKey => {
                let newValue = completeValue[objectKey];
                if (typeof newValue === 'object'  && !TargetUtil.isListTarget(newValue)) {
                    const valueArray = TargetUtil.getValueStepsCycles(tmodel, completeValue[objectKey], key);
                    newValue = valueArray[0];
                    steps = TUtil.isDefined(valueArray[1]) ? valueArray[1] : steps;
                    interval = TUtil.isDefined(valueArray[2]) ? valueArray[2] : interval;
                }

                TargetExecutor.executeImperativeTarget(tmodel, objectKey, newValue, steps, interval, easing, originalTargetName, originalTModel);
            });
        } else {
            if (typeof value === 'object' && !TargetUtil.isListTarget(value)) {
                const valueArray = TargetUtil.getValueStepsCycles(tmodel, value, key);
                if (value !== valueArray[0]) {
                    value = valueArray[0];
                    steps = TUtil.isDefined(valueArray[1]) ? valueArray[1] : steps;
                    interval = TUtil.isDefined(valueArray[2]) ? valueArray[2] : interval;
                    TargetExecutor.executeImperativeTarget(tmodel, key, value, steps, interval, easing, originalTargetName, originalTModel);
                } else {
                    TargetExecutor.assignSingleTarget(targetValue, value, undefined, steps, 0, interval, easing);
                    targetValue.step = 0;                    
                }
            } else {
                TargetExecutor.assignSingleTarget(targetValue, value, undefined, steps, 0, interval, easing);
                targetValue.step = 0;
            }
        }

        TargetExecutor.updateTarget(tmodel, targetValue, key);
    }

    static updateTarget(tmodel, targetValue, key) {
        targetValue.executionCount++;
        targetValue.executionFlag = true;
                
        tmodel.setActualValueLastUpdate(key);

        if (tmodel.getTargetSteps(key) === 0) {
            TargetExecutor.snapActualToTarget(tmodel, key);
        }
        
        tmodel.addToStyleTargetList(key);
        tmodel.setTargetMethodName(key, 'value');        

        tmodel.updateTargetStatus(key);
        
    }

    static assignListTarget(targetValue, valueList, initialValue, steps, interval, easing) {
        targetValue.valueList = valueList;
        targetValue.stepList = Array.isArray(steps) ? steps : TUtil.isDefined(steps) ? [steps] : [1];
        targetValue.intervalList = Array.isArray(interval) ? interval : TUtil.isDefined(interval) ? [interval] : [0];
        targetValue.easingList = Array.isArray(easing) ? easing : TUtil.isDefined(easing) ? [easing] : [Easing.linear];

        targetValue.cycle = 1;
        targetValue.value = valueList[1];
        targetValue.initialValue = initialValue;
        targetValue.steps = targetValue.stepList[0];
        targetValue.interval = targetValue.intervalList[0];
        targetValue.easing = targetValue.easingList[0];

        targetValue.step = 0;
        targetValue.cycles = 0;
    }
    
    static executeEventHandlerTarget(groupValue) {
        if (typeof groupValue === 'string') {
            getEvents().attachGroupEvent(groupValue);
        } else if (Array.isArray(groupValue)) {
            groupValue.forEach(group =>  getEvents().attachGroupEvent(group));
        }
    }

    static assignSingleTarget(targetValue, value, initialValue, steps, cycles, interval, easing) {
        delete targetValue.valueList;
        delete targetValue.stepList;
        delete targetValue.intervalList;
        delete targetValue.easingList;

        targetValue.initialValue = initialValue;
        targetValue.value = value;
        targetValue.steps = steps || 0;
        targetValue.cycles = cycles || 0;
        targetValue.interval = interval || 0;
        targetValue.easing = easing;
    }

    static snapActualToTarget(tmodel, key) {
        const oldValue = tmodel.val(key);
        const value = tmodel.targetValues[key].value;
        tmodel.val(key, typeof value === 'function' ? value.call(tmodel) : value);
        TargetUtil.handleValueChange(tmodel, key, tmodel.val(key), oldValue, 0, 0);
    }

    static resolveTargetValue(tmodel, key, cycle = tmodel.getTargetCycle(key)) {
        const targetInitial = !tmodel.targetValues[key] && TUtil.isDefined(tmodel.targets[key].initialValue)
            ? tmodel.targets[key].initialValue
            : undefined;

        const valueArray = TargetUtil.getValueStepsCycles(tmodel, tmodel.targets[key], key, cycle);

        const newValue = valueArray[0];
        const newSteps = valueArray[1] || 0;
        const newInterval = valueArray[2] || 0;
        const newCycles = valueArray[3] || 0;
        
        const targetValue = tmodel.targetValues[key] || TargetUtil.emptyValue();

        tmodel.targetValues[key] = targetValue;
        const easing = TUtil.isDefined(tmodel.targets[key].easing) ? tmodel.targets[key].easing : undefined;
        
        if (TargetUtil.isChildrenTarget(key, newValue)) {
            if (Array.isArray(newValue)) {
                newValue.forEach((child) => tmodel.addChild(child));                      
            } else {
                tmodel.addChild(newValue);
            }
            TargetExecutor.assignSingleTarget(targetValue, newValue, undefined, 0, newCycles, newInterval);

        } else if (TargetUtil.isListTarget(newValue)) {
            TargetExecutor.assignListTarget(targetValue, newValue.list, newValue.list[0], newSteps, newInterval, easing);
        } else {
            if (newSteps > 0 && !TUtil.areEqual(tmodel.val(key), newValue, tmodel.targets[key]?.deepEquality ?? false)) {
                tmodel.resetTargetStep(key);
            }
            TargetExecutor.assignSingleTarget(targetValue, newValue, targetInitial, newSteps, newCycles, newInterval, easing);            
        }
    }
}

export { TargetExecutor };
