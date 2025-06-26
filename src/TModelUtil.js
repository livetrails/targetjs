import { TUtil } from "./TUtil.js";
import { TargetData } from "./TargetData.js";
import { getRunScheduler, getManager } from "./App.js";
import { $Dom } from "./$Dom.js";
import { ColorUtil } from "./ColorUtil.js";

/**
 * It provides helper functions for TModel.
 */
class TModelUtil {    
   
    static shouldMeasureHeightFromDom(tmodel) {
        return (!tmodel.excludeDefaultStyling() && !TUtil.isDefined(tmodel.targetValues.height) && !TModelUtil.isHeightDefined(tmodel) && !tmodel.hasChildren()) 
            || !!tmodel.getTargetValue('heightFromDom');   
    }
    
    static shouldMeasureWidthFromDom(tmodel) {
        return (!tmodel.excludeDefaultStyling() && !tmodel.reuseDomDefinition() && !TUtil.isDefined(tmodel.targetValues.width) && !TModelUtil.isWidthDefined(tmodel) && !tmodel.hasChildren()) 
            || !!tmodel.getTargetValue('widthFromDom');   
    } 
    
    static isHeightDefined(tmodel) {
        return TUtil.isDefined(tmodel.targets.height) || TUtil.isDefined(tmodel.targets.style?.height);
    }
    
    static isWidthDefined(tmodel) {
        return TUtil.isDefined(tmodel.targets.width) || TUtil.isDefined(tmodel.targets.style?.width);
    }      

    static createDom(tmodel) {
        tmodel.$dom = new $Dom();
        tmodel.$dom.create(tmodel.getBaseElement());
        TModelUtil.patchDom(tmodel);
    }
    
    static patchDom(tmodel) {
        tmodel.$dom.setSelector(`#${tmodel.oid}`);
        tmodel.$dom.setId(tmodel.oid);
        tmodel.$dom.attr('tgjs', 'true');
        tmodel.isTextOnly() ? tmodel.$dom.text(tmodel.getHtml()) : tmodel.$dom.html(tmodel.getHtml());
        tmodel.setActualValueLastUpdate('html');
        tmodel.domHeightTimestamp = 0;
        tmodel.domWidthTimestamp = 0;        
        tmodel.transformMap = {};
        tmodel.styleMap = {};
        tmodel.allStyleTargetList.forEach(function(key) {
            if (TUtil.isDefined(tmodel.val(key))) {
                tmodel.addToStyleTargetList(key);
            }
        });
        TModelUtil.fixStyle(tmodel);
        TModelUtil.fixAsyncStyle(tmodel);
    }
    
    static getTransformValue(tmodel, key) {
        let value;
        
        if (key === 'x') {
            value = tmodel.getTransformX();
        } else if (key === 'y') {
            value = tmodel.getTransformY();
        } else if (TargetData.transformMap[key]) {
            value = TargetData.rotate3D[key]
                ? tmodel.val(key)
                : TargetData.scaleMap[key]
                ? TUtil.formatNum(tmodel.val(key), 2)
                : tmodel.floorVal(key);
        }
        
        return value;
    }

