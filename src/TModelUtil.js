// TModelUtil.js
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { getRunScheduler, getManager } from "./App.js";
import { $Dom } from "./$Dom.js";
import { ColorUtil } from "./ColorUtil.js";
import { Easing } from "./Easing.js";

/**
 * It provides helper functions for TModel.
 */
class TModelUtil {
    
    static async restoreScroll(page) {
        const left = page.scrollLeft || 0;
        const top = page.scrollTop || 0;

        window.scrollTo(left, top);

        if (left === 0 && top === 0) {
            return;
        }

        await new Promise(requestAnimationFrame);
        window.scrollTo(left, top);

        await new Promise(requestAnimationFrame);
        window.scrollTo(left, top);
    }
    
    static getRootDom() {
        return $Dom.query("#tgjs-root") ? new $Dom("#tgjs-root") : new $Dom("body");
    }
    
    static getPageDom() {
        return new $Dom("body");
    } 

    static captureDomState($root) {
        const root = $root?.getElement();

        if (!root) {
            return undefined;
        }

        const controls = [];
        const scrollPositions = [];
        const doc = root.ownerDocument;
        const focusedElement = doc.activeElement;
        const activeElement = focusedElement === doc.body || focusedElement === doc.documentElement ? null : focusedElement;
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        let element = root;
        let index = 0;
        let controlIndex = 0;
        let activeIndex = -1;

        while (element) {
            const kind = element.localName;

            if (element === activeElement) {
                activeIndex = index;
            }

            switch (kind) {
                case "input": {
                    const currentControlIndex = controlIndex++;

                    if (element.type !== "file") {
                        controls.push({
                            index,
                            controlIndex: currentControlIndex,
                            kind,
                            value: element.value,
                            checked: element.checked,
                            indeterminate: element.indeterminate
                        });
                    }
                    break;
                }
                case "textarea":
                    controls.push({ index, controlIndex: controlIndex++, kind, value: element.value });
                    break;
                case "select": {
                    const options = element.options;
                    const selected = new Array(options.length);

                    for (let i = 0; i < options.length; i++) {
                        selected[i] = options[i].selected;
                    }

                    controls.push({ index, controlIndex: controlIndex++, kind, selected });
                    break;
                }
                case "details":
                    controls.push({ index, controlIndex: controlIndex++, kind, open: element.open });
                    break;
            }

            const scrollLeft = element.scrollLeft;
            const scrollTop = element.scrollTop;

            if (scrollLeft || scrollTop) {
                scrollPositions.push({ index, scrollLeft, scrollTop });
            }

            element = walker.nextNode();
            index++;
        }

        let selection;

        if (activeIndex >= 0 && typeof activeElement.selectionStart === "number") {
            selection = {
                start: activeElement.selectionStart,
                end: activeElement.selectionEnd,
                direction: activeElement.selectionDirection
            };
        }

        return { controls, scrollPositions, activeIndex, selection };
    }

    static restoreMountedDom($root, domState) {
        const root = $root?.getElement();
        const states = domState?.controls;

        if (!root || !states?.length) {
            return;
        }

        const selector = "input,textarea,select,details";
        const offset = root.matches(selector) ? 1 : 0;
        const elements = root.querySelectorAll(selector);

        for (const state of states) {
            const element = offset && state.controlIndex === 0
                ? root
                : elements[state.controlIndex - offset];

            if (!element || element.localName !== state.kind) {
                continue;
            }

            switch (state.kind) {
                case "input":
                    if (element.value !== state.value) {
                        element.value = state.value;
                    }
                    if (element.checked !== state.checked) {
                        element.checked = state.checked;
                    }
                    if (element.indeterminate !== state.indeterminate) {
                        element.indeterminate = state.indeterminate;
                    }
                    break;
                case "textarea":
                    if (element.value !== state.value) {
                        element.value = state.value;
                    }
                    break;
                case "select": {
                    const options = element.options;
                    const selected = state.selected || [];

                    for (let i = 0; i < options.length; i++) {
                        const value = selected[i] === true;

                        if (options[i].selected !== value) {
                            options[i].selected = value;
                        }
                    }
                    break;
                }
                case "details":
                    if (element.open !== state.open) {
                        element.open = state.open;
                    }
                    break;
            }
        }
    }

