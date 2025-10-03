import { BracketGenerator } from "./BracketGenerator.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { App, getTargetManager, tRoot, getEvents } from "./App.js";

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
        
        this.domIslandSet = new Set();
        
        this.activatedList = [];
        this.activatedMap = {};
        
        this.calcBusy = false;
        this.calcQueued = false;        
    }
    
    clear() {
        this.visibleChildrenLengthMap = {};
        this.updatedContainerMap = {}; 
        this.activatedList = [];
        this.activatedMap = {};
        this.domIslandSet.clear();
        this.calcBusy = false;
        this.calcQueued = false;         
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

    async calculateAll(budgetMs = 4) {
        if (this.calcBusy) {
            this.calcQueued = true;
            return;
        }

        this.calcBusy = true;
        try {
            this.hasLocationList.length = 0;
            this.hasLocationMap = {};
            this.locationListStats = [];
            
            const stack = [];

            stack.push({
                container: tRoot(),
                stage: 'init',
                children: [],
                viewport: undefined,
                index: 0
            });

            const ctx = {
                budgetMs,
                sliceStart: TUtil.now()
            };

            await this.processStack(stack, ctx);
            this.processAfterStack();
                    
            //console.log(this.locationListStats)

        } finally {
            this.calcBusy = false;
        }

        if (this.calcQueued) {
            this.calcQueued = false;
            return this.calculateAll(budgetMs);
        }
    }


    async processStack(stack, ctx) {
        
        const processAfterAllChildren = job => {
            const {container, children} = job;
            
            container.adjustViewport();
            
            container.calcContentWidthHeight();
            
            for (const child of children) {
                this.checkExternalEvents(child);
            }
        }
        
        const resetDirtyLayout = job => {
            const {children, index} = job;
            const child = children[index];
            
            if (child) {
                if (child.getDirtyLayout() && (TargetUtil.isTModelComplete(child) || !App.tmodelIdMap[child.oid])) {
                    if (!child.hasChildren()) {
                        child.removeLayoutDirty(child, child.dirtyLayout.oids ? Object.keys(child.dirtyLayout.oids) : undefined);
                    } else {
                        child.removeLayoutDirty(child);
                    }
                }
            }
                        
            job.stage = 'afterChild';
        }

        const processAfterChild = job => {
            const {container, children, viewport, index} = job;
            const child = children[index];
            
            if (child) {
                       
                if (child.useContentHeight()) {
                    if (child.actualValues.height !== child.getContentHeight()) {
                        child.actualValues.height = child.getContentHeight();
                        child.markLayoutDirty('contentWidthHeight');
                    }
                    child.addToStyleTargetList('height');
                }

                if (child.useContentWidth()) {
                    if (child.actualValues.width !== child.getContentWidth()) {
                        child.actualValues.width = child.getContentWidth();
                        child.markLayoutDirty('contentWidthHeight');                     
                    }
                    child.addToStyleTargetList('width');
                } 

                if (child.isInFlow()) {
                    if (TUtil.isNumber(child.val('appendNewLine'))) {
                        viewport.appendNewLine();
                    }

                    viewport.nextLocation();
                    container.calcContentWidthHeight();
                }
  
            }
            
            job.index++;
                        
            if (job.index < job.children.length) {
                job.stage = 'child';
            }

        };

        const processChild = job => {
                
            const { container, children, viewport, index } = job;

            const child = children[index];
            
            if (child.isDomIsland()) {
                if (child.originWindowEpoch !== getEvents().getWindowEpoch() && child.hasDom()) {
                    child.calcAbsolutePositionFromDom();
                    child.originWindowEpoch = getEvents().getWindowEpoch();
                }
            }
            
            viewport.setCurrentChild(child);

            if (!child.getDirtyLayout() && !child.currentStatus) {
              
                this.calcNextLocation(stack, child, container, viewport);
                job.index++;

                return;
            }
            
            if (child.isDomIsland()) {                              
                this.domIslandSet.add(child);
            }            
            
            if (child.shouldBeBracketed() && !TUtil.isDefined(child.getDomParent().targets['onWindowScroll'])) {                
                child.getDomParent().addTarget('onWindowScroll', '');
                getEvents().attachEvents([child.getDomParent()]);  
            }

            viewport.setLocation();

            if (child.isIncluded() && container.manageChildTargetExecution(child)) {
                this.calculateTargets(child);
            }

            if (container.getContainerOverflowMode() === 'always' 
                    || child.getItemOverflowMode() === 'always'            
                    || (container.getContainerOverflowMode() === 'auto' && child.getItemOverflowMode() === 'auto' && !child.useContentWidth() && viewport.isOverflow())) {
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
            
            if (!child.isDomIsland()) {
                child.calcAbsolutePosition(child.getX(), child.getY());
            }

            if (!child.excludeDefaultStyling()) {
                child.addToStyleTargetList('x');
                child.addToStyleTargetList('y');
            }
           
            this.calculateVisibility(child);

            if (child.getDirtyLayout()?.count > 0) {
                this.locationListStats.push(`${child.oid}|${child.getDirtyLayout()?.count}|${child.getDirtyLayout()?.lastKey}`);
            } else {
                this.locationListStats.push(`${child.oid}|${child.getDirtyLayout()?.count ?? 0}`);
            }

            job.stage = 'resetDirtyLayout';

            if (child.hasChildren()) { 
                if (child.shouldCalculateChildren()) {
                    stack.push({
                        container: child,
                        stage: 'init',
                        children: [],
                        viewport: undefined,
                        index: 0
                    });
                    
                    job.stage = 'afterChild';
                    
                } else if (!child.isVisible()) {
                    
                    TUtil.getDeepList(child).forEach(t => {
                        t.actualValues.isVisible = false;
                        this.addToLocationList(t);
                    });                  
                }
            }
        };

        while (stack.length) {
            if ((TUtil.now() - ctx.sliceStart) > ctx.budgetMs) {
                await new Promise(requestAnimationFrame);
                ctx.sliceStart = TUtil.now();
                continue;
            }
                        

            const job = stack[stack.length - 1];
                        
            if (job.stage === 'init') {          
                const container = job.container;

                const allChildrenList = this.calcChildren(container);
                                
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

                job.children = allChildrenList;
                job.index = 0;
                job.viewport = container.createViewport();
                job.stage = 'child';
            }
            
            if (job.stage === 'resetDirtyLayout') {
                resetDirtyLayout(job);
            }
            
            if (job.stage === 'afterChild') {
                processAfterChild(job);
            }
            
            if (job.index === job.children.length) {
                processAfterAllChildren(job);
                stack.pop();
                continue;
            }

            processChild(job);
        }
    }

    processAfterStack() {
        for (const key in this.visibleChildrenLengthMap) {
            const {tmodel, visibleCount} = this.visibleChildrenLengthMap[key];
            if (tmodel.isVisible() && (visibleCount !== tmodel.visibleChildren.length || tmodel.visibleChildren.length === 0)) {
                this.runEventTargets(tmodel, ['onVisibleChildrenChange']);
                this.visibleChildrenLengthMap[key].visibleCount = tmodel.visibleChildren.length;
            }
        }
        for (const key in this.updatedContainerMap) {
            const tmodel = this.updatedContainerMap[key];
            if (tmodel.isVisible()) {
                this.runEventTargets(tmodel, ['onChildrenChange']);
            }
            delete this.updatedContainerMap[key];
        }
    }

    calcChildren(container) {
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
    
    calcNextLocation(stack, child, container, viewport) {
        
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

        if (!child.isDomIsland()) {
            child.calcAbsolutePosition(child.getX(), child.getY());      
        }

        if (!child.excludeDefaultStyling()) {
            child.addToStyleTargetList('x');           
            child.addToStyleTargetList('y'); 
        }
                
        if (child.styleTargetList.length > 0 || child.updatingTargetList.length > 0) {          
            this.addToLocationList(child);
        }
        
        this.calculateVisibility(child);
        
        if (!child.isVisible() && child.hasChildren()) {
            TUtil.getDeepList(child).forEach(t => {
                t.actualValues.isVisible = false;
                this.addToLocationList(t);
            });   
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
    
    calculateCoreTargets(tmodel) {
        if (tmodel.updatingTargetList.length === 0 && tmodel.activeTargetList.length === 0) {
            const coreTargets = tmodel.getCoreTargets();
            if (coreTargets) {
                coreTargets.forEach(key => {
                    const target = tmodel.targets[key];
                    if (!target) {
                        return;
                    }

                    if (target.active !== false && tmodel.isTargetEnabled(key) && !tmodel.isTargetImperative(key)) {
                        TargetExecutor.resolveTargetValue(tmodel, key);
                        TargetExecutor.updateTarget(tmodel, tmodel.targetValues[key], key, false);                    
                    }
                });
            } 
        }
    }
    
    calculateVisibility(tmodel) {
        
        let wasVisible, nowVisible;
        
        if (TUtil.isDefined(tmodel.targets.isVisible)) {
            wasVisible = tmodel.isVisible();
            
            if (typeof tmodel.targets.isVisible.value === 'function') {
               nowVisible = tmodel.targets.isVisible.value.call(tmodel); 
            } else {
                nowVisible = !!tmodel.targets.isVisible;
            }

        } else {
            wasVisible = tmodel.visibilityStatus?.isVisible ?? undefined;
            nowVisible = tmodel.calcVisibility();            
        }
        
        tmodel.actualValues.isVisible = nowVisible     
        tmodel.isNowVisible = !wasVisible && nowVisible;
        tmodel.isNowInvisible = (wasVisible || wasVisible === undefined) && !nowVisible;
        
        if (tmodel.isNowInvisible) {
            this.addToLocationList(tmodel);
        }
        
        tmodel.addToParentVisibleChildren();        
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
                tmodel.markLayoutDirty('width'); 
            }
        }
        
        if (TModelUtil.shouldMeasureHeightFromDom(tmodel)) {
            if (tmodel.hasDom()) {
                TModelUtil.setHeightFromDom(tmodel);
            } else {    
                tmodel.markLayoutDirty('height'); 
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
                TargetExecutor.resolveTargetValue(tmodel, targetName);
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
