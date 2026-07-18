import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { getLocationManager, getEvents, getTargetManager, tRoot } from "./App.js";
import { TModelUtil } from "./TModelUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { AnimationUtil } from "./AnimationUtil.js";

/**
 * It analyzes all objects and based on their needs, creates or removes DOM elements, restyles objects, and rerenders them. 
 * It plays a crucial role in the TargetJ process cycle.
 */
class TModelManager {
    constructor() {
        this.init();
    }

    init() {
        this.lists = {
            visible: [],
            rerender: [],
            restyle: [],
            reasyncStyle: [],
            reattach: [],
            relocation: [],
            deletedDom: [],
            noDom: [],
            updatingTModels: [],
            activeTModels: [],
            updatingTargets: [],
            activeTargets: []
        };
        this.visibleOidMap = {};
        this.preservedDomMap = {};
        this.targetMethodMap = {};
        this.noDomMap = {};
        this.domPolicyMap = new Map();
    }

    clearFrameLists() {
        this.lists.visible.length = 0;
        this.lists.rerender.length = 0;
        this.lists.restyle.length = 0;
        this.lists.reasyncStyle.length = 0;
        this.lists.reattach.length = 0;
        this.lists.relocation.length = 0;        
        this.lists.noDom.length = 0;
        this.lists.updatingTModels.length = 0;
        this.lists.activeTModels.length = 0;
        this.lists.updatingTargets.length = 0;
        this.lists.activeTargets.length = 0;
        this.targetMethodMap = {};
        this.noDomMap = {};
    }
    
    clearAll() {
        this.visibleOidMap = {};
        this.preservedDomMap = {};
        this.clearFrameLists();
        this.deleteDoms();   
        this.domPolicyMap.clear();  
    }

    analyze() {
        const lastVisibleMap = { ...this.visibleOidMap };
        const lastPreservedMap = { ...this.preservedDomMap };
        
        this.clearFrameLists();
        const activated = [];

        for (const tmodel of getLocationManager().hasLocationList) {
            lastVisibleMap[tmodel.oid] = undefined; 
            lastPreservedMap[tmodel.oid] = undefined;
            
            if (!tmodel.exists()) {
                if (tmodel.hasDom()) {
                    this.addToDeletedDom(tmodel);
                }
                delete this.visibleOidMap[tmodel.oid];
                delete this.preservedDomMap[tmodel.oid];

                continue;
            }            

            const visible = tmodel.isVisible();

            if (visible && tmodel.isIncluded()) {
                this.visibleOidMap[tmodel.oid] = tmodel;
                delete this.preservedDomMap[tmodel.oid];
                this.lists.visible.push(tmodel);                 
            } else {
                delete this.visibleOidMap[tmodel.oid];
            }
            
            const preserveDom = this.shouldPreserveDom(tmodel);
            
            if (!visible && preserveDom && tmodel.hasDom()) {
                this.preservedDomMap[tmodel.oid] = tmodel;
            } else {
                delete this.preservedDomMap[tmodel.oid];
            }
            
            if (tmodel.hasDom()) { 
                if (!tmodel.canHaveDom() || !tmodel.isIncluded() || (tmodel.canDeleteDom() && !visible && !preserveDom)) {
                    this.addToDeletedDom(tmodel);
                    tmodel.getChildren().forEach(tmodel => {
                        if (!tmodel.managesOwnScroll()) {
                            this.addToRecursiveDeletedDom(tmodel);
                        }
                    });                        
                }
            }
            
            if (visible || tmodel.isActivated()) {

                const state = tmodel.state();

                if (state.updatingTargetList?.length > 0 || tmodel.hasAnimatingTargets()) {
                    this.lists.updatingTModels.push(tmodel);
                    this.lists.updatingTargets = [...this.lists.updatingTargets, ...state.updatingTargetList];
                }
                
                if (state.activeTargetList?.length > 0) {
                    this.lists.activeTModels.push(tmodel);
                    this.lists.activeTargets = [...this.lists.activeTargets, ...state.activeTargetList];
                }
                              
            }
            
            if (preserveDom && !visible && !tmodel.isActivated()) {
                if (this.needsRestyle(tmodel)) {
                    this.lists.restyle.push(tmodel);               
                }
            }
            
            if (visible || tmodel.isActivated()) {
                if (this.needsRerender(tmodel)) {
                    this.lists.rerender.push(tmodel);            
                }
                if (this.needsRestyle(tmodel)) {
                    this.lists.restyle.push(tmodel);               
                }
                if (this.needsReasyncStyle(tmodel)) {
                    this.lists.reasyncStyle.push(tmodel);
                }
                if (this.needsReattach(tmodel)) {
                    this.lists.reattach.push(tmodel);            
                }
                if (this.needsRelocation(tmodel)) {
                    this.lists.relocation.push(tmodel);            
                }
                
                const state = tmodel.state();

                if (state.targetMethodMap && Object.keys(state.targetMethodMap).length > 0) {
                    this.targetMethodMap[tmodel.oid] = { ...state.targetMethodMap };
                    state.targetMethodMap = {};
                }                  
                
                if (tmodel.isActivated()) {
                    activated.push(tmodel);
                }

            }

            if (this.shouldCreateDom(tmodel, visible) && !this.noDomMap[tmodel.oid]) {
                if (tmodel.getDomHolder()?.exists() || this.noDomMap[tmodel.getDomParent()?.oid]) {
                    this.lists.noDom.push(tmodel);
                    this.noDomMap[tmodel.oid] = true;
                } else {
                    tmodel.markLayoutDirty('noDomHolder');
                }
            }
        }
        
        activated.forEach(t => t.deactivate());
                
        Object.values({ ...lastVisibleMap, ...lastPreservedMap }).filter(v => v !== undefined).forEach(tmodel => {
            if (tmodel.hasDom()) {
                
                if (!tmodel.exists() || !tmodel.isIncluded()) {   
                    this.addToDeletedDom(tmodel);
                } 
            }
        });
        
        return this.lists.noDom.length > 0 ? 0 :
               this.lists.reattach.length > 0 ? 1 :
               this.lists.relocation.length > 0 ? 2 :
               this.lists.rerender.length > 0 ? 3 :
               this.lists.reasyncStyle.length > 0 ? 4 :
               this.lists.deletedDom.length > 0 ? 5 :
               this.lists.restyle.length > 0 ? 10 : -1;
    }
    
