import { getLocationManager, tRoot, getScreenHeight, getScreenWidth } from "./App.js";

/**
 * 
 * It provide a variety of helping functions that are used by the framework.
 */
class TUtil {
    static calcVisibility(child) {
        //this condition is for objects that get overflow while updating their 'x'
        if (child.isVisible() && child.isTargetUpdating('x')) {
            return true;
        }
        
        const x = child.absX;
        const y = child.absY;
        const domParent = child.getDomParent();
        const parent = child.getRealParent();

        const scale = (domParent.getMeasuringScale() || 1) * child.getMeasuringScale();
        const maxWidth = TUtil.isDefined(child.getWidth()) ? scale * child.getWidth() : 0;
        const maxHeight = TUtil.isDefined(child.getHeight()) ? scale * child.getHeight() : 0;

        if (!child.visibilityStatus) {
            child.visibilityStatus = {};
        }

        const status = child.visibilityStatus;
        
        const validateInParent = child.validateVisibilityInParent() && parent !== tRoot();

        const parentX = validateInParent ? Math.max(domParent.absX, parent.absX) : 0;
        const parentY = validateInParent ? Math.max(domParent.absY, parent.absY) : 0;
        const parentWidth = validateInParent ? Math.min(domParent.getWidth(), parent.getWidth()) : getScreenWidth();
        const parentHeight = validateInParent ? Math.min(domParent.getHeight(), parent.getHeight()) : getScreenHeight();
        const validatingParent = validateInParent ? parent : "screen";

        status.right = x <= parentX + parentWidth;
        status.left = x + maxWidth >= parentX;
        status.bottom = y - child.getTopMargin() <= parentY + parentHeight;
        status.top = y + maxHeight >= parentY;
        status.parentX = parentX;
        status.parentY = parentY;
        status.parentWidth = parentWidth;
        status.parentHeight = parentHeight;
        status.x = x;
        status.y = y;
        status.isVisible = status.left && status.right && status.top && status.bottom;
        status.parent = validatingParent;

        child.actualValues.isVisible = status.isVisible;

        return child.actualValues.isVisible;
    }

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
                console.log(`${gtab}${g.oid} v:${g.isVisible()} x:${Math.floor(g.getX())} y:${Math.floor(g.getY())}, absY:${Math.floor(g.absY)} yy:${Math.floor(g.absY + g.getDomParent().absY)} w:${Math.floor(g.getWidth())} h:${Math.floor(g.getHeight())} hc:${Math.floor(g.getContentHeight())}`);
            } else {
                console.log(`${gtab}${g.oid} v:${g.isVisible()} x:${Math.floor(g.getX())} y:${Math.floor(g.getY())} absY:${Math.floor(g.absY)} yy:${Math.floor(g.absY + g.getDomParent().absY)} w:${Math.floor(g.getWidth())} h:${Math.floor(g.getHeight())} hc:${Math.floor(g.getContentHeight())}`);
            }

            if (g.hasChildren()) {
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
}

export { TUtil };
