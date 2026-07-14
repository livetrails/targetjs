import { tRoot, getScreenHeight, getScreenWidth } from "./App.js";
import { TUtil } from "./TUtil.js";

/**
 * 
 * It provides a variety of helping functions for calculating visibility
 */
class VisibilityUtil {
    static calcVisibility(child) {
        const parent = child.getRealParent();
        const onVisibleChildrenChange = parent?.targets['onVisibleChildrenChange'] ?? false;

        if (!onVisibleChildrenChange && child.isVisible() && (child.isTargetUpdating(child.allTargetMap['x']) || child.isTargetUpdating(child.allTargetMap['y']))) {
            return true;
        }

        const domParent = child.getDomParent();
        const scale = (domParent.getMeasuringScale() || 1) * child.getMeasuringScale();

        const x = child.absX;
        const y = child.absY;
        const width = TUtil.isDefined(child.getWidth()) ? scale * child.getWidth() : 0;
        const height = TUtil.isDefined(child.getHeight()) ? scale * child.getHeight() : 0;
        const visibilityMargin = 20;

        const rect = {
            x: x - visibilityMargin,
            y: y - visibilityMargin,
            r: x + width + visibilityMargin,
            b: y + height + visibilityMargin
        };

        const status = VisibilityUtil.checkVisibility(child, rect);

        status.x = x;
        status.y = y;
        status.width = width;
        status.height = height;
        
        child.visibilityStatus = status;

        child.actualValues.isVisible = status.isVisible;
        return status.isVisible;
    }

    static checkVisibility(tmodel, rect) {

       while (tmodel) {
           const parent = tmodel.getRealParent();

           if (!parent || parent === tRoot()) {
               break;
           }

           if (VisibilityUtil.shouldClipByAncestor(parent)) {
               const clip = VisibilityUtil.getParentClip(parent);

               const isVisible = VisibilityUtil.rectsOverlap(rect, clip);

               if (!isVisible) {
                   return { clip, isVisible: false };
               }

               rect = VisibilityUtil.intersectRects(parent, rect, clip);
           }

           tmodel = parent;
       }
     
       const clip = VisibilityUtil.getScreenViewportRect();

       const isVisible = VisibilityUtil.rectsOverlap(rect, clip);
       
       if (!isVisible) {
           return { clip, isVisible: false };
       }

       return { isVisible: true };
   }
    
    static getScreenViewportRect() {
        return {
            x: 0,
            y: 0,
            r: getScreenWidth(),
            b: getScreenHeight(),
            source: "screen"
        };
    }
    
    static shouldClipByAncestor(ancestor) {
        const overflow = ancestor.val("overflow");

        return (
            ancestor.managesOwnScroll() ||
            overflow === "hidden" ||
            overflow === "auto" ||
            overflow === "scroll" ||
            overflow === "clip"
        );
    }

    static getParentClip(parent) {
        const domScrollLeft = parent.$dom?.getScrollLeft() || 0;
        const domScrollTop = parent.$dom?.getScrollTop() || 0;
        
        const height = parent.getHeight();
        const width = parent.getWidth();
        
        return {
            x: parent.absX + domScrollLeft,
            y: parent.absY + domScrollTop,
            r: parent.absX + width + domScrollLeft,
            b: parent.absY + height + domScrollTop,
            source: parent
        };
    }
    
    static rectsOverlap(a, b) {
        return (
            a.x <= b.r &&
            a.r >= b.x &&
            a.y <= b.b &&
            a.b >= b.y
        );
    }

    static intersectRects(parent, a, b) {
        const domScrollLeft = parent.$dom?.getScrollLeft() || 0;
        const domScrollTop = parent.$dom?.getScrollTop() || 0;
        
        return {
            x: Math.max(a.x - domScrollLeft, b.x - domScrollLeft),
            y: Math.max(a.y - domScrollTop, b.y - domScrollTop),
            r: Math.min(a.r - domScrollLeft, b.r - domScrollLeft),
            b: Math.min(a.b - domScrollTop, b.b - domScrollTop),
            source: b.source
        };
    }

}

export { VisibilityUtil };
