import { BaseModel } from "./BaseModel.js";
import { App, getLocationManager, getRunScheduler } from "./App.js";
import { Viewport } from "./Viewport.js";
import { TUtil } from "./TUtil.js";
import { TargetData } from "./TargetData.js";
import { SearchUtil } from "./SearchUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";
import { DomInit } from "./DomInit.js";

/**
 * It provides the base class for all objects in an app where targets are defined. 
 * These objects typically have a DOM but can also operate without one.
 */
class TModel extends BaseModel {
    constructor(type, targets, oid) {
        super(type, targets, oid);
        
        this.allChildrenList = [];
        this.allChildrenMap = {};
        this.childrenUpdateFlag = false;

        this.$dom = null;

        this.x = 0;
        this.y = 0;
        this.absX = 0;
        this.absY = 0;

        this.domHeightTimestamp = 0;
        this.domWidthTimestamp = 0;

        this.contentWidth = 0;
        this.contentHeight = 0;
        this.bottomBaseWidth = 0;
        this.topBaseHeight = 0;
        
        this.styleMap = {};
        this.tfMap = {};
                
        this.visibilityStatus = undefined;
                      
        this.hasDomNow = false;
        this.isNowVisible = false;
        this.currentStatus = 'new';
        
        this.dirtyLayout = false;
        this.originWindowEpoch = -1;
        
        this.initTargets();        
    }

    createViewport() {
        this.viewport = this.viewport || new Viewport();

        const scrollLeft = -this.getScrollLeft();
        const scrollTop = -this.getScrollTop();
        
        const x = scrollLeft, y = scrollTop;
        
        this.viewport.xNext = x;
        this.viewport.xNorth = x;
        this.viewport.xEast = x;
        this.viewport.xSouth = x;
        this.viewport.xWest = x;
        
        this.viewport.scrollLeft = scrollLeft;
        this.viewport.scrollTop = scrollTop;        
        
        this.viewport.absX = this.absX;
        this.viewport.absY = this.absY;
        
        this.viewport.xOverflowReset = x;        
        this.viewport.xOverflowLimit = x +this.getWidth();

        this.viewport.yNext = y;
        this.viewport.yNorth = y;
        this.viewport.yWest = y;
        this.viewport.yEast = y;
        this.viewport.ySouth = y;
                
        this.calcContentWidthHeight();
        
        this.viewport.container = this;
        
        return this.viewport;
    }
    
    calcContentWidthHeight() {
        const contentHeight = this.viewport.ySouth - this.viewport.yNorth;
        const contentWidth = this.viewport.xEast - this.viewport.xWest;
        const topBaseHeight = this.viewport.yEast - this.viewport.yNorth;
        const bottomBaseWidth = this.viewport.xSouth - this.viewport.xWest;
        
        if (contentHeight !== this.contentHeight
                || this.contentWidth !== contentWidth
                ||  this.topBaseHeight !== topBaseHeight
                || this.bottomBaseWidth !== bottomBaseWidth) {
            this.contentHeight = contentHeight;
            this.topBaseHeight = topBaseHeight;
            this.bottomBaseWidth = bottomBaseWidth;
            this.contentWidth = contentWidth;
       }
    }
    
    adjustViewport() {}    

    calcAbsolutePosition(x, y) {
        this.absX = TUtil.isDefined(this.val('absX')) ? this.val('absX') : this.getParent().absX - (this.getParent().$dom?.getScrollLeft() ?? 0) + x;
        this.absY = TUtil.isDefined(this.val('absY')) ? this.val('absY') : this.getParent().absY - (this.getParent().$dom?.getScrollTop() ?? 0) + y;
    }
    
    calcAbsolutePositionFromDom() {
        TModelUtil.calcAbsolutePositionFromDom(this);
    }