    static async restoreDomInteractionState($root, domState, { focus = "editable" } = {}) {
        
        const root = $root?.getElement();

        if (!root || !domState) {
            return;
        }

        const scrollPositions = domState.scrollPositions || [];
        let activeIndex = domState.activeIndex ?? -1;

        if (root === root.ownerDocument.body && activeIndex === 0) {
            activeIndex = -1;
        }

        if (!scrollPositions.length && activeIndex < 0) {
            return;
        }

        // Wait only when restoring nonzero scroll positions.
        //if (scrollPositions.length) {
        //    await new Promise(requestAnimationFrame);
        //}

        const lastScrollIndex = scrollPositions.length ? scrollPositions[scrollPositions.length - 1].index : -1;
        const lastIndex = Math.max(activeIndex, lastScrollIndex);
        const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        let element = root;
        let activeElement;
        let scrollIndex = 0;

        for (let index = 0; element && index <= lastIndex; index++, element = walker.nextNode()) {
            if (index === activeIndex) {
                activeElement = element;
            }

            if (scrollIndex < scrollPositions.length && scrollPositions[scrollIndex].index === index) {
                const state = scrollPositions[scrollIndex++];

                const left = element.scrollLeft;
                const top = element.scrollTop;

                if (left !== state.scrollLeft) {
                    element.scrollLeft = state.scrollLeft;
                }

                if (top !== state.scrollTop) {
                    element.scrollTop = state.scrollTop;
                }
            }
        }
        
        if (!activeElement || focus === "none") {
            return;
        }

        if (focus === "editable") {
            const tag = activeElement.localName;

            const editable = tag === "textarea" || tag === "select" || (tag === "input" && activeElement.type !== "hidden") 
                    || activeElement.isContentEditable;

            if (!editable) {
                return;
            }
        }

        try {
            activeElement.focus({ preventScroll: true });
        } catch {
            activeElement.focus?.();
        }

        if (domState.selection && typeof activeElement.setSelectionRange === "function") {
            try {
                activeElement.setSelectionRange(domState.selection.start, domState.selection.end, domState.selection.direction);
            } 
            catch {}
        }

    }

    static getMarginValue(tmodel, side) {
        const margin = tmodel.val("margin");

        if (typeof margin === "number") {
            return margin;
        }

        if (Array.isArray(margin)) {
            if (margin.length === 2) {
                const [vertical, horizontal] = margin;
                return side === "top" || side === "bottom" ? vertical : horizontal;
            }

            if (margin.length === 4) {
                const [top, right, bottom, left] = margin;

                if (side === "top") { return top; }
                if (side === "right") { return right; }
                if (side === "bottom") { return bottom; }
                if (side === "left") { return left; }
            }
        }

        return 0;
    }

    static getPaddingValue(tmodel, side) {
        const padding = tmodel.val("padding");

        if (typeof padding === "number") {
            return padding;
        }

        if (Array.isArray(padding)) {
            if (padding.length === 2) {
                const [vertical, horizontal] = padding;
                return side === "top" || side === "bottom" ? vertical : horizontal;
            }

            if (padding.length === 4) {
                const [top, right, bottom, left] = padding;

                if (side === "top") { return top; }
                if (side === "right") { return right; }
                if (side === "bottom") { return bottom; }
                if (side === "left") { return left; }
            }
        }

        return 0;
    }

