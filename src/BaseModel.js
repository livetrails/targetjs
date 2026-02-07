import { App, getRunScheduler, getLocationManager, getAnimationManager, getDomTModelById, getEvents } from "./App.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { TUtil } from "./TUtil.js";
import { TargetParser } from "./TargetParser" ;
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { $Dom } from "./$Dom.js";

/**
 * It provides the target state and associated logic to the TModel.
 */
class BaseModel {
    constructor(type, targets, oid) {
        if (typeof type === 'object' && typeof targets === 'undefined') {
            targets = type;
            type = "";
        }
        this.targets = Object.assign({}, targets);
        oid = oid || this.targets.id;
        
        if (!TUtil.isDefined(oid)) {
            this.type = this.targets.otype || type || 'blank';
            
            const uniqueId = App.getOid(this.type);
            this.oid = uniqueId.oid;
            this.oidNum = uniqueId.num;
        } else {
            App.getOid(oid);
            this.type = oid;
            this.oid = oid;
            this.oidNum = 0;
        }
                
        if (!targets?.sourceDom && TUtil.isDefined(oid)) {
            this.originalId = oid;
        }        
        
        this._state = {};
    }

    state() {
        return this._state;
    }

    get targetValues() { return this.state().targetValues ??= {}; }
    get actualValues() { return this.state().actualValues ??= {}; }
    get lastActualValues() { return this.state().lastActualValues ??= {}; }
    get activeTargetList() { return this.state().activeTargetList ??= []; }
    get activeTargetMap() { return this.state().activeTargetMap ??= {}; }
    get updatingTargetList() { return this.state().updatingTargetList ??= []; }
    get updatingTargetMap() { return this.state().updatingTargetMap ??= {}; }
    get fetchActionTargetList() { return this.state().fetchActionTargetList ??= []; } 
    get activatedTargets() { return this.state().activatedTargets ??= []; }
    get targetMethodMap() { return this.state().targetMethodMap ??= {}; }
    get targetExecutionCount() { return this.state().targetExecutionCount ??= 0; }
    set targetExecutionCount(val) { this.state().targetExecutionCount = val; }
    get addedChildren() { return this.state().addedChildren ??= []; }
    get deletedChildren() { return this.state().deletedChildren ??= []; }
    get movedChildren() { return this.state().movedChildren ??= []; }
    get lastChildrenUpdate() { return this.state().lastChildrenUpdate ??= { additions: [], deletions: [] }; }
    get visibleChildren() { return this.state().visibleChildren ??= []; }
        
    set targetValues(val) { this.state().targetValues = val; }
    set actualValues(val) { this.state().actualValues = val; }
    set activeTargetMap(val) { this.state().activeTargetMap = val; }
    set activeTargetList(val) { this.state().activeTargetList = val; }
    set updatingTargetMap(val) { this.state().updatingTargetMap = val; }
    set updatingTargetList(val) { this.state().updatingTargetList = val; }

    getParent() {
        return this.parent;
    }

    initTargets() {        
        this.originalTargetNames = Object.keys(this.targets).filter(key => !TargetData.excludedTargetKeys.has(key));

        this.functionTargetNames = [];
        this.allTargetMap = {};
        
        if (TUtil.isDefined(this.originalId) && getDomTModelById(this.originalId)) {
            TUtil.mergeTargets(getDomTModelById(this.originalId), this);
            this.toDiscard = true;
            return;
        }
        
        this.actualValues = TargetData.defaultActualValues();
        this.targetValues = {};
        this.activeTargetMap = {};
        this.activeTargetList = [];

        this.originalTargetNames = Object.keys(this.targets).filter(key => !TargetData.excludedTargetKeys.has(key)).map(key => key.startsWith('_') ? key.slice(1) : key);

        const domExists = $Dom.query(`#${this.oid}`) || this.originalTargetNames.indexOf('$dom') >= 0;
        
        if (!domExists && !this.excludeDefaultStyling()) {
            Object.entries(TargetData.defaultTargetStyles).forEach(([key, value]) => {
                if (!(key in this.targets)) {
                    this.targets[key] = value;
                }
            });
            if (this.targets['canHaveDom'] !== false && !TUtil.isDefined(this.targets['domHolder'])) {
                this.targets['domHolder'] = true;
            }
        } else if (domExists) {
            this.targets['domIsland'] = true;
            if (!TUtil.isDefined(this.targets['reuseDomDefinition'])) {
                this.targets['reuseDomDefinition'] = true;
                this.targets['domHolder'] = true;
                if (!TUtil.isDefined(this.targets['excludeXYCalc'])) {
                    this.targets['excludeXYCalc'] = true;                
                } 
                if (!TUtil.isDefined(this.targets['x'])) {
                    this.targets['excludeX'] = true;
                }
                if (!TUtil.isDefined(this.targets['y'])) {
                    this.targets['excludeY'] = true;                
                }
                if (!TUtil.isDefined(this.targets['position'])) {
                    this.targets['position'] = 'relative';
                }
            }
        }

        Object.keys(this.targets).filter(key => !TargetData.excludedTargetKeys.has(key)).forEach((key, keyIndex) => {
            this.processNewTarget(key, keyIndex);
        });
    }
    
