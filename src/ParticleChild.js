import { TModelUtil } from "./TModelUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { VisibilityUtil } from "./VisibilityUtil.js";

/**
 * It provides a lightweight logical child for the GPU implemenation.
 */
class ParticleChild {
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

        this.targets = {};
        this.targetValues = {};
        this.allTargetMap = {};

        this.actualValues = {
            isVisible: true
        };

        this.visibilityStatus = undefined;
        this.noDomUpdatingTargets = undefined;

        this.updatingTargetList = [];
        this.activeTargetList = [];
        this.activatedTargets = [];
        this.updatingTargetMap = {};

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

        this.pendingTargets = false;

        this.currentStatus = undefined;
        this.dirtyLayout = false;
    }

    state() {
        return this.runtimeState;
    }

    isTargetImperative(key) {
        return this.targetValues[key]?.isImperative === true;
    }

    isComplete() {
        return TargetUtil.isTModelComplete(this);
    }

    val(key, value) {
        const cleanKey = TargetUtil.getTargetName(key);

        if (arguments.length === 2) {
            this.parent.setChildValue(this.index, cleanKey, value);

            return this;
        }

        return this.actualValues[cleanKey];
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
        return this.index >= 0 && this.parent?.childHandles[this.index] === this;
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
    
    getChild() {
        return undefined;
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
        return this.actualValues.x ?? this.x;
    }

    getY() {
        return this.actualValues.y ?? this.y;
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
        return true;
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
        return this.val("html");
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

        const scale = (parent.getMeasuringScale() || 1) * this.getMeasuringScale();
        const x = this.absX;
        const y = this.absY;
        const width = scale * this.getWidth();
        const height = scale * this.getHeight();
        const margin = 20;

        const status = VisibilityUtil.checkVisibility(this, {
            x: x - margin,
            y: y - margin,
            r: x + width + margin,
            b: y + height + margin
        });


        this.actualValues.isVisible = status.isVisible;

        return status.isVisible;
    }
    
    addToNoDomUpdatingTargets(key) {
        const cleanKey = TargetUtil.getTargetName(key);
        const noDomTargets = this.noDomUpdatingTargets ||= new Set();

        if (noDomTargets.has(cleanKey)) {
            return false;
        }

        noDomTargets.add(cleanKey);

        this.parent?.addToUpdatingChildren(this);

        return true;
    }
    
    removeFromNoDomUpdatingTargets(key) {
        if (!this.noDomUpdatingTargets) {
            return false;
        }

        const removed = this.noDomUpdatingTargets.delete(
            TargetUtil.getTargetName(key)
        );

        if (!this.noDomUpdatingTargets.size) {
            this.noDomUpdatingTargets = undefined;
            this.parent?.removeFromUpdatingChildren(this);
        }

        return removed;
    }

    catchupNoDomLayoutTargets() {
        return this.parent?.catchupChildLayoutTargets(this);
    }

    validateVisibilityInParent() {
        return true;
    }

    setLayoutX(value) {
        if (this.x === value) {
            return;
        }

        this.x = value;
        this.parent.particleValuesDirty = true;
    }

    setLayoutY(value) {
        if (this.y === value) {
            return;
        }

        this.y = value;
        this.parent.particleValuesDirty = true;
    }

    setTarget(key, value, steps, interval, easing) {
        const originalTargetName = TargetUtil.currentTargetName;
        const originalTModel = TargetUtil.currentTModel;

        if (this.parent === originalTModel && originalTargetName) {
            TargetUtil.markChildAction(originalTModel, originalTargetName, this);
        }

        if (key && typeof key === "object" && !Array.isArray(key)) {
            const targets = key;
            const targetSteps = value;
            const targetInterval = steps;
            const targetEasing = interval;

            for (const [targetKey, targetValue] of Object.entries(targets)) {
                const cleanKey = TargetUtil.getTargetName(targetKey);

                this.allTargetMap[cleanKey] = targetKey;
                this.parent.setChildTarget(this.index, targetKey, targetValue, targetSteps, targetInterval, targetEasing);
            }

            return this;
        }

        const cleanKey = TargetUtil.getTargetName(key);

        this.allTargetMap[cleanKey] = key;
        this.parent.setChildTarget(this.index, key, value, steps, interval, easing);

        return this;
    }
    
    activateTarget(key) {
        this.parent.activateGpuChildTarget(this.index, key);

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
    
    addToUpdatingTargets(key) {
        if (this.updatingTargetMap[key]) {
            return;
        }

        this.updatingTargetMap[key] = true;
        this.updatingTargetList.push(key);
        this.parent?.addToUpdatingChildren(this);
    }

    removeFromUpdatingTargets(key) {
        if (!this.updatingTargetMap[key]) {
            return;
        }

        delete this.updatingTargetMap[key];

        const index = this.updatingTargetList.indexOf(key);

        if (index >= 0) {
            this.updatingTargetList.splice(index, 1);
        }

        if (!this.updatingTargetList.length) {
            this.parent?.removeFromUpdatingChildren(this);
        }
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

export { ParticleChild };