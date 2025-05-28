import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { tRoot, App } from "./App.js";
import { TargetData } from "./TargetData.js";

/**
 * 
 * Map and bind dom elements to model structures
 */
class DomInit {
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
                        
                        let value = DomInit.parseString(rawValue);
                                                
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
                
                
                const childrenKey = DomInit.getChildrenKey(parentModel);
                
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
                value.isVisible = !TUtil.isDefined(value.isVisible) ? function() { return this.getParent().isVisible(); } : value.isVisible;
                value.domParent = !TUtil.isDefined(value.domParent) ? function() { return this.getParent(); } : value.domParent;                  
            } else {
                value.isVisible = !TUtil.isDefined(value.isVisible) ? true : value.isVisible;  
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
        
        if (!isObject && !isFunction && (trimmed.includes('return') || trimmed.includes('setTarget') || trimmed.includes('TargetJS.')) || (trimmed.includes('addChild'))) {
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
}

export { DomInit };