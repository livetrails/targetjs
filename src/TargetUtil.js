import { getLoader } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetData } from "./TargetData.js";


/**
 * It provides helper functions for target management, such as deriving the values for steps, intervals, and cycles from targets.
 */
class TargetUtil {

    static emptyValue() {
        return {
            value: undefined,
            step: 0,
            steps: 0,
            cycle: 0,
            cycles: 0,
            interval: 0,
            initialValue: undefined,
            scheduleTimeStamp: undefined,
            actualValueLastUpdate: 0,
            status: '',
            executionCount: 0,
            executionFlag: false,
            isImperative: false,
            originalTargetName: undefined,
            easing: undefined,
            creationTime: TUtil.now()
        };
    }
            
    static getTargetName(key) {
        if (!key) {
            return;
        }

        let cleanKey = key.startsWith('_') ? key.slice(1) : key;
        cleanKey = cleanKey.endsWith('$$') ? cleanKey.slice(0, -2) : cleanKey.endsWith('$') ? cleanKey.slice(0, -1) : cleanKey;
        return cleanKey;
    }
    
    static bindTarget(tmodel, key, prevKey, nextKey) {
        let target = tmodel.targets[key];
                
        const getPrevValue = () => {
            if (prevKey) { 
                if (getLoader().isLoading(tmodel, prevKey)) {
                    return getLoader().getLoadingItemValue(tmodel, prevKey, target.originalName);
                } else {
                    return tmodel.val(prevKey);
                }
            }
        };
        
        let lastPrevUpdateTime = prevKey !== undefined ? tmodel.getActualValueLastUpdate(prevKey) : undefined;

        const getPrevUpdateTime = () => prevKey !== undefined ? tmodel.getActualValueLastUpdate(prevKey) : undefined;

        const isPrevTargetUpdated = () => {
            const currentPrevUpdateTime = getPrevUpdateTime();
            if (lastPrevUpdateTime === undefined && currentPrevUpdateTime === undefined) {
                return false;
            }
            if (lastPrevUpdateTime === undefined && currentPrevUpdateTime !== undefined) {
                return true;
            }
            return currentPrevUpdateTime !== lastPrevUpdateTime;
        };
        
        const doesNextTargetUsePrevValue = nextKey && nextKey.endsWith('$') ? true : false;
        
        target.originalTargetName = TargetUtil.currentTargetName;
        target.originalTModel = TargetUtil.currentTModel;
        
        const cleanKey = TargetUtil.getTargetName(key);
        
        if (doesNextTargetUsePrevValue && !target.activateNextTarget) {
            target.activateNextTarget = nextKey.slice(0, -1);
        }  

        const stepPattern = /^on[A-Za-z]+Step$/;
        const endPattern = /^on[A-Za-z]+End$/;  
        const methods = ['value', 'enabledOn', 'onStepsEnd', 'onValueChange', 'loop', 'onImperativeEnd', 'onImperativeStep', 'onSuccess', 'onError'];

        Object.keys(target).forEach(method => {
            if (method === 'value') {
                const originalMethod = target[method];                
                target[method] = function() {
                    TargetUtil.currentTargetName = cleanKey;
                    TargetUtil.currentTModel = tmodel;
                    this.key = cleanKey;      
                    this.value = this.val(cleanKey);
                    this.prevTargetValue = getPrevValue();         
                    this.isPrevTargetUpdated = isPrevTargetUpdated;
                    const result = typeof originalMethod === 'function' ? originalMethod.apply(this, arguments) : originalMethod;
                    lastPrevUpdateTime = getPrevUpdateTime() ?? lastPrevUpdateTime;
                    return result;
                };
            } else if (typeof target[method] === 'function' && (methods.includes(method) || stepPattern.test(method) || endPattern.test(method))) {
                const originalMethod = target[method];
                target[method] = function() {
                    TargetUtil.currentTargetName = cleanKey;
                    TargetUtil.currentTModel = tmodel;
                    this.key = cleanKey;
                    this.value = this.val(cleanKey);
                    this.prevTargetValue = getPrevValue();         
                    this.isPrevTargetUpdated = isPrevTargetUpdated;
                    const result = typeof originalMethod === 'function' ? originalMethod.apply(this, arguments) : originalMethod;
                    lastPrevUpdateTime = getPrevUpdateTime() ?? lastPrevUpdateTime;
                    return result;
                };                
            }
        });
    }
    
