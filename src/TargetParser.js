import { TargetUtil } from "./TargetUtil.js";
import { TargetData } from './TargetData.js';
import { TModel } from "./TModel.js";

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

    static scoreChild(object) {
        let c = 0;
        let t = 0;
        for (const key in object) {
            if (TargetData.defaultTargetStyles[key]) {
                continue;
            }
            if (TargetParser.hasTargetSuffix(key)) {
                return true;
            } else if (TargetParser.isTargetKey(key)) {
                c++;
            } else if (!TargetData.activationKeywordSet.has(key) && !(typeof object[key] === 'function')) {
                t++;
            }
        }
        return c > t && c >= 2;
    }

    static classifyEntry(key, value) {
        if (!TargetParser.isPlainObject(value)) {
            return 'target';
        }
        
        if (TargetParser.isTargetKey(key)) {
            return 'target';
        }
        
        if (key === 'originalTModel') {
            return 'target';
        }
        
        if (value instanceof TModel) {
            return 'children';
        }

        if (TargetParser.isListTarget(value)
                || TargetParser.isFetchTarget(key, value)
                || TargetParser.isFetchImageTarget(key, value)) {
            return 'target';
        }

        if (this.hasLifecycle(value)) {
            return 'target';
        }

        if (this.scoreChild(value)) {
            return 'children';
        }

        return 'target';
    }

    static isChildrenTarget(key, value) {
        return TargetUtil.getTargetName(key) === 'children' && typeof value === 'object';
    }
    
    static isChildrenObjectTarget(key, value) {
        if (TargetParser.classifyEntry(key, value) === 'children') {
            return true;
        }
        
        return false;
    }

    static isValueStepsCycleArray(arr) {
        if (arr.length > 4 || arr.length === 0) {
            return false;
        }

        for (let i = 1; i < arr.length; i++) {
            if (typeof arr[i] !== 'number') {
                return false;
            }
        }

        return arr.length >= 2 && (typeof arr[0] === 'number' || TargetParser.isListTarget(arr[0]) || typeof arr[0] === 'string');
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
                && Object.getPrototypeOf(value) === Object.prototype;
    }
}

export { TargetParser };