    static fixStyle(tmodel) {        
        let transformUpdate = false;
        tmodel.styleTargetList.forEach(key => {          
            if (TargetData.transformMap[key]) {
                const value = TModelUtil.getTransformValue(tmodel, key);
                if (tmodel.transformMap[key] !== value) {
                    tmodel.transformMap[key] = value;
                    transformUpdate = true;
                }          
            } else if (key === 'width') {
                const width = Math.floor(tmodel.getWidth());

                if (tmodel.$dom.getStyleValue('width') !== width) {
                    tmodel.styleMap['width'] = width; 
                    tmodel.$dom.width(width); 
                }            
            } else if (key === 'height') {
                const height = Math.floor(tmodel.getHeight());

                if (tmodel.$dom.getStyleValue('height') !== height) {
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
        });
                
        if (transformUpdate) {
            tmodel.$dom.transform(TModelUtil.getTransformString(tmodel));
        }

        tmodel.state().styleTargetMap = {};
        tmodel.state().styleTargetList = [];
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
            const width = child.$dom.width();
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
    
    static morph(tmodel, key, fromValue, toValue, step) {
        const easing = tmodel.getTargetEasing(key);
        const easingStep = easing ? easing(tmodel.getTargetStepPercent(key, step)) : tmodel.getTargetStepPercent(key, step);

        if (TargetData.colorMap[key]) {
            const targetColors = ColorUtil.color2Integers(toValue);
            const lastColors = fromValue ? ColorUtil.color2Integers(fromValue) : ColorUtil.color2Integers('#fff');

            if (targetColors && lastColors) {
                const red = Math.floor(targetColors[0] * easingStep + lastColors[0] * (1 - easingStep));
                const green = Math.floor(targetColors[1] * easingStep + lastColors[1] * (1 - easingStep));
                const blue = Math.floor(targetColors[2] * easingStep + lastColors[2] * (1 - easingStep));

                return `rgb(${red},${green},${blue})`;
            } else {
                return toValue;
            }
        } else {
            return typeof toValue === 'number' ? toValue * easingStep + fromValue * (1 - easingStep) : toValue;
        }
    }    
    
    static fixAsyncStyle(tmodel) {
        tmodel.asyncStyleTargetList.forEach(key => { 
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
                    Object.keys(attributes).forEach(key => {
                        tmodel.$dom.attr(key, attributes[key]);
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
        });

        tmodel.state().asyncStyleTargetMap = {};
        tmodel.state().asyncStyleTargetList = [];
    }    
    
    static getTransformString(tmodel) {
        const processed = {};
       
        const transformMap = {};
        
        if (tmodel.transformMap['translateX'] || tmodel.transformMap['translateY'] || tmodel.transformMap['translateZ']) {
            delete tmodel.transformMap['x'];
            delete tmodel.transformMap['y'];            
        }
        
        let keys = Object.keys(tmodel.transformMap);
  
        for (const key of keys) {
            if (processed[key]) {
                continue;
            } 
                                                
            switch(key) {
                case 'translateX':
                case 'translateY':
                case 'translateZ':  
                    transformMap[key] = `${key}(${tmodel.transformMap[key]}px)`;                   
                    processed[key] = true;                       
                break;
                
                case 'x':
                case 'y':
                case 'z':
                    if (TUtil.isDefined(tmodel.getZ())) {
                       transformMap['translate3d'] = `translate3d(${tmodel.transformMap.x}px, ${tmodel.transformMap.y}px, ${tmodel.transformMap.z}px)`;
                    } else if (TUtil.isDefined(tmodel.getX()) || TUtil.isDefined(tmodel.getY())) {
                       transformMap['translate'] = `translate(${tmodel.transformMap.x}px, ${tmodel.transformMap.y}px)`;
                    }
                                        
                    processed['x'] = true;
                    processed['y'] = true;
                    processed['z'] = true;                    
                    break
                    
                case 'rotate':
                case 'rotateX':
                case 'rotateY':
                case 'rotateZ':
                case 'rotate3DX':
                case 'rotate3DY':
                case 'rotate3DZ':
                case 'rotate3DAngle':               
                    if (TUtil.isDefined(tmodel.val('rotate3DX')) && TUtil.isDefined(tmodel.val('rotate3DY'))
                            && TUtil.isDefined(tmodel.val('rotate3DZ')) && TUtil.isDefined(tmodel.val('rotate3DAngle'))) {

                        transformMap['rotate3d'] = `rotate3d(${tmodel.transformMap.rotate3DX}, ${tmodel.transformMap.rotate3DY}, ${tmodel.transformMap.rotate3DZ}, ${tmodel.transformMap.rotate3DAngle}deg)`;

                        processed['rotate3DX'] = true;
                        processed['rotate3DY'] = true;
                        processed['rotate3DZ'] = true;
                        processed['rotate3DAngle'] = true;                        
                    } else if (TUtil.isDefined(tmodel.val(key))) {
                        transformMap[key] = `${key}(${tmodel.transformMap[key]}deg)`;                   
                        processed[key] = true;                       
                    }
                   
                    break;
                   
                case 'scale':
                case 'scaleX':
                case 'scaleY':
                case 'scaleZ':
                case 'scale3DX':
                case 'scale3DY':
                case 'scale3DZ':
                    if (TUtil.isDefined(tmodel.val('scale3DX')) && TUtil.isDefined(tmodel.val('scale3DY')) && TUtil.isDefined(tmodel.val('scale3DZ'))) {  

                        transformMap['scale3d'] = `scale3d(${tmodel.transformMap.scale3DX}, ${tmodel.transformMap.scale3DY}, ${tmodel.transformMap.scale3DZ})`;
 
                        processed['scale3DX'] = true;
                        processed['scale3DY'] = true;
                        processed['scale3DZ'] = true;
                    } else if (TUtil.isDefined(tmodel.val(key))) {
                        transformMap[key] = `${key}(${tmodel.transformMap[key]})`;
                        
                        processed[key] = true;  
                    }                 
                    break;   
                
                case 'skewX':
                case 'skewY':
                    if (TUtil.isDefined(tmodel.val('skewX')) && TUtil.isDefined(tmodel.val('skewY'))) {

                        transformMap[key] = `skew(${tmodel.transformMap.skewX}deg, ${tmodel.transformMap.skewY}deg)`;
                        
                        processed['skewX'] = true;
                        processed['skewY'] = true;
                        
                    } else if (TUtil.isDefined(tmodel.val(key))) {
                        
                        transformMap[key] = `${key}(${tmodel.transformMap[key]}deg)`;
                          
                        processed[key] = true;                        
                    }
                   
                    break;  
                
                case 'perspective':
                    if (TUtil.isDefined(tmodel.val('perspective'))) {
                        
                        transformMap[key] = `perspective(${tmodel.transformMap.perspective}px)`;
                        
                        processed['perspective'] = true;
                    }
                    break;                
            }
        }
        
        let transformOrder = {};
        
        if (tmodel.val('transformOrder')) {
            tmodel.val('transformOrder').forEach((name, index) => {
                transformOrder[name] = index;
            });
        } else {
            transformOrder = TargetData.transformOrder;
        }
 
        const sortedKeys = Object.keys(transformMap).sort((a, b) => {
            return transformOrder[a] - transformOrder[b];
        });

        const sortedTransforms = sortedKeys.map(key => transformMap[key]);

        return sortedTransforms.join(' ');        
    };
}

export { TModelUtil };

