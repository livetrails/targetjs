import { App, getLoader, getLocationManager, getManager } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetData } from "./TargetData.js";

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
            valuePointer: 0,
            cycles: 1,
            interval: 0,
            initialValue: undefined,
            scheduleTimeStamp: undefined,
            lastUpdate: 0,
            updateCount: 0,
            completeCount: 0,
            completeTime: 0,
            executionCount: 0,
            visibleCompleteCount: 0,
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
            let nextTarget;
            if (doesNextTargetUsePrevValue) {
                nextTarget = nextKey;
            } else {
                const names = tmodel.originalTargetNames;
                for (let i = keyIndex + 1; i < names.length; i++) {
                    const name = names[i];
                    if (name.endsWith("$$")) {
                        nextTarget = name;
                        break;
                    }
                }            
            }
            if (nextTarget) {
                target.activateNextTarget = nextTarget;
            }
        }
        
        Object.keys(target).forEach(method => {
            const originalMethod = target[method];
            const sourceMethod = originalMethod?.__targetjsSource ?? originalMethod;
            const shouldWrap = method === 'value' || (typeof sourceMethod === 'function' && TargetData.isLifeCycleMethod(method));

            if (!shouldWrap) {
                return;
            }
                                
            const wrappedMethod = function() {
                if (!TargetData.lifecycleCoreSet.has(method)) {
                    TargetUtil.currentTargetName = key;
                    TargetUtil.currentTModel = tmodel;
                }                 

                this.key = cleanKey;
                this.value = this.val(cleanKey);
                this.prevTargetValue = getPrevValue(); 
                this.isPrevTargetUpdated = isPrevTargetUpdated;
                const result = typeof sourceMethod === 'function'
                    ? sourceMethod.apply(this, arguments)
                    : sourceMethod;
                lastPrevUpdateTime = getPrevUpdateTime() ?? lastPrevUpdateTime;
                return result;
            };

            wrappedMethod.__targetjsSource = sourceMethod;
            target[method] = wrappedMethod;
            
        });
    }
    
    static shouldActivateNextTarget(tmodel, key, levelUp = 0, sideStep = 0, isImperative = false, mode = "complete") {
        if (levelUp > 4 || !tmodel) {
            return;
        }

        const isUpdateMode = mode === "update";
        const isCompleteMode = !isUpdateMode;

        if (tmodel.isTargetImperative(key)) {
            const {originalTModel, originalTargetName} = tmodel.targetValues[key];

            TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, levelUp + 1, sideStep, true, "update");

            if (isCompleteMode) {
                TargetUtil.cleanupTarget(tmodel, key);

                if (TargetUtil.isTargetFullyCompleted(tmodel, key)) {
                    TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, levelUp + 1, sideStep, true, "complete");
                }
            }
            return;
        }

        const target = tmodel.targets[key];
        const targetValue = tmodel.targetValues[key];
        if (!target || !targetValue) {
            return;
        }

        const nextTarget = target.activateNextTarget;
        const isEndTrigger = nextTarget?.endsWith('$$') ?? false;
        const fetchAction = TargetUtil.hasFetchAction(tmodel, key);

        if (isUpdateMode && isEndTrigger) {
            return;
        }

        let nextTargetActivated = false;
        let canActivate = false;
                  
        if (nextTarget) {
                        
            const waitingForDom = TargetData.requiresDom(TargetUtil.getTargetName(nextTarget)) && !tmodel.hasDom();

            if (isEndTrigger) {
                const lastTriggeredCount = TargetUtil.getTriggeredByCompleteCount(tmodel, nextTarget, key);
                if (targetValue.completeCount > lastTriggeredCount) {
                    canActivate = true;
                }    
            } else {
                const nextTargetUpdateCount = targetValue.nextTargetUpdateCount ?? 0;
                canActivate = targetValue.updateCount > nextTargetUpdateCount;
            }

            if ((!isEndTrigger && sideStep === 0 && (canActivate || isImperative)) ||
                (isEndTrigger && canActivate)) {
           
                const prevOk = isEndTrigger ? TargetUtil.arePreviousTargetsComplete(tmodel, nextTarget) : false;
                
                if (isEndTrigger) {
                    (tmodel.targetValues[nextTarget] ??= TargetUtil.emptyValue()).previousTargetsStatus = prevOk;
                }
                
                if (waitingForDom) {
                    TargetUtil.markPendingTargets(tmodel, key);

                } else if (fetchAction) {
                    if (isEndTrigger) {
                        if (prevOk === true) {
                            const activated = TargetUtil.activateTargetOnce(tmodel, nextTarget);

                            if (activated) {
                                nextTargetActivated = true;
                                TargetUtil.clearPendingTargetsForNextTarget(tmodel, nextTarget);
                            }
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
                    if (prevOk === true) {
                        TargetUtil.activateTarget(tmodel, nextTarget);
                        nextTargetActivated = true;
                        TargetUtil.clearPendingTargetsForNextTarget(tmodel, nextTarget);
                    } else {
                        TargetUtil.markPendingTargets(tmodel, key);
                    }

                } else {
                    if (tmodel.activatedTargets.indexOf(nextTarget) >= 0 && !tmodel.isTargetUpdating(key)) {
                        tmodel.activatedTargets.push(nextTarget);
                    } else {
                        TargetUtil.activateTarget(tmodel, nextTarget);
                        nextTargetActivated = true;
                    }
                }
            } else if (isCompleteMode && tmodel.isTargetDone(nextTarget)) {
                TargetUtil.cleanupTarget(tmodel, nextTarget);
            }
        }

        if (nextTargetActivated) {
            if (!isEndTrigger) {
                targetValue.nextTargetUpdateCount = targetValue.updateCount;
            } else {
                TargetUtil.snapshotTriggeredByCompleteCounts(tmodel, nextTarget);
            }
        }
        
        let caughtUp = false;

        if (isEndTrigger && nextTarget) {
            const lastTriggeredCount = TargetUtil.getTriggeredByCompleteCount(tmodel, nextTarget, key);
            caughtUp = targetValue.completeCount <= lastTriggeredCount;
        }

        if (!nextTargetActivated && isCompleteMode) {
            if (nextTarget && caughtUp && !fetchAction) {
                TargetUtil.shouldActivateNextTarget(tmodel, nextTarget, levelUp, sideStep + 1, isImperative, "complete");
            } else if (!nextTarget) {
                const { originalTModel, originalTargetName } = target;

                if (originalTModel && originalTargetName) {
                    const completionScope = originalTModel.targets[originalTargetName]?.completionScope ?? "all";

                    if (completionScope !== "none" && TargetUtil.isTModelComplete(tmodel, completionScope)) {
                        TargetUtil.shouldActivateNextTarget(originalTModel, originalTargetName, levelUp + 1, sideStep, isImperative, "complete");
                    }
                }
            }
        }

        if (isCompleteMode) {
            TargetUtil.cleanupTarget(tmodel, key);
        }
    }

    static markPendingTargets(tmodel, key) {
        (tmodel.pendingTargets ||= new Set()).add(key);
    }

    static clearPendingTarget(tmodel, key) {
        const pending = tmodel.pendingTargets;

        if (!pending) {
            return;
        }

        pending.delete(key);

        if (pending.size === 0) {
            tmodel.pendingTargets = undefined;
        }
    }

    static clearPendingTargetsForNextTarget(tmodel, nextTarget) {
        const pending = tmodel.pendingTargets;

        if (!pending) {
            return;
        }

        for (const key of [...pending]) {
            if (tmodel.targets[key]?.activateNextTarget === nextTarget) {
                pending.delete(key);
            }
        }

        if (pending.size === 0) {
            tmodel.pendingTargets = undefined;
        }
    }   

    static cleanupTarget(tmodel, key) {
        TargetUtil.cleanupVisibleComplete(tmodel, key);

        const cannotBeCleaned = tmodel.isTargetComplete(key) || !TargetUtil.isTargetFullyCompleted(tmodel, key);

        if (cannotBeCleaned) {
            return false;
        }

        tmodel.setTargetComplete(key);

        const target = tmodel.targets[key];

        if (typeof target?.onComplete === "function") {
            target.onComplete.call(tmodel);
            tmodel.setTargetMethodName(key, "onComplete");
        }

        if (TargetUtil.hasFetchAction(tmodel, key) && getLoader().isLoadingSuccessful(tmodel, key)) {

            const index = tmodel.fetchActionTargetList.indexOf(key);

            if (index >= 0) {
                tmodel.fetchActionTargetList.splice(index, 1);
            }
        }

        TargetUtil.bubbleInvokerCompletion(tmodel, key);

        return true;
    }

    static cleanupVisibleComplete(tmodel, key, target = tmodel.targets[key]) {
        if (!target || typeof target.onVisibleComplete !== "function") {
            return false;
        }

        const targetValue = tmodel.targetValues[key];

        if (!targetValue) {
            return false;
        }

        if (TargetUtil.isTargetTreeComplete(tmodel, key, 'visible') !== true) {
            return false;
        }

        const signature = TargetUtil.getVisibleCompletionSignature(tmodel);

        if (targetValue.visibleCompleteSignature === signature) {
            return false;
        }

        targetValue.visibleCompleteSignature = signature;

        target.onVisibleComplete.call(tmodel);
        tmodel.setTargetMethodName(key, "onVisibleComplete");

        return true;
    }
    
    static getVisibleCompletionSignature(tmodel) {
        return tmodel.visibleChildren.map(child => child.oid).sort().join('|');
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

        const tryCleanupAndBubble = (m, t) => {
            if (!m || !t) {
                return;
            }

            const cSig = `${m.oid}:${t}`;
            if (!cleaned.has(cSig)) {
                cleaned.add(cSig);
                TargetUtil.cleanupTarget(m, t);
            }

            TargetUtil.bubbleInvokerCompletion(m, t, visited, cleaned, levelUp + 1);
        };

        tryCleanupAndBubble(targetValue.originalTModel, targetValue.originalTargetName);

        if (!tmodel.isTargetImperative(key)) {
            tryCleanupAndBubble(targetValue.invokerTModel, targetValue.invokerTargetName);

            tryCleanupAndBubble(tmodel.targets[key]?.originalTModel, tmodel.targets[key]?.originalTargetName);
        }
    }
    
    static getTriggeredByCompleteCount(tmodel, nextTarget, key) {
        return tmodel.targetValues[nextTarget]?.triggeredByCompleteCountMap?.get(key) ?? 0;
    }

    static snapshotTriggeredByCompleteCounts(tmodel, nextTarget) {
        const nextTargetValue = tmodel.targetValues[nextTarget] ||= TargetUtil.emptyValue();

        const map = nextTargetValue.triggeredByCompleteCountMap ||= new Map();

        const nextIndex = tmodel.functionTargetNames.indexOf(nextTarget);

        if (nextIndex < 0) {
            return;
        }

        for (let i = 0; i < nextIndex; i++) {
            const previousKey = tmodel.functionTargetNames[i];
            const previousTarget = tmodel.targets[previousKey];

            if (previousTarget?.activateNextTarget !== nextTarget) {
                continue;
            }

            const completeCount = tmodel.targetValues[previousKey]?.completeCount ?? 0;

            map.set(previousKey, completeCount);
        }
    }
    
    static activateTargetOnce(tmodel, nextTarget) {        
        const nextTargetValue = (tmodel.targetValues[nextTarget] ||= TargetUtil.emptyValue());
        const last = nextTargetValue.activationTime ?? 0;
        if (last > 0 && last >= tmodel.getLastUpdate(nextTarget)) {
            return false;
        }

        nextTargetValue.activationTime = tmodel.getLastUpdate(nextTarget) + 0.001;
        tmodel.activateTarget(nextTarget);
        
        return true;
    }

    static activateTarget(tmodel, key) {
        tmodel.activateTarget(key);
    }

    static isTModelComplete(tmodel, completionScope = "all") {
        if (completionScope === "visible" && TargetUtil.shouldIgnoreChildForCompletion(tmodel, "visible")) {
            return true;
        }

        if (tmodel.particleRuntime?.hasPendingAny(completionScope)) {
            return false;
        } 
       
        const waitingForDom = !tmodel.isLightweightChild && getManager().shouldHaveDom(tmodel) && !tmodel.hasDom();
        
        const state = tmodel.state();
        
        const pendingStyles = !tmodel.isLightweightChild && TargetUtil.hasPendingStyles(tmodel);
        const needsReattach = !tmodel.isLightweightChild && getManager().needsReattach(tmodel);

        if (completionScope === "visible") {
            
            return !waitingForDom
                && !(state.updatingTargetList?.length)
                && !(state.activeTargetList?.length)
                && !(state.activatedTargets?.length)
                && !tmodel.hasAnimatingTargets()
                && TargetUtil.isFetchingComplete(tmodel)
                && TargetUtil.getUpdatingChildren(tmodel, undefined, "visible").size === 0
                && TargetUtil.getActiveChildren(tmodel, "visible").size === 0
                && !(state.lastChildrenUpdate?.deletions?.length)
                && !(state.lastChildrenUpdate?.additions?.length)
                && !tmodel.noDomUpdatingTargets
                && !tmodel.pendingTargets
                && !pendingStyles
                && !needsReattach;
        }

        return !waitingForDom
            && !(state.updatingTargetList?.length)
            && !(state.activeTargetList?.length)
            && !(state.activatedTargets?.length)
            && !tmodel.hasAnimatingTargets()
            && TargetUtil.isFetchingComplete(tmodel)
            && !tmodel.hasAnimatingChildren()    
            && !tmodel.hasUpdatingChildren()
            && !tmodel.hasActiveChildren()
            && !(state.lastChildrenUpdate?.deletions?.length)
            && !(state.lastChildrenUpdate?.additions?.length)
            && !tmodel.noDomUpdatingTargets
            && !tmodel.pendingTargets
            && !pendingStyles
            && !needsReattach;
    }
    
    static getCompletionBlockers(tmodel, completionScope = "all") {
        const visible = completionScope === "visible";

        if (visible && TargetUtil.shouldIgnoreChildForCompletion(tmodel, "visible")) {
            return [];
        }

        const state = tmodel.state();
        const blockers = [];

        const add = (name, value) => {
            if (value && (!Array.isArray(value) || value.length > 0)) {
                blockers.push({ name, value });
            }
        };

        const list = value => {
            if (!value) {
                return [];
            }

            if (value instanceof Set) {
                return [...value];
            }

            if (value instanceof Map) {
                return [...value.keys()];
            }

            return Array.isArray(value) ? value : [value];
        };

        add("waitingForDom", !tmodel.isLightweightChild && getManager().shouldHaveDom(tmodel) && !tmodel.hasDom());
        add("updatingTargetList", list(state.updatingTargetList));
        add("activeTargetList", list(state.activeTargetList));
        add("activatedTargets", list(state.activatedTargets));
        add("animatingTargets", tmodel.hasAnimatingTargets() ? list(tmodel.animatingMap) : []);
        add("fetching", !TargetUtil.isFetchingComplete(tmodel));

        if (visible) {
            add("updatingChildren", [...TargetUtil.getUpdatingChildren(tmodel, undefined, "visible").keys()]);
            add("activeChildren", [...TargetUtil.getActiveChildren(tmodel, "visible").keys()]);
        } else {
            add("animatingChildren", tmodel.hasAnimatingChildren());
            add("updatingChildren", tmodel.hasUpdatingChildren() ? list(tmodel.updatingChildrenMap) : []);
            add("activeChildren", tmodel.hasActiveChildren() ? list(tmodel.activeChildrenMap) : []);
        }

        add("deletedChildren", list(state.lastChildrenUpdate?.deletions));
        add("addedChildren", list(state.lastChildrenUpdate?.additions));
        add("noDomUpdatingTargets", list(tmodel.noDomUpdatingTargets));
        add("pendingTargets", list(tmodel.pendingTargets));

        if (tmodel.hasDom()) {
            add("styleTargetMap", list(tmodel.styleTargetMap));
            add("asyncStyleTargetMap", list(tmodel.asyncStyleTargetMap));
        }

        add("needsReattach", getManager().needsReattach(tmodel));

        return blockers;
    }

    static hasPendingStyles(tmodel) {
        return tmodel.hasDom() && (tmodel.styleTargetMap?.size > 0 || tmodel.asyncStyleTargetMap?.size > 0);
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
        let result = !tmodel.isTargetUpdating(key) && (tmodel.isTargetTreeComplete(key) === true);
        
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

        if (TargetUtil.hasPendingStyles(tmodel)) {
            return "pending styles";
        }

        for (var i = keyIndex - 1; i >= 0; i--) {
            var targetName = tmodel.functionTargetNames[i];
            
            if (tmodel.isTargetImperative(targetName)) {
                continue;
            }
            
            if (tmodel.isTargetComplete(targetName)) {
                continue;
            }
            
            if (tmodel.activatedTargets.indexOf(targetName) >= 0) {
                return "activated targets";
            }
                  
            if (tmodel.hasUpdatingImperativeTargets(targetName)) {
                return  tmodel.oid + "." + targetName + ": " + tmodel.getUpdatingImperativeTargets(targetName);
            }
            
            if (tmodel.isTargetTreeComplete(targetName) !== true) {
                const completionScope = tmodel.targets[targetName].completionScope ?? "all";
                const reason = TargetUtil.isTargetTreeComplete(tmodel, targetName);
                const activeChildren = [...TargetUtil.getActiveChildren(tmodel, completionScope).keys()];
                const updatingChildren = [...TargetUtil.getUpdatingChildren(tmodel, targetName, completionScope).keys()];

                return `${tmodel.oid}.${targetName}: ${reason}; active=[${activeChildren.join(", ")}]; updating=[${updatingChildren.join(", ")}]`;
            }      
        }
        return true;
    }

    static isTargetTreeComplete(tmodel, key, completionScopeOverride) {
        
        const target = tmodel.targets[key];
        const targetValue = tmodel.targetValues[key];
        const childAction = targetValue?.childAction;  
        
        if (target) {                   
            const completionScope = completionScopeOverride ?? target.completionScope;

            if (tmodel.particleRuntime?.hasPending(key, completionScope ?? "all")) {
                return "pending GPU children";
            }

            const targetType = typeof target.value;

            if (TargetData.controlTargetMap[key]) {
                return true;
            }

            if (!TargetUtil.hasFetchAction(tmodel, key) && (targetType === 'string' || targetType === 'number' || targetType === 'boolean')) {
                return true;
            } 
            
            if (getManager().needsReattach(tmodel)) {
                return "needs Reattach";
            }
            
            if (getManager().shouldHaveDom(tmodel) && !tmodel.hasDom()) {
                return "no dom";
            }
            
            if (!tmodel.isTargetComplete(key) && !tmodel.isTargetDone(key)) {
                return 'not done';
            }
            
            let children;
            if (childAction?.length > 0 && (children = TargetUtil.getUpdatingChildren(tmodel, key, completionScope)).size > 0) {
                return "updating children: " + [...children.keys()].join(", ");
            }

            if (childAction?.length > 0 && (children = TargetUtil.getActiveChildren(tmodel, completionScope)).size > 0) {
                return "active children: " + [...children.keys()].join(", ");
            }

            if (childAction?.length > 0 && (children = TargetUtil.areTargetChildrenComplete(childAction, completionScope)) !== true) {
                return "incomplete children: " + children;
            }
            
            if (TargetUtil.hasFetchAction(tmodel, key) &&
                !getLoader().isLoadingSuccessful(tmodel, key)) {
                return 'incomplete loading';
            }
            
            if (tmodel.particleRuntime?.hasPending(key, completionScope)) {
                return "pending GPU children";
            }
        }
        
        return true;        
    }
    
    static areTargetChildrenComplete(children, completionScope = 'all') {
        if (!children) {
            return true;
        }

        for (const child of children) {
            if (!child) {
                continue;
            }

            if (completionScope === "visible" && !child.isLightweightChild && child.visibilityStatus?.isVisible === undefined) {
                return "visibility not calculated";
            }

            if (TargetUtil.shouldIgnoreChildForCompletion(child, completionScope)) {
                continue;
            }

            if (child.exists() && !TargetUtil.isTModelComplete(child, completionScope)) {
                return child.oid;
            }

            if (child.hasChildren()) {
                const result = TargetUtil.areTargetChildrenComplete(child.getChildren(), completionScope);

                if (result !== true) {
                    return result;
                }
            }
        }

        return true;
    }
   
    static getUpdatingChildren(tmodel, originalTargetName, completionScope = "all") {
        const childrenMap = new Map(); 
        
        const children = [
          ...(tmodel.updatingChildrenMap?.values() ?? []),
          ...(tmodel.animatingChildrenMap?.values() ?? [])
        ];
                
        children.forEach(child => {
            if (TargetUtil.shouldIgnoreChildForCompletion(child, completionScope)) {
                return;
            } 
            
            const updatingList = [
                ...(child.updatingTargetList ?? []),
                ...(child.animatingMap ? [...child.animatingMap.keys()] : []),
                ...(child.noDomUpdatingTargets ?? [])
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
    
    static hasVisibleActiveChild(tmodel) {
        if (TargetUtil.shouldIgnoreChildForCompletion(tmodel, "visible")) {
            return false;
        }

        if (tmodel.activeTargetList?.length > 0) {
            return true;
        }

        for (const child of tmodel.getChildren?.() ?? []) {
            if (TargetUtil.hasVisibleActiveChild(child)) {
                return true;
            }
        }

        return false;
    }
    
    static getActiveChildren(tmodel, completionScope = 'all') {
        const childrenMap = new Map(); 
        const children = [ ...(tmodel.activeChildrenMap?.values() ?? []) ];

        children.forEach(child => {
            if (completionScope === "visible") {
                if (TargetUtil.hasVisibleActiveChild(child)) {
                    childrenMap.set(child.oid, child);
                }

                return;
            }

            if (TargetUtil.shouldIgnoreChildForCompletion(child, completionScope)) {
                return;
            }    

            if (child.activeTargetList.length) {
                childrenMap.set(child.oid, child);
            }
        });

        return childrenMap;
    }
    
    static shouldIgnoreChildForCompletion(child, completionScope) {
        
        if (child && typeof child.exists !== "function") {
            console.warn("Invalid child reference", JSON.stringify(child));
            return true;
        }
                
        if (!child || !child.exists()) {
            return true;
        }

        if (completionScope === "none") {
            return true;
        }

        if (completionScope === "visible") {
            if (child.visibilityStatus) {
                return child.visibilityStatus.isVisible !== true;
            }

            if (typeof child.isVisible === "function") {
                return child.isVisible() !== true;
            }

            return true;
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
    

    static markTargetChildAction(tmodel, key, child, action) {
        if (!child || !tmodel?.targets[key] ||
            typeof tmodel.targets[key] !== "object") {
            return;
        }

        const targetValue = tmodel.targetValues[key] ??= TargetUtil.emptyValue();

        const children = targetValue[action] ??= [];

        if (!children.includes(child)) {
            children.push(child);
        }
    }

    static markChildAction(tmodel, key, child) {
        TargetUtil.markTargetChildAction(tmodel, key, child, "childAction");
    }

    static markAddChild(tmodel, key, child) {
        TargetUtil.markTargetChildAction(
            tmodel, key, child, "addChildAction"
        );
    }

    static markFetchAction(tmodel) {
        const key = TargetUtil.currentTargetName;

        if (!tmodel?.targets[key]) {
            return;
        }

        if (!tmodel.fetchActionTargetList.includes(key)) {
            tmodel.fetchActionTargetList.push(key);
        }
    }

    static hasFetchAction(tmodel, key) {
        return tmodel.fetchActionTargetList.includes(key);
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
    
    static resetBeforeDeletion(tmodel) {
        tmodel.updatingTargetList.length = 0;
        tmodel.activeTargetList.length = 0;
        tmodel.animatingMap?.clear();    
        tmodel.clearUpdatingChildren();
        tmodel.clearActiveChildren();
        tmodel.clearAnimatingChildren();
        
        getLocationManager().domIslandSet.delete(tmodel);
        
        if (App.tmodelIdMap[tmodel.oid] === tmodel) {
            delete App.tmodelIdMap[tmodel.oid];
        }
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

    static resetTargetState(tmodel, targetName, options = {}, visited = new Set()) {
        if (!tmodel || !targetName) {
            return;
        }

        TargetUtil.resetSingleTargetState(tmodel, targetName);
        TargetUtil.resetTargetChildActions(tmodel, targetName, options, visited);

        const target = tmodel.targets[targetName];
        const nextTarget = target?.activateNextTarget;
        const nextTargetDef = tmodel.targets[nextTarget];

        if (!nextTargetDef || (!nextTarget.endsWith('$') && nextTargetDef.active === false)) {
            return;
        }

        TargetUtil.resetTargetsBetween(tmodel, targetName, nextTarget, options, visited);
        TargetUtil.resetTargetPipelineState(tmodel, nextTarget, options, visited);
    }

    static resetTargetPipelineState(tmodel, targetName, options = {}, visited = new Set()) {
        if (!tmodel || !targetName) {
            return;
        }

        TargetUtil.resetSingleTargetState(tmodel, targetName);
        TargetUtil.resetTargetChildActions(tmodel, targetName, options, visited);

        const target = tmodel.targets[targetName];
        const nextTarget = target?.activateNextTarget;

        if (!nextTarget) {
            return;
        }

        const nextTargetDef = tmodel.targets[nextTarget];

        if (!nextTargetDef || (!nextTarget.endsWith('$') && nextTargetDef.active === false)) {
            return;
        }

        TargetUtil.resetTargetsBetween(tmodel, targetName, nextTarget, options, visited);
        TargetUtil.resetTargetPipelineState(tmodel, nextTarget, options, visited);
    }
    
    static resetTargetsBetween(tmodel, fromTarget, toTarget, options = {}, visited = new Set()) {
        const names = tmodel.functionTargetNames;
        const fromIndex = names.indexOf(fromTarget);
        const toIndex = names.indexOf(toTarget);

        if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) {
            return;
        }

        for (let i = fromIndex + 1; i < toIndex; i++) {
            const key = names[i];

            TargetUtil.resetSingleTargetState(tmodel, key);
            TargetUtil.resetTargetChildActions(tmodel, key, options, visited);
        }
    }
    
    static resetTargetChildState(tmodel, options = {}, visited = new Set()) {
        if (tmodel.isLightweightChild) {
            return;
        }

        const sig = `${tmodel.oid}`;

        if (visited.has(sig)) {
            return;
        }

        visited.add(sig);

        const names = Object.keys(tmodel.targetValues);

        for (let i = 0; i < names.length; i++) {
            const key = names[i];

            TargetUtil.resetSingleTargetState(tmodel, key);
            TargetUtil.resetTargetChildActions(tmodel, key, options, visited);
        }
    }
    
    static resetTargetChildActions(tmodel, key, options = {}, visited = new Set()) {
        const targetValue = tmodel.targetValues[key];

        if (!targetValue) {
            return;
        }

        const childActions = [...(targetValue.childAction ?? [])];
        const addChildActions = [...(targetValue.addChildAction ?? [])];

        childActions.forEach(child => {
            if (child) {
                TargetUtil.resetTargetChildState(child, options, visited);
            }
        });

        addChildActions.forEach(child => {
            if (child) {
                TargetUtil.resetTargetChildState(child, options, visited);
            }
        });

        if (options.clearChildActions) {
            if (Array.isArray(targetValue.childAction)) {
                targetValue.childAction = [];
            }
            if (Array.isArray(targetValue.addChildAction)) {
                targetValue.addChildAction = [];
            }
        }
    }
    
    static clearTriggeredByCompleteCount(tmodel, nextTarget, key) {
        const nextTargetValue = tmodel.targetValues[nextTarget];
        const map = nextTargetValue?.triggeredByCompleteCountMap;

        if (!map) {
            return;
        }

        map.delete(key);

        if (map.size === 0) {
            nextTargetValue.triggeredByCompleteCountMap = undefined;
        }
    }

    static resetTargetStateOnly(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        const nextTarget = tmodel.targets[key]?.activateNextTarget;

        if (nextTarget?.endsWith("$$")) {
            TargetUtil.clearTriggeredByCompleteCount(tmodel, nextTarget, key);
        }

        if (targetValue) {
            targetValue.completeCount = 0;
            targetValue.triggeredByCompleteCountMap = undefined;
            targetValue.resetFlag = true;
            targetValue.nextTargetUpdateCount = 0;
            targetValue.visibleCompleteSignature = undefined;
            targetValue.status = "";
        }

        tmodel.removeFromActiveTargets(key);
        tmodel.removeFromAnimatingMap(key);
        tmodel.removeFromUpdatingTargets(key);

        TargetUtil.clearPendingTarget(tmodel, key);
    }

    static resetSingleTargetState(tmodel, key) {
        TargetUtil.resetTargetStateOnly(tmodel, key);

        tmodel.cancelAnimation();
        tmodel.activatedTargets.length = 0;
    }

    static resetRemovedChildTarget(tmodel, key, child) {
        const targetValue = tmodel.targetValues[key];
        
        if (!targetValue) {
            return;
        }

        TargetUtil.resetTargetStateOnly(tmodel, key);

        for (const name of ["childAction", "addChildAction"]) {
            const children = targetValue[name];
            const index = children?.indexOf(child) ?? -1;

            if (index >= 0) {
                children.splice(index, 1);
            }
        }
    }
    
    static convertAnimatingTargetsToUpdating(tmodels) {
        for (const tmodel of tmodels) {
            if (!tmodel?.hasAnimatingTargets()) {
                continue;
            }

            const animatingTargets = [ ...tmodel.getAnimatingTargets() ];

            for (const targetName of animatingTargets) {
                tmodel.setTargetStatus(targetName, "updating");

                tmodel.removeFromAnimatingMap(targetName);
            }
        }
    }
    
    static getResetOptions(options) {
        const reset = options?.reset;

        return {
            shouldReset: reset === true || reset === 'pipeline' || reset === 'tree' || reset === 'all',
            clearChildActions: reset === 'tree' || reset === 'all'
        };
    }
    
    static isTargetUpdating(tmodel, key) {
        const targetValue = tmodel.targetValues[key];
        
        if (!targetValue) {
            return false;
        }
        
        const valuePointer = tmodel.getValueListPointer(key);
        const cycle = tmodel.getTargetCycle(key);
        const cycles = tmodel.getTargetCycles(key);
        const step = tmodel.getTargetStep(key);
        const steps = tmodel.getTargetSteps(key);
        
        if (Array.isArray(targetValue.valueList) && valuePointer < targetValue.valueList.length) {
            return true;
        } else if (tmodel.isTargetImperative(key) && cycle < cycles - 1) { 
            return true;
        } else if (step < steps) {
            return true;
        }
        
        return false;
    }   
}

export { TargetUtil };
