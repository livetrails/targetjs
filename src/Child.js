import { TModelUtil } from "./TModelUtil.js";

/**
 * It provides a lightweight logical child that can be rendered by different backends.
 *
 * A Child participates in layout, visibility and the public child API, but does not
 * have its own TargetJS runtime, scheduler, DOM, animations or child hierarchy.
 */
class Child {
    constructor(parent, index) {
        this.parent = parent;
        this.index = index;

        this.isLightweightChild = true;

        this.type = `${parent.type}_`;
        this.oid = `${parent.oid}_gpu_${index}`;

        this.x = 0;
        this.y = 0;
        this.absX = 0;
        this.absY = 0;

        const values = parent.particleValues[index] ?? {};

        this.explicitX = Object.prototype.hasOwnProperty.call(values, "x");
        this.explicitY = Object.prototype.hasOwnProperty.call(values, "y");

        this.targets = {};
        this.targetValues = {};
        this.allTargetMap = {};

        for (const key of Object.keys(values)) {
            this.allTargetMap[key] = true;
        }

        this.actualValues = {
            ...values,
            isVisible: true
        };

        this.visibilityStatus = undefined;

        this.updatingTargetList = [];
        this.activeTargetList = [];
        this.activatedTargets = [];

        this.runtimeState = {
            updatingTargetList: this.updatingTargetList,
            activeTargetList: this.activeTargetList,
            activatedTargets: this.activatedTargets,
            fetchActionTargetList: [],
            lastChildrenUpdate: {
                additions: [],
                deletions: []
            }
        };

        this.noDomUpdatingTargets = false;
        this.pendingTargets = false;

        this.currentStatus = undefined;
        this.dirtyLayout = false;
    }

    state() {
        return this.runtimeState;
    }

    isTargetImperative() {
        return false;
    }

    val(key, value) {
        if (arguments.length === 2) {
            this.allTargetMap[key] = true;
            this.actualValues[key] = value;

            if (key === "x") {
                this.explicitX = true;
            } else if (key === "y") {
                this.explicitY = true;
            }

            this.parent.setChildValue(this.index, key, value);

            return this;
        }

        return this.parent.getChildValue(this.index, key);
    }

    getParent() {
        return this.parent;
    }

    getRealParent() {
        return this.parent;
    }

    getParentValue(key) {
        return this.parent?.val(key);
    }

    pval(key) {
        return this.getParentValue(key);
    }

    exists() {
        return this.parent?.getChild(this.index) === this;
    }

    isComplete() {
        return true;
    }

    hasAnimatingTargets() {
        return false;
    }

    hasAnimatingChildren() {
        return false;
    }

    hasUpdatingChildren() {
        return false;
    }

    hasActiveChildren() {
        return false;
    }

    getChildren() {
        return [];
    }

    hasChildren() {
        return false;
    }

    clearUpdatingChildren() {
        this.updatingTargetList.length = 0;
    }

    clearActiveChildren() {
        this.activeTargetList.length = 0;
    }

    clearAnimatingChildren() {}

    cancelAnimation() {}

    hasEventDirty() {
        return false;
    }

    markEventDirty() {}

    markLayoutDirty(key) {
        this.parent?.markLayoutDirty?.(`gpuChild-${this.index}-${key}`);
    }

    removeLayoutDirty() {}

    getDirtyLayout() {
        return false;
    }

    getX() {
        return this.explicitX ? this.val("x") : this.x;
    }

    getY() {
        return this.explicitY ? this.val("y") : this.y;
    }

    getWidth() {
        return this.val("width") ?? 0;
    }

    getHeight() {
        return this.val("height") ?? 0;
    }

    getBaseWidth() {
        return this.getWidth();
    }

    getBaseHeight() {
        return this.getHeight();
    }

    getMinWidth() {
        return this.getWidth();
    }

    getTopBaseHeight() {
        return 0;
    }

    getMeasuringScale() {
        return this.val("measuringScale") ?? 1;
    }

    getMarginTop() {
        return this.val("marginTop") ?? this.val("topMargin") ?? 0;
    }

    getMarginLeft() {
        return this.val("marginLeft") ?? this.val("leftMargin") ?? 0;
    }

    getMarginRight() {
        const margin = this.val("marginRight") ?? this.val("rightMargin") ?? 0;

        return margin + (this.getParentValue("gap") ?? 0);
    }

