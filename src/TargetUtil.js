import { App, getLoader, getEvents, getLocationManager, getTargetManager, getManager } from "./App.js";
import { TUtil } from "./TUtil.js";
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
            updateCount: 0,
            completeCount: 0,
            completeTime: 0,
            executionCount: 0,
            status: '',
            executionFlag: false,
            isImperative: false,
            originalTargetName: undefined,
            easing: undefined,
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
        const targetValue = tmodel.targetValues[key];

        if (!target || !targetValue) {
            return;
        }
        
        const nextTarget = target.activateNextTarget;
        const isEndTrigger = nextTarget?.endsWith('$$') ?? false;
        const fetchAction = target.fetchAction;

        let nextTargetActivated = false;
        let completeSignature = 0;

        if (nextTarget) {
                          
            let canActivate = false;
            
            if (isEndTrigger) {
                completeSignature = TargetUtil.getPrevCompleteSignature(tmodel, nextTarget);

                const previousResult = tmodel.targetValues[nextTarget]?.completeSignature ?? 0;
                if (completeSignature !== previousResult){
                    canActivate = true;
                }

            } else {
                targetValue.nextTargetUpdateMap ||= {};
                const updateCount = targetValue.nextTargetUpdateMap[nextTarget] || 0;

                canActivate = targetValue.updateCount > updateCount;
            }
             
            if ((!isEndTrigger && sideStep === 0 && (canActivate || isImperative)) 
                    || (isEndTrigger && (canActivate))) {
                                
                const prevOk = isEndTrigger ? TargetUtil.arePreviousTargetsComplete(tmodel, nextTarget) : false; 
                
                if (fetchAction) {
                    if (isEndTrigger) {
                        
                        if (prevOk === true) {                  
                            TargetUtil.activateTarget(tmodel, nextTarget);
                            nextTargetActivated = true;
                            TargetUtil.clearPendingTargets(tmodel, key);
                        } else {
                            TargetUtil.markPendingTargets(tmodel, key);
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
                    if (prevOk === true)  {
                        tmodel.removeFromActiveTargets(nextTarget);
                        TargetUtil.activateTarget(tmodel, nextTarget);
                        nextTargetActivated = true;
                         TargetUtil.clearPendingTargets(tmodel, key);
                    } else {
                        TargetUtil.markPendingTargets(tmodel, key);
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
        
        if (nextTargetActivated) {
            if (isEndTrigger) {
                if (completeSignature > 0) {
                    tmodel.targetValues[nextTarget] ||= TargetUtil.emptyValue();
                    tmodel.targetValues[nextTarget].completeSignature = completeSignature;
                }
            } else {
                targetValue.nextTargetUpdateMap[nextTarget] = targetValue.updateCount;
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
    
    static markPendingTargets(tmodel, key) {
        (tmodel.pendingTargets ||= new Set()).add(key);
    }

    static clearPendingTargets(tmodel, key) {
        
        const pending = tmodel.pendingTargets;
        
        if (!pending) {
            return;
        }

        pending.delete(key);
        if (pending.size === 0) {
            tmodel.pendingTargets = undefined;
        }
    }
    
    static cleanupTarget(tmodel, key) {
        if (tmodel.isTargetComplete(key) || !TargetUtil.isTargetFullyCompleted(tmodel, key)) {
            return;
        }
        
        tmodel.setTargetComplete(key);
        const target = tmodel.targets[key];
       
        if (typeof target?.onComplete === "function") {
            target.onComplete.call(tmodel);
            tmodel.setTargetMethodName(key, "onComplete");
        }
        
        const fetchAction = target?.fetchAction;
        
        if (fetchAction && getLoader().isLoadingComplete(tmodel, key)) {
            const index = tmodel.fetchActionTargetList.indexOf(key);
            if (index >= 0) {
                tmodel.fetchActionTargetList.splice(index, 1);
            }           
                
            target.fetchAction = false;
        } 
        
        TargetUtil.bubbleInvokerCompletion(tmodel, key);
    }
    
    static bubbleInvokerCompletion(tmodel, key, visited = new Set(), cleaned = new Set(), levelUp = 0) {
        if (!tmodel || !key) {
            return;
        }

        const sig = `${tmodel.oid}:${key}`;
        if (visited.has(sig) || levelUp > 4) {
            return;
        }
        
        visited.add(sig);

        const targetValue = tmodel.targetValues[key];
        if (!targetValue) {
            return;
        }

        const tryCleanupAndBubble = (invT, invK) => {
            if (!invT || !invK) {
                return;
            }

            const cSig = `${invT.oid}:${invK}`;
            if (!cleaned.has(cSig)) {
                cleaned.add(cSig);
                TargetUtil.cleanupTarget(invT, invK);
            }

            TargetUtil.bubbleInvokerCompletion(invT, invK, visited, cleaned, levelUp + 1);
        };

        tryCleanupAndBubble(targetValue.originalTModel, targetValue.originalTargetName);

        if (!tmodel.isTargetImperative(key)) {
            tryCleanupAndBubble(targetValue.invokerTModel, targetValue.invokerTargetName);

            tryCleanupAndBubble(tmodel.targets[key]?.originalTModel, tmodel.targets[key]?.originalTargetName);
        }
    }

    static activateTargets(tmodel, target) {
        while(target) {
            if (!tmodel.isTargetActive(target) && !tmodel.isTargetUpdating(target)) {
                TargetUtil.activateTarget(tmodel, target);
            }
            
            const activateNextTarget = tmodel.targets[target]?.activateNextTarget;
            target = activateNextTarget && !activateNextTarget.endsWith('$$') && activateNextTarget.endsWith('$') ? activateNextTarget : undefined;
        }
    }
    
    static activateTarget(tmodel, target) {
        tmodel.activateTarget(target);
    }

    static isTModelComplete(tmodel) {
        if (!tmodel) {
            return false;
        }
        const state = tmodel.state();
        
        return !(state.updatingTargetList?.length)
            && !(state.activeTargetList?.length)
            && !(state.activatedTargets?.length)
            && !tmodel.hasAnimatingTargets()
            && TargetUtil.isFetchingComplete(tmodel)
            && !tmodel.hasAnimatingChildren()    
            && !tmodel.hasUpdatingChildren()
            && !tmodel.hasActiveChildren()
            && !(state.lastChildrenUpdate?.deletions?.length)
            && !(state.lastChildrenUpdate?.additions?.length)
            && !tmodel.pausedBatch
            && !getManager().needsReattach(tmodel);
    }
    
    static isFetchingComplete(tmodel) {
        const state = tmodel.state();

        const list = state.fetchActionTargetList;
        if (!list) {
            return true;
        }

        for (const key of list) {
            if (!getLoader().isLoadingSuccessful(tmodel, key)) {
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
        
    static getPrevCompleteSignature(tmodel, key) {
        const keyIndex = key ? tmodel.functionTargetNames.findIndex(name => key === name) : tmodel.functionTargetNames?.length ?? 0;
 
        let completeSignature = 0;
        for (var i = keyIndex - 1; i >= 0; i--) {
            const targetName = tmodel.functionTargetNames[i];
        
            completeSignature += (tmodel.targetValues[targetName]?.completeCount ?? 0) + (tmodel.targetValues[targetName]?.completeTime ?? 0);
            
            if (tmodel.targets[targetName]?.addChildAction) {
                tmodel.targets[targetName]?.addChildAction.forEach(t => {
                    completeSignature += this.getPrevCompleteSignature(t);
                });
            }
        }
        
        return completeSignature;
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
               return  tmodel.oid + "." + targetName + " ==> " + tmodel.getTargetStatus(targetName) + ", " + tmodel.isTargetCompleteDeep(targetName) + ":: " + activeChildrenList.map(t => t.oid + ':' + t.hasAnyUpdates()) + ", " + [ ...TargetUtil.getUpdatingChildren(tmodel, targetName).keys() ]; 
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
            
            if (getManager().needsReattach(tmodel)) {
                return "needs Reattach";
            }
            
            if (tmodel.canHaveDom() && !tmodel.hasDom()) {
                return "no dom";
            }
            
            if (!tmodel.isTargetComplete(key) && !tmodel.isTargetDone(key)) {
                return 'not done';
            }
            
            if (target.childAction?.length > 0 && TargetUtil.getUpdatingChildren(tmodel, key).size > 0) {         
                return 'updating children';
            }
            
            if (target.childAction?.length > 0 && TargetUtil.getActiveChildren(tmodel).size > 0) {
                return 'active children';
            }
            
            if (target.childAction?.length > 0 && TargetUtil.areTargetChildrenComplete(target.childAction) !== true) {
                return 'incomplete children';
            }
            
            if (target.fetchAction && !getLoader().isLoadingSuccessful(tmodel, key)) {
                return 'incomplete loading';
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
        const childrenMap = new Map(); 
        
        const children = [
          ...(tmodel.updatingChildrenMap?.values() ?? []),
          ...(tmodel.animatingChildrenMap?.values() ?? [])
        ];
                
        children.filter(child => child.isVisible() || !child.visibilityStatus).forEach(child => {
            const updatingList = [
              ...(child.updatingTargetList ?? []),
              ...(child.animatingMap ? [...child.animatingMap.keys()] : [])
            ];

            for (const target of updatingList) {

                if (child.targetValues[target]?.snapAnimation) {
                    continue;
                }

                if (child.isTargetImperative(target)) {
                    const imperativeOriginalTarget = child.targetValues[target]?.originalTargetName;
                    if (imperativeOriginalTarget === originalTargetName) {
                        childrenMap.set(child.oid, child);
                    } else if (imperativeOriginalTarget) {

                        const originalTModel = child.targetValues[target]?.originalTModel;

                        if (originalTModel.targets[imperativeOriginalTarget]?.originalTargetName === originalTargetName) {                            
                            childrenMap.set(child.oid, child);
                        }
                    }
                } else if (child.targets[target]?.invokerTargetName === originalTargetName) {                         
                    childrenMap.set(child.oid, child);
                }
            }
        });

        return childrenMap;
    } 
    
    static getActiveChildren(tmodel) {
        const childrenMap = new Map(); 

        const children = [ ...(tmodel.activeChildrenMap?.values() ?? []) ];
                
        children.filter(child => child.isVisible() || !child.visibilityStatus).forEach(child => {
            if (child.activeTargetList.length) {
                childrenMap.set(child.oid, child);
            }
        });
        
        return childrenMap;
    }

    static getOldUpdatingTarget(tmodel, key) {
        const cleanKey = TargetUtil.getTargetName(key);
        const updatingKey = tmodel.allTargetMap[cleanKey];

        if (tmodel.updatingTargetMap[updatingKey]) {
            return updatingKey;
        }
        
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
    
    static markChildAction(parentTModel, parentTargetName, child) {
        const target = parentTModel.targets[parentTargetName];

        if (typeof target === 'object') {
            if (!target['childAction']){
                target['childAction'] = [child];
            } else if (!target['childAction'].includes(child)) {
                target['childAction'].push(child);
            }    
        }
    }
    
    static markAddChild(parentTModel, parentTargetName, child) {        
        const target = parentTModel.targets[parentTargetName];

        if (typeof target === 'object') {
            if (!target['addChildAction']){
                target['addChildAction'] = [child];
            } else if (!target['addChildAction'].includes(child)) {
                target['addChildAction'].push(child);
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
