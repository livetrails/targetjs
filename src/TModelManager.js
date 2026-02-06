import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { App, getLocationManager, getEvents, getAnimationManager } from "./App.js";
import { TModelUtil } from "./TModelUtil.js";
import { TargetUtil } from "./TargetUtil.js";

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
            invisibleDom: [],
            noDom: [],
            updatingTModels: [],
            activeTModels: [],
            updatingTargets: [],
            activeTargets: []
        };
        this.visibleOidMap = {};
        this.targetMethodMap = {};
        this.noDomMap = {};
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
        this.clearFrameLists();
        this.deleteDoms();     
    }

    analyze() {
        const lastVisibleMap = { ...this.visibleOidMap };
        this.clearFrameLists();

        for (const tmodel of getLocationManager().hasLocationList) {         
            lastVisibleMap[tmodel.oid] = undefined; 
            
            if (!App.tmodelIdMap[tmodel.oid]) {
                if (tmodel.hasDom()) {
                    this.addToInvisibleDom(tmodel);
                }
                delete this.visibleOidMap[tmodel.oid];
                continue;
            }            

            const visible = tmodel.isVisible();
            
            if (visible && tmodel.isIncluded()) {
                this.visibleOidMap[tmodel.oid] = tmodel;
                this.lists.visible.push(tmodel);                 
            } else {
                delete this.visibleOidMap[tmodel.oid]; 
            }
            
            if (tmodel.hasDom()) { 
                if (!tmodel.canHaveDom() || !tmodel.isIncluded() || (tmodel.canDeleteDom() && !visible)) {                    
                    this.addToInvisibleDom(tmodel);
                    tmodel.getChildren().forEach(tmodel => {
                        this.addToRecursiveInvisibleDom(tmodel);
                    });                        
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

                if (state.updatingTargetList?.length > 0 || tmodel.hasAnimatingTargets()) {
                    this.lists.updatingTModels.push(tmodel);
                    this.lists.updatingTargets = [...this.lists.updatingTargets, ...state.updatingTargetList];
                }

                if (state.activeTargetList?.length > 0) {
                    this.lists.activeTModels.push(tmodel);
                    this.lists.activeTargets = [...this.lists.activeTargets, ...state.activeTargetList];
                }

                if (state.targetMethodMap && Object.keys(state.targetMethodMap).length > 0) {
                    this.targetMethodMap[tmodel.oid] = { ...state.targetMethodMap };
                    state.targetMethodMap = {};
                }

                tmodel.deactivate();
            }

            if (visible || tmodel.requiresDom()) {
                if (tmodel.canHaveDom() && !tmodel.hasDom() && tmodel.isIncluded() && !this.noDomMap[tmodel.oid]) {
                    if (tmodel.getDomHolder(tmodel)?.exists() || this.noDomMap[tmodel.getDomParent()?.oid]) {
                        this.lists.noDom.push(tmodel);
                        this.noDomMap[tmodel.oid] = true;
                    } else {
                        tmodel.markLayoutDirty('noDomHolder');
                    }
                } 
            }
        }
                
        Object.values(lastVisibleMap).filter(v => v !== undefined).forEach(tmodel => {
            if (tmodel.hasDom()) {
                
                if (!App.tmodelIdMap[tmodel.oid] || !tmodel.isIncluded()) {   
                    this.addToInvisibleDom(tmodel);
                } 
            }
        });
        
        return this.lists.noDom.length > 0 ? 0 :
               this.lists.reattach.length > 0 ? 1 :
               this.lists.relocation.length > 0 ? 2 :
               this.lists.rerender.length > 0 ? 3 :
               this.lists.reasyncStyle.length > 0 ? 4 :
               this.lists.invisibleDom.length > 0 ? 5 :
               this.lists.restyle.length > 0 ? 10 : -1;
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
    
    addToRecursiveInvisibleDom(tmodel) {
        delete this.visibleOidMap[tmodel.oid];
        
        if (!this.lists.invisibleDom.includes(tmodel)) {
            if (tmodel.hasDom()) {
                this.lists.invisibleDom.push(tmodel);
            }

            tmodel.getChildren().forEach(tmodel => {
                this.addToRecursiveInvisibleDom(tmodel);
            });
        }
    }
    
    addToInvisibleDom(tmodel) {
        delete this.visibleOidMap[tmodel.oid];     

        if (!this.lists.invisibleDom.includes(tmodel)) {
            this.lists.invisibleDom.push(tmodel);
        }
    }
        
    getVisibles() {
        return Object.values(this.visibleOidMap);
    }
    
    needsRelocation(tmodel) {
        if (tmodel.hasDom() && TUtil.isDefined(tmodel.domOrderIndex)) {            
            return true;
        }
        
        return false;
    }

    needsRerender(tmodel) {
        if (tmodel.hasDom() && TUtil.isDefined(tmodel.getHtml()) &&
                (tmodel.$dom.html() !== tmodel.getHtml() || tmodel.$dom.textOnly !== tmodel.isTextOnly())) {
            return true;
        }

        return false;
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
    
            if (tmodel.getDomHolder(tmodel)) {  
                tmodel.getDomHolder(tmodel).appendTModel$Dom(tmodel);
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
        for (const tmodel of this.lists.invisibleDom) {
            this.deleteDom(tmodel);
        }
        
        this.lists.invisibleDom.length = 0;
    }
    
    deleteDom(tmodel) {
        if (tmodel.hasAnimatingTargets()) {
            getAnimationManager().pauseTModel(tmodel);
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
    
    activatePendingTargetsAfterDom(tmodels) {
        for (const tmodel of tmodels) {
        
            const pending = tmodel.pendingTargets;
            if (pending?.size) {
                for (const target of [...pending]) {
                   TargetUtil.shouldActivateNextTarget(tmodel, target);
                }
            }
        }
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
            
        this.activatePendingTargetsAfterDom(this.lists.noDom);

        for (const tmodel of needsDom) {
            const domHolder = tmodel.getDomHolder(tmodel);
                        
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

        for (const tmodel of styleBatch) {
            if (tmodel.hasDom()){
                tmodel.hasDomNow = true;
                tmodel.markLayoutDirty('hasDomNow');
            }          
            TModelUtil.initStyleMaps(tmodel);
            TModelUtil.fixStyle(tmodel);
            TModelUtil.fixAsyncStyle(tmodel);
        }
        
        this.activatePendingTargetsAfterDom(styleBatch);
        
        getEvents().attachEvents(this.lists.noDom.filter(t => t.externalEventMap?.size > 0));
    }        
}

export { TModelManager };
