// AnimationUtil.js
import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";
import { getAnimationManager, getTargetManager } from "./App.js";

/**
 * It provides helper functions for Animation.
 */
class AnimationUtil {
    
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

           (keyMap[cleanKey] = new Set()).add(key);

            if (targetValue) {
                targetValue.value = value;
                targetValue.steps = 1;
                targetValue.interval = 0;
                targetValue.snapAnimation = true;
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
                
        getAnimationManager().animate(tmodel, batch, AnimationUtil.getAnimationHooks());
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
    
    static addUnitsToFrame(out) {
        for (const k of Object.keys(out)) {
            if (k === 'offset' || k === 'transform') {
                continue;
            }

            let v = out[k];

            if (v === undefined || v === null || Number.isNaN(v)) {
                delete out[k];
                continue;
            }

            if (typeof v === 'number' && TargetData.styleWithUnitMap[k]) {
                if ((k === 'width' || k === 'height') && v < 0) {
                    v = 0;
                }
                
                out[k] = `${v}px`;
            }
        }
    }
    
    static getAnimationHooks() {
        return {
            morph: (tm, key, from, to, step, steps) => TModelUtil.morph(tm, key, from, to, step, steps),
            fireOnStep: (tm, key, step) => getTargetManager().fireOnStep(tm, key, step),
            fireOnEnd: (tm, key) => getTargetManager().fireOnEnd(tm, key)
        };
    } 
}

export { AnimationUtil };
