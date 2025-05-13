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
        this.visibleTypeMap = {};
        this.visibleOidMap = {};
        this.targetMethodMap = {};
        this.noDomMap = {};

        this.doneTargets = [];
    }

    clear() {
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
        this.visibleTypeMap = {};
        this.visibleOidMap = {};
        this.targetMethodMap = {};
        this.noDomMap = {};
    }

    analyze() {
        const lastVisibleMap = TUtil.list2map(this.lists.visible);
        this.clear();

        for (const tmodel of getLocationManager().hasLocationList) {
            const parent = tmodel.getParent();

            if (parent && !parent.allChildrenMap[tmodel.oid]) {
                if (tmodel.hasDom() && !this.lists.invisibleDom.includes(tmodel)) {
                    this.lists.invisibleDom.push(tmodel);
                }
                continue;
            }
            const visible = tmodel.isVisible();

            if (visible) {
                lastVisibleMap[tmodel.oid] = null;

                if (tmodel.hasDom() && !tmodel.canHaveDom() && !this.lists.invisibleDom.includes(tmodel)) {
                    this.lists.invisibleDom.push(tmodel);
                }

                this.lists.visible.push(tmodel);
                
                this.visibleOidMap[tmodel.oid] = tmodel;
                if (!this.visibleTypeMap[tmodel.type]) {
                    this.visibleTypeMap[tmodel.type] = [];
                }
                
                this.visibleTypeMap[tmodel.type].push(tmodel);
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

                if (state.activeChildrenList?.length > 0) {
                    this.lists.activeTModels = [...this.lists.activeTModels, ...state.activeChildrenList];
                }

                if (state.targetMethodMap && Object.keys(state.targetMethodMap).length > 0) {
                    this.targetMethodMap[tmodel.oid] = { ...state.targetMethodMap };
                    state.targetMethodMap = {};
                }

                tmodel.deactivate();
            }

            if ((visible || !tmodel.canDeleteDom()) &&
                (tmodel.canHaveDom() && !tmodel.hasDom() && !this.noDomMap[tmodel.oid])) {
                this.lists.noDom.push(tmodel);
                this.noDomMap[tmodel.oid] = true;
            }
        }

        const lastVisible = Object.values(lastVisibleMap)
            .filter(tmodel => tmodel !== null &&
                tmodel.hasDom() &&
                (tmodel.canDeleteDom() || !tmodel.getParent()?.allChildrenMap[tmodel.oid]));

        this.lists.invisibleDom.push(...lastVisible);

        return this.lists.noDom.length > 0 ? 0 :
               this.lists.reattach.length > 0 ? 1 :
               this.lists.relocation.length > 0 ? 2 :
               this.lists.rerender.length > 0 ? 3 :
               this.lists.reasyncStyle.length > 0 ? 4 :
               this.lists.invisibleDom.length > 0 ? 5 :
               this.lists.restyle.length > 0 ? 10 : -1;
    }
    
    needsRelocation(tmodel) {
        if (tmodel.hasDom() && TUtil.isDefined(tmodel.domOrderIndex)) {            
            this.lists.relocation.push(tmodel);  
            return true;
        }
        
        return false;
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
    
    deleteDoms() {
        for (const tmodel of this.lists.invisibleDom) {
            tmodel.styleMap = {};
            tmodel.transformMap = {};
            tmodel.val('isVisible', false);
            tmodel.hasDomNow = false;
        
            tmodel.$dom?.detach();
            tmodel.$dom = null;
        }

        this.lists.invisibleDom.length = 0;
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
                } else {
                    tmodel.$dom = new $Dom();
                    TModelUtil.createDom(tmodel);
                    tmodel.getDomHolder(tmodel).appendTModel$Dom(tmodel);
                    tmodel.hasDomNow = true;                      
                } 
            }
        }
        
        getEvents().attachEvents(this.lists.noDom);
    }        
}

export { TModelManager };
