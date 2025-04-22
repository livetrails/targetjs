import { TUtil } from "./TUtil.js";
import { tApp } from "./App.js";

/**
 * It provides search functions to find an object by a specific target, type, or oid
 */
class SearchUtil {
    static foundParentWithType = {};
    static foundParentWithTarget = {};
    static foundTypeMap = {};
    static foundTargetMap = {};
    static foundOids = {};
    static foundHandler = {};
    
    static clear() {
        SearchUtil.foundParentWithType = {};
        SearchUtil.foundParentWithTarget = {};
        SearchUtil.foundTypeMap = {};
        SearchUtil.foundTargetMap = {};
        SearchUtil.foundOids = {};
        SearchUtil.foundHandler = {};        
    }

    static findFirstScrollHandler(tmodel, name, eventType) {
        if (!tmodel) {
            return;
        }
        
        const handlerKey = `${tmodel.oid} ${name} ${eventType}`;
        
        if (SearchUtil.foundHandler[handlerKey]) {
            return SearchUtil.foundHandler[handlerKey];
        }

        const handler = this.findScrollHandler(tmodel, eventType, name);
            
        if (handler) {
            SearchUtil.foundHandler[handlerKey] = handler;
        }
       
        return handler;
    }
    
    static findFirstHandler(tmodel, name) {
        if (!tmodel) {
            return;
        }        
        const handlerKey = `${tmodel.oid} ${name}`;
        
        if (SearchUtil.foundHandler[handlerKey]) {
            return SearchUtil.foundHandler[handlerKey];
        }

        const handler = this.findEventHandler(tmodel, name);
            
        if (handler) {
            SearchUtil.foundHandler[handlerKey] = handler;
        }
       
        return handler;
    }
    
    static findFirstScrollTopHandler(tmodel, eventType) {
        return this.findFirstScrollHandler(tmodel, 'onScrollTop', eventType);
    }

    static findFirstScrollLeftHandler(tmodel, eventType) {
        return this.findFirstScrollHandler(tmodel, 'onScrollLeft', eventType);
    }

    static findFirstPinchHandler(tmodel) {
        return this.findFirstHandler(tmodel, 'onPinch');
    }
    
    static findFirstSwipeHandler(tmodel) {
        return this.findFirstHandler(tmodel, 'onSwipe');
    }

    static findFirstEnterHandler(tmodel) {
        return this.findFirstHandler(tmodel, 'onEnter');
    }
    
    static findFirstLeaveHandler(tmodel) {
        return this.findFirstHandler(tmodel, 'onLeave');
    }
    
    static findFirstClickHandler(tmodel) {
        return this.findFirstHandler(tmodel, 'onClick') || this.findFirstHandler(tmodel, 'onAnyClick');
    }

    static findScrollHandler(tmodel, eventType, name) {
        while (tmodel) {
            if (tmodel.canHandleEvent('onSwipe') && eventType !== 'wheel') {
                break;
            }
            if (tmodel.canHandleEvent(name) || tmodel.canHandleEvent('onScroll')) {
                return tmodel;
            }
            tmodel = tmodel.getParent();
        }
    }

    static findEventHandler(tmodel, name) {
        while (tmodel) {
            if (tmodel.canHandleEvent(name)) {
                return tmodel;
            }
            tmodel = tmodel.getParent();
        }
    }

    static findParentByType(child, type) {
        const indexKey = `${child.oid}__${type}`;

        if (!TUtil.isDefined(SearchUtil.foundParentWithType[indexKey])) {
            let parent = child.getParent();
            while (parent) {
                if (parent.type === type) {
                    SearchUtil.foundParentWithType[indexKey] = parent;
                    break;
                }
                parent = parent.getParent();
            }
        }

        return SearchUtil.foundParentWithType[indexKey];
    }

    static findParentByTarget(child, targetName) {
        const indexKey = `${child.oid}__${targetName}`;

        if (!TUtil.isDefined(SearchUtil.foundParentWithTarget[indexKey])) {
            let parent = child.getParent();
            while (parent) {
                if (TUtil.isDefined(parent.targets[targetName]) || TUtil.isDefined(parent.targetValues[targetName])) {
                    SearchUtil.foundParentWithTarget[indexKey] = parent;
                    break;
                }
                parent = parent.getParent();
            }
        }

        return SearchUtil.foundParentWithTarget[indexKey];
    }

    static findByType(type) {
        if (!TUtil.isDefined(SearchUtil.foundTypeMap[type])) {
            const search = (container) => {
                if (container.type === type) {
                    return container;
                }

                for (const child of container.getChildren()) {
                    if (child && child.hasChildren()) {
                        const found = search(child);
                        if (found) {
                            return found;
                        }
                    } else if (child && child.type === type) {
                        return child;
                    }
                }
            };

            const tmodel = search(tApp.tRoot);
            if (tmodel) {
                SearchUtil.foundTypeMap[type] = tmodel;
            }
        }

        return SearchUtil.foundTypeMap[type];
    }

    static findByTarget(target) {
        if (!TUtil.isDefined(SearchUtil.foundTargetMap[target])) {
            const search = (container) => {
                if (container.targets[target]) {
                    return container;
                }

                for (const child of container.getChildren()) {
                    if (child && child.hasChildren()) {
                        const found = search(child);
                        if (found) {
                            return found;
                        }
                    } else if (child && child.targets[target]) {
                        return child;
                    }
                }
            };

            const tmodel = search(tApp.tRoot);
            if (tmodel) {
                SearchUtil.foundTargetMap[target] = tmodel;
            }
        }

        return SearchUtil.foundTargetMap[target];
    }

    static find(oid) {
        if (!TUtil.isDefined(SearchUtil.foundOids[oid])) {
            const search = (container) => {
                if (container.oid === oid) {
                    return container;
                }

                for (const child of container.getChildren()) {
                    if (child && child.hasChildren()) {
                        const found = search(child);
                        if (found) {
                            return found;
                        }
                    } else if (child && child.oid === oid) {
                        return child;
                    }
                }
            };

            const tmodel = search(tApp.tRoot);
            if (tmodel) {
                SearchUtil.foundOids[oid] = tmodel;
            }
        }

        return SearchUtil.foundOids[oid];
    }
}

export { SearchUtil };
