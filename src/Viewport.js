
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
    
    setCurrentChild(child) {
        this.currentChild = child;
    }

    setLocation() {
        if (!this.currentChild.targets['excludeXYCalc']) {
            this.currentChild.x = this.xNext + this.currentChild.getLeftMargin();
            this.currentChild.y = this.yNext + this.currentChild.getTopMargin();
        }
    }
    
    isOverflow() {
        const childWidth = this.currentChild.getMinWidth();
        return this.absX + this.currentChild.x + childWidth + this.currentChild.getLeftMargin() > this.xOverflowLimit;
    }

    overflow() {
        this.xNext = this.scrollLeft - this.absX + this.xOverflowReset;
        this.yNext = this.ySouth;
    }
    
    appendNewLine() {
        const height = this.currentChild.getHeight() * this.currentChild.getMeasuringScale();

        this.xNext = this.scrollLeft - this.absX + this.xOverflowReset;
        this.yNext = this.ySouth > this.yNext ? this.ySouth + this.currentChild.val('appendNewLine') : this.ySouth + height + this.currentChild.val('appendNewLine');

        this.yEast = this.yNext;
        this.xSouth = this.xNext;

        this.ySouth = Math.max(this.yNext, this.ySouth);
    }
    
    
    computeBoundary(child, space) {
        const scale = child.getMeasuringScale();
        const width  = child.getBaseWidth() * scale;
        const height = child.getBaseHeight() * scale;
        
        let x, y, left, right, top, bottom;
        
        if (space === 'layout') {
            x = child.x;
            y = child.y;
            left = x - child.getLeftMargin();
            right = x + width + child.getRightMargin();
            top = y - child.getTopMargin();
            bottom = y + height + child.getBottomMargin();
        } else if (space === 'absolute') {
            x = child.absX - this.absX;
            y = child.absY - this.absY;
            left = x;
            right = x + width + child.getRightMargin();
            top = y;
            bottom = y + height + child.getBottomMargin();
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
               
        let maxHeight = child.getBaseHeight() * scale + this.currentChild.getTopMargin() + this.currentChild.getBottomMargin();
        let maxWidth = child.getBaseWidth() * scale +  this.currentChild.getLeftMargin() + this.currentChild.getRightMargin();
        
        if (child.type !== 'BI') {
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
            this.xWest = absolute.x;
            this.yWest = absolute.y;
        }
    
        this.yNext += topBaseHeight;
        this.xSouth = this.xNext;
        this.yEast = this.yNext;

        this.xEast = Math.max(this.xNext, this.xEast);
        this.ySouth = Math.max(ySouth, this.ySouth) ;

        child.getRealParent().viewport.xEast = Math.max(child.getRealParent().viewport.xEast, this.xEast);
        child.getRealParent().viewport.ySouth = Math.max(child.getRealParent().viewport.ySouth, this.ySouth);
        
        if (child.type === 'BI') {
            //console.log("child: " + child.oid + ', ' + child.getChildrenOids() + ', ' + maxWidth + ', ' + maxHeight + ' => ' + this.xNext + ', ' + this.yNext);
        }

        if (child.type === 'BI' && !child.isVisible() && !child.getRealParent().managesOwnScroll()) {
            child.getRealParent().viewport.xEast = child.viewport.xEast;
            child.getRealParent().viewport.ySouth = child.viewport.ySouth;
        }
    }
}

export { Viewport };
