import { tApp, App, getRunScheduler, getLocationManager, getDomTModelById } from "./App.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { TUtil } from "./TUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { SearchUtil } from "./SearchUtil.js";
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
        this.type = type || 'blank';
        this.targets = Object.assign({}, targets);
        
        if (!TUtil.isDefined(oid)) {
            const uniqueId = App.getOid(this.type);
            this.oid = uniqueId.oid;
            this.oidNum = uniqueId.num;
        } else {
            App.getOid(oid);
            this.oid = oid;
            this.oidNum = 0;
        }
        
        if (!targets?.sourceDom && TUtil.isDefined(oid)) {
            this.originalId = oid;
        }        
        
        if (!App.tmodelIdMap[this.oid]) {
            App.tmodelIdMap[this.oid] = this;
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
    get childActionTargetList() { return this.state().childActionTargetList ??= []; }
    get fetchActionTargetList() { return this.state().fetchActionTargetList ??= []; }    
    get updatingChildrenList() { return this.state().updatingChildrenList ??= []; }
    get updatingChildrenMap() { return this.state().updatingChildrenMap ??= {}; }
    get activeChildrenList() { return this.state().activeChildrenList ??= []; }
    get activeChildrenMap() { return this.state().activeChildrenMap ??= {}; }
    get externalEventList() { return this.state().externalEventList ??= []; }
    get externalEventMap() { return this.state().externalEventMap ??= {}; }
    get internalEventList() { return this.state().internalEventList ??= []; }
    get internalEventMap() { return this.state().internalEventMap ??= {}; }
    get coreTargets() { return this.state().coreTargets ??= []; }
    get allStyleTargetList() { return this.state().allStyleTargetList ??= []; }
    get allStyleTargetMap() { return this.state().allStyleTargetMap ??= {}; }
    get styleTargetList() { return this.state().styleTargetList ??= []; }
    get styleTargetMap() { return this.state().styleTargetMap ??= {}; }
    get asyncStyleTargetList() { return this.state().asyncStyleTargetList ??= []; }
    get asyncStyleTargetMap() { return this.state().asyncStyleTargetMap ??= {}; }
    get activatedTargets() { return this.state().activatedTargets ??= []; }
    get targetMethodMap() { return this.state().targetMethodMap ??= []; }
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
        this.originalTargetNames = Object.keys(this.targets);
        
        if (TUtil.isDefined(this.originalId) && getDomTModelById(this.originalId)) {
            TUtil.mergeTargets(getDomTModelById(this.originalId), this);
            this.toDiscard = true;
            return;
        }
        
        this.actualValues = TargetData.defaultActualValues();
        this.targetValues = {};
        this.activeTargetMap = {};
        this.activeTargetList = [];

        this.originalTargetNames = Object.keys(this.targets);

        const domExists = $Dom.query(`#${this.oid}`) || this.originalTargetNames.indexOf('$dom') >= 0;

        if (!domExists && !this.excludeDefaultStyling()) {
            Object.entries(TargetData.defaultTargetStyles).forEach(([key, value]) => {
                if (!(key in this.targets)) {
                    this.targets[key] = value;
                }
            });
        } else if (domExists && !TUtil.isDefined(this.targets['reuseDomDefinition'])) {
            this.targets['reuseDomDefinition'] = true;
            if (!TUtil.isDefined(this.targets['excludeXYCalc'])) {
                this.targets['excludeXYCalc'] = true;                
            } 
            if (!TUtil.isDefined(this.targets['x'])) {
                this.targets['excludeX'] = true;
            }
            if (!TUtil.isDefined(!this.targets['y'])) {
                this.targets['excludeY'] = true;                
            }
            if (!TUtil.isDefined(this.targets['position'])) {
                this.targets['position'] = 'relative';
            }            
        }

        Object.keys(this.targets).forEach((key, keyIndex) => {
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
        
        const isInactiveKey = key.startsWith('_') || (key.endsWith('$') && !target.active);
        const isExternalEvent = TargetData.allEventMap[cleanKey];
        const isInternalEvent = TargetData.internalEventMap[cleanKey];

        if (!TargetData.controlTargetMap[key]) {
            if (targetType !== 'object' || Array.isArray(target)) {
                this.targets[key] = { value: target };
                target = this.targets[key];
            }
        }

        let doesNextTargetUsePrevValue = false;
        if (TUtil.isDefined(keyIndex)) {
            const prevKey = keyIndex > 0 ? TargetUtil.getTargetName(this.originalTargetNames[keyIndex - 1]) : undefined;
            const nextKey = keyIndex < this.originalTargetNames.length - 1 ? this.originalTargetNames[keyIndex + 1] : undefined;
            doesNextTargetUsePrevValue = nextKey && nextKey.endsWith('$') ? true : false;
            
            if (doesNextTargetUsePrevValue
                || isInactiveKey 
                || isExternalEvent 
                || isInternalEvent 
                || targetType === 'object'
                || targetType === 'function'
            ) {            
                TargetUtil.bindTarget(this, key, prevKey, nextKey);
            }
        }

        if (isExternalEvent) {
            if (!this.externalEventMap[cleanKey]) {
                this.externalEventList.push(cleanKey);
                this.externalEventMap[cleanKey] = true;
                target.active = false;
            }
        }
        
        if (isInternalEvent) {
            if (!this.internalEventMap[cleanKey]) {
                this.internalEventList.push(cleanKey);
                this.internalEventMap[cleanKey] = true;
                target.active = false;
            }
        }        

        if (cleanKey !== key) {
            if (this.targets[key]) {
                this.targets[cleanKey] = this.targets[key];
                this.targets[cleanKey].originalName = key;
            }
            if (isInactiveKey) {
                this.targets[cleanKey].active = false;
            }
            
            delete this.targets[key];
            key = cleanKey;
            target = this.targets[key];
        }

        if (TargetData.bypassInitialProcessingTargetMap[key]) {
            return;
        }     

        if (TUtil.isDefined(target.initialValue)) {
            this.val(key, target.initialValue);
        }

        this.addToStyleTargetList(key);

        if (TargetData.coreTargetMap[key] && !this.coreTargets.includes(key)) {
            this.coreTargets.push(key);
        }
        
        if (!TargetData.mustExecuteTargets[key] && !doesNextTargetUsePrevValue && (targetType === 'string' || targetType === 'number' || targetType === 'boolean')) {          
            this.val(key, typeof target === 'object' ? target.value : target );
            return;
        }
        
        if (TUtil.isDefined(target.interval) && !TUtil.isDefined(target.steps) && !TUtil.isDefined(target.cycles) && !TUtil.isDefined(target.value)) {
            target.cycles = 1;
        }
        
        if (target.active !== false && this.canTargetBeActivated(key)) {
            this.addToActiveTargets(key);
        }
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
   
    shouldExecuteCyclesInParallel(key) {
        return this.targets[key]?.parallel === true;
    }
    
    canTargetBeActivated(key) {
        return (Array.isArray(this.targets['onDomEvent']) && this.targets['onDomEvent'].includes(key) && !this.hasDom()) ? false : !this.activeTargetMap[key];
    }
    
    addToStyleTargetList(key, enforce) {
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
                if (TModelUtil.getTransformValue(this, key) === this.transformMap[key]) {
                    styleFlag = false;
                }
            } else if (key === 'width' || key === 'height') {
                const dimension = Math.floor(key === 'width' ? this.getWidth() : this.getHeight());
                if (this.styleMap[key] === dimension) {
                    styleFlag = false;
                }
            } else if (TUtil.isDefined(this.val(key)) && this.styleMap[key] === this.val(key)) {
                styleFlag = false;
            }

            if (styleFlag && !this.styleTargetMap[key]) {
                this.styleTargetList.push(key);
                this.styleTargetMap[key] = true;                
            }
        } else if (this.useWindowFrame(key) && !this.styleTargetMap[key]) {
            this.styleTargetList.push(key);
            this.styleTargetMap[key] = true;            
        } else {
            return;
        }

        if (!this.allStyleTargetMap[key]) {
            this.allStyleTargetList.push(key);
            this.allStyleTargetMap[key] = true;
        }
    }
   
    isStyleTarget(key) {
        return TargetData.styleTargetMap[key];
    }
    
    useWindowFrame(key) {
        return Array.isArray(this.targets['useWindowFrame']) && this.targets['useWindowFrame'].includes(key);
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

        if (this.isExecuted(key) && step < steps) {
            this.targetValues[key].status = 'updating';
        } else if (Array.isArray(targetValue.valueList) && cycle < targetValue.valueList.length - 1) {
            this.targetValues[key].status = 'updating';
        } else if (!this.isExecuted(key) || this.isTargetInLoop(key) || cycle < cycles) {
            this.targetValues[key].status = 'active';
        } else {
            this.targetValues[key].status = 'done';
        }

        if (this.isTargetUpdating(key)) {
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

        return this.targetValues[key].status;
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
        return this.targetValues[key] && this.targetValues[key].status === 'complete';
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
        return this.targetValues[key] ? (typeof this.targetValues[key].value === 'function' ? this.targetValues[key].value.call(this) : this.targetValues[key].value) : undefined;
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

    getActualValueLastUpdate(key) {
        return this.targetValues[key]?.actualValueLastUpdate;
    }
    
    getDimLastUpdate() {
        return Math.max(
            this.getActualValueLastUpdate('width') || 0,
            this.getActualValueLastUpdate('height') || 0,
            this.domHeightTimestamp,
            this.domWidthTimestamp
        );
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

    setActualValueLastUpdate(key) {
        if (this.targetValues[key]) {
            this.targetValues[key].actualValueLastUpdate = TUtil.now();
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
            TargetUtil.markTargetAction(originalTModel, 'childAction');
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
            if (this.activeTargetList.length === 0) {
                this.getParent()?.removeFromActiveChildren(this);
            }            
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
            if (this.updatingTargetList.length === 0) {
                this.getParent()?.removeFromUpdatingChildren(this);
            }
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

    deleteTargetValue(key) {
        const targetValue = this.targetValues[key];
        
        delete this.targetValues[key];
        this.addToActiveTargets(key);
        this.removeFromUpdatingTargets(key);
        
        if (targetValue) {
            getRunScheduler().schedule(1, 'deleteTargetValue-' + this.oid + "-" + key);
        }
        
        return this;
    }    
 
    resetImperative(key) {
        const targetValue = this.targetValues[key];
        
        const isImperative = targetValue?.isImperative;

        if (targetValue) {
            targetValue.isImperative = false;
            targetValue.executionFlag = false;
            targetValue.scheduleTimeStamp = undefined;
            targetValue.step = 0;
            targetValue.cycle = 0;
            targetValue.steps = 0;
            targetValue.cycles = 0;
            targetValue.interval = 0;
        }

        if (isImperative) {
            getRunScheduler().schedule(1, 'resetImperative-' + this.oid + "-" + key);
        }

        return this;
    }

    activateTarget(key, value) {
        if (this.canTargetBeActivated(key)) {
            if (TUtil.isDefined('value')) {
                this.val(`__${key}`, value);
            }
            
            this.markLayoutDirty(key);

            const targetValue = this.targetValues[key];
            
            if (targetValue) {
                targetValue.isImperative = false;
                targetValue.executionFlag = false;
                targetValue.scheduleTimeStamp = undefined;
                targetValue.step = 0;
                targetValue.cycle = Array.isArray(targetValue.valueList) ? 1 : 0;

                this.updateTargetStatus(key);
            } else {
                this.addToActiveTargets(key);
            }           
            this.activate(key);            
        }

        return this;
    }
    
    activateAncestorTarget(key) {
        SearchUtil.findParentByTarget(this, key)?.activateTarget(key);
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

        return this.state().coreTargets;
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

