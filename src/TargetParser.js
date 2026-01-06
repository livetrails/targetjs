import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from './TargetData.js';
import { TUtil } from './TUtil.js';
import { TModel } from "./TModel.js";
import { Easing } from "./Easing.js";

/**
 * It provides helper functions for classify target types
 */
class TargetParser {
    static isPlainObject(o) {
        return !!o && typeof o === 'object' && !Array.isArray(o) && o.constructor === Object;
    }

    static hasLifecycle(object) {
        for (const key in object) {
            const value = object[key];
            if (typeof value === 'function' && TargetData.isLifeCycleMethod(key)) {
                return true;
            }
        }
        return false;
    }
    
    static hasTargetSuffix(key) {
        return /\${1,2}$/.test(key) || key.startsWith('_');
    }
    
    static isTargetKey(key) {
        key = TargetUtil.getTargetName(key);
        return TargetData.reservedKeywordSet.has(key);
    }

    static scoreChild(targetValue) {
        let c = 0;
        let t = 0;
        for (const key in targetValue) {
            const value = targetValue[key];
            if (TargetData.defaultTargetStyles[key] || TargetData.excludedTargetKeys.has(key) || key === 'active') {
                continue;
            }
            if (TargetParser.hasTargetSuffix(key)) {
                return true;
            } else if (this.hasLifecycle(value)) {
                return true;
            } else if (TargetParser.isTargetKey(key)) {
                c++;
            } else if (!TargetData.activationKeywordSet.has(key) && !(typeof targetValue[key] === 'function')) {
                t++;
            }
        }
        return c - t >= 1;
    }

    static classifyEntry(key, value) {
        if (!TargetParser.isPlainObject(value)) {
            return 'target1';
        }
        
        if (TargetParser.isTargetKey(key)) {
            return 'target2';
        }
        
        if (key === 'originalTModel') {
            return 'target3';
        }
        
        if (value instanceof TModel) {
            return 'children';
        }

        if (TargetParser.isListTarget(value)
                || TargetParser.isFetchTarget(key, value)
                || TargetParser.isFetchImageTarget(key, value)) {
            return 'target4';
        }

        if (this.hasLifecycle(value)) {
            return 'target5';
        }

        if (this.scoreChild(value)) {
            return 'children';
        }

        return 'target6';
    }
    
    static isTargetSpecObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
            return false;
        }

        return (
            Object.prototype.hasOwnProperty.call(value, 'value') ||
            Object.prototype.hasOwnProperty.call(value, 'steps') ||
            Object.prototype.hasOwnProperty.call(value, 'interval') ||
            Object.prototype.hasOwnProperty.call(value, 'easing') ||
            Object.prototype.hasOwnProperty.call(value, 'cycles')
        );
    }    

    static isChildrenTarget(key, value) {
        return (TargetUtil.getTargetName(key) === 'children' || TargetUtil.getTargetName(key) === 'addChildren') && typeof value === 'object';
    }
    
    static isChildTarget(key, value) {
        return TargetUtil.getTargetName(key) === 'child' && typeof value === 'object';        
    }
    
    static isChildObjectTarget(key, targetValue) {
        if (TargetParser.classifyEntry(key, targetValue) !== 'children') {
            return false;
        }
        
        return true;
    }

    static isListTarget(value) {
        return typeof value === 'object' && value !== null && Array.isArray(value.list);
    }

    static isFetchTarget(key, value) {
        if (TargetUtil.getTargetName(key) !== 'fetch') {
            return false;
        }
        if (typeof value === 'string' || Array.isArray(value)) {
            return true;
        }
        if (value && typeof value === 'object' && typeof value.url === 'string') {
            return true;
        }

        return false;
    }

    static isFetchImageTarget(key, value) {
        return TargetUtil.getTargetName(key) === 'fetchImage' && value && (typeof value === 'string' || Array.isArray(value));
    }

