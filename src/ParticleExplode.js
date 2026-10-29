
import { TargetParser } from "./TargetParser.js";
import { TModel } from "./TModel.js";
import { TUtil } from "./TUtil.js";
import { getRunScheduler } from "./App.js";

class ParticleExplode {

    static createExplodeChildren(tmodel, key, definition = {}) {
        const needsDomImage = childDefinition => {
            if (childDefinition.image === false) {
                return false;
            }

            if (childDefinition.image === true) {
                return true;
            }

            const color = childDefinition.backgroundColor;

            // A fixed background color does not need a captured image.
            return !(typeof color === 'string' && color.trim() !== '');
        };
        
        const target = tmodel.targets[key] ?? {};
        const renderer = target.renderer ?? "gpu";

        if (renderer !== "gpu" && renderer !== "dom") {
            throw new Error(`Unsupported explodeChildren renderer: ${renderer}`);
        }

        const valueFactory = typeof target.value === "function" ? target.value : typeof definition === "function" ? definition : undefined;
        const sharedDefinition = valueFactory ? undefined : definition;

        const source = ParticleExplode.resolveSource(tmodel, target.source);
        const sourceElement = ParticleExplode.resolveDomElement(source);

        if (!sourceElement) {
            throw new Error("explodeChildren.source must resolve to a TModel, $Dom, or DOM element with an existing DOM.");
        }

        const { width: uiWidth, height: uiHeight } = ParticleExplode.getSourceDimensions(source, sourceElement);

        if (!Number.isFinite(uiWidth) || !Number.isFinite(uiHeight) || uiWidth <= 0 || uiHeight <= 0) {
            throw new RangeError("explodeChildren requires positive, resolved source dimensions.");
        }

        const resolveDimension = (name, value, index) => {
            const initial = typeof value === 'function' ? value.call(tmodel, index) : value;
            const number = Number(TargetParser.getInitialTargetValue(tmodel, name, initial));

            if (!Number.isFinite(number) || ((name === 'width' || name === 'height') && number <= 0)) {
                throw new RangeError(`explodeChildren fragment ${index} requires a valid ${name}.`);
            }

            return number;
        };

        const firstExplodeChild = renderer === "gpu" ? tmodel.childHandles.length : tmodel.getChildren().length;
        const requestedCount = TUtil.isDefined(target.instances) ? TargetParser.getTargetInstances(tmodel, key, target) : undefined;

        const state = {
            key,
            renderer,
            columns: undefined,
            rows: undefined,
            count: 0,
            width: uiWidth,
            height: uiHeight,
            particleWidth: undefined,
            particleHeight: undefined,
            firstExplodeChild,
            fragments: []
        };

        const planned = [];
        const maxFragments = 20000;
        const epsilon = 1e-7;
        let nextX = 0;
        let rowY = 0;
        let rowHeight = 0;

        while (requestedCount === undefined ? rowY < uiHeight - epsilon : planned.length < requestedCount) {
            const index = planned.length;

            if (index >= maxFragments) {
                throw new RangeError(`explodeChildren exceeded ${maxFragments} fragments. Specify instances or larger dimensions.`);
            }

            const raw = valueFactory ? valueFactory.call(tmodel, index) : sharedDefinition ?? {};

            if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                throw new TypeError(`explodeChildren.value(${index}) must return a child definition object.`);
            }

            const childDefinition = TUtil.cloneTargetDefinition({
                ...raw,
                width: raw.width ?? 20,
                height: raw.height ?? 20,
                isInFlow: raw.isInFlow ?? false
            });

            const requestedWidth = resolveDimension("width", childDefinition.width, index);
            const requestedHeight = resolveDimension("height", childDefinition.height, index);

            const layoutX = nextX;
            const layoutY = rowY;

            const x = TUtil.isDefined(childDefinition.x) ? resolveDimension("x", childDefinition.x, index) : layoutX;
            const y = TUtil.isDefined(childDefinition.y) ? resolveDimension("y", childDefinition.y, index) : layoutY;


            const layoutWidth = Math.min(requestedWidth, uiWidth - x);
            const layoutHeight = Math.min(requestedHeight, uiHeight - y);

            if (layoutWidth <= epsilon || layoutHeight <= epsilon) {
                if (requestedCount !== undefined) {
                    throw new RangeError(`explodeChildren cannot fit fragment ${index} within the source dimensions.`);
                }

                break;
            }

            if (x < 0 || x >= uiWidth || y < 0 || y >= uiHeight) {
                throw new RangeError(`explodeChildren fragment ${index} starts outside the source image (${x}, ${y}).`);
            }

            const width = Math.min(requestedWidth, uiWidth - x);
            const height = Math.min(requestedHeight, uiHeight - y);

            childDefinition.x = x;
            childDefinition.y = y;
            childDefinition.width = width;
            childDefinition.height = height;

            // Preserve both the image rectangle and the generated layout position.
            state.fragments.push({ index, x, y, width, height, layoutX, layoutY });
            planned.push(childDefinition);

            nextX += layoutWidth;
            rowHeight = Math.max(rowHeight, layoutHeight);

            if (nextX >= uiWidth - epsilon) {
                nextX = 0;
                rowY += rowHeight;
                rowHeight = 0;
            }
        }