    static shouldActivateOriginalTModel(tmodel, key, originalTModel, originalTargetName, level) {
        if (!originalTModel) {
            return;
        }
        const originalTarget = originalTModel.targets[originalTargetName];
        const activeNextTarget = originalTarget.activateNextTarget;
       
        if (activeNextTarget && (!activeNextTarget.endsWith('$') || !tmodel.isTargetUpdating(key))) {
            TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, level + 1);
        }      
    }
    
    static shouldActivateNextTarget(tmodel, key, level = 0) { 
                
        if (tmodel.isTargetImperative(key)) {
            const { originalTModel, originalTargetName } = tmodel.targetValues[key];
            
            TargetUtil.shouldActivateOriginalTModel(tmodel, key,  originalTModel, originalTargetName, level);
            return;
        }
        
        const target = tmodel.targets[key];
        
        if (!target) {
            return;
        }
        
        if (!target.activateNextTarget) {
            const { originalTModel, originalTargetName } = target;      
            TargetUtil.shouldActivateOriginalTModel(tmodel, key,  originalTModel, originalTargetName, level);
            return;
        }
       
        const nextTarget = target.activateNextTarget;
        const cleanNextTarget = TargetUtil.getTargetName(nextTarget);           
        const isEndTrigger = nextTarget.endsWith('$');
        const fetchAction = target.fetchAction;
        
        if (fetchAction) {
            if (isEndTrigger) {     
                if (TargetUtil.hasTargetEnded(tmodel, key)) {                  
                    tmodel.activateTarget(cleanNextTarget);
                }
            } else {
                while (getLoader().isNextLoadingItemSuccessful(tmodel, key)) {
                    if (tmodel.activatedTargets.indexOf(cleanNextTarget) >= 0) {
                        tmodel.activatedTargets.push(cleanNextTarget);
                    } else {
                        tmodel.activateTarget(cleanNextTarget);
                    }
                    getLoader().nextActiveItem(tmodel, key);
                }   
            }
        } else if ((isEndTrigger && TargetUtil.hasTargetEnded(tmodel, key)) || (!isEndTrigger)) { 
            tmodel.activateTarget(cleanNextTarget);                
        }
          
        if (TargetUtil.isTargetComplete(tmodel, key)) {                
            TargetUtil.cleanupTarget(tmodel, key);
        }
    }
    
    static cleanupTarget(tmodel, key) {
        const target = tmodel.targets[key];
        const fetchAction = target?.fetchAction;
        const childAction = target?.childAction;
        
        if (fetchAction && getLoader().isLoadingComplete(tmodel, key)) {
            const index = tmodel.fetchActionTargetList.indexOf(key);
            if (index >= 0) {
                tmodel.fetchActionTargetList.splice(index, 1);
            }           
                
            if (!tmodel.fetchActionTargetList.length) {    
                target.fetchAction = false;
            }
        } 
        
        if (childAction) {
            const index = tmodel.childActionTargetList.indexOf(key);
            if (index >= 0) {
                tmodel.childActionTargetList.splice(index, 1);
            }
            
            if (!tmodel.childActionTargetList.length) {    
                target.childAction = false;
            }
        }
    }
    
    static isTModelComplete(tmodel) {
        const state = tmodel.state();

        return !(state.updatingTargetList?.length)
            && !(state.activeTargetList?.length)
            && TargetUtil.isFetchingComplete(tmodel)
            && !(state.updatingChildrenList?.length)
            && !(state.activeChildrenList?.length)
            && !(state.lastChildrenUpdate?.deletions?.length)
            && !(state.lastChildrenUpdate?.additions?.length);
    }
    
    static isFetchingComplete(tmodel) {
        const state = tmodel.state();

        const list = state.fetchActionTargetList;
        if (!list) {
            return true;
        }

        for (const key of list) {
            if (!getLoader().isLoadingComplete(tmodel, key)) {
                return false;
            }
        }

        return true;
    }
    static hasTargetEnded(tmodel, key) {
        const result = !TargetUtil.isTargetComplete(tmodel, key) || tmodel.hasUpdatingImperativeTargets(key) || !TargetUtil.arePreviousTargetsComplete(tmodel, key) ? false : true;

        return result;
    }
       
    static arePreviousTargetsComplete(tmodel, key) {
        const keyIndex = tmodel.originalTargetNames.findIndex(name => key === TargetUtil.getTargetName(name));
        
        for (var i = keyIndex - 1; i >= 0; i--) {
            var targetName = tmodel.originalTargetNames[i];
            var cleanTargetName = TargetUtil.getTargetName(targetName);
            
            if (tmodel.isTargetImperative(cleanTargetName)) {
                continue;
            }
                        
            if (!TargetUtil.isTargetComplete(tmodel, cleanTargetName) || tmodel.hasUpdatingImperativeTargets(cleanTargetName)) {
               return false; 
            }

            if (!targetName.endsWith('$')) {
                break;
            }
                        
        }
        return true;
    }

    static isTargetComplete(tmodel, key) {

        const target = tmodel.targets[key];
                
        if (target) {
            const targetType = typeof target.value;

            if (TargetData.controlTargetMap[key]) {
                return true;
            }

            if (!target.childAction && !target.fetchAction && (targetType === 'string' || targetType === 'number' || targetType === 'boolean')) {
                return true;
            } 
            
            if (!tmodel.isTargetComplete(key) && !tmodel.isTargetDone(key)) {
                return false;
            }            
            
            if (target.childAction && (TargetUtil.getUpdatingChildren(tmodel, key) > 0 || tmodel.hasActiveChildren())) {         
                return false;
            }
            if (target.fetchAction && !getLoader().isLoadingSuccessful(tmodel, key)) {
                return false;
            }
        }
        
        return true;        
    }
    
    static getUpdatingChildren(tmodel, originalTargetName) {
        let count = 0;
        tmodel.updatingChildrenList.filter(child => child.isVisible()).forEach(child => {
            child.updatingTargetList.forEach(target => {
                if (child.isTargetImperative(target) && child.targetValues[target]?.originalTargetName === originalTargetName) {
                    count++;
                } else if (child.targets[target]?.originalTargetName === originalTargetName) {
                    count++;
                }
            });
        });

        return count;
        
    }    
        
    
    static activateSingleTarget(tmodel, targetName) {
        if (tmodel.targets[targetName] && tmodel.canTargetBeActivated(targetName)) {
            if (tmodel.isTargetEnabled(targetName)) {
                tmodel.activateTarget(targetName);
            } else {
                tmodel.addToActiveTargets(targetName);
            }
        }
    }
    
    static markTargetAction(tmodel, actionName) {
        if (!tmodel) {
            return;
        }
        
        const currentTargetName = TargetUtil.currentTargetName;
        const target = tmodel.targets[currentTargetName];

        if (typeof target === 'object') {
            target[actionName] = true;

            if (actionName === 'childAction' && !tmodel.childActionTargetList.includes(currentTargetName)) {
                tmodel.childActionTargetList.push(currentTargetName);
            } else if (actionName === 'fetchAction' && !tmodel.fetchActionTargetList.includes(currentTargetName)) {
                tmodel.fetchActionTargetList.push(currentTargetName);                
            }
        }        
    }

    static isValueStepsCycleArray(arr) {
        if (arr.length > 4 || arr.length === 0) {
            return false;
        }

        for (let i = 1; i < arr.length; i++) {
            if (typeof arr[i] !== 'number') {
                return false;
            }
        }

        return arr.length >= 2 && (typeof arr[0] === 'number' || TargetUtil.isListTarget(arr[0]) || typeof arr[0] === 'string');
    }

    static isListTarget(value) {
        return typeof value === 'object' && value !== null && Array.isArray(value.list);
    }
    
    static isFetchTarget(key, value) {
        return key === 'fetch' && (typeof value === 'string' || Array.isArray(value));
    }
    
    static isObjectTarget(key, value) {
        return key !== 'style'
            && typeof value === 'object'
            && value !== null
            && !Array.isArray(value)
            && Object.getPrototypeOf(value) === Object.prototype;
    }
    
    static isChildrenTarget(key, value) {
        return key === 'children' && typeof value === 'object';
    }

    static getValueStepsCycles(tmodel, _target, key, cycle = tmodel.getTargetCycle(key)) {
        const valueOnly = _target && _target.valueOnly;
        const lastValue = tmodel.val(key);

        let value = null, steps = 0, interval = 0, cycles = 0;

        function getValue(target) {
            if (Array.isArray(target)) {
                if (valueOnly || !TargetUtil.isValueStepsCycleArray(target)) {
                    return [target, steps, interval, cycles];
                } else if (Array.isArray(_target)) {
                    return _target;
                } else {
                    value = target[0];
                    steps = target.length >= 2 ? target[1] : steps;
                    interval = target.length >= 3 ? target[2] : interval;
                    cycles = target.length >= 4 ? target[3] : cycles;
                    return [value, steps, interval, cycles];
                }
            }

            if (typeof target === 'object' && target !== null && Object.getPrototypeOf(target) === Object.prototype) {
                value = typeof target.value === 'function' ? target.value.call(tmodel, cycle, lastValue) : TUtil.isDefined(target.value) ? target.value : target;
                steps = typeof target.steps === 'function' ? target.steps.call(tmodel, cycle) : TUtil.isDefined(target.steps) ? target.steps : 0;
                interval = typeof target.interval === 'function' ? target.interval.call(tmodel, cycle) : TUtil.isDefined(target.interval) ? target.interval : 0;
                cycles = typeof target.cycles === 'function' ? target.cycles.call(tmodel, cycle, tmodel.getTargetCycles(key)) : TUtil.isDefined(target.cycles) ? target.cycles : 0;

                return Array.isArray(value) ? getValue(value) : [value, steps, interval, cycles];
            }

            if (typeof target === 'function') {
                return getValue(target.call(tmodel, cycle, lastValue));
            }

            return [target, steps, interval, cycles];
        }

        return getValue(_target);
    }

    static getIntervalValue(tmodel, key, interval) {
        const intervalValue = typeof interval === 'function' ? interval.call(tmodel, key) : interval;
        return TUtil.isNumber(intervalValue) ? intervalValue : 0;
    }

    static scheduleExecution(tmodel, key) {
        const interval = tmodel.getTargetInterval(key);

        if (interval <= 0) {
            return 0;
        }
        
        const now = TUtil.now();
        const lastScheduledTime = tmodel.getScheduleTimeStamp(key);
        
        if (TUtil.isDefined(lastScheduledTime)) {
            const elapsed = now - lastScheduledTime;
            return Math.max(interval - elapsed, 0);
        }

        tmodel.setScheduleTimeStamp(key, now);
        
        return interval;
    }    

    static getTargetSchedulePeriod(tmodel, key, intervalValue) {
        const now = TUtil.now();
        let pastPeriod;
        let schedulePeriod = 0;

        if (intervalValue > 0) {
            if (TUtil.isDefined(tmodel.getTargetTimeStamp(key))) {
                pastPeriod = now - tmodel.getTargetTimeStamp(key);
                if (pastPeriod < intervalValue) {
                    schedulePeriod = intervalValue - pastPeriod;
                } else {
                    schedulePeriod = 0;
                }
            } else {
                tmodel.setTargetTimeStamp(key, now);
                schedulePeriod = intervalValue;
            }
        } else if (TUtil.isDefined(tmodel.getTargetTimeStamp(key))) {
            pastPeriod = now - tmodel.getTargetTimeStamp(key);
            if (pastPeriod < 0) {
                schedulePeriod = -pastPeriod;
            } else {
                schedulePeriod = 0;
            }
        }

        return schedulePeriod;
    }

    static handleValueChange(tmodel, key, newValue, lastValue, step, cycle) {
        if (typeof tmodel.targets[key] === 'object' && typeof tmodel.targets[key].onValueChange === 'function') {
            const valueChanged = !TUtil.areEqual(newValue, lastValue, tmodel.targets[key].deepEquality);
            if (valueChanged) {
                tmodel.targets[key].onValueChange.call(tmodel, newValue, lastValue, cycle);
                tmodel.setTargetMethodName(key, 'onValueChange');
            }
        }
    }
}

export { TargetUtil };