    processNewTarget(key, keyIndex) {
        
        const cleanKey = TargetUtil.getTargetName(key);
        let target = this.targets[key];
        
        if (!TUtil.isDefined(target)) {
            this.delVal(key);
            return;
        }
        
        const targetType = typeof target;

        const isInactiveKey = key.startsWith('_') || key.endsWith('$');
        
        let needsTargetExecution = TargetData.mustExecuteTargets[cleanKey] || isInactiveKey || (targetType !== 'string' && targetType !== 'number' && targetType !== 'boolean');          

        const isExternalEvent = !!TargetData.allEventMap[cleanKey];
        const isInternalEvent = !!TargetData.internalEventMap[cleanKey];

        if ((targetType !== 'object' || Array.isArray(target)) && needsTargetExecution) {
            target = TargetUtil.wrapTarget(this, target, key);
        }

        let doesNextTargetUsePrevValue = false;
        if (TUtil.isDefined(keyIndex)) {
            const prevKey = keyIndex > 0 ? this.originalTargetNames[keyIndex - 1] : undefined;
            const nextKey = keyIndex < this.originalTargetNames.length - 1 ? this.originalTargetNames[keyIndex + 1] : undefined;
            doesNextTargetUsePrevValue = nextKey && nextKey.endsWith('$') ? true : false;
            
            if (doesNextTargetUsePrevValue
                || isInactiveKey 
                || isExternalEvent 
                || isInternalEvent 
                || targetType === 'object'
                || targetType === 'function'
            ) { 
                if (!TUtil.isDefined(target.value) && !TargetParser.isChildObjectTarget(key, target) && !TargetParser.isIntervalTarget(target)) {                  
                    needsTargetExecution = true;
                    target = TargetUtil.wrapTarget(this, target, key);
                }
                TargetUtil.bindTarget(this, key, prevKey, nextKey, keyIndex);              
            }
        }
        
        if (key.startsWith('_')) {
            const k = key.slice(1);
            if (this.targets[key]) {
                this.targets[k] = this.targets[key];
            }      

            delete this.targets[key];
            key = k;
            target = this.targets[k];
        }
                
        if (isExternalEvent) { 
            this.externalEventMap ||= new Map();
            this.externalEventMap.set(cleanKey, true);
            target.active = false;
        }

        if (isInternalEvent) {
            this.internalEventMap ||= new Map();
            this.internalEventMap.set(cleanKey, true);
            target.active = false;
        }
        
        this.allTargetMap[cleanKey] = key;

        if (isInactiveKey) {
            this.targets[key].active = false;
        }            

        if (TargetData.bypassInitialProcessingTargetMap[cleanKey]) {
            return;
        }     

        if (TUtil.isDefined(target.initialValue)) {
            this.val(key, target.initialValue);            
        }
        
        if (target.active !== false || TUtil.isDefined(target.initialValue)) {  
            this.addToStyleTargetList(key);
        }

        if (TargetParser.isIntervalTarget(target)) {
            target.cycles = 1;
            target.isInterval = true;
        } else if (!needsTargetExecution) {    
            this.val(cleanKey, TUtil.isDefined(target?.value) ? target.value : target );
            return;
        }
        
        if (target.active !== false && this.canTargetBeActivated(key)) {
            this.addToActiveTargets(key);
        }
        
        this.functionTargetNames.push(key);
    }
    
