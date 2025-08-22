import { BracketGenerator } from "./BracketGenerator.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { tApp, getTargetManager } from "./App.js";

/*
 * It calculates the locations and dimensions of all objects and triggers the calculation of all targets. 
 * It functions as an integral part of TargetJ process cycle, playing a crucial role."
 */
class LocationManager {
    constructor() {
        this.hasLocationList = [];
        this.hasLocationMap = {};
        
        this.visibleChildrenLengthMap = {};
        this.updatedContainerMap = {};

        this.locationListStats = [];
        
        this.activatedList = [];
        this.activatedMap = {};    
    }
    
    clear() {
        this.visibleChildrenLengthMap = {};
        this.updatedContainerMap = {}; 
        this.activatedList = [];
        this.activatedMap = {};        
    }

    calculateAll() {
        this.hasLocationList.length = 0;
        this.hasLocationMap = {};
        this.locationListStats = [];

        this.startTime = TUtil.now();

        this.calculate();
        
        Object.keys(this.visibleChildrenLengthMap).forEach(key => {
            const { tmodel, visibleCount } = this.visibleChildrenLengthMap[key];
            if (tmodel.isVisible() && (visibleCount !== tmodel.visibleChildren.length || tmodel.visibleChildren.length === 0)) {
                this.runEventTargets(tmodel, ['onVisibleChildrenChange']);
                this.visibleChildrenLengthMap[key].visibleCount = tmodel.visibleChildren.length; 
            }
        });
        
        Object.keys(this.updatedContainerMap).forEach(key => {
            const tmodel = this.updatedContainerMap[key];
            if (tmodel.isVisible()) {
                this.runEventTargets(tmodel, ['onChildrenChange']);
                delete this.updatedContainerMap[key];                                
            }
        }); 

        //console.log(this.locationListStats);
    }

    calculate() {
        this.calculateContainer(tApp.tRoot);
    }

    calculateActivated() {
        let i = 0;     
                
        const activatedList = this.activatedList;
        
        this.activatedList = [];
        this.activatedMap = {};      
                
        while (i < activatedList.length) {
            const child = activatedList[i++];

            const activatedTargets = child.activatedTargets.slice(0);
                    
            child.activatedTargets.length = 0;
                                  
            getTargetManager().applyTargetValues(child, activatedTargets);
            
            if (child.updatingTargetList.length > 0) {
                getTargetManager().setActualValues(child, child.updatingTargetList.filter((key => child.getTargetStep(key) === 0)));
            }
            
            if (!this.hasLocationMap[child.oid]) {
                this.addToLocationList(child);
            }
        }
    }

    getChildren(container) {
        container.getChildren();
        
        if (container.shouldBeBracketed()) {
            return BracketGenerator.generate(container);
        } else {
            container.lastChildrenUpdate.additions.length = 0;
            container.lastChildrenUpdate.deletions.length = 0;                
        }
        
        if (BracketGenerator.bracketMap[container.oid]) {
            delete BracketGenerator.bracketMap[container.oid];
            delete BracketGenerator.pageMap[container.oid];
        }
        
        return container.getChildren();
    }
    