    shouldPreserveDom(tmodel) {
        if (!tmodel.isIncluded()) {
            return false;
        }
        
        if (this.getDomPolicy(tmodel) === "keep") {
            return true;
        }
        
        if (!tmodel.isVisible() && TUtil.isDefined(tmodel.targets.isVisible)) {
            return false;
        }
        
        let parent = tmodel.parent;
        

        while (parent && parent !== tRoot()) {
            if (TUtil.isDefined(parent.targets.canDeleteDom)) {
                return parent.val('canDeleteDom') === false;
            }

            if (TUtil.isDefined(parent.targets.isVisible)) {
                return parent.val('isVisible') === true;
            }

            parent = parent.parent;
        }

        return false;
    }
    
    shouldCreateDom(tmodel, visible) {
        if (!tmodel.canHaveDom() || !tmodel.isIncluded() || tmodel.hasDom()) {
            return false;
        }

        if (visible) {
            return true;
        }

        if (tmodel.requiresDom()) {
            return true;
        }

        return this.getDomPolicy(tmodel) === "keep";
    }

    getDomPolicy(tmodel) {
        if (this.domPolicyMap.has(tmodel.oid)) {
            return this.domPolicyMap.get(tmodel.oid);
        }

        let current = tmodel;

        while (current && current !== tRoot()) {
            const policy = current.val("dom");

            if (TUtil.isDefined(policy)) {
                this.domPolicyMap.set(tmodel.oid, policy);
                return policy;
            }

            current = current.parent;
        }

        this.domPolicyMap.set(tmodel.oid, "auto");
        return "auto";
    }

    isBracketVisible(tmodel) {
        tmodel = tmodel.bracket;
        
        while(tmodel) {
            if (tmodel.type !== 'BI') {
                break;
            }
            if (!tmodel.isVisible()) {
                return false;
            }
            
            tmodel = tmodel.getParent();
        }
        
        return true;
    }
    
    addToRecursiveDeletedDom(tmodel) {
        delete this.visibleOidMap[tmodel.oid];
        delete this.preservedDomMap[tmodel.oid];
        
        if (!this.lists.deletedDom.includes(tmodel)) {
            if (tmodel.hasDom()) {
                this.lists.deletedDom.push(tmodel);
            }

            tmodel.getChildren().forEach(tmodel => {
                if (!tmodel.managesOwnScroll()) {
                    this.addToRecursiveDeletedDom(tmodel);
                }
            });
        }
    }
    
    addToDeletedDom(tmodel) {
        delete this.visibleOidMap[tmodel.oid];
        delete this.preservedDomMap[tmodel.oid];

        if (!this.lists.deletedDom.includes(tmodel)) {
            this.lists.deletedDom.push(tmodel);
        }
    }
        