    removeChild(child) {
        if (!child || !this.allChildrenMap[child.oid]) {
            return;
        }
            
        TargetUtil.resetBeforeDeletion(child);
        this.deletedChildren.push(child);   
        this.removeFromUpdatingChildren(child);
        this.removeFromActiveChildren(child);
        this.childrenUpdateFlag = true;
        getLocationManager().calcChildren(this);
        this.markLayoutDirty('removeChild');
                   
        getRunScheduler().schedule(1, 'removeChild-' + child.oid);

        return this;
    }
    
    moveChild(child, index) {
        this.movedChildren.push({ index, child });
        
        if (child.hasDom() && child.requiresDomRelocation()) {  
            child.domOrderIndex = index;
            child.activate();
        }
                 
        this.childrenUpdateFlag = true;
        this.markLayoutDirty('moveChild');
        
        getRunScheduler().schedule(1, 'moveChild-' + this.oid + "-" + child.oid);
                           
        return this;
    }
    
    addChild(child, index = this.addedChildren.length + this.allChildrenList.length) {  
        if (typeof child === 'object') {
            this.childrenUpdateFlag = true;
            
            if (!(child instanceof TModel)) {
                const foundKey = Object.keys(this.actualValues).find(key => this.actualValues[key] === child);
                
                if (foundKey) {
                    child = new TModel(child.id || foundKey, child);
                } else {
                    child = new TModel(`${this.oid}_`, child);                    
                }
            }
        
            if (!child.toDiscard) { 
                
                App.tmodelIdMap[child.oid] = child;
                this.addedChildren.push({ index, child });
                child.parent = this;
                child.markLayoutDirty('addChild');
                
                if (child.updatingTargetList.length > 0) {
                    this.addToUpdatingChildren(child);
                }
                if (child.activeTargetList.length > 0) {
                    this.addToActiveChildren(child);
                }   
                        
                TargetUtil.markChildAction(this, TargetUtil.currentTargetName, child);
            }
        }
        return this;
    }    
    
    addSibling(sibling) {
        this.getParent().addChild(sibling);
    }
    
    removeSibling(sibling) {
        if (!sibling) {
            sibling = this.getParent().getChildren().find(child => child !== this);
        }
        this.getParent().removeChild(sibling);
    }
    
    getChildren() { 
        const state = this.state();

        if (state.deletedChildren?.length > 0) {
            this.deletedChildren.forEach(child => {                
                if (this.allChildrenMap[child.oid]) {
                    const index = this.allChildrenList.indexOf(child);
                    this.lastChildrenUpdate.deletions.push(child);
                    this.allChildrenList.splice(index, 1);
                    delete this.allChildrenMap[child.oid];
                }
            });                     
                                    
            this.deletedChildren.length = 0;
        } 
        
        if (state.addedChildren?.length > 0) {
            this.addedChildren.sort((a, b) => a.index - b.index);

            this.addedChildren.forEach(({ index, child }) => {
                
                if (this.allChildrenMap[child.oid]) {
                    return;
                }
                
                if (!TUtil.isDefined(child.val('canDeleteDom')) && this.val('canDeleteDom') === false) {
                    child.val('canDeleteDom', false);
                }

                if (index >= this.allChildrenList.length) {
                    this.allChildrenList.push(child);
                } else {
                    this.allChildrenList.splice(index, 0, child);
                }
                
                this.allChildrenMap[child.oid] = child;
 
                this.lastChildrenUpdate.additions.push({ index, child });
            });
                                    
            this.addedChildren.length = 0;            
        }
        
        if (state.movedChildren?.length > 0) {
            this.movedChildren.sort((a, b) => a.index - b.index);
            
            const deletionMap = {};
            const additionMap = {};
            this.movedChildren.forEach(({ index, child }) => {
                this.lastChildrenUpdate.deletions.push(child);
                this.lastChildrenUpdate.additions.push({ index, child });
                
                const currentIndex = this.allChildrenList.indexOf(child);
                
                if (index === currentIndex) {
                    return;
                }
                
                if (additionMap[child.oid]) {
                    delete additionMap[child.oid];
                }

                const deleted = this.allChildrenList.splice(index, 1, child);
                
                if (!deletionMap[index] && deleted.length > 0) {
                    additionMap[deleted[0].oid] = { child: deleted[0], index: index + 1 };
                }
                if (currentIndex >= 0) {
                    deletionMap[currentIndex] = { fromIndex: currentIndex < index ? currentIndex : index, child };
                }                
                
                if (deletionMap[index]) {
                    delete deletionMap[index];
                }
            });
            Object.values(additionMap).forEach(({ index, child }) => {
                this.allChildrenList.splice(index, 0, child);
            });
                        
            Object.values(deletionMap).forEach(({ fromIndex, child }) => {
                const deleteIndex = this.allChildrenList.indexOf(child, fromIndex);
                this.allChildrenList.splice(deleteIndex, 1);
            });
           
            this.movedChildren.length = 0;
        }
        
        return this.allChildrenList;
    }