    calculateContainer(container, shouldCalculateChildTargets = true) {
        const allChildrenList = this.getChildren(container);
        const viewport = container.createViewport();
        if (container.childrenUpdateFlag) {
            container.childrenUpdateFlag = false;
            if (container.targets['onChildrenChange']) {
                this.updatedContainerMap[container.oid] = container;
            }
        }
                        
        if (container.shouldBeBracketed()) {
            container.backupDirtyLayout = { ...container.dirtyLayout };
        }
                        
        container.visibleChildren.length = 0;
       
        for (const child of allChildrenList) {
            if (!child) {
                continue;
            }

            viewport.setCurrentChild(child); 

            if (!child.getDirtyLayout() && !child.currentStatus) {
                this.calcNextLocation(child, container, viewport);
                continue;
            }
 
             viewport.setLocation();
 
            if (child.isIncluded() && container.manageChildTargetExecution(child, shouldCalculateChildTargets)) {
                this.calculateTargets(child);
            }
           
            if (container.getContainerOverflowMode() === 'always' 
                    || child.getItemOverflowMode() === 'always'            
                    || (container.getContainerOverflowMode() === 'auto' && child.getItemOverflowMode() === 'auto' && viewport.isOverflow())) {
                viewport.overflow();
                viewport.setLocation();
            }  
            
            if (child.isIncluded()) {
                if (child.targets['onVisibleChildrenChange'] && !this.visibleChildrenLengthMap[child.oid]) {
                    this.visibleChildrenLengthMap[child.oid] = { 
                        tmodel: child, 
                        visibleCount: child.visibleChildren.length
                    };
                }
            }
            
            this.addToLocationList(child);

            this.calculateCoreTargets(child);
         
            if (!TModelUtil.isXDefined(child)) {
                child.actualValues.x =  child.x;
            }
            if (!TModelUtil.isYDefined(child)) {
                child.actualValues.y =  child.y;
            }
                
            child.calcAbsolutePosition(child.getX(), child.getY());
            
            if (!child.excludeDefaultStyling()) {
                child.addToStyleTargetList('x');           
                child.addToStyleTargetList('y'); 
            }            
            
            const oldVisibilityStatus = child.visibilityStatus?.isVisible ?? false;
            
            const isVisible = child.isVisible();
            const newVisibilityStatus = child.calcVisibility();
            
            if (TUtil.isDefined(child.targets.isVisible)) {
                let targetResult = false;

                if (typeof child.targets.isVisible.value === 'function') {
                   targetResult = child.targets.isVisible.value.call(child); 
                } else {
                    targetResult = !!child.targets.isVisible;
                }
                
                child.actualValues.isVisible = targetResult;
            }        
                
            child.isNowVisible = (!oldVisibilityStatus && newVisibilityStatus) || (!isVisible && child.isVisible());
                    
            child.addToParentVisibleChildren();

            if (child.getDirtyLayout()?.count > 0) {
                this.locationListStats.push(`${child.oid}|${child.getDirtyLayout()?.count}|${child.getDirtyLayout()?.lastKey}`);
            } else {
                this.locationListStats.push(`${child.oid}|${child.getDirtyLayout()?.count ?? 0}`);
            }
            
            if (child.shouldCalculateChildren() && child.hasChildren()) {              
                this.calculateContainer(child, shouldCalculateChildTargets && container.shouldCalculateChildTargets() !== false);
            }
            
            if (child.getDirtyLayout() && TargetUtil.isTModelComplete(child)) {

                if (!child.hasChildren()) {
                    child.removeLayoutDirty(child, Object.keys(child.dirtyLayout.oids));
                } else {
                    child.removeLayoutDirty(child);
                }
            }
                
            if (!TModelUtil.isHeightDefined(child) && !child.val('heightFromDom') && child.getContentHeight() > 0) {
                child.actualValues.height = child.getContentHeight();
                child.addToStyleTargetList('height');
            }

            if (!TModelUtil.isWidthDefined(child) && !child.val('widthFromDom') && child.getContentWidth() > 0) {
                child.actualValues.width = child.getContentWidth();
                child.addToStyleTargetList('width');
            } 
            
            if (child.isInFlow()) {
                if (TUtil.isNumber(child.val('appendNewLine'))) {
                    viewport.appendNewLine();
                    container.calcContentWidthHeight();
                } else if  (child.getItemOverflowMode() === 'always') {
                    viewport.nextLocation();
                    viewport.overflow();
                    container.calcContentWidthHeight();
                } else {
                    container.calcContentWidthHeight();
                    viewport.nextLocation();
                }
            }
        }
        
        container.calcContentWidthHeight();

        for (const child of allChildrenList) {
            this.checkExternalEvents(child);
        }
    }
    
    calcNextLocation(child, container, viewport) {
        
        viewport.setLocation();
        
        if (container.getContainerOverflowMode() === 'always' 
                || child.getItemOverflowMode() === 'always'
                || (container.getContainerOverflowMode() === 'auto' && child.getItemOverflowMode() === 'auto' && viewport.isOverflow())) {
            viewport.overflow();
            viewport.setLocation();
        }
        
        if (child.isIncluded()) {
            if (child.targets['onVisibleChildrenChange'] && !this.visibleChildrenLengthMap[child.oid]) {
                this.visibleChildrenLengthMap[child.oid] = { 
                    tmodel: child, 
                    visibleCount: child.visibleChildren.length
                };
            }
        }
        
        this.calculateCoreTargets(child);
         
        if (!TModelUtil.isXDefined(child)) {
            child.actualValues.x = child.x;
        }
        if (!TModelUtil.isYDefined(child)) {
            child.actualValues.y = child.y;
        }  
        
        const absX = Math.floor(child.absX);
        const absY = Math.floor(child.absY);
        
        child.calcAbsolutePosition(child.getX(), child.getY());
        
        if (absX !== Math.floor(child.absX) || absY !== Math.floor(child.absY)) {
            child.markLayoutDirty('absXY');
        }

        if (!child.excludeDefaultStyling()) {
            child.addToStyleTargetList('x');           
            child.addToStyleTargetList('y'); 
        }
                
        if (child.styleTargetList.length > 0 || child.updatingTargetList.length > 0) {          
            this.addToLocationList(child);
        }
        
        const oldVisibilityStatus = child.visibilityStatus?.isVisible ?? false;

        const isVisible = child.isVisible();
        const newVisibilityStatus = child.calcVisibility();

        if (TUtil.isDefined(child.targets.isVisible)) {
            let targetResult = false;

            if (typeof child.targets.isVisible.value === 'function') {
               targetResult = child.targets.isVisible.value.call(child); 
            } else {
                targetResult = !!child.targets.isVisible;
            }

            child.actualValues.isVisible = targetResult;         
        }     

        child.isNowVisible = (!oldVisibilityStatus && newVisibilityStatus) || (!isVisible && child.isVisible());    

        child.addToParentVisibleChildren();
        
        if (child.isInFlow()) {
            if (TUtil.isNumber(child.val('appendNewLine'))) {
                viewport.appendNewLine();
                container.calcContentWidthHeight();
            } else if  (child.getItemOverflowMode() === 'always') {
                viewport.nextLocation();
                viewport.overflow();
                container.calcContentWidthHeight();
            } else {
                container.calcContentWidthHeight();
                viewport.nextLocation();
            }
        }     
    }
    
