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
            child.x = this.xNext + child.getMarginLeft() + this.container.getPaddingLeft();
            child.y = this.yNext + child.getMarginTop() + this.container.getPaddingTop();
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
        const width  = child.getBaseWidth() * scale;
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
               
        let maxHeight = child.getLayoutHeight() * scale + this.currentChild.getMarginTop() + this.currentChild.getMarginBottom();
        let maxWidth = child.getItemOverflowMode() === 'always' && TModelUtil.isWidthDefined(this.container) ? this.container.getWidth() : child.getBaseWidth() * scale +  this.currentChild.getMarginLeft() + this.currentChild.getMarginRight();
        
        if (child.type !== 'BI' && this.container.type === 'BI') {
            const layout = this.computeBoundary(child, 'layout');
            const animated = this.computeBoundary(child, 'animated');  
            maxHeight = Math.max(maxHeight, layout.bottom - animated.top, animated.bottom - layout.top, layout.bottom - layout.top, animated.bottom - animated.top);
            maxWidth = Math.max(maxWidth, layout.right - animated.left, animated.right - layout.left, layout.right - layout.left, animated.right - animated.left);
        }
                
        let ySouth = this.yNext + maxHeight;
        this.xNext += maxWidth; 
                
        if (child.isDomIsland() && child.hasDom()) {
            const absolute = this.computeBoundary(child, 'absolute');
            ySouth = absolute.bottom;
            this.xNext = absolute.right;
            this.xWest = absolute.left;
            this.yWest = absolute.top;
        }
    
        this.yNext += topBaseHeight;
        this.xSouth = this.xNext;
        this.yEast = this.yNext;
        
        this.xEast = Math.max(this.xNext, this.xEast);
        this.ySouth = Math.max(ySouth, this.ySouth) ;
             
        child.getRealParent().viewport.xEast = Math.max(child.getRealParent().viewport.xEast, this.xEast);
        child.getRealParent().viewport.ySouth = Math.max(child.getRealParent().viewport.ySouth, this.ySouth);
        
        if (this.container.getContainerOverflowMode() === 'always' || this.currentChild.getItemOverflowMode() === 'always') {
            this.yEast = child.getRealParent().viewport.ySouth;
            this.yNext = child.getRealParent().viewport.ySouth;

            this.xNext = child.getRealParent().viewport.xWest;
            this.xSouth = child.getRealParent().viewport.xWest;
        }           
    }
}

export { Viewport };