    static shouldMeasureHeightFromDom(tmodel) {
        if (tmodel.val('heightFromDom') === false) {
            return false;
        }

        return (!tmodel.excludeDefaultStyling()
                && !TUtil.isDefined(tmodel.targetValues.height)
                && !tmodel.val('heightFromDom')
                && !TModelUtil.isHeightDefined(tmodel)
                && !tmodel.hasChildren())
                || tmodel.val('heightFromDom');
    }

    static shouldMeasureWidthFromDom(tmodel) {
        if (tmodel.val('widthFromDom') === false) {
            return false;
        }

        return (!tmodel.excludeDefaultStyling()
                && !tmodel.reuseDomDefinition()
                && !tmodel.val('widthFromDom')
                && !TUtil.isDefined(tmodel.targetValues.width)
                && !TModelUtil.isWidthDefined(tmodel)
                && !tmodel.hasChildren())
                || tmodel.val('widthFromDom');
    }

    static isHeightDefined(tmodel) {
        return tmodel.isTargetImperative('height')
                || !!tmodel.allTargetMap['height']
                || !!tmodel.allTargetMap['dim']
                || TUtil.isDefined(tmodel.targets.style?.height);
    }

    static isWidthDefined(tmodel) {
        return tmodel.isTargetImperative('width')
                || !!tmodel.allTargetMap['width']
                || !!tmodel.allTargetMap['dim']
                || TUtil.isDefined(tmodel.targets.style?.width);
    }

    static isXDefined(tmodel) {
        return !!tmodel.allTargetMap['x'] || !!tmodel.targetValues['x'];
    }

    static isYDefined(tmodel) {
        return !!tmodel.allTargetMap['y'] || !!tmodel.targetValues['y'];
    }

    static useContentWidth(tmodel) {
        return !TModelUtil.isWidthDefined(tmodel) && !tmodel.val('widthFromDom') && tmodel.getContentWidth() > 0;
    }

    static useContentHeight(tmodel) {
        return !TModelUtil.isHeightDefined(tmodel) && !tmodel.val('heightFromDom') && tmodel.getContentHeight() > 0;
    }

    static createDom(tmodel) {
        tmodel.$dom = new $Dom();
        tmodel.$dom.create(tmodel.getBaseElement());
    }

    static patchDom(tmodel) {
        tmodel.$dom.ensureId(tmodel.oid);
        tmodel.$dom.attr('tgjs', 'true');
        if (tmodel.getHtml()) {
            tmodel.isTextOnly() ? tmodel.$dom.text(tmodel.getHtml()) : tmodel.$dom.html(tmodel.getHtml());
        }
        tmodel.setLastUpdate('html');
    }   
    
    static initStyleMaps(tmodel) {
        tmodel.domHeightTimestamp = 0;
        tmodel.domWidthTimestamp = 0;
        tmodel.tfMap = {};
        tmodel.styleMap = {};

        for (const [key] of tmodel.allStyleTargetMap ?? []) {
            if (TUtil.isDefined(tmodel.val(key))) {
                tmodel.addToStyleTargetList(key);
            }
        }
    }
        
    static getTransformValue(tmodel, key) {
        let value;
        if (key === 'x') {
            value = Math.floor(tmodel.getX());
        } else if (key === 'y') {
            value = Math.floor(tmodel.getY());
        } else if (TargetData.transformMap[key]) {
            value = TargetData.rotate3D[key]
                    ? tmodel.val(key)
                    : TargetData.scaleMap[key]
                    ? TUtil.formatNum(tmodel.val(key), 2)
                    : tmodel.floorVal(key);
        }
        return value;
    }

