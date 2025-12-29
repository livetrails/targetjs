import { App, getLoader, getEvents, getLocationManager, getTargetManager } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetParser } from "./TargetParser.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";

/**
 * It provides helper functions for target management, such as deriving the values for steps, intervals, and cycles from targets.
 */
class TargetUtil {

    static emptyValue() {
        return {
            value: undefined,
            actual: undefined,
            step: 0,
            steps: 0,
            cycle: 0,
            cycles: 0,
            interval: 0,
            initialValue: undefined,
            scheduleTimeStamp: undefined,
            lastUpdate: 0,
            status: '',
            executionCount: 0,
            executionFlag: false,
            isImperative: false,
            originalTargetName: undefined,
            easing: undefined,
            activationTime: TUtil.now(),
            creationTime: TUtil.now()
        };
    }
            
    static getTargetName(name) {
        if (!name) {
            return;
        }
        let start = name.startsWith('_') ? 1 : 0;
        let end = name.length;
        while (end > start && name[end - 1] === '$') {
            end--;
        }
        if (name[end - 1] === '+') {
            end--;
        }
        return name.slice(start, end);
    }
    
    static bindTarget(tmodel, key, prevKey, nextKey, keyIndex) {
        let target = tmodel.targets[key];
                
        const getPrevValue = () => {
            if (prevKey) { 
                if (getLoader().isLoading(tmodel, prevKey)) {
                    return getLoader().getLoadingItemValue(tmodel, prevKey, key);
                } else {
                    return tmodel.targetValues[prevKey] ? tmodel.targetValues[prevKey].actual : tmodel.val(prevKey);
                }
            }
        };
        
        let lastPrevUpdateTime = prevKey !== undefined ? tmodel.getLastUpdate(prevKey) : undefined;

        const getPrevUpdateTime = () => prevKey !== undefined ? tmodel.getLastUpdate(prevKey) : undefined;

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
                
        target.originalTargetName = TargetUtil.currentTargetName;
        target.originalTModel = TargetUtil.currentTModel;
                
        const cleanKey = key.startsWith('_') ? key.slice(1) : key;
        
        const doesNextTargetUsePrevValue = nextKey && nextKey.endsWith('$') ? true : false;
        
        if (!target.activateNextTarget) {
            if (doesNextTargetUsePrevValue) {
                target.activateNextTarget = nextKey;
            } else {
                target.activateNextTarget = tmodel.originalTargetNames.slice(keyIndex + 1).find(name => name.endsWith('$$'));
            }
        }
        
        Object.keys(target).forEach(method => {
            const originalMethod = target[method];
            const shouldWrap = method === 'value' || (typeof originalMethod === 'function' && TargetData.isLifeCycleMethod(method));

            if (shouldWrap) {
                target[method] = function() {
                    if (!TargetData.lifecycleCoreSet.has(method)) {
                        TargetUtil.currentTargetName = key;
                        TargetUtil.currentTModel = tmodel;
                    }                 

                    this.key = cleanKey;
                    this.value = this.val(cleanKey);
                    this.prevTargetValue = getPrevValue();         
                    this.isPrevTargetUpdated = isPrevTargetUpdated;
                    const result = typeof originalMethod === 'function'
                        ? originalMethod.apply(this, arguments)
                        : originalMethod;
                    lastPrevUpdateTime = getPrevUpdateTime() ?? lastPrevUpdateTime;
                    return result;
                };
            }
        });
    }
    
    static shouldActivateNextTarget(tmodel, key, levelUp = 0, sideStep = 0, isImperative = false) {

        if (levelUp > 4 || !tmodel) {
            return;
        }
        if (tmodel.isTargetImperative(key)) {
            const { originalTModel, originalTargetName } = tmodel.targetValues[key];
            TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, levelUp + 1, sideStep, true); 
                    
            TargetUtil.cleanupTarget(tmodel, key);
            return;
        }
        
        let target = tmodel.targets[key];
        
        if (!target) {
            return;
        }
        
        const nextTarget = target.activateNextTarget;
        const isEndTrigger = nextTarget?.endsWith('$$') ?? false;
        const fetchAction = target.fetchAction;

        let nextTargetActivated = false;