    removeChildren() {  
        if (!this.hasChildren()) {
            return this;
        }
        
        this.markLayoutDirty('removeChildren');
        
        this.allChildrenList.forEach(t => {
            TargetUtil.resetBeforeDeletion(t);
            t.$dom = undefined;
        }); 
        this.allChildrenList = [];
        this.allChildrenMap = {};
       
        this.clearUpdatingChildren();
        this.clearActiveChildren();
        this.clearAnimatingChildren();
       
        if (this.hasDom()) {
            this.$dom.deleteAll();
        }
        
        return this;        
    }   
    
    addToParentVisibleChildren() {
        if (this.isVisible() && this.isInFlow() && this.getParent()) {
            this.getParent().visibleChildren.push(this);
        }
    }
            
    markLayoutDirty(key, tmodel = this) {
        if (!this.dirtyLayout) {
            this.dirtyLayout = { oids: {}, count: 0 };
        }
        
        if (!this.dirtyLayout.oids[tmodel.oid]) {
            this.dirtyLayout.oids[tmodel.oid] = tmodel;
            this.dirtyLayout.count++;
        }
        
        if (tmodel === this) {
            key = tmodel.oid + "#" + key;
        }
                    
        this.dirtyLayout.lastKey = key;
        
        if (this.bracket) {
            this.bracket.markLayoutDirty(key, tmodel);    
        }
        
        if (this.parent) {
            this.parent.markLayoutDirty(key, tmodel);
        }
    }
    
    removeLayoutDirty(tmodel, oids) {
        if (this.dirtyLayout) {
            if (oids) {
                oids.forEach(oid => {
                    if (this.dirtyLayout.oids[oid]) {
                        this.dirtyLayout.count--;
                        delete this.dirtyLayout.oids[oid];
                    }
                });
            } else if (this.dirtyLayout.oids[tmodel.oid]) {
                this.dirtyLayout.count--;
                delete this.dirtyLayout.oids[tmodel.oid];
            }

            if (this.dirtyLayout.count === 0) {
               this.dirtyLayout = false; 
            }
        }
        
        if (this.bracket) {
            this.bracket.removeLayoutDirty(tmodel, oids);    
        }        
            
        if (this.parent) {
            this.parent.removeLayoutDirty(tmodel, oids);
        }            
    }
    
    getDirtyLayout() {
        return this.dirtyLayout;
    }

    shouldCalculateChildren() {
        if (TUtil.isDefined(this.val('calculateChildren'))) {
            return this.val('calculateChildren');
        }
        
        if (!this.isIncluded() || (this.isDomIsland() && !this.hasDom())) {
            return false;
        }
        
        const result = (this.isVisible() && this.dirtyLayout !== false) || this.isNowVisible;
        
        this.currentStatus = undefined;

        return result;
    }
 
    getFirstChild() {
        return this.getChildren()[0];
    }
    
    hasChildren() {
        return this.getChildren().length > 0;
    }
    
    findChildren(type) {
        return this.getChildren().filter(child => child.type === type);
    }

