
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
        this.xOverflowReset = 0;
        this.xOverflowLimit = 0;

        this.yNext = 0;
        this.yNorth = 0;
        this.yWest = 0;
        this.yEast = 0;
        this.ySouth = 0;
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

        this.currentChild.getRealParent().viewport.xEast = Math.max(this.currentChild.getRealParent().viewport.xEast, this.xEast);
        this.currentChild.getRealParent().viewport.ySouth = Math.max(this.currentChild.getRealParent().viewport.ySouth, this.ySouth);
    }

    nextLocation() {   
        const height = this.currentChild.getBaseHeight() * this.currentChild.getMeasuringScale();
        
        const baseWidth = this.currentChild.getBaseWidth() * this.currentChild.getMeasuringScale();
        const topBaseHeight = this.currentChild.getTopBaseHeight() * this.currentChild.getMeasuringScale();

        const ySouth = this.yNext + height + this.currentChild.getTopMargin() + this.currentChild.getBottomMargin();      
        this.xNext += baseWidth + this.currentChild.getLeftMargin() + this.currentChild.getRightMargin();
        this.yNext += topBaseHeight;

        this.xSouth = this.xNext;
        this.yEast = this.yNext;

        this.xEast = Math.max(this.xNext, this.xEast);
        this.ySouth = Math.max(ySouth, this.ySouth);
        
        this.currentChild.getRealParent().viewport.xEast = Math.max(this.currentChild.getRealParent().viewport.xEast, this.xEast);
        this.currentChild.getRealParent().viewport.ySouth = Math.max(this.currentChild.getRealParent().viewport.ySouth, this.ySouth);
    }
}

export { Viewport };