        if (nextTarget) { 
                
            
            const updateAfterActivation = tmodel.getLastUpdate(key) > tmodel.getTargetActivationTime(nextTarget) || tmodel.getTargetActivationTime(nextTarget) === TUtil.now();                           

            if ((!isEndTrigger && sideStep === 0 && (updateAfterActivation || isImperative)) 
                    || (isEndTrigger && updateAfterActivation)) {
                if (fetchAction) {
                    if (isEndTrigger) {
                        if (TargetUtil.arePreviousTargetsComplete(tmodel, nextTarget) === true) {                  
                            TargetUtil.activateTarget(tmodel, nextTarget);
                            nextTargetActivated = true;
                        }
                    } else {
                        while (getLoader().isNextLoadingItemSuccessful(tmodel, key)) {
                            if (tmodel.activatedTargets.indexOf(nextTarget) >= 0) {
                                tmodel.activatedTargets.push(nextTarget);                            
                            } else {
                                TargetUtil.activateTarget(tmodel, nextTarget);
                            }
                            getLoader().nextActiveItem(tmodel, key);
                            nextTargetActivated = true;
                        } 
                    }
                } else if (isEndTrigger) {                     
                    if (TargetUtil.arePreviousTargetsComplete(tmodel, nextTarget) === true)  {
                        tmodel.removeFromActiveTargets(nextTarget);
                        TargetUtil.activateTarget(tmodel, nextTarget);
                        nextTargetActivated = true;

                    }
                } else if (!isEndTrigger) {
                    if (tmodel.activatedTargets.indexOf(nextTarget) >= 0 && !tmodel.isTargetUpdating(key)) {
                        tmodel.activatedTargets.push(nextTarget);
                    } else {
                        TargetUtil.activateTarget(tmodel, nextTarget);
                        nextTargetActivated = true;
                    }             
                }
            } else if (tmodel.isTargetDone(nextTarget)) {
                TargetUtil.cleanupTarget(tmodel, nextTarget);
            }
        }
       
