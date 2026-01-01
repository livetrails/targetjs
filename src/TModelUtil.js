// TModelUtil.js
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { getRunScheduler, getManager, getAnimationManager } from "./App.js";
import { $Dom } from "./$Dom.js";
import { ColorUtil } from "./ColorUtil.js";

/**
 * It provides helper functions for TModel.
 */
class TModelUtil {

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
        tmodel.$dom.setSelector(`#${tmodel.oid}`);
        tmodel.$dom.setId(tmodel.oid);
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
        for (const [key] of tmodel.allStyleTargetMap) {
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
    
    static fixStyleByAnimation(tmodel, frame) {
        
        if (!tmodel.hasDom()) {
            return;
        }
        
        const keys = Object.keys(frame);

        for (const key of keys) {
            if (key === 'offset') {
                continue;
            }
            
            const value = frame[key];
            
            if (value === null) {
                continue;
            }

            let num = value;
            if (typeof value === 'string' && value.endsWith('px')) {
                const parsed = Number(value.slice(0, -2));
                if (!Number.isNaN(parsed)) {
                    num = parsed;
                }
            }

            if (key === 'width') {
                tmodel.styleMap.width = num;
                tmodel.$dom.width(value);
            } else if (key === 'height') {
                tmodel.styleMap.height = num;
                tmodel.$dom.height(value);
            } else if (key === 'transform') {
                tmodel.$dom.transform(value, tmodel.val('transformOrder'));
            } else if (!TargetData.transformMap[key]) {
                tmodel.$dom.style(key, value);
                tmodel.styleMap[key] = num;
            }
        }
 
    }

    static fixStyle(tmodel) {
        if (!tmodel.styleTargetMap) {
            return;
        }
        
        let transformUpdate = false;
           
        for (const [key] of tmodel.styleTargetMap) {
            
            if (tmodel.isKeyAnimating(key)) {
                continue;
            }
                      
            if (TargetData.transformMap[key]) {
                const value = TModelUtil.getTransformValue(tmodel, key);             
                if (tmodel.tfMap[key] !== value) {
                    tmodel.tfMap[key] = value;
                    transformUpdate = true;
                }
            } else if (key === 'dim') {
                const dim = Math.floor(tmodel.val('dim'));
                if (tmodel.styleMap['height'] !== dim || tmodel.$dom.getStyleValue('height') !== dim) {
                    tmodel.styleMap['height'] = dim;
                    tmodel.$dom.height(dim);
                }
                if (tmodel.styleMap['width'] !== dim || tmodel.$dom.getStyleValue('width') !== dim) {
                    tmodel.styleMap['width'] = dim;
                    tmodel.$dom.width(dim);
                }
            } else if (key === 'width') {
                const width = Math.floor(tmodel.getWidth());
                if (tmodel.styleMap['width'] !== width || tmodel.$dom.getStyleValue('width') !== width) {
                    tmodel.styleMap['width'] = width;
                    tmodel.$dom.width(width);
                }
            } else if (key === 'height') {
                const height = Math.floor(tmodel.getHeight());
                if (tmodel.styleMap['height'] !== height || tmodel.$dom.getStyleValue('height') !== height) {
                    tmodel.styleMap['height'] = height;
                    tmodel.$dom.height(height);
                }
            } else if (TargetData.styleWithUnitMap[key]) {
                if (TUtil.isDefined(tmodel.val(key)) && tmodel.styleMap[key] !== tmodel.val(key)) {
                    tmodel.$dom.style(key, TUtil.isNumber(tmodel.val(key)) ? `${tmodel.val(key)}px` : tmodel.val(key));
                    tmodel.styleMap[key] = tmodel.val(key);
                }
            } else {
                if (TUtil.isDefined(tmodel.val(key)) && tmodel.styleMap[key] !== tmodel.val(key)) {
                    tmodel.$dom.style(key, `${tmodel.val(key)}`);
                    tmodel.styleMap[key] = tmodel.val(key);
                }
            }
        }
        
        if (transformUpdate) {        
            tmodel.$dom.transform(TModelUtil.getTransformString(tmodel.tfMap, tmodel.val('transformOrder')));
        }
        
        tmodel.styleTargetMap.clear();
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

            getRunScheduler().schedule(15, 'resize');
        }
    }

    static morph(tmodel, key, from, to, step, steps) {
        const easing = tmodel.getTargetEasing(key);
        const easingStep = easing ? easing(tmodel.getTargetStepPercent(key, step, steps)) : tmodel.getTargetStepPercent(key, step, steps);

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
                        tmodel.val('height', parseInt(style.height, 10));
                    }
                    if (style.width) {
                        tmodel.val('width', parseInt(style.width, 10));
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

    static getTransformString(values, transformOrderList) {
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
        if (Array.isArray(transformOrderList) && transformOrderList.length) {
            transformOrderList.forEach((name, index) => {
                orderMap[name] = index;
            });
        } else {
            orderMap = TargetData.transformOrder || {};
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
    }

    static normalizeDomHolder(holder) {
        if (holder instanceof $Dom) {
            return holder;
        }
        if (holder instanceof Element) {
            return new $Dom(holder);
        }

        if (typeof holder === 'string') {
            const el = $Dom.querySelector(holder);
            return el ? new $Dom(el) : null;
        }
        return null;
    }
    
    static overrideAnimatedKeyWithSnap(tmodel, keys, values) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const valueList = Array.isArray(values) ? values : [values];

        const tfMap0 = {};
        const styleMap0 = {};
        const keyMeta0 = new Map();

        const tfMap1 = {};
        const styleMap1 = {};
        const keyMeta1 = new Map();

        const keyMap = {};
        
        let needsAnimation = false;

        for (let i = 0; i < keyList.length; i++) {
            const key = keyList[i];

            needsAnimation = true;
            
            const value = valueList[i];
            const targetValue = tmodel.targetValues[key];

            const cleanKey = TargetUtil.getTargetName(key);

            if (TargetData.isTransformKey(cleanKey)) {
                tfMap0[cleanKey] = value;
                tfMap1[cleanKey] = value;
            } else {
                styleMap0[cleanKey] = value;
                styleMap1[cleanKey] = value;
            }

            keyMeta0.set(cleanKey, { steps: 1, interval: 1 });
            keyMeta1.set(cleanKey, { steps: 1, interval: 1 });

            keyMap[cleanKey] = key;

            if (targetValue) {
                targetValue.value = value;
                targetValue.steps = 1;
                targetValue.interval = 0;
            }
        }
        
        if (!needsAnimation) {
            return;
        }

        const frames = [];


        frames.push({
            keyTime: 0,
            tfMap: tfMap0,
            styleMap: styleMap0,
            keyMeta: keyMeta0
        });

        frames.push({
            keyTime: 1,
            tfMap: tfMap1,
            styleMap: styleMap1,
            keyMeta: keyMeta1
        });

        const batch = {
            frames,
            keyMap,
            totalDuration: 1
        };
                
        getAnimationManager().animate(tmodel, batch, TargetUtil.getAnimationHooks());
    }

}

export { TModelUtil };