        state.count = state.fragments.length;
        tmodel.explodeChildrenState = state;

        const needsCapture = planned.some(needsDomImage);
        const capturePromise = needsCapture ? tmodel.captureExplodeSource(uiWidth, uiHeight, source) : undefined;
        const domChildren = [];

        for (let index = 0; index < planned.length; index++) {
            const childDefinition = planned[index];
            const { x, y, layoutX, layoutY } = state.fragments[index];

            if (renderer === "gpu") {
                if (!tmodel.addGpuChild(childDefinition)) {
                    throw new Error(`Could not create GPU fragment ${index}.`);
                }

                const child = tmodel.childHandles[firstExplodeChild + index];

                child.layoutX = layoutX;
                child.layoutY = layoutY;

                child.targets.excludeXYCalc = true;
                child.setLayoutX(x);
                child.setLayoutY(y);

                continue;
            }

            const useImage = needsDomImage(childDefinition);

            if (useImage) {
                childDefinition.backgroundImage = {
                    enabledOn: false,
                    value() {
                        const color = this.val('backgroundColor');

                        return !TUtil.isDefined(color) || color === '' ? `url("${state.imageUrl}")`  : 'none';
                    }
                };

                childDefinition.backgroundSize = `${uiWidth}px ${uiHeight}px`;
                childDefinition.backgroundPosition = `-${x}px -${y}px`;
                childDefinition.backgroundRepeat = "no-repeat";
            }

            const previousCount = tmodel.addedChildren.length;
            tmodel.addChild(childDefinition);

            const child = tmodel.addedChildren[previousCount]?.child;

            if (!child) {
                throw new Error(`Could not create DOM fragment ${index}.`);
            }

            child.layoutX = layoutX;
            child.layoutY = layoutY;

            child.targets.excludeXYCalc = true;
            child.setLayoutX(x);
            child.setLayoutY(y);

            if (useImage) {
                domChildren.push(child);
            }
        }

        tmodel.explodeCapturePromise = capturePromise
            ? capturePromise.then(capture => ParticleExplode.applyExplodeCapture(tmodel, state, capture, domChildren))
                .catch(error => {
                    if (tmodel.explodeChildrenState === state) {
                        state.captureError = error;
                    }

                    console.error("Could not prepare explode image:", error);
                    return false;
                })
            : undefined;

        if (renderer === "gpu") {
            return tmodel.finalizeChildrenTarget(key);
        }
    }

    static async applyExplodeCapture(tmodel, state, capture, children) {
        if (tmodel.explodeChildrenState !== state) {
            return false;
        }

        if (state.renderer === "gpu") {
            return tmodel.particleRenderer.setExplodeSource(capture);
        }

        const imageUrl = capture.canvas.toDataURL("image/png");
        const image = new Image();

        image.src = imageUrl;
        await image.decode();

        if (tmodel.explodeChildrenState !== state) {
            return false;
        }

        state.imageUrl = imageUrl;
        tmodel.getChildren();

        for (const child of children) {
            if (tmodel.allChildrenMap[child.oid] !== child) {
                continue;
            }

            child.targets.backgroundImage.enabledOn = true;
            child.addToActiveTargets("backgroundImage");
        }

        tmodel.markLayoutDirty("domExplodeImagesReady");
        getRunScheduler().schedule(1, `dom-explode-${tmodel.oid}`);

        return true;
    }

    static resolveSource(tmodel, dom) {
        if (typeof dom === "function") {
            dom = dom.call(tmodel);
        }

        return dom ?? tmodel;
    }

    static resolveDomElement(source) {
        if (source instanceof Element) {
            return source;
        }

        if (source instanceof TModel) {
            return source.$dom?.element;
        }

        if (source?.element instanceof Element) {
            return source.element;
        }
    }

    static getSourceDimensions(source, element) {
        let width;
        let height;

        if (source instanceof TModel) {
            width = Number(source.getWidth());
            height = Number(source.getHeight());
        }

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            const rect = element.getBoundingClientRect();

            width = rect.width;
            height = rect.height;
        }

        return { width, height };
    }

    static getExplodeFragment(state, childIndex) {
        const index = childIndex - state.firstExplodeChild;

        if (index < 0 || index >= state.count) {
            return;
        }

        if (state.fragments) {
            return state.fragments[index];
        }

        // Support checkpoints created with the original uniform-grid format.
        const column = index % state.columns;
        const row = Math.floor(index / state.columns);
        const x = column * state.particleWidth;
        const y = row * state.particleHeight;

        return {
            index,
            x,
            y,
            width: Math.min(state.particleWidth, state.width - x),
            height: Math.min(state.particleHeight, state.height - y)
        };
    }
}

export { ParticleExplode };