        if (!nextTargetActivated && !tmodel.hasAnyUpdates()) {
            const { originalTModel, originalTargetName, activateNextTarget } = target;
            if (activateNextTarget && !fetchAction) {
                TargetUtil.shouldActivateNextTarget(tmodel, activateNextTarget, levelUp, sideStep + 1, isImperative);
            } else if (originalTModel) {
                TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, levelUp + 1, sideStep, isImperative);
            }
        }
        
        TargetUtil.cleanupTarget(tmodel, key);      
    }
    
    static cleanupTarget(tmodel, key) {
        if (tmodel.isTargetComplete(key) || !TargetUtil.isTargetFullyCompleted(tmodel, key)) {
            return;
        }
        
        tmodel.setTargetComplete(key);
        const target = tmodel.targets[key];
        const fetchAction = target?.fetchAction;
        
        if (fetchAction && getLoader().isLoadingComplete(tmodel, key)) {
            const index = tmodel.fetchActionTargetList.indexOf(key);
            if (index >= 0) {
                tmodel.fetchActionTargetList.splice(index, 1);
            }           
                
            target.fetchAction = false;
        } 
    }
    
    static activateTargets(tmodel, target) {
        while(target) {
            if (!tmodel.isTargetActive(target) && !tmodel.isTargetUpdating(target)) {
                TargetUtil.activateTarget(tmodel, target);
            }
            
            const activateNextTarget = tmodel.targets[target].activateNextTarget;
            target = activateNextTarget && !activateNextTarget.endsWith('$$') && activateNextTarget.endsWith('$') ? activateNextTarget : undefined;
        }
    }
    
    static activateTarget(tmodel, target) {
        tmodel.activateTarget(target);
    }

    static isTModelComplete(tmodel) {
        const state = tmodel.state();

        return !(state.updatingTargetList?.length)
            && !(state.activeTargetList?.length)
            && !tmodel.hasAnimatingTargets()
            && TargetUtil.isFetchingComplete(tmodel)
            && !tmodel.hasAnimatingChildren()    
            && !tmodel.hasUpdatingChildren()
            && !tmodel.hasActiveChildren()
            && !(state.lastChildrenUpdate?.deletions?.length)
            && !(state.lastChildrenUpdate?.additions?.length)
            && !tmodel.pausedBatch;
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
    static isTargetFullyCompleted(tmodel, key) {
        let result = !tmodel.isTargetUpdating(key) && (tmodel.isTargetCompleteDeep(key) === true);
        
        if (result && !tmodel.isTargetImperative(key)) {
             result = !tmodel.hasUpdatingImperativeTargets(key);
        }
        
        if (result && key.endsWith('$$')) {
            result = TargetUtil.arePreviousTargetsComplete(tmodel, key) === true;
        }

        return result;
    }
       
    static arePreviousTargetsComplete(tmodel, key) {
        const keyIndex = tmodel.functionTargetNames.findIndex(name => key === name);
 
        for (var i = keyIndex - 1; i >= 0; i--) {
            var targetName = tmodel.functionTargetNames[i];

            if (tmodel.isTargetImperative(targetName)) {
                continue;
            }
                   
            if (tmodel.hasUpdatingImperativeTargets(targetName)) {
                return  tmodel.oid + "." + targetName + ": " + tmodel.getUpdatingImperativeTargets(targetName);
            }
            
            if (tmodel.isTargetCompleteDeep(targetName) !== true) {
               const activeChildrenList = [ ...(tmodel.activeChildrenMap?.values() ?? []) ];
               return  tmodel.oid + "." + targetName + " ==> " + tmodel.isTargetCompleteDeep(targetName) + " -1- " + tmodel.getTargetStatus(targetName) + " -2- " + TargetUtil.getUpdatingChildren(tmodel, targetName) + " -3- " + activeChildrenList.map(t => t.oid + ':' + t.hasAnyUpdates()); 
               //return false;
            }            
        }
        return true;
    }

    static isTargetCompleteDeep(tmodel, key) {
        
        const target = tmodel.targets[key];
                
        if (target) {
            const targetType = typeof target.value;

            if (TargetData.controlTargetMap[key]) {
                return true;
            }

            if (!target.fetchAction && (targetType === 'string' || targetType === 'number' || targetType === 'boolean')) {
                return true;
            } 
            
            if (!tmodel.isTargetComplete(key) && !tmodel.isTargetDone(key)) {
                return 1;
            }            
            
            if (target.childAction && TargetUtil.getUpdatingChildren(tmodel, key) > 0) {         
                return 2;
            }
            
            if (target.childAction && tmodel.hasActiveChildren()) {
                return 3;
            }
            
            if (target.childAction && TargetUtil.areTargetChildrenComplete(target.childAction) !== true) {
                return 4;
            }
            
            if (target.fetchAction && !getLoader().isLoadingSuccessful(tmodel, key)) {
                return 5;
            }
        }
        
        return true;        
    }
    
    static areTargetChildrenComplete(children) {
        if (!children) {
            return true;
        }
        
        for (const child of children) {
            if (!child.isVisible() && child.visibilityStatus) {
                continue;
            }
            if (App.tmodelIdMap[child.oid] && !TargetUtil.isTModelComplete(child)) {
                return false;
            }
            if (child.hasChildren()) {
                if (!TargetUtil.areTargetChildrenComplete(child.getChildren())) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    static getUpdatingChildren(tmodel, originalTargetName) {
        let count = 0; 
        
        const children = [
          ...(tmodel.updatingChildrenMap?.values() ?? []),
          ...(tmodel.animatingChildrenMap?.values() ?? [])
        ]; 
        
        children.filter(child => child.isVisible() || !child.visibilityStatus).forEach(child => {
            const updatingList = [
              ...(child.updatingTargetList ?? []),
              ...(child.animatingMap ? [...child.animatingMap.keys()] : [])
            ];
            
            updatingList.forEach(target => {
                if (child.isTargetImperative(target)) {
                    const imperativeOriginalTarget = child.targetValues[target]?.originalTargetName;
                    if (imperativeOriginalTarget === originalTargetName) {
                        count++;
                    } else if (imperativeOriginalTarget) {

                        const originalTModel = child.targetValues[target]?.originalTModel;

                        if (originalTModel.targets[imperativeOriginalTarget]?.originalTargetName === originalTargetName) {                            
                            count++;
                        }
                    }
                } else if (child.targets[target]?.originalTargetName === originalTargetName) {                         
                    count++;
                }
            });
        });

        return count;
    }       

    static isTargetAlreadyUpdating(tmodel, key) {
        const cleanKey = TargetUtil.getTargetName(key);

        if (key !== cleanKey) {
            if (!tmodel.isTargetImperative(key) && tmodel.isTargetImperative(cleanKey) && !tmodel.isTargetComplete(cleanKey)) {
                return true;
            } 
        }
        
        return false;
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
    
    static markChildAction(tmodel, child) {
        const currentTargetName = TargetUtil.currentTargetName;
        const target = tmodel.targets[currentTargetName];

        if (typeof target === 'object') {
            if (!target['childAction']){
                target['childAction'] = [child];
            } else if (!target['childAction'].includes(child)) {
                target['childAction'].push(child);
            }    
        }
    }
    
    static markFetchAction(tmodel) {
        if (!tmodel) {
            return;
        }
        
        const currentTargetName = TargetUtil.currentTargetName;
        const target = tmodel.targets[currentTargetName];

        if (typeof target === 'object') {
            target['fetchAction'] = true;

            if (!tmodel.fetchActionTargetList.includes(currentTargetName)) {
                tmodel.fetchActionTargetList.push(currentTargetName);                
            }
        }        
    }

    static wrapTarget(tmodel, target, key) {      
        if (!TargetData.controlTargetMap[key]) {
                tmodel.targets[key] = { 
                    value: target,
                    originalTargetName: TargetUtil.currentTargetName,
                    originalTModel: TargetUtil.currentTModel
                };
                target = tmodel.targets[key];
        } 
        
        return target;
    }

    static getValueStepsCycles(tmodel, _target, key, cycle = tmodel.getTargetCycle(key)) {
        const valueOnly = _target && _target.valueOnly;
        const lastValue = tmodel.val(key);

        let value = null, steps = 0, interval = 0, cycles = 0;

        function getValue(target) {
            if (Array.isArray(target)) {
                if (valueOnly || !TargetParser.isValueStepsCycleArray(target)) {
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
                value = TargetUtil.runTargetValue(tmodel, target, key, cycle, lastValue);
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
    
    static runTargetValue(tmodel, target, key, cycle, lastValue) {
        const cleanKey = TargetUtil.getTargetName(key);  
        const isExternalEvent = TargetData.allEventMap[cleanKey];

        if (isExternalEvent) {
            return typeof target.value === 'function' ? target.value.call(tmodel, getEvents().getCurrentOriginalEvent(), cycle, lastValue) : TUtil.isDefined(target.value) ? target.value : target;        
        } else if (tmodel.val(`___${key}`)) {
            return typeof target.value === 'function' ? target.value.call(tmodel, tmodel.val(`___${key}`), cycle, lastValue) : TUtil.isDefined(target.value) ? target.value : target;            
        } else {
            return typeof target.value === 'function' ? target.value.call(tmodel, cycle, lastValue) : TUtil.isDefined(target.value) ? target.value : target;
        }
    }
    
    static resetBeforeDeletion(tmodel) {
        tmodel.updatingTargetList.length = 0;
        tmodel.activeTargetList.length = 0;
        tmodel.animatingMap?.clear();    
        tmodel.clearUpdatingChildren();
        tmodel.clearActiveChildren();
        tmodel.clearAnimatingChildren();
        
        getLocationManager().domIslandSet.delete(tmodel);
        delete App.tmodelIdMap[tmodel.oid];
    } 

    static getIntervalValue(tmodel, key, interval) {
        const intervalValue = typeof interval === 'function' ? interval.call(tmodel, key) : interval;
        return TUtil.isNumber(intervalValue) ? intervalValue : 0;
    }

    static scheduleExecution(tmodel, key) {
        const interval = tmodel.getTargetInterval(key);
        const now = TUtil.now();
        
        if (interval <= 0) {
            return 0;
        }

        if (tmodel.isTargetImperative(key) && tmodel.getTargetStep(key) === 0) {
            tmodel.setScheduleTimeStamp(key, now);
            return 0;
        }

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
    
    static getAnimationHooks() {
        return {
            morph: (tm, key, from, to, step, steps) => TModelUtil.morph(tm, key, from, to, step, steps),
            fireOnStep: (tm, key, step) => getTargetManager().fireOnStep(tm, key, step),
            fireOnEnd: (tm, key) => getTargetManager().fireOnEnd(tm, key)
        };
    }
    
    static getOriginalNames(tmodel, key) {
        let originalTModel, originalTargetName;
        
        if (tmodel.isTargetImperative(key)) {
            originalTModel = tmodel.targetValues[key]?.originalTModel;
            originalTargetName = tmodel.targetValues[key]?.originalTargetName;     
        } else {
            originalTModel = tmodel.targets[key]?.originalTModel;
            originalTargetName = tmodel.targets[key]?.originalTargetName;
        }
        
        return { originalTModel, originalTargetName };
    }

    static handleValueChange(tmodel, key) {
        let target = tmodel.targets[key];
        
        if (!target) {
            key = TargetUtil.getTargetName(key);
            target = tmodel.targets[key];
        }
        
        const newValue = tmodel.val(key);
        const lastValue = tmodel.lastVal(key);

        if (typeof target === 'object' && typeof target.onValueChange === 'function') {
            const valueChanged = !TUtil.areEqual(newValue, lastValue, target.deepEquality);
            if (valueChanged) {
                target.onValueChange.call(tmodel, newValue, lastValue, tmodel.getTargetCycle(key));
                tmodel.setTargetMethodName(key, 'onValueChange');
            }
                            
            return true;
        }
        
        return false;
    }
}

export { TargetUtil };