    getVisibles() {
        return Object.values(this.visibleOidMap);
    }
    
    getAvailableDoms() {
        return Object.values({
            ...this.preservedDomMap,
            ...this.visibleOidMap
        });
    }
    
    needsRelocation(tmodel) {
        if (tmodel.hasDom() && TUtil.isDefined(tmodel.domOrderIndex)) {            
            return true;
        }
        
        return false;
    }

    needsRerender(tmodel) {
        const html = tmodel.getHtml();

        if (!tmodel.hasDom() || !TUtil.isDefined(html)) {
            return false;
        }

        return tmodel.$dom.innerHTML() !== String(html) || tmodel.$dom.textOnly !== tmodel.isTextOnly();
    }

    needsRestyle(tmodel) {
        return tmodel.hasDom() && tmodel.styleTargetMap?.size > 0;
    }
    
    needsReasyncStyle(tmodel) {
        return tmodel.hasDom() && tmodel.asyncStyleTargetMap?.size > 0;
    }

    needsReattach(tmodel) {
        if (!tmodel.hasDom() || tmodel.reuseDomDefinition()) {
            return false;
        }
                
        return tmodel.hasDomHolderChanged() || tmodel.hasBaseElementChanged();
    }  

    renderTModels() {
        for (const tmodel of this.lists.rerender) {
            tmodel.isTextOnly() ? tmodel.$dom?.text(tmodel.getHtml()) : tmodel.$dom?.html(tmodel.getHtml());
            tmodel.setLastUpdate('html');
            tmodel.domHeightTimestamp = 0;
            tmodel.domWidthTimestamp = 0;
        }
    }

    reattachTModels() {
        const reattached = [];
        for (const tmodel of this.lists.reattach) { 
            const changed = tmodel.hasBaseElementChanged();
            
            const domParent = tmodel.getDomParent();
            if (!domParent || !domParent.$dom) {
                continue;
            }
               
            domParent.$dom.removeElement(tmodel.$dom.element);          
            
            if (changed) {
                TModelUtil.createDom(tmodel);
                TModelUtil.patchDom(tmodel);
                TModelUtil.initStyleMaps(tmodel);
                if (this.needsRestyle(tmodel)) {
                    this.lists.restyle.push(tmodel);
                }
                if (this.needsReasyncStyle(tmodel)) {
                    this.lists.reasyncStyle.push(tmodel);
                }  
                
                reattached.push(tmodel);
            }
    
            if (tmodel.getDomHolder()) {  
                tmodel.getDomHolder().appendTModel$Dom(tmodel);
            }
        }
        
        this.activatePendingTargetsAfterDom(reattached);
    }
    
    relocateTModels() {
        this.lists.relocation.sort((a, b) => b.domOrderIndex - a.domOrderIndex);
        
        for (const tmodel of this.lists.relocation) { 
            const domParent = tmodel.getDomParent();
            if (!domParent || !domParent.$dom) {
                continue;
            }            
            
            domParent.$dom.relocate(tmodel, tmodel.domOrderIndex);
            tmodel.domOrderIndex = undefined;
        }
    }
    
    resetTModelDom(tmodel) { 
        tmodel.styleMap = {};
        tmodel.tfMap = {};
        tmodel.actualValues.isVisible = false;
        tmodel.hasDomNow = false;
        tmodel.$dom = null;       
    };
    
    deleteDoms() {   
        for (const tmodel of this.lists.deletedDom) {
            if (tmodel.val('sourceDom')) {
                continue;
            }
                
            this.deleteDom(tmodel);
        }
        
        this.lists.deletedDom.length = 0;
    }
    
    deleteDom(tmodel) {
        if (tmodel.hasAnimatingTargets()) {
            AnimationUtil.detachAnimationsOnDeleteDom(tmodel);
        }
        
        const domParent = tmodel.getDomParent();
        if (domParent && domParent.$dom) {
            domParent.$dom.removeElement(tmodel.$dom.element); 
        }        

        this.resetTModelDom(tmodel);
    }
    
    fixStyles() {
        for (const tmodel of this.lists.restyle) {
            if (tmodel.hasDom()) {
                TModelUtil.fixStyle(tmodel);
            }
        }       
    }
    
    fixAsyncStyles() {
        for (const tmodel of this.lists.reasyncStyle) {
            if (tmodel.hasDom()) {
                TModelUtil.fixAsyncStyle(tmodel);
            }
        }
    }
    