static isObjectTarget(key, value) {
    return TargetUtil.getTargetName(key) !== 'style'
                && typeof value === 'object'
                && value !== null
                && !Array.isArray(value)
                && Object.getPrototypeOf(value) === Object.prototype
                && !TargetParser.isTargetSpecObject(value);
    }
    
    static isIntervalTarget(target) {
        if (!target || typeof target !== 'object') {
            return false;
        }
        if (target.isInterval && TUtil.isDefined(target.interval)) {
            return true;
        }
        
        return TUtil.isDefined(target.interval) 
                && !TUtil.isDefined(target.steps) 
                && !TUtil.isDefined(target.cycles) 
                && !TUtil.isDefined(target.value);
    }
    
    static isPrimitiveArray(value) {
        if (!Array.isArray(value)) {
            return false;
        }

        return value.every(v =>
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean'
        );
    }
    
    static isValueStepsCycleArray(arr) {
        if (!Array.isArray(arr) || arr.length === 0 || arr.length > 5) {
            return false;
        }

        const firstOk =
            typeof arr[0] === "number" ||
            typeof arr[0] === "string" ||
            TargetParser.isListTarget(arr[0]);

        if (!firstOk) {
            return false;
        } 

        // steps / interval must be numbers if present
        if (arr.length >= 2 && typeof arr[1] !== "number") {
            return false;
        }
        if (arr.length >= 3 && typeof arr[2] !== "number") {
            return false;
        }

        // 4th slot can be: cycles (number) OR easing (string)
        if (arr.length >= 4) {
            const v3 = arr[3];
            const isCycles = typeof v3 === "number";
            const isEasing = typeof v3 === "string" && Easing.easeMap.has(v3);

            if (!isCycles && !isEasing) {
                return false;
            }
        }

        // 5th slot only allowed when 4th is easing, and must be cycles (number)
        if (arr.length === 5) {
            const v3 = arr[3];
            const v4 = arr[4];

            if (!(typeof v3 === "string" && Easing.easeMap.has(v3))) {
                return false;
            }
            if (typeof v4 !== "number") {
                return false;
            }
        }

        return TargetParser.isListTarget(arr[0]) || arr.length >= 2;
    }

    
    static getValueStepsCycles(tmodel, _target, key, cycle = tmodel.getTargetCycle(key)) {
        const valueOnly = _target && _target.valueOnly;
        const lastValue = tmodel.val(key);

        let value = null, steps = 0, interval = 0, easing = undefined, cycles = 0;

        const resolveMaybeFn = (v, ...args) => (typeof v === "function" ? v.call(tmodel, ...args) : v);
                       
        function parseVSCArray(arr) {
            // If not a directive array, treat as "value only"
            if (valueOnly || !TargetParser.isValueStepsCycleArray(arr)) {
                return [arr, steps, interval, easing, cycles];
            }

            value = arr[0];
            steps = arr.length >= 2 ? arr[1] : steps;
            interval = arr.length >= 3 ? arr[2] : interval;

            if (arr.length >= 4) {
                if (typeof arr[3] === "string") {
                    // [value, steps, interval, easing]
                    easing = arr[3];
                    cycles = arr.length >= 5 ? arr[4] : cycles;
                } else {
                    // [value, steps, interval, cycles]
                    cycles = arr[3];
                }
            }

            return [value, steps, interval, easing, cycles];
        }

        function getValue(target) {
            // Arrays: either "value list" or [value,steps,interval,(easing),cycles]
            if (Array.isArray(target)) {
                return parseVSCArray(target);
            }

            // Plain objects: compute value + params (steps/interval/easing/cycles)
            if (typeof target === "object" && target !== null && Object.getPrototypeOf(target) === Object.prototype) {
                const valueResult = TargetUtil.runTargetValue(tmodel, target, key, cycle, lastValue);
                
                if (TargetParser.isPrimitiveArray(valueResult) && (TUtil.isDefined(target.steps) || TUtil.isDefined(target.interval) || TUtil.isDefined(target.easing) || TUtil.isDefined(target.cycles))) {
                    value = { list: valueResult };
                    steps = TUtil.isDefined(target.steps) ? resolveMaybeFn(target.steps, cycle) : 0;
                    interval = TUtil.isDefined(target.interval) ? resolveMaybeFn(target.interval, cycle) : 8;
                    easing = TUtil.isDefined(target.easing) ? resolveMaybeFn(target.easing, cycle) : easing;
                    cycles = TUtil.isDefined(target.cycles)
                        ? resolveMaybeFn(target.cycles, cycle, tmodel.getTargetCycles(key))
                        : 0;               

                    return [value, steps, interval, easing, cycles];
                } else if (typeof valueResult === 'object' && TUtil.isDefined(valueResult.value) && TUtil.isDefined(valueResult.steps)) {
                    return getValue(valueResult);
                }
                
                value = valueResult;

                steps = TUtil.isDefined(target.steps)
                        ? resolveMaybeFn(target.steps, cycle)
                        : 0;

                interval = TUtil.isDefined(target.interval)
                        ? resolveMaybeFn(target.interval, cycle)
                        : 0;

                easing = TUtil.isDefined(target.easing)
                        ? resolveMaybeFn(target.easing, cycle)
                        : easing; // keep prior easing if not supplied

                cycles = TUtil.isDefined(target.cycles)
                        ? resolveMaybeFn(target.cycles, cycle, tmodel.getTargetCycles(key))
                        : 0;

                return Array.isArray(value) ? getValue(value) : [value, steps, interval, easing, cycles];
            }

            // Functions: call and re-run
            if (typeof target === "function") {
                return getValue(target.call(tmodel, cycle, lastValue));
            }

            // Primitives: value only
            return [target, steps, interval, easing, cycles];
        }

        return getValue(_target);
    }
}

export { TargetParser };