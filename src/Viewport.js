import { TModelUtil } from "./TModelUtil.js";

/**
 * It calculates the locations and visibility of objects
 */
class Viewport {
    constructor() {
        this.xNext = 0;
        this.xNorth = 0;
        this.xWest = 0;
        this.xEast = 0;
        this.xSouth = 0;

        this.scrollLeft = 0;
        this.scrollTop = 0;
        
        this.absX = 0;
        this.absY = 0;
        this.xOverflowReset = 0;
        this.xOverflowLimit = 0;

        this.yNext = 0;
        this.yNorth = 0;
        this.yWest = 0;
        this.yEast = 0;
        this.ySouth = 0;
                        
        this.container = undefined;
        
        this.time = 0;
    }
    
    setContainer(container) {
        this.container = container;
    }
    
    setCurrentChild(child) {
        this.currentChild = child;
    }
    
    setLocation() {
        const child = this.currentChild;

        if (!child.targets['excludeXYCalc']) {
            child.setLayoutX(this.xNext + child.getMarginLeft() + this.container.getPaddingLeft());
            child.setLayoutY(this.yNext + child.getMarginTop() + this.container.getPaddingTop());
        }
    }
    
    isOverflow() {
        if (this.currentChild.type === 'BI') {
            return false;
        }
        
        if (this.container.getContainerOverflowMode() === 'always' 
            || this.currentChild.getItemOverflowMode() === 'always'            
                    || (this.container.getContainerOverflowMode() === 'auto' &&
                        this.currentChild.getItemOverflowMode() === 'auto' && 
                        !this.currentChild.useContentWidth() && this.checkChildOverflow())) {  
            return true;        
        }
        
    }
    
    checkChildOverflow() {
        const child = this.currentChild;
        const childWidth = child.getMinWidth();
        return this.xNext + child.getMarginLeft() + childWidth + child.getMarginRight()> this.xOverflowLimit;
    }
    
    overflow() {
        this.xNext = this.scrollLeft - this.xOverflowReset;
        this.yNext = Math.max(this.currentChild.getRealParent().viewport.ySouth, this.ySouth);
    }
    
    appendNewLine() {
        const child = this.currentChild;
        const scale = child.getMeasuringScale();
        
        let maxHeight = child.getHeight() * scale + this.currentChild.getMarginTop() + this.currentChild.getMarginBottom();

        this.xNext = this.scrollLeft - this.xOverflowReset;
        const ySouth =  this.yNext + maxHeight + child.val('appendNewLine');

        this.yEast = this.yNext;
        this.xSouth = this.xNext;
        

        this.ySouth = Math.max(this.ySouth, ySouth);
        this.yEast = this.ySouth;
        this.yNext = this.ySouth;

        child.getRealParent().viewport.xEast = Math.max(child.getRealParent().viewport.xEast, this.xEast);
        child.getRealParent().viewport.ySouth = Math.max(child.getRealParent().viewport.ySouth, this.ySouth);
    }

    computeBoundary(child, space) {
        const scale = child.getMeasuringScale();
        const width = child.getBaseWidth() * scale;
        const height = child.getBaseHeight() * scale;

        let x, y, left, right, top, bottom;

        if (space === 'layout') {
            x = child.x;
            y = child.y;
            left = x - child.getMarginLeft();
            right = x + width + child.getMarginRight();
            top = y - child.getMarginTop();
            bottom = y + height + child.getMarginBottom();
        } else if (space === 'absolute') {
            x = child.absX - this.absX;
            y = child.absY - this.absY;
            left = x;
            right = x + width + child.getMarginRight();
            top = y;
            bottom = y + height + child.getMarginBottom();
        } else if (space === 'content') {
            x = (TModelUtil.isXDefined(child) ? child.getX() : undefined) ?? child.x;
            y = (TModelUtil.isYDefined(child) ? child.getY() : undefined) ?? child.y;
            left = x - child.getMarginLeft();
            right = x + width + child.getMarginRight();
            top = y - child.getMarginTop();
            bottom = y + height + child.getMarginBottom();
        } else {
            x = child.getX();
            y = child.getY();
            left = x;
            right = x + width;
            top = y;
            bottom = y + height;
        }

        return { left, top, right, bottom };
    }

    nextLocation() {
        const child = this.currentChild;
        const scale = child.getMeasuringScale();
        const topBaseHeight = child.getTopBaseHeight() * scale;
        const isBracket = this.container.type === 'BI';
        const realViewport = isBracket ? this.container.getRealParent().viewport : child.getRealParent().viewport;

        const maxHeight = child.getLayoutHeight() * scale + child.getMarginTop() + child.getMarginBottom();
        const maxWidth = child.getItemOverflowMode() === 'always' && TModelUtil.isWidthDefined(this.container)
            ? this.container.getWidth()
            : child.getBaseWidth() * scale + child.getMarginLeft() + child.getMarginRight();

        let ySouth = this.yNext + maxHeight;
        this.xNext += maxWidth;

        const isDomIsland = child.isDomIsland() && child.hasDom();
        const content = !isDomIsland && child.type !== 'BI' ? this.computeBoundary(child, 'content') : null;

        if (isDomIsland) {
            const absolute = this.computeBoundary(child, 'absolute');
            ySouth = absolute.bottom;
            this.xNext = absolute.right;
            this.xWest = absolute.left;
            this.yWest = absolute.top;
        }

        this.yNext += topBaseHeight;
        this.xSouth = this.xNext;
        this.yEast = this.yNext;

        if (content) {
            const viewport = isBracket ? realViewport : this;

            viewport.xWest = Math.min(viewport.xWest, content.left);
            viewport.yNorth = Math.min(viewport.yNorth, content.top);
            viewport.xEast = Math.max(viewport.xEast, content.right);
            viewport.ySouth = Math.max(viewport.ySouth, content.bottom);
        }

        this.xEast = Math.max(this.xEast, isBracket ? this.xNext : content && TModelUtil.isXDefined(child) ? content.right : this.xNext);
        this.ySouth = Math.max(this.ySouth, isBracket ? ySouth : content && TModelUtil.isYDefined(child) ? content.bottom : ySouth);

        if (!isBracket) {
            realViewport.xEast = Math.max(realViewport.xEast, this.xEast);
        }

        realViewport.ySouth = Math.max(realViewport.ySouth, this.ySouth);

        if (this.container.getContainerOverflowMode() === 'always' || child.getItemOverflowMode() === 'always') {
            this.yEast = realViewport.ySouth;
            this.yNext = realViewport.ySouth;

            this.xNext = realViewport.xWest;
            this.xSouth = realViewport.xWest;
        }
    }
}

export { Viewport };
