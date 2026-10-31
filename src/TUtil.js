import { getLocationManager, tRoot } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModel } from "./TModel.js";

/**
 * 
 * It provides a variety of helping functions that are used by the framework.
 */
class TUtil {
    static webGpuAvailable = false;
    static webGpuInitPromise;

    static contains(container, tmodel) {
        if (!container || !tmodel) {
            return false;
        }

        if (container === tmodel
                || tmodel.getDomParent() === container
                || tmodel.getDomParent()?.getDomParent() === container) {
            return true;
        }

        return false;
    }
    
    static uniqueTModels(tmodels) {
        return [ ...new Map(tmodels.filter(Boolean).map(tmodel => [ tmodel.oid, tmodel ])).values() ];
    }

    static list2map(list, defaultValue) {
        return list.reduce((map, item) => {
            map[item.oid] = TUtil.isDefined(defaultValue) ? defaultValue : item;
            return map;
        }, {});
    }

    static getDeepList(parent) {
        const deepList = [];

        function traverse(tmodel) {
            if (tmodel && tmodel.hasChildren()) {
                const list = tmodel.getChildren();
                deepList.push(...list);
                list.forEach(traverse);
            }
        }

        traverse(parent);
        return deepList;
    }

    static areEqual(a, b, deepEquality) {
        if (deepEquality) {
            return JSON.stringify(a) === JSON.stringify(b);
        } else {
            return a === b;
        }
    }

    static momentum(past, current, time = 1, deceleration = 0.002, maxDistance = 100) {
        const distance = current - past;

        const speed = time < 10 ? Math.abs(distance) / 10 : Math.abs(distance) / time;

        const duration = speed / deceleration;
        let momentumDistance = (speed ** 2) / (2 * deceleration);

        if (momentumDistance > maxDistance) {
            momentumDistance = maxDistance;
        }

        const adjustedDistance = distance > 0 ? distance + momentumDistance : distance - momentumDistance;

        return {
            distance: Math.round(adjustedDistance) / 5,
            duration: Math.round(duration),
            momentumDistance
        };
    }

    static isDefined(obj) {
        return typeof obj !== "undefined" && obj !== null;
    }
    