    calculateCoreTargets(tmodel) {
        if (tmodel.updatingTargetList.length === 0 && tmodel.activeTargetList.length === 0) {
            const coreTargets = tmodel.getCoreTargets();
            if (coreTargets) {
                coreTargets.forEach(key => {
                    const target = tmodel.targets[key];
                    if (!target) {
                        return;
                    }

                    if (target.active !== false && tmodel.isTargetEnabled(key) && !tmodel.isTargetUpdating(key) 
                            && !tmodel.isTargetImperative(key)) {
                        TargetExecutor.resolveTargetValue(tmodel, key, tmodel.getTargetCycle(key));
                        TargetExecutor.updateTarget(tmodel, tmodel.targetValues[key], key, false);                    
                    }
                });
            } 
        }
    }

    calculateTargets(tmodel) {
        this.checkInternalEvents(tmodel);
        
        tmodel.activatedTargets.forEach(target => {
            if (tmodel.activeTargetMap[target]) {
                tmodel.removeFromActiveTargets(target);
            }
        });
        
        getTargetManager().applyTargetValues(tmodel);        
        getTargetManager().setActualValues(tmodel);


        if (TModelUtil.shouldMeasureWidthFromDom(tmodel)) {
            if (tmodel.hasDom()) {
                TModelUtil.setWidthFromDom(tmodel);
            } else {           
                tmodel.addToActiveTargets('width'); 
            }
        }
        
        if (TModelUtil.shouldMeasureHeightFromDom(tmodel)) {
            if (tmodel.hasDom()) {
                TModelUtil.setHeightFromDom(tmodel);
            } else {    
                tmodel.addToActiveTargets('height'); 
            }
        }        
        
        tmodel.isNowVisible = false;
        tmodel.hasDomNow = false;
        tmodel.targetExecutionCount++;
    }
    
    checkExternalEvents(tmodel) {
        const eventTargets = [];
        const eventMap = TargetData.allEventMap;

        const externalList = tmodel.state().externalEventList;
        if (externalList?.length > 0) {
            for (const targetName of externalList) {
                if (eventMap[targetName](tmodel)) {
                    eventTargets.push(tmodel.allTargetMap[targetName]);
                }
            }
        }

        this.runEventTargets(tmodel, eventTargets);
    }

    checkInternalEvents(tmodel) {
        const eventTargets = [];
        const eventMap = TargetData.internalEventMap;

        const internalList = tmodel.state().internalEventList;
        if (internalList?.length > 0) {
            for (const targetName of internalList) {
                if (eventMap[targetName](tmodel)) {
                    eventTargets.push(tmodel.allTargetMap[targetName]);
                }
            }
        }

        this.runEventTargets(tmodel, eventTargets);        
    }

    runEventTargets(tmodel, eventTargets) {

        eventTargets.forEach(targetName => {
            const target = tmodel.targets[targetName];
                        
            if (tmodel.isTargetEnabled(targetName) && !tmodel.isTargetUpdating(target)) {
                TargetExecutor.prepareTarget(tmodel, targetName);
                TargetExecutor.resolveTargetValue(tmodel, targetName, tmodel.getTargetCycle(targetName));
                TargetExecutor.updateTarget(tmodel, tmodel.targetValues[targetName], targetName, false);

                const result = tmodel.val(targetName);
                
                if (Array.isArray(result)) {
                    result.forEach(t => TargetUtil.activateSingleTarget(tmodel, t));
                } else if (typeof result === 'string') {
                    TargetUtil.activateSingleTarget(tmodel, result);
                }
                
                TargetUtil.shouldActivateNextTarget(tmodel, targetName);
            }
        });
    }

    addToLocationList(tmodel) {
        if (!this.hasLocationMap[tmodel.oid]) {
            this.hasLocationList.push(tmodel);
            this.hasLocationMap[tmodel.oid] = tmodel;
        }
    }
    
    addToActivatedList(tmodel) {
        if (!this.activatedMap[tmodel.oid]) {
            this.activatedList.push(tmodel);
            this.activatedMap[tmodel.oid] = tmodel; 
        }
    }
    
    isActivated(tmodel) {
        return this.activatedMap[tmodel.oid];
    }
}

export { LocationManager };