    activate(targetName) {
        getLocationManager().addToActivatedList(this);
        this.currentStatus = 'active';
        if (targetName && this.isTargetEnabled(targetName) && this.activatedTargets.indexOf(targetName) === -1) {
            this.activatedTargets.push(targetName);
        }
    }

    isActivated() {
        return this.currentStatus === 'active';
    }
    
    deactivate() {
        this.currentStatus = undefined;
    }

    excludeDefaultStyling() {
        return this.targets['defaultStyling'] === false || this.excludeStyling() || (this.reuseDomDefinition() && !this.allStyleTargetMap);
    }    
    
    canTargetBeActivated(key) {
        const onDomEvent = this.targets.onDomEvent;
        if (onDomEvent) {
            const included = Array.isArray(onDomEvent) ? onDomEvent.includes(key) : onDomEvent === key;
            if (included && !this.hasDom()) {
                return false;
            }
        }
        return !this.activeTargetMap[key];
    }
    
    addToStyleTargetList(key, enforce) {
        
        key = TargetUtil.getTargetName(key);

        if (!enforce && (this.excludeStyling() || this.targets[`exclude${TUtil.capitalizeFirstLetter(key)}`])) {
            return;
        }
        
        const isAsyncStyleTarget = TargetData.asyncStyleTargetMap[key];
        const isAttributeTarget = TargetData.attributeTargetMap[key];     

        if (isAsyncStyleTarget || isAttributeTarget) {
            if (!this.asyncStyleTargetMap?.has(key)) {
                this.asyncStyleTargetMap ||= new Map();
                this.asyncStyleTargetMap.set(key, true);                 
            }
                      
        } else if (this.isStyleTarget(key)) {
            let styleFlag = true;
            if (TargetData.transformMap[key]) {
                if (this.getParent()) {
                    this.calcAbsolutePosition(this.getX(), this.getY());
                }
            } else if (key === 'width' || key === 'height') {
                const dimension = Math.floor(key === 'width' ? this.getWidth() : this.getHeight());
                if (this.styleMap[key] === dimension) {
                    styleFlag = false;
                }
            } else if (key === 'dim') {
                if (this.styleMap[key] === Math.floor(this.val('dim'))) {
                    styleFlag = false;
                }
            } else if (TUtil.isDefined(this.val(key)) && this.styleMap[key] === this.val(key)) {
                styleFlag = false;
            } 

            if (styleFlag && !this.styleTargetMap?.has(key)) {
                this.styleTargetMap ||= new Map();
                this.styleTargetMap.set(key, true);                
            }
        }

        if (TargetData.styleSet.has(key) && !this.allStyleTargetMap?.has(key)) {
            this.allStyleTargetMap ||= new Map();
            this.allStyleTargetMap.set(key, true);
        }
    }
   
    isStyleTarget(key) {
        return TargetData.styleTargetMap[key];
    }
    
    removeTarget(key) {
        delete this.targets[key];
        this.removeFromActiveTargets(key);
        this.removeFromUpdatingTargets(key);
        delete this.targetValues[key];
    }

    addTarget(key, target) {
        this.addTargets({ [key]: target });
    }

    addTargets(targets) {
        Object.keys(targets).forEach(key => {
            this.targets[key] = targets[key];
            this.removeFromUpdatingTargets(key);
            if (!this.originalTargetNames.includes(key)) {
                this.originalTargetNames.push(key);
            }
            const keyIndex = this.originalTargetNames.indexOf(key);
            
            this.processNewTarget(key, keyIndex);
        });

        if (this.hasDom()) {
            getEvents().attachEvents([this]);

        }

        getRunScheduler().schedule(1, 'addTargets-' + this.oid);
    }
        
    getTargetStepPercent(key, step, steps) {
        step = !TUtil.isDefined(step) ? this.getTargetStep(key) : step;
        return steps ? step / steps : 1;
    }

