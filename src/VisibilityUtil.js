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

        if (!child.visibilityStatus) {
            child.visibilityStatus = {};
        }

        const status = child.visibilityStatus;
        const clip = VisibilityUtil.getVisibilityClipRect(child.getParent());
        
        if (clip) {
            status.right = (x - visibilityMargin) <= clip.r;
            status.left = (x + width + visibilityMargin) >= clip.x;
            status.bottom = (y - child.getTopMargin() - visibilityMargin) <= clip.b;
            status.top = (y + height + visibilityMargin) >= clip.y;

            status.clipX = clip.x;
            status.clipY = clip.y;
            status.clipR = clip.r;
            status.clipB = clip.b;
            status.parent = clip.source;

            status.isVisible = status.left && status.right && status.top && status.bottom;
        } else {
            status.right = true;
            status.left = true;
            status.bottom = true;
            status.top = true;

            status.clipX = undefined;
            status.clipY = undefined;
            status.clipR = undefined;
            status.clipB = undefined;
            status.parent = "none";
            status.isVisible = true;
        }

        status.x = x;
        status.y = y;
        status.width = width;
        status.height = height;

        child.actualValues.isVisible = status.isVisible;
        return status.isVisible;
    }

    static getVisibilityClipRect(container) {
        let rect = VisibilityUtil.getScreenViewportRect();

        while (container && container !== tRoot()) {
            if (VisibilityUtil.shouldClipByAncestor(container)) {
                const ancestorRect = VisibilityUtil.getAncestorViewportRect(container);
                rect = rect && !container.allTargetMap['onWindowScroll'] ? VisibilityUtil.intersectVisibilityRects(rect, ancestorRect) : ancestorRect;

                if (rect.r <= rect.x || rect.b <= rect.y) {
                    break;
                }
            }

            container = container.getRealParent();
        }

        return rect;
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
        return ancestor.managesOwnScroll();
    }

    static getAncestorViewportRect(ancestor) {
        const domScrollLeft = ancestor.$dom?.getScrollLeft() || 0;
        const domScrollTop = ancestor.$dom?.getScrollTop() || 0;

        return {
            x: ancestor.absX + domScrollLeft,
            y: ancestor.absY + domScrollTop,
            r: ancestor.absX + domScrollLeft + ancestor.getWidth(),
            b: ancestor.absY + domScrollTop + ancestor.getHeight(),
            source: ancestor
        };
    }

    static intersectVisibilityRects(a, b) {
        return {
            x: Math.max(a.x, b.x),
            y: Math.max(a.y, b.y),
            r: Math.min(a.r, b.r),
            b: Math.min(a.b, b.b),
            source: b.source
        };
    }

}

export { VisibilityUtil };