    static fixStyle(tmodel, { keys, frame } = {}) {
        const commit = keys !== undefined || frame !== undefined;
        
        if (!tmodel.$dom?.element) {
            return;
        }
                
        let styleValues;

        if (frame) {
            styleValues = new Map([ ...Object.entries(frame.styleMap ?? {}), ...Object.entries(frame.tfMap ?? {}) ]);
        } else {
            const styleKeys = keys ? [...keys].map(key => TargetUtil.getTargetName(key)) : [...(tmodel.styleTargetMap?.keys() ?? [])];
            styleValues = new Map(styleKeys.map(key => [key, tmodel.val(key)]));
        }

        if (!styleValues.size) {
            return;
        }

        let transformUpdate = false;

        for (const [key, value] of styleValues) {

            if (!commit && tmodel.isKeyAnimating(key)) {
                continue;
            }

            if (!TUtil.isDefined(value)) {
                continue;
            }
            
            if (TargetData.transformMap[key]) {
                const transformValue = frame ? value : TModelUtil.getTransformValue(tmodel, key);

                if (TUtil.isDefined(transformValue) && (commit || tmodel.tfMap[key] !== transformValue)) {
                    tmodel.tfMap[key] = transformValue;
                    transformUpdate = true;
                }
            } else if (key === 'dim') {
                TModelUtil.applyDimensionStyle(tmodel, 'width', value);
                TModelUtil.applyDimensionStyle(tmodel, 'height', value);
            } else if (key === 'width' || key === 'height') {
                TModelUtil.applyDimensionStyle(tmodel, key, value);
            } else if (commit || tmodel.styleMap[key] !== value) {
                const cssValue = typeof value === 'number' && TargetData.styleWithUnitMap[key] ? `${value}px` : `${value}`;

                tmodel.$dom.style(key, cssValue);
                tmodel.styleMap[key] = value;               
            }
        }

        if (transformUpdate) {
            tmodel.$dom.transform(TModelUtil.getTransformString(tmodel, tmodel.tfMap));
        }
        
        if (!commit) {
            tmodel.styleTargetMap.clear();
        }
    }

    static applyDimensionStyle(tmodel, key, value) {
        if (!TUtil.isDefined(value)) {
            return;
        }

        const cssValue = typeof value === 'number' ? `${Math.floor(value)}px` : value;

        if (tmodel.styleMap[key] !== value || tmodel.$dom.style(key) !== cssValue) {
            tmodel.styleMap[key] = value;
            tmodel.$dom.style(key, cssValue);
            
            if (tmodel.isDomIsland()) {
                tmodel.originWindowEpoch = -1;
                getRunScheduler().schedule(1, 'domIslandDimensionStyle');
            }            
        }
    }
    
    static resolveDimension(value, parentSize) {
        if (typeof value !== 'string') {
            return value;
        }

        const str = value.trim();
        const single = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|%)$/i.exec(str);

        const convert = (term) => {
            const number = parseFloat(term);

            if (term.endsWith('%')) {
                if (!Number.isFinite(parentSize)) {
                    throw new Error(`Percentage dimension requires a definite parent size: ${value}`);
                }
                return number * parentSize / 100;
            }

            return number;
        };

        if (single) {
            return convert(str);
        }

        const calc = /^calc\((.*)\)$/i.exec(str);

        if (!calc) {
            throw new Error(`Unsupported dimension: ${value}`);
        }