    getLastChild() {
        return this.getChildren()[this.allChildrenList.length - 1];
    }
    
    getChild(index) {
        return typeof index === 'number' ? this.getChildren()[index] : this.findChild(index);
    }
    
    getChildIndex(child) {
        return this.getChildren().indexOf(child);
    }

    getChildrenOids() {
        return this.getChildren().map(o => o.oid).join(" ");
    }

    findChild(type) {
        return this.getChildren().find(child => child.type === type);
    }

    findLastChild(type) {
        return this.getChildren().findLast(child => child.type === type);
    }
    
    getChildByOid(oid) {
        this.getChildren();
        return this.allChildrenMap[oid];
    }

    getParentValue(targetName) {
        return this.parent?.val(targetName);
    }
    
    pval(targetName) {
        return this.getParentValue(targetName);
    }
    
    getParentValueAtMyIndex(targetName) {
        const parentValue = this.getParentValue(targetName);
        if (Array.isArray(parentValue)) {
            const index = this.getParent()?.getChildIndex(this);
            if (typeof index === 'number') {
                return parentValue[index];
            }
        }
        
        return parentValue;
    }
    
    delVal(key) {
        this.markLayoutDirty(`del-${key}`);
        
        if (key.startsWith('_')) {
            delete this[key.slice(1)];
        } else {
            delete this.actualValues[key];
        }
    }

    val(key, value) {
        let actual = this.actualValues;
        let lastActual = this.lastActualValues;

        key = TargetUtil.getTargetName(key);

        if (arguments.length === 2) {
            lastActual[key] = actual[key];
            if (value !== actual[key]) {
                actual[key] = value;
                this.markLayoutDirty(`val-${key}`);
            }
            return this;
        }
        
        return actual[key];
    }
    
    lastVal(key) {
        return this.lastActualValues[key];
    }
    
    setActual(key, value) {
        if (this.targetValues[key]) {
            this.targetValues[key].actual = value;
        }
    }

    floorVal(key) {
        return Math.floor(this.val(key) ?? 0);
    }

    getDomParent() {
        return this.val('domParent') || SearchUtil.findParentByTarget(this, 'domHolder', true);
    }
   
    getDomHolder(tmodel) {
        const domHolder = this.val('domHolder');
        
        if (domHolder === true && tmodel !== this) {
            return this.$dom;
        }        
        if (domHolder && domHolder !== true && tmodel.$dom !== domHolder) {
            return domHolder;
        }
        
        const domParent = this.getDomParent();

        return domParent ? domParent.$dom : null;
    }
   
    bug() {
        return [
            { visible: this.isVisible() },
            { visibilityStatus: this.visibilityStatus },
            { hasDom: this.hasDom() },
            { x: this.getX() },
            { y: this.getY() },
            { width: this.getWidth() },
            { height: this.getHeight() },
            { activeTargetList: this.activeTargetList },
            { updatingTargetList: this.updatingTargetList },
            { updatingChildren: this.updatingChildrenMap ? [ ...this.updatingChildrenMap.keys() ] : [] },
            { activeChildren: this.activeChildrenMap ? [ ...this.activeChildrenMap.keys() ] : [] },            
            { children: this.getChildren() },
            { targetValues: this.targetValues },
            { actualValues: this.actualValues }
        ];
    }
    
    logTree() {
        TUtil.logTree(this);
    }
    
    isVisible() {
        return this.val('isVisible');
    }
    
    makeVisible() {
        this.val('isVisible', true);
        this.targets.isVisible = true;
    }
    
    makeInvisible() {
        this.val('isVisible', false);
        this.targets.isVisible = false;        
    }
    
    managesOwnScroll() {
        if (TUtil.isDefined(this.val('managesOwnScroll'))) {
            return !!this.val('managesOwnScroll');
        }

        return !!this.allTargetMap['onScroll'] || !!this.allTargetMap['onScrollLeft'] || !!this.allTargetMap['onScrollTop'] || !!this.allTargetMap['onWindowScroll'];
    }
    