    activatePendingTargetsAfterDom(tmodels, { restoredDoneTargets = true } = {}) {
        for (const tmodel of tmodels) {
            if (!tmodel.hasDom()) {
                tmodel.markLayoutDirty('noDom');
                continue;
            }

            if (tmodel.noDomUpdatingTargets) {
                for (const target of [...tmodel.noDomUpdatingTargets]) {
                    tmodel.addTargetToStatusList(target);
                }

                tmodel.noDomUpdatingTargets = undefined;
            }

            const pending = tmodel.pendingTargets;
            const visited = new Set();

            if (pending) {
                for (const key of [...pending]) {
                    visited.add(key);
                    TargetUtil.cleanupTarget(tmodel, key);
                    TargetUtil.shouldActivateNextTarget(tmodel, key);
                }

            }
            
            
            if (restoredDoneTargets) {
                for (const key of Object.keys(tmodel.targetValues)) {
                    const targetValue = tmodel.targetValues[key];

                    if (targetValue.status !== 'done' || visited.has(key)) {
                        continue;
                    }
                    
                   if (tmodel.isTargetInLoop(key) || tmodel.isTargetPassiveLoop(key)) {
                        continue;
                    }
                    
                    if (TargetUtil.cleanupTarget(tmodel, key)) {
                        TargetUtil.shouldActivateNextTarget(tmodel, key);
                    }
                }
            }
        }
    }
    
    catchupNoDomTargetsBeforeStyle(tmodel) {
        if (!tmodel.noDomUpdatingTargets?.size) {
            return;
        }

        for (const key of [...tmodel.noDomUpdatingTargets]) {
            const newStatus = getTargetManager().calculateTargetStatus(tmodel, key);
            tmodel.setTargetStatus(key, newStatus);
        }

        tmodel.noDomUpdatingTargets = undefined;
        
    }
    
    createDoms() {   
        if (this.lists.noDom.length === 0) { 
            return;
        }
        
        const holdersMap = new Map();
        const styleBatch = [];
        
        const needsDom = [];

        this.lists.noDom.sort((a, b) => {
            return a.getUIDepth() < b.getUIDepth() ? -1 : 1;
        });
        
        for (const tmodel of this.lists.noDom) {
            const domId = tmodel.domId ?? tmodel.oid;
            if ($Dom.query(`#${domId}`)) {
                tmodel.$dom = new $Dom(`#${domId}`);
                tmodel.$dom.attr('tgjs', 'true');
                tmodel.hasDomNow = true;
                tmodel.markLayoutDirty('hasDomNow');
                if (this.needsRerender(tmodel)) {
                    this.lists.rerender.push(tmodel);            
                }
                if (this.needsRestyle(tmodel)) {
                    this.lists.restyle.push(tmodel);               
                }
                if (this.needsReasyncStyle(tmodel)) {
                    this.lists.reasyncStyle.push(tmodel);
                }              
            } else {                
                needsDom.push(tmodel);
            }
        }
            
        for (const tmodel of needsDom) {
            const domHolder = tmodel.getDomHolder();
                        
            if (!domHolder) {
                tmodel.markLayoutDirty('noDomHolder');
                continue;
            }

            tmodel.$dom = undefined;
            if (tmodel.val('$dom')) {
                tmodel.$dom = tmodel.val('$dom');
                if (!tmodel.hasDom()) {
                    domHolder.appendTModel$Dom(tmodel);
                }   
            } else {
                TModelUtil.createDom(tmodel);
                TModelUtil.patchDom(tmodel);
                styleBatch.push(tmodel);

                let entry = holdersMap.get(domHolder);
                if (!entry) {
                    entry = {domHolder, fragment: $Dom.createDocumentFragment(), tmodels: []};
                    holdersMap.set(domHolder, entry);
                }

                entry.fragment.appendChild(tmodel.$dom.element);
                entry.tmodels.push(tmodel);
            }
            
        }

        for (const { domHolder, fragment } of holdersMap.values()) {
            domHolder.appendElement(fragment);
        }
        
        for (const tmodel of this.lists.noDom) {
            this.catchupNoDomTargetsBeforeStyle(tmodel);
        }
        
        for (const tmodel of styleBatch) {
            if (tmodel.hasDom()) {
                tmodel.hasDomNow = true;
                tmodel.markLayoutDirty('hasDomNow');
            }
            
            TModelUtil.initStyleMaps(tmodel);
            TModelUtil.fixStyle(tmodel);
            TModelUtil.fixAsyncStyle(tmodel);
        }
        
        this.activatePendingTargetsAfterDom(this.lists.noDom);
        
        getEvents().attachEvents(this.lists.noDom.filter(t => t.externalEventMap?.size > 0));
    }        
}

export { TModelManager };