    getMarginBottom() {
        const margin = this.val("marginBottom") ?? this.val("bottomMargin") ?? 0;

        return margin + (this.getParentValue("gap") ?? 0);
    }

    getTopMargin() {
        return this.getMarginTop();
    }

    getLeftMargin() {
        return this.getMarginLeft();
    }

    getRightMargin() {
        return this.getMarginRight();
    }

    getBottomMargin() {
        return this.getMarginBottom();
    }

    getItemOverflowMode() {
        return this.val("itemOverflowMode") ?? "auto";
    }

    isInFlow() {
        return this.val("isInFlow") ?? true;
    }

    isIncluded() {
        return true;
    }

    useContentWidth() {
        return false;
    }

    useContentHeight() {
        return false;
    }

    getContentWidth() {
        return 0;
    }

    getContentHeight() {
        return 0;
    }

    hasDom() {
        return false;
    }

    isDomIsland() {
        return false;
    }

    reuseDomDefinition() {
        return false;
    }

    requiresDom() {
        return false;
    }

    requiresDomRelocation() {
        return false;
    }

    hasDomHolderChanged() {
        return false;
    }

    hasBaseElementChanged() {
        return false;
    }

    getHtml() {
        return undefined;
    }

    excludeDefaultStyling() {
        return true;
    }

    excludeStyling() {
        return true;
    }

    addToStyleTargetList() {}

    calcAbsolutePosition(x, y) {
        this.absX = (this.parent?.absX ?? 0) + x;
        this.absY = (this.parent?.absY ?? 0) + y;
    }

    isVisible() {
        return this.actualValues.isVisible !== false;
    }

    calcVisibility() {
        const parent = this.parent;

        if (!parent) {
            return false;
        }

        const x = this.getX() ?? 0;
        const y = this.getY() ?? 0;
        const width = this.getWidth();
        const height = this.getHeight();
        const parentWidth = parent.getWidth();
        const parentHeight = parent.getHeight();

        return x + width >= 0 && y + height >= 0 && x <= parentWidth && y <= parentHeight;
    }

    validateVisibilityInParent() {
        return true;
    }

    addToParentVisibleChildren() {
        if (this.isVisible() && this.isInFlow() && this.parent) {
            this.parent.visibleChildren.push(this);
        }
    }

    setLayoutX(value) {
        this.x = value;
        this.actualValues.x = value;

        if (!this.explicitX) {
            this.parent.setChildLayoutValue(this.index, "x", value);
        }
    }

    setLayoutY(value) {
        this.y = value;
        this.actualValues.y = value;

        if (!this.explicitY) {
            this.parent.setChildLayoutValue(this.index, "y", value);
        }
    }
    
    setTarget(key, value) {
        this.allTargetMap[key] = true;

        if (key === "x") {
            this.explicitX = true;
        } else if (key === "y") {
            this.explicitY = true;
        }

        this.parent.setChildTarget(this.index, key, value);

        return this;
    }
    
    getLayoutHeight() {
        let height = this.getHeight();

        if (this.usesContentBoxSizing()) {
            height += this.getPaddingTop() + this.getPaddingBottom();
        }

        return height;
    }

    getLayoutWidth() {
        let width = this.getWidth();

        if (this.usesContentBoxSizing()) {
            width += this.getPaddingLeft() + this.getPaddingRight();
        }

        return width;
    }

    usesContentBoxSizing() {
        return this.getBoxSizing() !== "border-box";
    }

    getBoxSizing() {
        return this.val("boxSizing") ?? this.val("box-sizing") ?? this.getParentValue("boxSizing") ?? "content-box";
    }

    getPaddingTop() {
        return this.val("paddingTop") ?? this.val("topPadding") ?? TModelUtil.getPaddingValue(this, "top");
    }

    getPaddingLeft() {
        return this.val("paddingLeft") ?? this.val("leftPadding") ?? TModelUtil.getPaddingValue(this, "left");
    }

    getPaddingRight() {
        return this.val("paddingRight") ?? this.val("rightPadding") ?? TModelUtil.getPaddingValue(this, "right");
    }

    getPaddingBottom() {
        return this.val("paddingBottom") ?? this.val("bottomPadding") ?? TModelUtil.getPaddingValue(this, "bottom");
    }    
}

export { Child };