    calcVisibility() {
        return TUtil.calcVisibility(this);
    }
    
    validateVisibilityInParent() {
        return TUtil.isDefined(this.val('validateVisibilityInParent')) ? this.val('validateVisibilityInParent') : this.parent.managesOwnScroll();
    }

    hasDomHolderChanged() {
        return !this.reuseDomDefinition() && this.getDomHolder(this) && this.getDomHolder(this).exists() && this.$dom.parent() !== this.getDomHolder(this).element;
    }
    
    hasBaseElementChanged() {
        return this.hasDom() ? this.getBaseElement() !== this.$dom.getTagName() : false;
    }
    
    mount(elemTarget) {
        DomInit.mount(this, elemTarget);
    }

    hasDom() {
        return !!this.$dom && this.$dom.exists();
    }
    
    isDomIsland() {
        return this.val('domIsland');
    }
    
    getRealParent() {
        return this.parent;
    }
    
    getContentHeight() {
        return this.contentHeight;
    }
    
    getContentWidth() {
        return this.contentWidth;
    }  
    
    useContentWidth() {
        return TModelUtil.useContentWidth(this);
    }
    
    useContentHeight() {
        return TModelUtil.useContentHeight(this);
    }    

    getBaseWidth() {
        return this.val('baseWidth') ?? this.getWidth();
    }
    
    getBaseHeight() {
        return this.val('baseHeight') ?? this.getHeight();
    }    
    
     getMinWidth() {
        return this.val('minWidth') ?? Math.min(this.getWidth(), this.getBaseWidth());
    }
   
    getTopBaseHeight() {
        return this.val('topBaseHeight') ?? 0;
    }

    getContainerOverflowMode() {
        return this.val('containerOverflowMode') ?? 'auto';
    }
    
    getItemOverflowMode() {
        const mode = this.targets.itemOverflowMode;

        if (mode !== undefined) {
            return typeof mode === 'function' ? mode.call(this) : mode;
        }

        const v = this.val('itemOverflowMode');
        return v !== undefined ? v : 'auto';
    }    

    getUIDepth() {
        let depth = 0;

        let node = this.parent;
        while (node) {
            depth++;
            node = node.parent;
        }

        return depth;
    }
    
    canBeAnimated(key) {
        return TargetData.isGpuPreferred(key) && this.actualValues.webAnimation !== false;
    }
    
    isTextOnly() {
        return TUtil.isDefined(this.val('textOnly')) ? this.val('textOnly') : typeof this.getHtml() === 'string' &&  this.getHtml().trim().startsWith('<') ? false : true;
    }
    
    getHtml() {
        return this.val('html');
    }

    isInFlow() {
        return TUtil.isDefined(this.val('isInFlow')) ? this.val('isInFlow') : true;
    }

    canHandleEvent(eventName) {
        return this.allTargetMap[eventName] ?? false;
    }

    preventDefault() {
        return TUtil.isDefined(this.val('preventDefault')) ? this.val('preventDefault') : this.getParentValue('preventDefault') || false;
    }
    
    canDeleteDom() {
        return TUtil.isDefined(this.val('canDeleteDom')) ? this.val('canDeleteDom') : !this.reuseDomDefinition();
    }
    
    requiresDom() {
        return TUtil.isDefined(this.val('requiresDom')) ? this.val('requiresDom') : this.reuseDomDefinition();
    }
    
    excludeStyling() {
        return this.targets['styling'] === false;
    }
        
    getBracketThreshold() {
        return this.val('bracketThreshold');
    }
    
    getBracketSize() {
        return this.val('bracketSize');
    }
    
    shouldBeBracketed() {
        if (TUtil.isDefined(this.val('shouldBeBracketed'))) {
            return this.val('shouldBeBracketed');
        }        
        return this.getChildren().length > this.getBracketThreshold();  
    }
   
