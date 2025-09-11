import { tApp, App, getRunScheduler, getLocationManager, getDomTModelById, getLoader } from "./App.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { TUtil } from "./TUtil.js";
import { TModelUtil } from "./TModelUtil.js";
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
            this.type = type || this.targets.otype || 'blank';
            
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
    get updatingChildrenList() { return this.state().updatingChildrenList ??= []; }
    get updatingChildrenMap() { return this.state().updatingChildrenMap ??= {}; }
    get activeChildrenList() { return this.state().activeChildrenList ??= []; }
    get activeChildrenMap() { return this.state().activeChildrenMap ??= {}; }
    get externalEventList() { return this.state().externalEventList ??= []; }
    get internalEventList() { return this.state().internalEventList ??= []; }
    get coreTargets() { return this.state().coreTargets ??= []; }
    get allStyleTargetList() { return this.state().allStyleTargetList ??= []; }
    get allStyleTargetMap() { return this.state().allStyleTargetMap ??= {}; }
    get styleTargetList() { return this.state().styleTargetList ??= []; }
    get styleTargetMap() { return this.state().styleTargetMap ??= {}; }
    get asyncStyleTargetList() { return this.state().asyncStyleTargetList ??= []; }
    get asyncStyleTargetMap() { return this.state().asyncStyleTargetMap ??= {}; }
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
        } else if (domExists && !TUtil.isDefined(this.targets['reuseDomDefinition'])) {
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

        Object.keys(this.targets).filter(key => !TargetData.excludedTargetKeys.has(key)).forEach((key, keyIndex) => {
            this.processNewTarget(key, keyIndex);
        });
    }
    
    processNewTarget(key, keyIndex) {
        
        const cleanKey = TargetUtil.getTargetName(key);
        let target = this.targets[key] || this.targets[cleanKey];
        
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
                if (!target.value && !TargetParser.isChildObjectTarget(key, target) && !TargetParser.isIntervalTarget(target)) {
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
            if (!this.allTargetMap[cleanKey]) {
                this.externalEventList.push(cleanKey);
                target.active = false;
            }
        }

        if (isInternalEvent) {
            if (!this.allTargetMap[cleanKey]) {
                this.internalEventList.push(cleanKey);
                target.active = false;
            }
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
        
        if (TargetData.coreTargetMap[key] && !this.coreTargets.includes(key)) {
            this.coreTargets.push(key);
        }
        
        if (!needsTargetExecution) {          
            this.val(cleanKey, typeof target === 'object' ? target.value : target );
            return;
        }
        
        if (TargetParser.isIntervalTarget(target)) {
            target.cycles = 1;
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
        return this.targets['defaultStyling'] === false || this.excludeStyling() || (this.reuseDomDefinition() && this.allStyleTargetList.length === 0);
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
            if (!this.asyncStyleTargetMap[key]) {
                this.asyncStyleTargetList.push(key);
                this.asyncStyleTargetMap[key] = true;
            }
        } else if (this.isStyleTarget(key)) {
            let styleFlag = true;
            if (TargetData.transformMap[key]) {
                if (this.getParent()) {
                    this.calcAbsolutePosition(this.getX(), this.getY());
                }
                if (TModelUtil.getTransformValue(this, key) === Math.floor(this.transformMap[key])) {
                    styleFlag = false;
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

            if (styleFlag && !this.styleTargetMap[key]) {
                this.styleTargetList.push(key);
                this.styleTargetMap[key] = true;                
            }
        } else if (!this.styleTargetMap[key]) {
            this.styleTargetList.push(key);
            this.styleTargetMap[key] = true;            
        } else {
            return;
        }

        if (TargetData.styleSet.has(key) && !this.allStyleTargetMap[key]) {
            this.allStyleTargetList.push(key);
            this.allStyleTargetMap[key] = true;
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
            this.processNewTarget(key);
        });

        getRunScheduler().schedule(1, 'addTargets-' + this.oid);
    }
        
    getTargetStepPercent(key, step) {
        const steps = this.getTargetSteps(key);
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
    
    updateTargetStatus(key) {
        const targetValue = this.targetValues[key];

        if (!targetValue) {
            return;
        }

        const cycle = this.getTargetCycle(key);
        const cycles = this.getTargetCycles(key);
        const step = this.getTargetStep(key);
        const steps = this.getTargetSteps(key);

        if (TargetUtil.isTargetAlreadyUpdating(this, key)) {
            targetValue.status = 'done';
            targetValue.step = steps;
            targetValue.cycle = cycles;
        } else if (this.isExecuted(key) && step < steps) {
            targetValue.status = 'updating';
        } else if (Array.isArray(targetValue.valueList) && cycle < targetValue.valueList.length - 1) {
            targetValue.status = 'updating';
        } else if (!this.isExecuted(key) || this.isTargetInLoop(key) || cycle < cycles) {
            targetValue.status = 'active';
        } else if (this.targets[key]?.fetchAction && !getLoader().isLoadingSuccessful(this, key)) {
            targetValue.status = 'fetching';
        } else {
            targetValue.status = 'done';
        }

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
            tApp.manager.doneTargets.push({ tmodel: this, key: key });
        }

        return targetValue.status;
    }

    getTargetStatus(key) {
        return this.targetValues[key] ? this.targetValues[key].status : '';
    }

    isTargetActive(key) {
        return this.targetValues[key] && this.targetValues[key].status === 'active';
    }

    isTargetUpdating(key) {
        return this.targetValues[key] && this.targetValues[key].status === 'updating';
    }

    isTargetDone(key) {
        return this.targetValues[key] && this.targetValues[key].status === 'done';
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

    isTargetInLoop(key) {
        return this.targets[key] ? (typeof this.targets[key].loop === 'function' ? this.targets[key].loop.call(this, key) : this.targets[key].loop) : false;
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
    
    getTargetSteps(key) {
        return this.targetValues[key] ? this.targetValues[key].steps || 0 : 0;
    }

    getTargetStep(key) {
        return this.targetValues[key] ? this.targetValues[key].step : 0;
    }

    getScheduleTimeStamp(key) {
        return this.targetValues[key] ? this.targetValues[key].scheduleTimeStamp : undefined;
    }

    isScheduledPending(key) {
        const lastScheduledTime = this.getScheduleTimeStamp(key); 
        const interval = this.getTargetInterval(key);
        return lastScheduledTime && lastScheduledTime + interval > TUtil.now();
    }
    
    shouldScheduleRun(key) {
        return this.targets[key]?.triggerRerun ?? true;
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

        const stepInterval = interval || 7;
        
        const elapsed = now - lastUpdate;
        const stepIncrement = Math.max(1, Math.floor(elapsed / stepInterval));

        targetValue.step = Math.min(steps, targetValue.step + stepIncrement);

        return targetValue.step;        
    }

    getTargetCycles(key) {
        return this.targetValues[key] ? this.targetValues[key].cycles || 0 : 0;
    }

    getTargetCycle(key) {
        return this.targetValues[key] ? this.targetValues[key].cycle : 0;
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
        }
    }

    getTargetEasing(key) {
        return typeof this.targetValues[key].easing === 'function' ? this.targetValues[key].easing : undefined;
    }

    getTargetInterval(key) {
        const targetValue = this.targetValues[key];
        return targetValue?.interval || 0;
    }

    setTarget(key, value, steps, interval, easing) {       
        if (typeof key === 'object' && key !== null) {
            [value, steps, interval, easing] = [key, value, steps, interval, easing];
            key = '';
        }
        const originalTargetName = TargetUtil.currentTargetName;
        const originalTModel = TargetUtil.currentTModel;
            
        if (this.getParent() === originalTModel) {
            TargetUtil.markChildAction(originalTModel, this);
        }
                
        this.markLayoutDirty(key);
        
        TargetExecutor.executeImperativeTarget(this, key, value, steps, interval, easing, originalTargetName, originalTModel);

        return this;
    }
    
    hasTargetUpdates(key) {
        return key ? this.updatingTargetMap[key] === true : this.updatingTargetList.length > 0;
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

        const oldKey = this.updatingTargetList.find(k => k !== key && TargetUtil.getTargetName(k) === TargetUtil.getTargetName(key));
        if (oldKey) {
            this.resetTarget(oldKey);
            this.removeFromUpdatingTargets(oldKey);
        }
        
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
        for (const target of this.updatingTargetList) {
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
    
    addToUpdatingChildren(child) {
        if (!this.updatingChildrenMap[child.oid]) {
            this.updatingChildrenMap[child.oid] = true;
            this.updatingChildrenList.push(child);
        }
    }

    removeFromUpdatingChildren(child) {
        if (this.updatingChildrenMap[child.oid]) {
            delete this.updatingChildrenMap[child.oid];
            const index = this.updatingChildrenList.indexOf(child);
            if (index >= 0) {
                this.updatingChildrenList.splice(index, 1);
            }
        }
    } 
    
    addToActiveChildren(child) {
        if (!this.activeChildrenMap[child.oid]) {              
            this.activeChildrenMap[child.oid] = true;
            this.activeChildrenList.push(child);
        }
    }
    
    removeFromActiveChildren(child) {
        if (this.activeChildrenMap[child.oid]) {         
            delete this.activeChildrenMap[child.oid];
            const index = this.activeChildrenList.indexOf(child);
            if (index >= 0) {
                this.activeChildrenList.splice(index, 1);
            }
        }
    }     
    
    hasActiveChildren() {
        return this.activeChildrenList.length > 0;
    } 
    
    hasUpdatingChildren() {
        return this.updatingChildrenList.length > 0;
    }   

    deleteTargetValue(key) {        
        delete this.targetValues[key];
        this.addToActiveTargets(key);
        this.removeFromUpdatingTargets(key);
        
        return this;
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

    activateTarget(key, value) {
        if (this.canTargetBeActivated(key)) {
            if (TUtil.isDefined(value)) {
                this.val(`___${key}`, value);
            }
           
            if (this.isVisible()) {
                this.markLayoutDirty(key);
            }

            const targetValue = this.targetValues[key] || TargetUtil.emptyValue();
            
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
            }
                            
            this.updateTargetStatus(key);

            this.activate(key);           
        }

        return this;
    }
    
    manageChildTargetExecution(child, shouldCalculateChildTargets) {
        return shouldCalculateChildTargets
                || this.shouldCalculateChildTargets()
                || child.hasChildren() 
                || child.addedChildren.length > 0 
                || child.dirtyLayout
                || child.targetExecutionCount === 0;
    }
    
    shouldCalculateChildTargets() {
        return this.val('shouldCalculateChildTargets');
    }
    
    getCoreTargets() {
        const explicit = this.val('coreTargets');
        if (TUtil.isDefined(explicit)) {
            return explicit;
        }

        return this.coreTargets;
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

