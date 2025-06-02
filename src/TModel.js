import { BaseModel } from "./BaseModel.js";
import { getRunScheduler } from "./App.js";
import { Viewport } from "./Viewport.js";
import { TUtil } from "./TUtil.js";
import { SearchUtil } from "./SearchUtil.js";
import { TargetUtil } from "./TargetUtil.js";

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
        this.transformMap = {};
        
        this.visibilityStatus = undefined;
                      
        this.hasDomNow = false;
        this.isNowVisible = false;
        this.currentStatus = 'new';
        
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
        
        this.viewport.xOverflowReset = this.absX;        
        this.viewport.xOverflowLimit = this.absX +this.getWidth();

        this.viewport.yNext = y;
        this.viewport.yNorth = y;
        this.viewport.yWest = y;
        this.viewport.yEast = y;
        this.viewport.ySouth = y;
                
        Object.assign(this.viewport, this.val('viewport') || {});
        
        for (const key in this.viewport) {
            const prefixedKey = `viewport_${key}`;
            if (TUtil.isDefined(this.val(prefixedKey))) {
                this.viewport[key] = this.val(prefixedKey);
            }
        }
        
        return this.viewport;
    }

    calcAbsolutePosition(x, y) {
        this.absX = TUtil.isDefined(this.val('absX')) ? this.val('absX') : this.getParent().absX + x;
        this.absY = TUtil.isDefined(this.val('absY')) ? this.val('absY') : this.getParent().absY + y;
    }
      
    removeChild(child) {
        if (!child) {
            return;
        }
            
        this.deletedChildren.push(child);   
        this.removeFromUpdatingChildren(child);           
        this.childrenUpdateFlag = true;
           
        getRunScheduler().schedule(1, 'removeChild-' + this.oid + "-" + child.oid);

        return this;
    }
    
    moveChild(child, index) {
        this.movedChildren.push({ index, child });
        
        if (child.hasDom() && child.requiresDomRelocation()) {  
            child.domOrderIndex = index;
            child.activate();
        }
         
        this.childrenUpdateFlag = true;

        getRunScheduler().schedule(1, 'moveChild-' + this.oid + "-" + child.oid);
                           
        return this;
    }
    
    addChild(child, index = this.addedChildren.length + this.allChildrenList.length) {
        TargetUtil.markTargetAction(this, 'childAction');
        
        if (typeof child === 'object') {
            this.childrenUpdateFlag = true;
            if (!(child instanceof TModel)) {   
                
                const foundKey = Object.keys(this.actualValues).find(key => this.actualValues[key] === child);

                if (foundKey) {
                    child = new TModel(child.id || foundKey, child);
                    this.actualValues[foundKey] = child;
                } else if (TUtil.isDefined(child.otype)) {
                    child = new TModel(child.otype, child);                     
                } else if (TUtil.isDefined(child.id)) {     
                    child = new TModel(child.id, child, child.id);                   
                } else {
                    child = new TModel(`${this.oid}_`, child);                    
                }
            }
            
            if (!child.toDiscard) {
                this.addedChildren.push({ index, child });
                child.parent = this;
                if (child.updatingTargetList.length > 0) {
                    this.addToUpdatingChildren(child);
                }
                if (child.activeTargetList.length > 0) {
                    this.addToActiveChildren(child);
                }
                child.activate();
            }
        }
        return this;
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

    removeAll() {  
        this.allChildrenList = [];
        this.allChildrenMap = {};

        this.state().updatingChildrenList = [];
        this.state().updatingChildrenMap = {};
        
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

    shouldCalculateChildren() {
        if (TUtil.isDefined(this.val('calculateChildren'))) {
            return this.val('calculateChildren');
        }
        const result = this.isIncluded() && 
                (this.isVisible() || this.currentStatus === 'new')  && 
                (this.hasChildren() || this.childrenUpdateFlag || this.getContentHeight() > 0);

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
        return this.getChildren()[index];
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
        return this.allChildrenMap[oid];
    }

    getParentValue(targetName) {
        const parent = SearchUtil.findParentByTarget(this, targetName);
        return parent ? parent.val(targetName) : undefined;
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
        if (key.startsWith('_')) {
            delete this[key.slice(1)];
        } else {
            delete this.actualValues[key];
        }
    }

    val(key, value) {
        let actual = this.actualValues;
        let lastActual = this.lastActualValues;
        if (key?.startsWith('_')) {
            actual = this;
            key = key.slice(1);
        }
        if (value !== undefined) {
            lastActual[key] = actual[key];
            if (value !== actual[key]) {
                actual[key] = value;
            }
            return this;
        }
        
        return actual[key];
    }
    
    lastVal(key) {
        return this.lastActualValues[key];
    }

    floorVal(key) {
        return Math.floor(this.val(key));
    }

    getDomParent() {
        return this.val('domParent') || SearchUtil.findParentByTarget(this, 'domHolder');
    }
   
    getDomHolder(tmodel) {
        const domHolder = this.val('domHolder');
        const domParent = this.getDomParent();

        if (domHolder === true && tmodel !== this) {
            return this.$dom;
        }

        if (domHolder && domHolder !== true && tmodel.$dom !== domHolder) {
            return domHolder;
        }

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
            { updatingChildrenList: this.updatingChildrenList },
            { activeChildrenList: this.activeChildrenList },            
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
    
    calcVisibility() {
        return TUtil.calcVisibility(this);
    }
    
    validateVisibilityInParent() {
        return TUtil.isDefined(this.val('validateVisibilityInParent')) ? this.val('validateVisibilityInParent') : false;
    }

    hasDomHolderChanged() {
        return !this.reuseDomDefinition() && this.getDomHolder(this) && this.getDomHolder(this).exists() && this.$dom.parent() !== this.getDomHolder(this).element;
    }
    
    hasBaseElementChanged() {
        return this.getBaseElement() !== this.$dom.getTagName();
    }

    hasDom() {
        return !!this.$dom && this.$dom.exists();
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
    
    calcContentWidthHeight() {
        this.contentHeight = this.viewport.ySouth - this.viewport.yNorth;
        this.topBaseHeight = this.viewport.yEast - this.viewport.yNorth;
        this.bottomBaseWidth = this.viewport.xSouth - this.viewport.xWest;        
        this.contentWidth = this.viewport.xEast - this.viewport.xWest;
    }
    
    getBaseWidth() {
        return this.val('baseWidth') ?? this.getWidth();
    }
    
     getMinWidth() {
        return this.val('minWidth') ?? this.getWidth();
    }
   
    getTopBaseHeight() {
        return this.val('topBaseHeight') ?? 0;
    }

    getContainerOverflowMode() {
        return this.val('containerOverflowMode') ?? 'auto';
    }
    
    getItemOverflowMode() {
        return this.val('itemOverflowMode') ?? 'auto';
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
    
    isTextOnly() {
        return this.val('textOnly');
    }
    
    getHtml() {
        return this.val('html');
    }

    isInFlow() {
        return TUtil.isDefined(this.val('isInFlow')) ? this.val('isInFlow') : true;
    }

    canHandleEvent(eventName) {
        return this.state().externalEventMap?.[eventName] ?? false;
    }

    preventDefault() {
        return TUtil.isDefined(this.val('preventDefault')) ? this.val('preventDefault') : this.getParentValue('preventDefault') || false;
    }
    
    canDeleteDom() {
        return TUtil.isDefined(this.val('canDeleteDom')) ? this.val('canDeleteDom') : !this.reuseDomDefinition();
    }

    excludeDefaultStyling() {
        return this.targets['defaultStyling'] === false || this.excludeStyling() || (this.reuseDomDefinition() && this.allStyleTargetList.length === 0);
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
        return TUtil.isDefined(this.val('requiresDomRelocation')) ? this.val('requiresDomRelocation') : !TUtil.isDefined(this.transformMap.x) && !TUtil.isDefined(this.transformMap.y);
    }
    
    getBaseElement() {
        return this.val('baseElement');
    }

    getOpacity() {
        return this.val('opacity');
    }
    
    getCenterX() {
        return TUtil.isDefined(this.getParentValue('width')) ?  (this.getParentValue('width') - this.getWidth()) / 2 : 0;
    }
    
    getCenterY() {
        return TUtil.isDefined(this.getParentValue('height')) ?  (this.getParentValue('height') - this.getHeight()) / 2 : 0;
    }    

    getX() {
        return this.val('x');
    }

    getY() {
        return this.val('y');
    }
    
    getTransformX() {
        return this.absX - this.getDomParent()?.absX;
    }
    
    getTransformY() {
        return this.absY - this.getDomParent()?.absY;
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
        return this.val('scale');
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
        return this.val('rightMargin');
    }

    getBottomMargin() {
        return this.val('bottomMargin');
    }

    getWidth() {
        return this.val('width');
    }

    getHeight() {
        return this.val('height');
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
    
    isOverflowHidden() {
        return this.val('overflow') === 'hidden';
    }
    
    reuseDomDefinition() {
        return this.val('reuseDomDefinition');
    } 
}

export { TModel };