    isIncluded() {
        return this.val('isIncluded');
    }
    
    canHaveDom() {
        if (this.targets['$dom'] && !this.val('$dom')) {
            return false;
        }
        return this.val('canHaveDom');
    }
    
    requiresDomRelocation() {
        return TUtil.isDefined(this.val('requiresDomRelocation')) ? this.val('requiresDomRelocation') : !TUtil.isDefined(this.tfMap.x) && !TUtil.isDefined(this.tfMap.y);
    }
    
    getBaseElement() {
        return this.val('baseElement') || this.val('element') || this.$dom?.element?.tagName?.toLowerCase();
    }

    getOpacity() {
        return this.val('opacity');
    }
    
    getCenterX() {
        return (this.parent.getWidth() - this.getWidth()) / 2;
    }
    
    getCenterY() {
        return (this.parent.getHeight() - this.getHeight()) / 2;
    }    

    getX() {
        return this.val('x');
    }

    getY() {
        return this.val('y');
    }
    
    getZ() {
        return this.val('z');
    }    
             
    getPerspective() {
        return this.val('perspective');
    }  
    
    getRotate() {
        return this.val('rotate');
    }     
    
    getRotateX() {
        return this.val('rotateX');
    }    
    
    getRotateY() {
        return this.val('rotateY');
    }   
    
    getRotateZ() {
        return this.val('rotateZ');
    } 

    getScale() {
        return this.val('scale');
    }    
   
    getScaleX() {
        return this.val('scaleX');
    }    
    
    getScaleY() {
        return this.val('scaleY');
    }   
    
    getScaleZ() {
        return this.val('scaleZ');
    }    
    
    getSkewX() {
        return this.val('skewX');
    }   
    
    getSkewY() {
        return this.val('skewY');
    }    
    
    getSkewZ() {
        return this.val('skewZ');
    }      

    getMeasuringScale() {
        return this.val('measuringScale') ?? 1;
    }

    getZIndex() {
        return this.val('zIndex');
    }    

    getTopMargin() {
        return this.val('topMargin');
    }

    getLeftMargin() {
        return this.val('leftMargin');
    }

    getRightMargin() {
        return this.val('rightMargin') + (this.getParentValue('gap') ?? 0);
    }

    getBottomMargin() {
        return this.val('bottomMargin') + (this.getParentValue('gap') ?? 0);
    }

    getWidth() {
        if (TUtil.isDefined(this.targets.width) || TUtil.isDefined(this.targetValues.width)) {
            return this.val("width");
        }

        if (TUtil.isDefined(this.targets.dim) || TUtil.isDefined(this.targetValues.dim)) {
            return this.val("dim");
        }

        return this.val("width");
    }

    getHeight() {
        if (TUtil.isDefined(this.targets.height) || TUtil.isDefined(this.targetValues.height)) {
            return this.val("height");
        }

        if (TUtil.isDefined(this.targets.dim) || TUtil.isDefined(this.targetValues.dim)) {
            return this.val("dim");
        }

        return this.val("height");
    }

    getScrollTop() {
        return this.val('scrollTop');
    }

    getScrollLeft() {
        return this.val('scrollLeft');
    }

    getCss() {
        return this.val('css');
    }

    getStyle() {
        return this.val('style');
    }
    
    getBackground() {
        return this.val('background');
    }
    
    getBackgroundColor() {
        return this.val('backgroundColor');
    }
    
    getAttributes() {
        return this.val('attributes');
    }
    
    getInputValue() {
        return this.hasDom() ? this.$dom.value() : undefined;
    }
    
    isFormControl() {
        const t = this.getBaseElement();
        return t === 'input' || t === 'select' || t === 'textarea' || (this.$dom?.element?.isContentEditable);
    }
    
    isOverflowHidden() {
        return this.val('overflow') === 'hidden';
    }
    
    reuseDomDefinition() {
        return this.val('reuseDomDefinition');
    } 
}

export { TModel };
