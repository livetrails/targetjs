import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { tRoot, App, getTModelById } from "./App.js";
import { TargetData } from "./TargetData.js";
import { TModelUtil } from "./TModelUtil.js";

/**
 * 
 * Map and bind dom elements to model structures
 */
class DomInit {
    static initCacheDoms(visibleList) {
        const elements = tRoot().$dom.queryAll('[tgjs]');

        visibleList.forEach(tmodel => {
            tmodel.$dom = null;
        });
        
        const visibleMap = TUtil.list2map(visibleList.filter(item => item.type !== 'BI'));
        const newVisibles = [];

        for (let element of elements) {
            const id = element.getAttribute("id");

            let tmodel = visibleMap[id];
            if (tmodel) {
                tmodel.$dom = new $Dom(`#${id}`);
            } else {
                tmodel = getTModelById(id);
                
                if (tmodel) {
                    newVisibles.push(tmodel);
                    tmodel.$dom = new $Dom(`#${id}`);              
                } else {
                    $Dom.detach(element);
                }
            }
        }
        
        return newVisibles;
    }
    
    static mount(tmodel, elemTarget) {
        if (elemTarget !== undefined) {
            const $dom = TModelUtil.normalizeDomHolder(elemTarget);
            if ($dom) {                
                tmodel.targets.$dom = $dom;
                tmodel.val('$dom', $dom);
                delete tmodel.targets.position;

                const id = $dom.getId();
                if (id) {
                    const uniqueId = App.getOid(id);
                    tmodel.type = id;
                    tmodel.oid = uniqueId.oid;
                    tmodel.oidNum = uniqueId.num;
                }

                $dom.setSelector(`#${tmodel.oid}`);
                $dom.setId(tmodel.oid);
                $dom.attr('tgjs', 'true');

                tmodel.initTargets();
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
                        const key = TargetData.toCanonicalKey(rawKey);
                        
                        const rawValue = attr.value.trim();
                                                
                        let value = DomInit.parseString(rawValue);
                                                
                        attributeSet[key] = value;                                           
                    } else if (attr.name === 'tg') {
                        attributeSet[attr.name] = true; 
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

                if (!element.getAttribute('tgjs')) {
                    element.setAttribute('tgjs', true);
                }
                 
               newModel = {
                    id,
                    baseElement: element.tagName.toLowerCase(),
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
                    parentModel.children$ = {
                        cycles: 0,
                        value: [ newModel ]
                    };
                }

                elementToModel.set(element, newModel);

            } else if (newModel) {
                elementToModel.set(element, newModel);
            }
        }
                
        const invisibleList = [];
        for (const value of elementToModel.values()) {
            const parentEl = value.$dom.element.parentElement;
            const parentModel = elementToModel.get(parentEl);
                        
            if (parentModel) {
                value.$dom.detach();
                delete value.$dom; 
                delete value.id;
                value.sourceDom = true;
                value.otype = value.id || (parentModel.id || App.getOid('blank').oid)  + "_";
                value.isVisible = !TUtil.isDefined(value.isVisible) ? function() { return this.getParent().isVisible(); } : value.isVisible;
                value.domParent = !TUtil.isDefined(value.domParent) ? function() { return this.getParent(); } : value.domParent;
            } else {
                value.isVisible = !TUtil.isDefined(value.isVisible) ? true : value.isVisible;
                value.domHolder = !TUtil.isDefined(value.domHolder) ? true : value.domHolder; 
                value.sourceDom = true;
                
                tRoot().addChild(value);
                
                if (!value.isVisible) {
                    invisibleList.push({ $dom: value.$dom, tmodel: tRoot().getLastChild() });
                }
            }
        }
        
        invisibleList.forEach(({ $dom, tmodel }) => {
            if ($dom.exists() && !tmodel.hasChildren()) {
                $dom.detach();
                tmodel.val('requiresDom', false);
            }
        });
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
        const containsCode = ['return', 'setTarget', 'TargetJS.', 'addChild', 'addSibling', 'activateTarget', 'removeChild', 'removeAll'].some(keyword => trimmed.includes(keyword));
        
        if (!isObject && !isFunction && containsCode) {
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