        const expression = calc[1].replace(/\s+/g, '');
        const terms = expression.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:%|px)/gi);

        if (!terms || terms.join('') !== expression || terms.slice(1).some(term => !/^[+-]/.test(term))) {
            throw new Error(`Unsupported calc expression: ${value}`);
        }

        return terms.reduce((total, term) => total + convert(term), 0);
    }
    
    static commitAnimatedStyles(tmodel, originalKeys) {
        if (!originalKeys?.size) {
            return;
        }

        TModelUtil.fixStyle(tmodel, { keys: originalKeys });
    }

    static setWidthFromDom(child) {
        const timestamp = child.domWidthTimestamp;
        const parent = child.getParent();
        const domParent = child.getDomParent();

        let rerender = false;
        if (getManager().needsRerender(child)) {
            child.isTextOnly() ? child.$dom.text(child.getHtml()) : child.$dom.html(child.getHtml());
            rerender = true;
        }

        if (rerender || (parent && timestamp <= parent.getDimLastUpdate()) || (domParent && timestamp <= domParent.getDimLastUpdate())) {
            child.$dom.width('auto');
            let width = child.$dom.width();
            width = width > 0 && child.getHtml() ? width + 1 : width;
            child.domWidthTimestamp = TUtil.now();

            child.val('width', width);

            if (width > 0 || (width === 0 && child.lastVal('width') > 0)) {
                child.addToStyleTargetList('width');
            }
            
            child.markLayoutDirty('width');
            
            getRunScheduler().schedule(15, 'resize');
        }
    }

    static setHeightFromDom(child) {
        const timestamp = child.domHeightTimestamp;
        const parent = child.getParent();
        const domParent = child.getDomParent();

        let rerender = false;
        if (getManager().needsRerender(child)) {
            child.isTextOnly() ? child.$dom.text(child.getHtml()) : child.$dom.html(child.getHtml());
            rerender = true;
        }

        if (rerender || (parent && timestamp <= parent.getDimLastUpdate()) || (domParent && timestamp <= domParent.getDimLastUpdate())) {
            child.$dom.height('auto');
            const height = child.$dom.height();
            child.domHeightTimestamp = TUtil.now();

            child.val('height', height);

            if (height > 0 || (height === 0 && child.lastVal('height') > 0)) {
                child.addToStyleTargetList('height');
            }
            
            child.markLayoutDirty('height'); 

            getRunScheduler().schedule(15, 'resize');
        }
    }

    static easingMorph(tmodel, key, from, to, step, steps) {
        const easingName = tmodel.getTargetEasing(key);
        const easing = easingName ? Easing.easingFunction(easingName) : undefined;

        const easingStep = easing ? easing(tmodel.getTargetStepPercent(key, step, steps)) : tmodel.getTargetStepPercent(key, step, steps);

        return TModelUtil.morph(key, from, to, easingStep);
    }
      
    static morph(key, from, to, easingStep) {

        if (TargetData.colorMap[TargetUtil.getTargetName(key)]) {
            const targetColors = ColorUtil.color2Integers(to);
            const lastColors = from ? ColorUtil.color2Integers(from) : ColorUtil.color2Integers('#fff');

            if (targetColors && lastColors) {
                const red = Math.floor(targetColors[0] * easingStep + lastColors[0] * (1 - easingStep));
                const green = Math.floor(targetColors[1] * easingStep + lastColors[1] * (1 - easingStep));
                const blue = Math.floor(targetColors[2] * easingStep + lastColors[2] * (1 - easingStep));

                return `rgb(${red},${green},${blue})`;
            } else {
                return to;
            }
        } else {
            return typeof to === 'number' ? from + (to - from) * easingStep : to;
        }
    }

    static fixAsyncStyle(tmodel) {
        if (!tmodel.asyncStyleTargetMap) {
            return;
        }
        
        for (const [key] of tmodel.asyncStyleTargetMap) {

            if (key === 'style') {
                const style = tmodel.getStyle();
                if (TUtil.isDefined(style) && tmodel.styleMap.style !== style) {
                    tmodel.$dom.setStyleByMap(style);
                    if (style.height) {
                        tmodel.val('height', style.height);
                    }
                    if (style.width) {
                        tmodel.val('width', style.width);
                    }
                    tmodel.styleMap.style = style;
                }
            } else if (key === 'attributes') {
                const attributes = tmodel.getAttributes();
                if (TUtil.isDefined(attributes) && tmodel.styleMap.attributes !== attributes) {
                    Object.keys(attributes).forEach(k => {
                        tmodel.$dom.attr(k, attributes[k]);
                    });
                    tmodel.styleMap.attributes = attributes;
                }
            } else if (key === 'css') {
                const css = tmodel.getCss();
                if (tmodel.$dom.css() !== css) {
                    tmodel.$dom.css(css);
                }
            } else if (TargetData.attributeTargetMap[key]) {
                tmodel.$dom.attr(key, tmodel.val(key));
            } else {
                if (TUtil.isDefined(tmodel.val(key)) && tmodel.styleMap[key] !== tmodel.val(key)) {                   
                    tmodel.$dom.style(key, `${tmodel.val(key)}`);
                    tmodel.styleMap[key] = tmodel.val(key);
                }
            }
        }

        tmodel.asyncStyleTargetMap.clear();
    }

    static getTransformBaseFromActualValues(tmodel) {

        const base = {};
        const transformMap = TargetData.transformMap;

        for (const key in tmodel.actualValues) {
            if (transformMap[key]) {
                const val = tmodel.actualValues[key];
                if (TUtil.isDefined(val)) {
                    base[key] = val;
                }
            }
        }
        
        return base;
    }  
    
    static num(v, fallback) {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    }
    
    static shouldUseImplicitTransformOrder(tmodel) {
        if (tmodel.val('useTargetTransformOrder')) {
            return true;
        }
        const names = tmodel.originalTargetNames || [];

        const hasAny = (arr) => arr.some(k => names.indexOf(k) >= 0);

        const hasPerspective = hasAny(["perspective"]);
        const hasTranslate = hasAny(["translateX", "translateY", "translateZ", "x", "y", "z"]);
        const hasRotate = hasAny(["rotateX", "rotateY", "rotateZ"]) || (hasAny(["rotate3DX"]) && hasAny(["rotate3DY"]) && hasAny(["rotate3DZ"]) && hasAny(["rotate3DAngle"]));
        const hasSkew = hasAny(["skewX", "skewY", "skew"]);
        const hasScale = hasAny(["scaleX", "scaleY", "scaleZ"]) ||
                (hasAny(["scale3DX"]) && hasAny(["scale3DY"]) && hasAny(["scale3DZ"]));

        let groups = 0;
        if (hasPerspective) {
           groups++;
        }
        if (hasTranslate) {
           groups++;
        }
        if (hasRotate) {
           groups++;
        }
        if (hasSkew) {
           groups++;
        }
        if (hasScale) {
           groups++;
        }
        
        return groups > 1;
    }
    

    static buildImplicitTransformOrderMap(names) {

        const has = (k) => names.indexOf(k) >= 0;

        const firstIdx = (candidates) => {
            let best = Infinity;
            for (const c of candidates) {
                const i = names.indexOf(c);
                if (i >= 0 && i < best) {
                    best = i;
                }
            }
            return best;
        };

        const hasExplicitTranslate = has("translateX") || has("translateY") || has("translateZ");
        const hasXYZ = has("x") || has("y") || has("z");

        const hasRotate3d = has("rotate3DX") && has("rotate3DY") && has("rotate3DZ") && has("rotate3DAngle");
        const hasScale3d = has("scale3DX") && has("scale3DY") && has("scale3DZ");
        const hasBothSkew = has("skewX") && has("skewY");

        const groups = [];

        if (has("perspective")) {
            groups.push({
                group: "perspective",
                order: firstIdx(["perspective"]),
                outputs: ["perspective"]
            });
        }

        if (hasExplicitTranslate) {
            groups.push({
                group: "translate",
                order: firstIdx(["translateX", "translateY", "translateZ"]),
                outputs: ["translateX", "translateY", "translateZ"].filter(has)
            });
        } else if (hasXYZ) {
            groups.push({
                group: "translate",
                order: firstIdx(["x", "y", "z"]),
                outputs: ["translate3d"]
            });
        }

        if (hasRotate3d) {
            groups.push({
                group: "rotate",
                order: firstIdx(["rotate3DX", "rotate3DY", "rotate3DZ", "rotate3DAngle"]),
                outputs: ["rotate3d"]
            });
        } else {
            const rotKeys = ["rotateX", "rotateY", "rotateZ", "rotate"];
            const rotPresent = rotKeys.filter(has);
            if (rotPresent.length) {
                groups.push({
                    group: "rotate",
                    order: firstIdx(rotKeys),
                    outputs: rotPresent
                });
            }
        }

        if (hasBothSkew) {
            groups.push({
                group: "skew",
                order: firstIdx(["skewX", "skewY"]),
                outputs: ["skew"]
            });
        } else {
            const skewPresent = ["skewX", "skewY"].filter(has);
            if (skewPresent.length) {
                groups.push({
                    group: "skew",
                    order: firstIdx(["skewX", "skewY"]),
                    outputs: skewPresent
                });
            }
        }

        if (hasScale3d) {
            groups.push({
                group: "scale",
                order: firstIdx(["scale3DX", "scale3DY", "scale3DZ"]),
                outputs: ["scale3d"]
            });
        } else {
            const scaleKeys = ["scaleX", "scaleY", "scaleZ", "scale"];
            const scalePresent = scaleKeys.filter(has);
            if (scalePresent.length) {
                groups.push({
                    group: "scale",
                    order: firstIdx(scaleKeys),
                    outputs: scalePresent
                });
            }
        }

        const tieRank = {perspective: 0, translate: 1, rotate: 2, skew: 3, scale: 4};

        groups.sort((a, b) => {
            const oa = Number.isFinite(a.order) ? a.order : Infinity;
            const ob = Number.isFinite(b.order) ? b.order : Infinity;
            if (oa !== ob) {
                return oa - ob;
            }
            return (tieRank[a.group] ?? 999) - (tieRank[b.group] ?? 999);
        });

        const orderList = groups.flatMap(g => g.outputs);
        const map = {};
        orderList.forEach((k, i) => map[k] = i);
        return map;        
    }

    static getTransformString(tmodel, values) {
        const processed = {};
        const transformMap = {};

        const hasExplicitTranslate = TUtil.isDefined(values.translateX) || TUtil.isDefined(values.translateY) || TUtil.isDefined(values.translateZ);

        const keys = Object.keys(values);

        for (const key of keys) {
            if (processed[key]) {
                continue;
            }
                                    
            switch (key) {
                case 'translateX':
                case 'translateY':
                case 'translateZ':
                    if (values[key] !== null) {
                        transformMap[key] = `${key}(${TModelUtil.num(values[key], 0)}px)`;
                        processed[key] = true;
                    }
                    break;

                case 'x':
                case 'y':
                case 'z':
                {
                    if (hasExplicitTranslate) {
                        processed.x = processed.y = processed.z = true;
                        break;
                    }
                    const x = `${TModelUtil.num(values.x, 0)}px`;
                    const y = `${TModelUtil.num(values.y, 0)}px`;
                    const z = `${TModelUtil.num(values.z, 0)}px`;


                    transformMap['translate3d'] = `translate3d(${x}, ${y}, ${z})`;
                    
                    processed.x = processed.y = processed.z = true;
                    break;
                }

                case 'rotate':
                case 'rotateX':
                case 'rotateY':
                case 'rotateZ':
                case 'rotate3DX':
                case 'rotate3DY':
                case 'rotate3DZ':
                case 'rotate3DAngle':
                {
                    const has3D = TUtil.isDefined(values.rotate3DX) && TUtil.isDefined(values.rotate3DY) && TUtil.isDefined(values.rotate3DZ) && TUtil.isDefined(values.rotate3DAngle);

                    if (has3D) {
                        transformMap['rotate3d'] = `rotate3d(${TModelUtil.num(values.rotate3DX, 0)}, ${TModelUtil.num(values.rotate3DY, 0)}, ${TModelUtil.num(values.rotate3DZ, 0)}, ${TModelUtil.num(values.rotate3DAngle, 0)}deg)`;

                        processed.rotate3DX = processed.rotate3DY = processed.rotate3DZ = processed.rotate3DAngle = true;
                    } else if (values[key] !== null) {
                        transformMap[key] = `${key}(${TModelUtil.num(values[key], 0)}deg)`;
                        processed[key] = true;
                    }
                    break;
                }

                case 'scale':
                case 'scaleX':
                case 'scaleY':
                case 'scaleZ':
                case 'scale3DX':
                case 'scale3DY':
                case 'scale3DZ':
                {
                    const has3D = TUtil.isDefined(values.scale3DX) && TUtil.isDefined(values.scale3DY) && TUtil.isDefined(values.scale3DZ);
                    if (has3D) {
                        transformMap['scale3d'] = `scale3d(${Number(values.scale3DX ?? 1)}, ${Number(values.scale3DY ?? 1)}, ${Number(values.scale3DZ ?? 1)})`;
                        processed.scale3DX = processed.scale3DY = processed.scale3DZ = true;
                    } else {
                        transformMap[key] = `${key}(${TModelUtil.num(values[key], 1)})`;
                        processed[key] = true;
                    }
                    break;
                }

                case 'skewX':
                case 'skewY':
                {
                    const hasBoth = TUtil.isDefined(values.skewX) && TUtil.isDefined(values.skewY);
                    if (hasBoth) {
                        transformMap['skew'] = `skew(${Number(values.skewX ?? 0)}deg, ${Number(values.skewY ?? 0)}deg)`;
                        processed.skewX = processed.skewY = true;
                    } else if (values[key] !== null) {
                        transformMap[key] = `${key}(${Number(values[key] ?? 0)}deg)`;
                        processed[key] = true;
                    }
                    break;
                }

                case 'perspective':
                    transformMap[key] = `perspective(${TModelUtil.num(values.perspective, 0)}px)`;
                    processed.perspective = true;

                    break;

            }
        }
        
        let orderMap = {};
        
        const transformOrderList = tmodel.val('transformOrder'); 
        
        
        if (Array.isArray(transformOrderList) && transformOrderList.length) {
            transformOrderList.forEach((name, index) => { orderMap[name] = index; });
        } else {
            if (TModelUtil.shouldUseImplicitTransformOrder(tmodel)) {
                if (tmodel.implicitTransformOrderVersion !== tmodel.targetsVersion) {
                  tmodel.implicitTransformOrderMap = TModelUtil.buildImplicitTransformOrderMap(tmodel.originalTargetNames);
                  tmodel.implicitTransformOrderVersion = tmodel.targetsVersion;
                }
                orderMap = tmodel.implicitTransformOrderMap;
            }
        }
        
        if (!Object.keys(orderMap).length) {
            orderMap = TargetData.transformOrder;
        }

        const sortedKeys = Object.keys(transformMap).sort((a, b) => {
            const ia = (orderMap[a] ?? 999);
            const ib = (orderMap[b] ?? 999);
            return ia - ib;
        });

        const sortedTransforms = sortedKeys.map(key => transformMap[key]);
        return sortedTransforms.join(' ');        
    };
    
    static calcAbsolutePositionFromDom(tmodel) {
        if (!tmodel.hasDom()) {
            return;
        }

        const rect = tmodel.$dom.getBoundingClientRect();
        const absX = Math.floor(rect.left);
        const absY = Math.floor(rect.top);

        if (absX !== Math.floor(tmodel.absX) || absY !== Math.floor(tmodel.absY)) {
            tmodel.absX = rect.left;
            tmodel.absY = rect.top;
            tmodel.markLayoutDirty('islandAbsXY');
        }

        const size = tmodel.domIslandSize;

        if (!size || size.width !== rect.width || size.height !== rect.height) {
            tmodel.domIslandSize = {
                width: rect.width,
                height: rect.height
            };

            const now = TUtil.now();
            tmodel.domWidthTimestamp = now;
            tmodel.domHeightTimestamp = now;

            tmodel.markLayoutDirty('islandDimensions');
        }
    }

}

export { TModelUtil };