    static hasProperty(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    static isNumber(num) {
        return typeof num === 'number' && !isNaN(num);
    }

    static limit(num, low, high) {
        num = TUtil.isDefined(num) ? num : low;
        num = num > high ? high : num;
        num = num < low ? low : num;

        return num;
    }

    static capitalizeFirstLetter(val) {
        return val.charAt(0).toUpperCase() + val.slice(1);
    }
    
    static getLoadTargetName(targetName) {
        return `load-${targetName}`;
    }

    static formatNum(num, precision) {
        if (!num) {
            return 0;
        }
        const n = parseFloat(num.toString());
        return n.toFixed(precision);
    }

    static now() {
        return performance.now();
    }

    static log(condition) {
        return condition === true ? console.log : () => {};
    }

    static distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    static getFullLink(link) {
        if (!TUtil.isDefined(link)) {
            return;
        }

        if (!link.startsWith('http')) {
            let protocol = window.location.protocol;
            protocol += protocol.endsWith(":") ? "//" : "://";
            const base = `${protocol}${window.location.hostname}`;
            link = link.startsWith("/") ? base + link : `${base}/${link}`;
        }

        return link.endsWith('/') ? link.slice(0, -1) : link;
    }

    static isStringBooleanOrNumber(input) {
        const inputType = typeof input;
        return inputType === 'string' || inputType === 'boolean' || inputType === 'number';
    }

    static logTree(tmodel = tRoot(), tab = '') {
        const list = getLocationManager().calcChildren(tmodel);
        for (const g of list) {
            const gtab = g.isVisible() ? tab + '|  ' : tab + 'x  ';
            if (g.type === 'BI') {
                console.log(`${gtab}${g.oid} v:${g.isVisible()} x:${Math.floor(g.getX())} y:${Math.floor(g.getY())}, absX:${Math.floor(g.absX)}, absY:${Math.floor(g.absY)}  n-e-s:${Math.floor(g.viewport?.yNorth)}-${Math.floor(g.viewport?.yEast)}-${Math.floor(g.viewport?.ySouth)} w:${Math.floor(g.getBaseWidth())} ww:${Math.floor(g.getContentWidth())} h:${Math.floor(g.getBaseHeight())} hh:${Math.floor(g.getContentHeight())}`);
            } else {
                console.log(`${gtab}${g.oid} v:${g.isVisible()} x:${Math.floor(g.getX())} y:${Math.floor(g.getY())} absX:${Math.floor(g.absX)}, absY:${Math.floor(g.absY)} w:${Math.floor(g.getWidth())} h:${Math.floor(g.getHeight())} hc:${Math.floor(g.getContentHeight())}`);
            }

            if (g.hasChildren() && g.type !== 'exampleItem') {
                TUtil.logTree(g, gtab);
            }
        }
    }
    
    static logBranch(tmodel) {
        const branch = [];
        
        while(tmodel) {
            branch.unshift(tmodel);
            tmodel = tmodel.bracket ? tmodel.bracket : tmodel.getParent();
        }
        
        for (var i = 1; i < branch.length; i++) {
             const parent = branch[i - 1];
             const child = branch[i];
             if (getLocationManager().getChildren(parent).indexOf(child) < 0) {
                 console.log("branch is not valid: " + parent.oid + ", " + child.oid);
                 break;
             }
        }
        
        console.log(branch.map(t => t.oid));
    }
    
    static handleValueChange(tmodel, key) {
        let target = tmodel.targets[key];
        
        if (!target) {
            key = TargetUtil.getTargetName(key);
            target = tmodel.targets[key];
        }
        
        const newValue = tmodel.val(key);
        const lastValue = tmodel.lastVal(key);

        if (typeof target === 'object' && typeof target.onValueChange === 'function') {
            const valueChanged = !TUtil.areEqual(newValue, lastValue, target.deepEquality);
            if (valueChanged) {
                target.onValueChange.call(tmodel, newValue, lastValue, tmodel.getTargetCycle(key));
                tmodel.setTargetMethodName(key, 'onValueChange');
            }
                            
            return true;
        }
        
        return false;
    }
    
    static mergeTargets(tmodel1, tmodel2) {
        const sourceTargets = tmodel2.targets;
        const targetNames = tmodel2.originalTargetNames;
        const destTargets = tmodel1.targets;

        const newTargets = [];

        targetNames.forEach(key => {
            if (!TUtil.isDefined(destTargets[key])) {
                newTargets.push(key);
            }
        });
        
        tmodel1.originalTargetNames.push(...newTargets);
        
        newTargets.forEach(key => {
            const keyIndex = tmodel1.originalTargetNames.indexOf(key);
            destTargets[key] = sourceTargets[key];
            tmodel1.processNewTarget(key, keyIndex);            
        });
    }
    
    static cloneTargetDefinition(value, seen = new WeakMap()) {
        if (!TUtil.isDefined(value) || typeof value !== 'object') {
            return value;
        }

        // Keep functions shared. They are behavior, not per-instance state.
        if (typeof value === 'function') {
            return value;
        }

        // Avoid cloning DOM wrappers, real DOM nodes, TModels, etc.
        if (
            value instanceof TModel ||
            value instanceof Element ||
            value instanceof Node ||
            value instanceof Date ||
            value instanceof RegExp
        ) {
            return value;
        }

        if (seen.has(value)) {
            return seen.get(value);
        }

        if (Array.isArray(value)) {
            const arr = [];
            seen.set(value, arr);

            for (const item of value) {
                arr.push(TUtil.cloneTargetDefinition(item, seen));
            }

            return arr;
        }

        const proto = Object.getPrototypeOf(value);

        // Only deep-clone plain objects.
        if (proto !== Object.prototype && proto !== null) {
            return value;
        }

        const cloned = {};
        seen.set(value, cloned);

        for (const key of Object.keys(value)) {
            cloned[key] = TUtil.cloneTargetDefinition(value[key], seen);
        }

        return cloned;
    }
  
    static initWebGpu() {
        return this.webGpuInitPromise ??= (async () => {
            this.webGpuAvailable = false;

            if (!this.hasWebGpu()) {
                return false;
            }

            let device;

            try {
                const adapter = await navigator.gpu.requestAdapter();

                if (!adapter) {
                    return false;
                }

                device = await adapter.requestDevice();

                const canvas = document.createElement("canvas");
                const context = canvas.getContext("webgpu");

                if (!context) {
                    return false;
                }

                context.configure({
                    device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    alphaMode: "premultiplied",
                    usage: globalThis.GPUTextureUsage.RENDER_ATTACHMENT | globalThis.GPUTextureUsage.COPY_SRC
                });

                context.unconfigure();

                this.webGpuAvailable = true;
                return true;
            } catch (error) {
                console.warn("TargetJS: WebGPU unavailable. Using DOM.", error);
                return false;
            } finally {
                device?.destroy();
            }
        })();
    }
    
    static hasWebGpu() {
        return typeof navigator !== "undefined" &&
            !!navigator.gpu &&
            !!globalThis.GPUBufferUsage &&
            !!globalThis.GPUTextureUsage &&
            globalThis.isSecureContext === true;
    }
    
}

export { TUtil };