    resetTargetStep(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].step = 0;
        }

        return this;
    }
    
    resetTargetExecutionFlag(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].executionFlag = false;
        }

        return this;
    }

    resetTargetCycle(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].cycle = 0;
        }

        return this;
    }

    resetScheduleTimeStamp(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].scheduleTimeStamp = undefined;
        }

        return this;
    }

    resetTargetInitialValue(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].initialValue = undefined;
        }

        return this;
    }
    
    setTargetStatus(key, status) {
        const targetValue = this.targetValues[key];

        if (!targetValue) {
            return;
        }
        
        const oldStatus = targetValue.status;

        if (status === 'done' && oldStatus !== 'done' && oldStatus !== 'complete') {
          targetValue.completeCount++;
          targetValue.completeTime = TUtil.now();
        }

        targetValue.status = status;
        
        if (targetValue.status === 'fetching') {
            this.removeFromActiveTargets(key);
            this.removeFromUpdatingTargets(key);
            this.getParent().addToActiveChildren(this); 
        } else if (this.isTargetUpdating(key)) {
            this.addToUpdatingTargets(key);
            this.removeFromActiveTargets(key);
        } else if (this.isTargetActive(key)) {
            this.addToActiveTargets(key);
            this.removeFromUpdatingTargets(key);
        } else {
            this.removeFromActiveTargets(key);
            this.removeFromUpdatingTargets(key);
        }
        
    }

    getTargetStatus(key) {
        return this.targetValues[key]?.status ?? '';
    }

    isTargetActive(key) {
        return this.targetValues[key]?.status === 'active';
    }
    
    isTargetUpdating(key) {
        return this.targetValues[key]?.status === 'updating';
    }

    isTargetDone(key) {
        return this.targetValues[key]?.status === 'done';
    }

    isTargetComplete(key) {
        return this.targetValues[key]?.status === 'complete' ? true : this.targetValues[key] === undefined ? undefined : false;
    }
    
    isTargetCompleteDeep(key) {
        return TargetUtil.isTargetCompleteDeep(this, key);
    }
    
    isTargetFullyCompleted(key) {
        return TargetUtil.isTargetFullyCompleted(this, key);
    }
    
    arePreviousTargetsComplete(key) {
        return TargetUtil.arePreviousTargetsComplete(this, key);
    }
    
    cleanupTarget(key) {
        TargetUtil.cleanupTarget(this, key);
    }
    
    isComplete() {
        return TargetUtil.isTModelComplete(this);
    }
    
    isExecuted(key) {
        return this.targetValues[key] && this.targetValues[key].executionFlag;
    }
    
    neverExecuted(key) {
        return !this.targetValues[key];
    }

    isTargetImperative(key) {
        return this.targetValues[key] ? this.targetValues[key].isImperative : false;
    }

    getTargetExecutionCount(key) {
        return this.targetValues[key] ? this.targetValues[key].executionCount : 0;
    }

    setTargetComplete(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].status = 'complete';
        }
    }

    isTargetEnabled(key) {
        const target = this.targets[key];

        if (!TUtil.isDefined(target)) {
            return false;
        }
        
        if (typeof target.enabledOn === 'function') {  
            this.setTargetMethodName(key, 'enabledOn');
            return target.enabledOn.call(this);
        } else {
            return true;
        }
    }

    doesTargetEqualActual(key) {
        if (this.targetValues[key]) {
            const deepEquality = this.targets[key] ? this.targets[key].deepEquality : false;
            return deepEquality ? TUtil.areEqual(this.getTargetValue(key), this.val(key), deepEquality) : this.getTargetValue(key) === this.val(key);
        }

        return false;
    }

    getTargetValue(key) {
        const target = this.targetValues[key] || this.targets[key];
        if (!target) {
            return undefined;
        }

        const value = target.value ?? target;
        return (typeof value === 'function') ? value.call(this) : value;
    }

    getTargetStep(key) {
        return this.targetValues[key] ? this.targetValues[key].step : 0;
    }

    getScheduleTimeStamp(key) {
        return this.targetValues[key]?.scheduleTimeStamp;
    }

    isScheduledPending(key) {
        const lastScheduledTime = this.getScheduleTimeStamp(key); 
        const interval = this.getTargetInterval(key);
        return lastScheduledTime && lastScheduledTime + interval > TUtil.now();
    }
    
    isTargetInLoop(key) {
        const t = this.targets[key];
        if (!t) {
            return false;
        }

        const loop = (typeof t.loop === 'function') ? t.loop.call(this, key) : t.loop;

        return loop === true || loop === 'passive';
    }

    shouldScheduleRun(key) {
        const t = this.targets[key];
        if (!t) {
            return false;
        }

        if (t.triggerRerun !== undefined) {
            return !!t.triggerRerun;
        }

        if (t.loop !== undefined) {
            const loop = (typeof t.loop === 'function') ? t.loop.call(this, key) : t.loop;
            if (loop === 'passive') {
                return false;
            }
        }

        return true;
    }

    getTargetInitialValue(key) {
        return this.targetValues[key]?.initialValue;
    }

    getLastUpdate(key) {
        return this.targetValues[key]?.lastUpdate;
    }
    
    getDimLastUpdate() {
        return Math.max(
            this.getLastUpdate('width') ?? 0,
            this.getLastUpdate('height') ?? 0,
            this.getLastUpdate('size') ?? 0,
            this.domHeightTimestamp ?? 0,
            this.domWidthTimestamp ?? 0
        );
    }
    
    getTargetActivationTime(key) {
        return this.targetValues[key]?.activationTime ?? 0;
    }
    
    getTargetCreationTime(key) {
        return this.targetValues[key] ? this.targetValues[key].creationTime : undefined;
    }

    incrementTargetStep(key, now, lastUpdate, interval, steps) {
        const targetValue = this.targetValues[key];
        if (!targetValue) {
            return;
        }

        const stepInterval = interval || 8;
        
        const elapsed = now - lastUpdate;
        const stepIncrement = Math.max(1, Math.floor(elapsed / stepInterval));

        targetValue.step = Math.min(steps, targetValue.step + stepIncrement);

        return targetValue.step;        
    }
    
    getTargetEasing(key) {
        const easing = this.targetValues[key]?.easing;
        const target = this.targets[key];
        if (!target) {
            return easing;
        }
        
        return typeof target.easing === 'function' ? target.easing.call(this, this.getTargetCycle(key)) : easing;
    }

    getTargetInterval(key) {
        const interval = this.targetValues[key]?.interval ?? 0;
        const target = this.targets[key];
        if (!target) {
            return interval;
        }
        
        return typeof target.interval === 'function' ? target.interval.call(this, this.getTargetCycle(key)) : interval;        
    }    
    
    getTargetSteps(key) {
        const steps = this.targetValues[key]?.steps  ?? 0;
        const target = this.targets[key];
        if (!target) {
            return steps;
        }
        
        return typeof target.steps === 'function' ? target.steps.call(this, this.getTargetCycle(key)) : steps;
    }

    getTargetCycles(key) {
        const cycles = this.targetValues[key]?.cycles ?? 0;
        const target = this.targets[key];
        if (!target) {
            return cycles;
        }
        
        return typeof target.cycles === 'function' ? target.cycles.call(this, this.getTargetCycle(key), cycles) : cycles;
    }

    getTargetCycle(key) {
        return this.targetValues[key]?.cycle ?? 0;
    }

    incrementTargetCycle(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].cycle++;
        }
        return this.targetValues[key].cycle;        
    }

    setTargetInterval(key, value) {
        if (this.targetValues[key]) {
            this.targetValues[key].interval = value;
        }
        return this.targetValues[key].interval;
    }

    setScheduleTimeStamp(key, value) {
        if (this.targetValues[key]) {
            this.targetValues[key].scheduleTimeStamp = value;
        }
    }

    setTargetInitialValue(key, value) {
        if (this.targetValues[key]) {
            this.targetValues[key].initialValue = value;
        }
    }

    setLastUpdate(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].lastUpdate = TUtil.now();
            this.targetValues[key].updateCount++;
        }
    }

    setTarget(key, value, steps, interval, easing) {     
        if (typeof key === 'object' && key !== null) {
            [value, steps, interval, easing] = [key, value, steps, interval, easing];
            key = '';
        }
        
        if (typeof key === 'string') {
            key = !key.endsWith('+') ? key + "+" : key;
        }

        const originalTargetName = TargetUtil.currentTargetName;
        const originalTModel = TargetUtil.currentTModel;
            
        if (this.getParent() === originalTModel) {
            TargetUtil.markChildAction(originalTModel, originalTargetName, this);
        }
        
        this.markLayoutDirty(key);
        
        TargetExecutor.executeImperativeTarget(this, key, value, steps, interval, easing, originalTargetName, originalTModel);

        return this;
    }
    
    cancelAnimation() {
        if (!this.hasAnimatingTargets()) {
            return;
        }
        
        for (const [key] of this.animatingMap) {
            if (this.targetValues[key]) {
                this.targetValues[key].status = 'done';
                this.removeFromUpdatingTargets(key);
                this.removeFromActiveTargets(key);
            }
        }
        
        getAnimationManager().deleteAnimation(this);
        this.pausedBatch = undefined;
    }
    
    hasTargetUpdates(key) {
        return key ? this.updatingTargetMap[key] === true || this.animatingMap?.has(key) : this.updatingTargetList.length > 0;
    }

    addToActiveTargets(key) {
        if (!this.activeTargetMap[key] && this.canTargetBeActivated(key)) {
            this.markLayoutDirty(key);
            this.activeTargetMap[key] = true;
            this.activeTargetList.push(key);
            this.getParent()?.addToActiveChildren(this);
        }
    }

    removeFromActiveTargets(key) {      
        if (this.activeTargetMap[key]) {
            delete this.activeTargetMap[key];
            const index = this.activeTargetList.indexOf(key);
            if (index >= 0) {
                this.activeTargetList.splice(index, 1);
            }           
        }
        if (this.activeTargetList.length === 0) {
            this.getParent()?.removeFromActiveChildren(this);
        }         
    }

    addToUpdatingTargets(key) {

        if (!this.updatingTargetMap[key]) {
            this.markLayoutDirty(key);
            this.updatingTargetMap[key] = true;
            this.updatingTargetList.push(key);
            this.getParent()?.addToUpdatingChildren(this);
        }
    }

    removeFromUpdatingTargets(key) {       
        if (this.updatingTargetMap[key]) {
            delete this.updatingTargetMap[key];
            const index = this.updatingTargetList.indexOf(key);
            if (index >= 0) {
                this.updatingTargetList.splice(index, 1);
            }
        }
        if (this.updatingTargetList.length === 0) {
            this.getParent()?.removeFromUpdatingChildren(this);
        }        
    }
    
    hasUpdatingImperativeTargets(originalTargetName) {
        const updatingList = [
          ...(this.updatingTargetList ?? []),
          ...(this.hasAnimatingTargets() ? [...this.animatingMap.keys()] : [])
        ];        
        
        for (const target of updatingList) {
            if (this.isTargetImperative(target) && this.targetValues[target].originalTargetName === originalTargetName) {
                return true;
            }
        }
        
        return false;
    }
    
    getUpdatingImperativeTargets(originalTargetName) {
        const targets = [];
        for (const target of this.updatingTargetList) {
            if (this.isTargetImperative(target) && this.targetValues[target].originalTargetName === originalTargetName) {
                targets.push(target);
            }
        }
        
        return targets;
    }
    
    hasAnyUpdates() {
        return this.updatingTargetList.length !== 0 || this.activeTargetList.length !== 0 || (this.animatingMap?.size ?? 0) !== 0;  
    }
    
    removeFromAnimatingMap(key) {
        if (this.animatingMap?.has(key)) {
            this.animatingMap.delete(key);
            if (this.animatingMap.size === 0) {
                this.getParent()?.removeFromAnimatingChildren(this);
            }
        }
    }
    
    clearAnimatingMap() {
        this.animatingMap?.clear();
        this.getParent()?.removeFromAnimatingChildren(this);
    }
    
    addToAnimatingMap(key, record = true) {
        if (this.targetValues[key]?.snapAnimation) {
            return;
        }
        this.animatingMap ||= new Map();        
        this.animatingMap.set(key, record);
        this.getParent()?.addToAnimatingChildren(this);
    }
    
    isKeyAnimating(key) {
        if (!this.animatingMap) {
            return false;
        }
        
        const { originalTargetName } = TargetUtil.getOriginalNames(this, key);

        return this.animatingMap.has(key) && this.animatingMap.get(key).originalTargetName === originalTargetName;
    }    
    
    addToUpdatingChildren(child) {
        this.updatingChildrenMap ||= new Map();
        this.updatingChildrenMap.set(child.oid, child);
    }

    removeFromUpdatingChildren(child) {
        this.updatingChildrenMap?.delete(child.oid);   
    } 
    
    addToAnimatingChildren(child) {
        this.animatingChildrenMap ||= new Map();
        this.animatingChildrenMap.set(child.oid, child);
    }
    
    removeFromAnimatingChildren(child) {
        this.animatingChildrenMap?.delete(child.oid);
    }    
    addToActiveChildren(child) {
        this.activeChildrenMap ||= new Map();
        this.activeChildrenMap.set(child.oid, child);
    }
    
    removeFromActiveChildren(child) {
        this.activeChildrenMap?.delete(child.oid); 
    }     
    
    hasActiveChildren() {
        return !!this.activeChildrenMap?.size;
    } 
    
    hasUpdatingChildren() {
        return !!this.updatingChildrenMap?.size;
    }   
    
    hasAnimatingChildren() {
        return !!this.animatingChildrenMap?.size;
    }
    
    hasAnimatingTargets() {
        return !!this.animatingMap?.size;
    }
    
    hasValidAnimation() {
        return this.hasAnimatingTargets() && this.lastBatch && this.lastBatch.totalDuration > 0;
    }

    deleteTargetValue(key) {        
        delete this.targetValues[key];
        this.addToActiveTargets(key);
        this.removeFromUpdatingTargets(key);
        
        return this;
    }
    
    clearAnimatingChildren() {
        this.animatingChildrenMap?.clear();
    }
    
    clearUpdatingChildren() {
        this.updatingChildrenMap?.clear();
    }
    
    clearActiveChildren() {
        this.activeChildrenMap?.clear();   
    }    
 
    resetTarget(key) {
        const targetValue = this.targetValues[key];
        
        if (targetValue) {
            targetValue.isImperative = false;
            targetValue.executionFlag = false;
            targetValue.scheduleTimeStamp = undefined;
            targetValue.step = 0;
            targetValue.cycle = 0;
            targetValue.steps = 0;
            targetValue.cycles = 0;
            targetValue.interval = 0;
            targetValue.status = '';
        }
        
        return this;
    }
    
    activateTargets(keys) {
        if (Array.isArray(keys)) {
            keys.forEach(key => this.activateTarget(key));
        }
    }

    activateTarget(key, value) {
        if (this.canTargetBeActivated(key)) {
            if (TUtil.isDefined(value)) {
                this.val(`___${key}`, value);
            }
           
            if (this.isVisible()) {
                this.markLayoutDirty(key);
            }
            
            const target = this.targets[key];
            
            if (target?.childAction?.length) {
                target.childAction = [];
            }
            if (target?.addChildAction?.length) {
                target.addChildAction = [];
            }
                                
            const invokerTModel = TargetUtil.currentTModel;
            const invokerTarget = TargetUtil.currentTargetName;

            const targetValue = this.targetValues[key] || TargetUtil.emptyValue();

            if (this.getParent() === invokerTModel) {
                TargetUtil.markChildAction(invokerTModel, invokerTarget, this);
            }

            targetValue.invokerTModel = invokerTModel;
            targetValue.invokerTarget = invokerTarget;

            if (this.targetValues[key]) {
                targetValue.activationTime = TUtil.now();
                targetValue.lastUpdate = TUtil.now();
                targetValue.isImperative = false;
                targetValue.executionFlag = false;
                targetValue.scheduleTimeStamp = undefined;
                targetValue.step = 0;
                targetValue.cycle = Array.isArray(targetValue.valueList) ? 1 : 0;
                targetValue.initialValue = undefined;
            } else {
                this.targetValues[key] = targetValue;
                targetValue.cycles = this.targets[key]?.cycles ?? targetValue.cycles;                
            }
                            
            this.setTargetStatus(key, 'active');

            this.activate(key);           
        }

        return this;
    }
    
    manageChildTargetExecution(child) {
        return child.hasChildren() 
                || child.addedChildren.length > 0 
                || child.dirtyLayout
                || child.targetExecutionCount === 0;
    }

    setTargetMethodName(targetName, methodName) {
        if (TargetData.ignoreTargetMethodNameMap[targetName] && !this.isTargetUpdating(targetName) && !this.isTargetImperative(targetName)) {
            return;
        }

        if (!this.targetMethodMap[targetName]) {
            this.targetMethodMap[targetName] = [];
        }
        if (!this.targetMethodMap[targetName].includes(methodName)) {
            this.targetMethodMap[targetName].push(methodName);
        }
    }  
}

export { BaseModel };

