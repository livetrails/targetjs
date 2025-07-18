import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { getLocationManager, getEvents } from "./App.js";
import { TModelUtil } from "./TModelUtil.js";

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
        this.exchangeTypeMap = {};
        this.visibleOidMap = {};
        this.targetMethodMap = {};
        this.noDomMap = {};

        this.doneTargets = [];
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
        this.clearFrameLists();
        this.deleteDoms();     
    }

    analyze() {
        const lastVisibleMap = { ...this.visibleOidMap };
        this.clearFrameLists();

        for (const tmodel of getLocationManager().hasLocationList) {
            lastVisibleMap[tmodel.oid] = undefined; 
            
            if (this.hasNoParent(tmodel)) {
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
                this.needsRerender(tmodel);
                this.needsRestyle(tmodel);
                this.needsReattach(tmodel);
                this.needsRelocation(tmodel);

                const state = tmodel.state();

                if (state.updatingTargetList?.length > 0) {
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

            if ((visible || tmodel.requiresDom()) &&
                (tmodel.canHaveDom() && !tmodel.hasDom() && tmodel.isIncluded() && !this.noDomMap[tmodel.oid])) {
                this.lists.noDom.push(tmodel);
                this.noDomMap[tmodel.oid] = true;
            }
        }
        
        Object.values(lastVisibleMap).filter(v => v !== undefined).forEach(tmodel => {
            if (tmodel.hasDom()) {

                if (this.hasNoParent(tmodel) || !tmodel.isIncluded()) {
                    this.addToInvisibleDom(tmodel);
                } else if (tmodel.canDeleteDom() && this.isBracketVisible(tmodel) === false) {
                    this.addToInvisibleDom(tmodel);
                    tmodel.getChildren().forEach(tmodel => {
                        this.addToRecursiveInvisibleDom(tmodel);
                    });
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
    
    hasNoParent(tmodel, level = 0) {
        if (tmodel.getParent()) {
            if (!tmodel.getParent().allChildrenMap[tmodel.oid]) {
                return true;
            }
            if (level <= 1) {
                return this.hasNoParent(tmodel.getParent(), level + 1);
            }
        } else {
            return false;
        }
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

            if (!tmodel.hasChildren()) {
                this.addToExchange(tmodel);
            }
            
        }
    }
    
    needsRelocation(tmodel) {
        if (tmodel.hasDom() && TUtil.isDefined(tmodel.domOrderIndex)) {            
            this.lists.relocation.push(tmodel);  
            return true;
        }
        
        return false;
    }
    
    getVisibles() {
        return Object.values(this.visibleOidMap);
    }

    needsRerender(tmodel) {
        if (tmodel.hasDom() && TUtil.isDefined(tmodel.getHtml()) &&
                (tmodel.$dom.html() !== tmodel.getHtml() || tmodel.$dom.textOnly !== tmodel.isTextOnly())) {
            this.lists.rerender.push(tmodel);            
            return true;
        }

        return false;
    }

    needsRestyle(tmodel) {
        if (tmodel.hasDom()) {  
            if (tmodel.styleTargetList.length > 0) {
                this.lists.restyle.push(tmodel);             
            }
            if (tmodel.asyncStyleTargetList.length > 0) {
                this.lists.reasyncStyle.push(tmodel);
            }
        }
    }

    needsReattach(tmodel) {
        if (tmodel.hasDom() && !tmodel.reuseDomDefinition() && (tmodel.hasDomHolderChanged() || tmodel.hasBaseElementChanged())) {
            this.lists.reattach.push(tmodel);
        }
    }  
    
    addToExchange(tmodel) {
        const xKey = this.getDomExchangeKey(tmodel);
        if (!this.exchangeTypeMap[xKey]) {
            this.exchangeTypeMap[xKey] = [];
        }
        this.exchangeTypeMap[xKey].push(tmodel);  
    }

    renderTModels() {
        for (const tmodel of this.lists.rerender) {
            tmodel.isTextOnly() ? tmodel.$dom?.text(tmodel.getHtml()) : tmodel.$dom?.html(tmodel.getHtml());
            tmodel.setActualValueLastUpdate('html');
            tmodel.domHeightTimestamp = 0;
            tmodel.domWidthTimestamp = 0;
        }
    }

    reattachTModels() {
        for (const tmodel of this.lists.reattach) {            
            tmodel.$dom?.detach();
            
            if (tmodel.hasBaseElementChanged()) {
                TModelUtil.createDom(tmodel);
            }
    
            if (tmodel.getDomHolder(tmodel)) {  
                tmodel.getDomHolder(tmodel).appendTModel$Dom(tmodel);
            }
        }
    }
    
    relocateTModels() {
        this.lists.relocation.sort((a, b) => b.domOrderIndex - a.domOrderIndex);
        
        for (const tmodel of this.lists.relocation) { 
            tmodel.getDomParent().$dom.relocate(tmodel, tmodel.domOrderIndex);
            tmodel.domOrderIndex = undefined;
        }
    }
    
    resetTModelDom(tmodel) {
        tmodel.styleMap = {};
        tmodel.transformMap = {};
        tmodel.actualValues.isVisible = false;
        tmodel.hasDomNow = false;
        tmodel.$dom = null;        
    };
    
    deleteDoms() {
        for (const tmodel of this.lists.invisibleDom) {
            tmodel.$dom?.detach();
            this.resetTModelDom(tmodel);
        }
        
        this.lists.invisibleDom.length = 0;
        this.exchangeTypeMap = {};
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
    
    getDomExchangeKey(tmodel) {
        return `${tmodel.type}-${tmodel.getDomParent().oid}-${tmodel.getBaseElement()}`;
    }

    completeDoneTModels() {
        this.doneTargets.forEach(target => {
            const tmodel = target.tmodel;
            const key = target.key;
            if (tmodel.isTargetDone(key)) {
                tmodel.setTargetComplete(key);
                tmodel.removeFromActiveTargets(key);
                tmodel.removeFromUpdatingTargets(key);
            }
        });
    }

    createDoms() {           
        if (this.lists.noDom.length === 0) { 
            return;
        }
                
        const needsDom = [];

        this.lists.noDom.sort((a, b) => {
            return a.getUIDepth() < b.getUIDepth() ? -1 : 1;
        });

        for (const tmodel of this.lists.noDom) {
            let $dom;
            if ($Dom.query(`#${tmodel.oid}`)) {
                $dom = new $Dom(`#${tmodel.oid}`);
                tmodel.$dom = $dom;
                tmodel.hasDomNow = true;
                this.needsRestyle(tmodel);
            } else {                
                needsDom.push(tmodel);
            }
        }
        
        for (const tmodel of needsDom) {
            if (tmodel.getDomHolder(tmodel)?.exists()) {
                if (tmodel.val('$dom')) {
                    tmodel.$dom = tmodel.val('$dom');
                    if (!tmodel.hasDom()) {
                        tmodel.getDomHolder(tmodel).appendTModel$Dom(tmodel);
                        tmodel.hasDomNow = true;    
                    }   
                } else {
                    const xKey = this.getDomExchangeKey(tmodel);
                    const xList = this.exchangeTypeMap[xKey];
                    let invisible = undefined;
                    
                    if (xList) {
                        const idx = xList.findIndex(obj => obj?.$dom);
                        if (idx === -1) {
                            delete this.exchangeTypeMap[xKey];
                        } else {
                            invisible = this.exchangeTypeMap[xKey][idx];
                            this.exchangeTypeMap[xKey] = this.exchangeTypeMap[xKey].slice(idx + 1);
                        }
                    }

                    if (invisible) {
                        const index = this.lists.invisibleDom.indexOf(invisible);
                        if (index >= 0) {                            
                            this.lists.invisibleDom.splice(index, 1);
                            tmodel.styleMap = invisible.styleMap;
                            tmodel.transformMap = invisible.transformMap;
                            tmodel.$dom = invisible.$dom; 
                            
                            TModelUtil.patchDom(tmodel);
                            this.resetTModelDom(invisible);
                        }
                    }
                    
                    if (!tmodel.$dom) {
                        tmodel.$dom = new $Dom();
                        TModelUtil.createDom(tmodel);
                        tmodel.getDomHolder(tmodel).appendTModel$Dom(tmodel);
                        tmodel.hasDomNow = true;
                    }
                } 
            }
        }
        
        getEvents().attachEvents(this.lists.noDom);
    }        
}

export { TModelManager };
