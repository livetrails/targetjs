import { $Dom } from "./$Dom.js";
import { getLocationManager, tRoot, getScreenHeight, getScreenWidth, App } from "./App.js";
import { TargetData } from "./TargetData.js";

/**
 * 
 * It provide a variety of helping functions that are used by the framework.
 */
class TUtil {
    static calcVisibility(child) {
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

        const parentX = child.validateVisibilityInParent() ? Math.max(domParent.absX, parent.absX) : 0;
        const parentY = child.validateVisibilityInParent() ? Math.max(domParent.absY, parent.absY) : 0;
        const parentWidth = child.validateVisibilityInParent() ? Math.min(domParent.getWidth(), parent.getWidth()) : getScreenWidth();
        const parentHeight = child.validateVisibilityInParent() ? Math.min(domParent.getHeight(), parent.getHeight()) : getScreenHeight();

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

        child.val('isVisible', status.left && status.right && status.top && status.bottom);

        return child.val('isVisible');
    }

    static initCacheDoms(visibleList) {
        const elements = tRoot().$dom.queryAll('[tg]');

        visibleList.forEach(tmodel => {
            tmodel.$dom = null;
        });

        const visibleMap = TUtil.list2map(visibleList.filter(item => item.type !== 'BI'));

        for (let element of elements) {
            const id = element.getAttribute("id");
            const tmodel = visibleMap[id];

            if (tmodel) {
                tmodel.$dom = new $Dom(`#${id}`);
            } else {
                $Dom.detach(element);
            }
        }
    }

    static initPageDoms($dom) {
        const elementToModel = new Map();

        const elements = $dom.queryAll('*');

        for (let element of elements) {
            let newModel;
            const attrs = Array.from(element.attributes);
            
            const isTargetElement = attrs.some(attr => attr.name === 'tg' || attr.name.startsWith('tg-'));

    
            const attributeSet = {};

            if (isTargetElement) {
                for (let attr of attrs) {
                    if (attr.name.startsWith("tg-")) {
                        const rawKey = attr.name.slice(3);
                        const key = TargetData.attributesToTargets[rawKey] || rawKey;
                        
                        const rawValue = attr.value.trim();
                        
                        let value = TUtil.parseString(rawValue);
                                                
                        attributeSet[key] = value;                                           
                    }
                }
            }
            
            const parentEl = element.parentElement;
            const parentModel = elementToModel.get(parentEl);            

            let id;
            
            if (Object.keys(attributeSet).length > 0) {
                id = element.getAttribute('id');
                
                if (!id && !parentModel) {
                    id = App.getOid('blank').oid;
                    element.setAttribute('id', id);
                }  

                if (!element.getAttribute('tg')) {
                    element.setAttribute('tg', true);
                }
                 
               newModel = {
                    id,
                    $dom: new $Dom(element),
                    ...attributeSet
                }; 
            }            

            if (parentModel) {
                if (!newModel) {
                    newModel = {
                        textOnly: false,
                        html: element.outerHTML,
                        $dom: new $Dom(element)
                    };
                }
                
                
                const childrenKey = TUtil.getChildrenKey(parentModel);
                
                if (childrenKey) {
                    if (Array.isArray(parentModel[childrenKey].value)) {
                        parentModel[childrenKey].value.push(newModel);
                    } else if (typeof parentModel[childrenKey] === 'string') {
                        parentModel[childrenKey] = {
                            cycles: TUtil.isNumber(+parentModel[childrenKey]) ? +parentModel[childrenKey] : 0,
                            value: [ newModel ]
                        }
                    } else if (typeof parentModel[childrenKey] === 'object') {
                        parentModel[childrenKey].value = [ newModel ];
                    }

                } else {
                    parentModel._children$ = {
                        cycles: 0,
                        value: [ newModel ]
                    };
                }

                elementToModel.set(element, newModel);

            } else if (newModel) {
                elementToModel.set(element, newModel);
            }
        }
        
        for (const value of elementToModel.values()) {
            const parentEl = value.$dom.element.parentElement;
            const parentModel = elementToModel.get(parentEl);
                        
            if (parentModel) {
                value.$dom.detach();
                delete value.$dom; 
                delete value.id;                
                value.shouldBeBracketed = false;
                value.otype = value.id || (parentModel.id || App.getOid('blank').oid)  + "_";
                value.isVisible = function() { return this.getParent().isVisible(); };
                value.domParent = function() { return this.getParent(); };                  
            } else {
                value.isVisible = true;  
                value.sourceDom = true;
                tRoot().addChild(value);
            }
        } 
    }
    
    static getChildrenKey(obj) {
        for (const key of Object.keys(obj)) {
          if (key.toLowerCase().includes("children")) {
            return key;
          }
        }
        
        return null;
    }
    
    static parseString(rawValue) {
        if (typeof rawValue !== 'string') {
            return rawValue;
        }

        const trimmed = rawValue.trim();
        const isFunction = /^function\s*\([\s\S]*?\)\s*\{[\s\S]*\}$/m.test(trimmed) || /^\(?[\w\s,]*\)?\s*=>\s*(\{[\s\S]*\}|\S+)/m.test(trimmed);         
        const isObject = /^(\{[\s\S]*\}|\[[\s\S]*\])$/.test(trimmed);
        
        if (!isObject && !isFunction && (trimmed.includes('return') || trimmed.includes('setTarget') || trimmed.includes('TargetJS.'))) {
            try {
                return new Function(trimmed);
            } catch {
            }
        }

        if (isObject || isFunction) {
            try {
                return eval(`(${trimmed})`);
            } catch {}
        }
    
        try {
            return JSON.parse(trimmed);
        } catch {
        }

        return rawValue;
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
        return Date.now();
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
        const list = getLocationManager().getChildren(tmodel);
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

}

export { TUtil };
