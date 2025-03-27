import { BracketGenerator } from "./BracketGenerator.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { tApp, getEvents } from "./App.js";

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
            const { tmodel, length } = this.visibleChildrenLengthMap[key];
            if (tmodel.isVisible() && (length !== tmodel.visibleChildren.length || tmodel.visibleChildren.length === 0)) {
                this.runEventTargets(tmodel, 'onVisibleChildrenChange');
                this.visibleChildrenLengthMap[key].length = tmodel.visibleChildren.length;           
            }
        });
        
        Object.keys(this.updatedContainerMap).forEach(key => {
            const tmodel = this.updatedContainerMap[key];
            if (tmodel.isVisible()) {
                this.runEventTargets(tmodel, 'onChildrenChange');
                delete this.updatedContainerMap[key];                                
            }
        }); 
    }

    calculate() {
        this.calculateContainer(tApp.tRoot);
    }

    calculateActivated() {
        let i = 0;     
                
        while (i < this.activatedList.length) {
            const child = this.activatedList[i++];

            tApp.targetManager.applyTargetValues(child, child.activatedTargets);
            
            if (child.updatingTargetList.length > 0) {
                tApp.targetManager.setActualValues(child, child.updatingTargetList.filter((key => child.getTargetStep(key) === 0)));
            }
            
            if (!this.hasLocationMap[child.oid]) {
                this.addToLocationList(child);
            }
        }
        
        this.activatedList.length = 0;
        this.activatedMap = {};
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
        
        container.visibleChildren.length = 0;                
        
        for (const child of allChildrenList) {
            if (!child) {
                continue;
            }
            
            this.locationListStats.push(child.oid);
            
            viewport.setCurrentChild(child);
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
                    this.visibleChildrenLengthMap[child.oid] = { tmodel: child, length: child.visibleChildren.length };
                }
                
                this.addToLocationList(child);
            }

            child.getCoreTargets().forEach(target => {
                if (child.isTargetEnabled(target) && !child.isTargetUpdating(target) && !child.isTargetImperative(target)) {
                    TargetExecutor.executeDeclarativeTarget(child, target, child.getTargetCycle(target)); 
                };
            });
            
            if ((!child.isTargetImperative('x') && !child.targets['x']) || !TUtil.isDefined(child.targetValues.x)) {
                child.val('x', child.x);
            }
            if ((!child.isTargetImperative('y') && !child.targets['y']) || !TUtil.isDefined(child.targetValues.y)) {
                child.val('y', child.y);
            }
                
            child.calcAbsolutePosition(child.getX(), child.getY());
            
            if (!child.excludeDefaultStyling()) {
                child.addToStyleTargetList('x');           
                child.addToStyleTargetList('y'); 
            }            
            
            const isVisible = child.isVisible();
            
            TUtil.isDefined(child.targets.isVisible) 
                ? TargetExecutor.executeDeclarativeTarget(child, 'isVisible') 
                : child.calcVisibility();
                
            child.isNowVisible = !isVisible && child.isVisible();
            
            child.addToParentVisibleChildren();

            if (child.shouldCalculateChildren()) {
                this.calculateContainer(child, shouldCalculateChildTargets && container.shouldCalculateChildTargets() !== false);
            }
            
            if (!child.excludeDefaultStyling() && !TUtil.isDefined(child.targetValues.height) && !TUtil.isDefined(child.targets.heightFromDom) && child.getContentHeight() > 0) {
                child.val('height', child.getContentHeight());
                child.addToStyleTargetList('height');
            }

            if (!child.excludeDefaultStyling() && !TUtil.isDefined(child.targetValues.width) && !TUtil.isDefined(child.targets.widthFromDom) && child.getContentWidth() > 0) {
                child.val('width', child.getContentWidth());
                child.addToStyleTargetList('width');
            }               
            
            if (child.isInFlow()) {
                if (TUtil.isNumber(child.val('appendNewLine'))) {
                    viewport.appendNewLine();
                    container.calcContentWidthHeight();
                } else {
                    container.calcContentWidthHeight();
                    viewport.nextLocation();
                }  
            }
        }
        
        container.calcContentWidthHeight();     

        for (const child of allChildrenList) {
            this.checkEventTargets(child);
        }
    }

    calculateTargets(tmodel) {
        this.checkInternalEventTargets(tmodel);
        tApp.targetManager.applyTargetValues(tmodel);        
        tApp.targetManager.setActualValues(tmodel);

        if (tmodel.hasDom()) {
            if (TModelUtil.shouldMeasureWidthFromDom(tmodel)) {
                TargetUtil.setWidthFromDom(tmodel);
            }
        }
        
        if (tmodel.hasDom()) {
            if (TModelUtil.shouldMeasureHeightFromDom(tmodel)) {
                TargetUtil.setHeightFromDom(tmodel);
            }           
        }        
        
        tmodel.isNowVisible = false;
        tmodel.hasDomNow = false;
        tmodel.targetExecutionCount++;
    }
    
    checkEventTargetsByType(tmodel, eventMap, attachEvents = false) {
        const eventTargets = [];

        tmodel.eventTargetList.forEach(targetName => {
            if (eventMap[targetName] && eventMap[targetName](tmodel)) {
                eventTargets.push(targetName);
            }

            if (attachEvents && TargetData.targetToEventsMapping[targetName]) {
                getEvents().attachTargetEvents(targetName);
            }
        });

        this.runEventTargets(tmodel, eventTargets);
    }

    checkInternalEventTargets(tmodel) {
        this.checkEventTargetsByType(tmodel, TargetData.internalEventMap);
    }

    checkEventTargets(tmodel) {
        this.checkEventTargetsByType(tmodel, TargetData.allEventMap, true);
    }

    runEventTargets(tmodel, eventTargets) {
        if (!Array.isArray(eventTargets)) {
            eventTargets = [eventTargets];
        }
               
        const originalEventTarget = getEvents().getEventTarget();

        eventTargets.forEach(targetName => {
            const target = tmodel.targets[targetName];
            
            if (tmodel.isTargetEnabled(targetName)) {
                if (typeof target.value === 'function') {
                    target.value.call(tmodel, originalEventTarget);
                } else if (Array.isArray(target.value)) {
                    target.value.forEach(t => TargetUtil.activateSingleTarget(tmodel, t));
                } else if (Array.isArray(target)) {
                    target.forEach(t => TargetUtil.activateSingleTarget(tmodel, t));                      
                } else {
                    TargetUtil.activateSingleTarget(tmodel, target.value);
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
