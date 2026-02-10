import { getEvents, getResizeLastUpdate } from "./App.js";
import { TUtil } from "./TUtil.js";
import { TargetUtil } from "./TargetUtil.js";

class TargetData {

    static defaultActualValues() {
        return {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            leftMargin: 0,
            rightMargin: 0,
            topMargin: 0,
            bottomMargin: 0,
            opacity: 1,
            scale: 1,
            scrollLeft: 0,
            scrollTop: 0,
            borderRadius: 0,
            children: [],
            isInFlow: true,
            element: 'div',
            canHaveDom: true,
            isIncluded: true,
            bracketThreshold: 40,
            bracketSize: 2,
            preventDefault: undefined,
            canDeleteDom: undefined
        };
    }

    static transformOrder = {
        perspective: 0,
        translateX: 1,
        translateY: 1,
        translateZ: 1,
        translate: 1,
        translate3d: 1,
        rotate: 2,
        rotateX: 2,
        rotateY: 2,
        rotateZ: 2,
        rotate3d: 2,
        skew: 3,
        skewX: 3,
        skewY: 3,
        scale: 4,
        scaleX: 4,
        scaleY: 4,
        scaleZ: 4,
        scale3DX: 4,
        scale3DY: 4,
        scale3DZ: 4
    };      

    static defaultTargetStyles = {
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 1
    };

    static transformMap = {
        x: true,
        y: true,
        z: true,
        translateX: true,
        translateY: true,
        translateZ: true,
        perspective: true,
        rotate: true,
        rotateX: true,
        rotateY: true,
        rotateZ: true,
        rotate3DX: true,
        rotate3DY: true,
        rotate3DZ: true,
        rotate3DAngle: true,
        scale: true,
        scaleX: true,
        scaleY: true,
        scaleZ: true,
        scale3DX: true,
        scale3DY: true,
        scale3DZ: true,
        skew: true,
        skewX: true,
        skewY: true
    };

    static dimMap = {
        width: true,
        height: true,
        dim: true
    };

    static styleWithUnitMap = {
        width: true,
        height: true,
        fontSize: true,
        lineHeight: true,
        borderRadius: true,
        padding: true,
        paddingLeft: true,
        paddingRight: true,
        paddingTop: true,
        paddingBottom: true,
        left: true,
        top: true,
        right: true,
        bottom: true,
        wordSpacing: true,
        letterSpacing: true
    }

    static colorMap = {
        color: true,
        backgroundColor: true,
        borderColor: true,
        background: true        
    };
    
    static styleTargetMap = {
        ...TargetData.transformMap,
        ...TargetData.styleWithUnitMap,
        ...TargetData.colorMap,
        dim: true,
        color: true,
        opacity: true,       
        zIndex: true,
        border: true,
        borderTop: true,
        borderLeft: true,
        borderRight: true,
        borderBottom: true
    };
    
    static gpuTargetMap = {
        ...TargetData.transformMap,
        color: true,
        backgroundColor: true,
        borderColor: true,      
        opacity: true,
        width: true,
        height: true
    }

    static asyncStyleTargetMap = {
        position: true,
        css: true,
        style: true,
        textAlign: true,
        boxSizing: true,
        transformStyle: true,
        transformOrigin: true,
        attributes: true,
        justifyContent: true,
        flexDirection: true,
        alignItems: true,
        display: true,
        cursor: true,
        fontFamily: true,
        overflow: true,
        overflowX: true,
        overflowY: true,
        textDecoration: true,
        boxShadow: true,
        fontWeight: true,
        willChange: true,
        backgroundImage: true,
        backgroundSize: true,
        flexWrap: true,
        userSelect: true,
        outline: true,
        backfaceVisibility: true,
        filter: true
    };

    static scaleMap = {
        scale: true,
        scaleX: true,
        scaleY: true,
        scaleZ: true,
        scale3DX: true,
        scale3DY: true,
        scale3DZ: true
    };

    static rotate3D = {
        rotate3DX: true,
        rotate3DY: true,
        rotate3DZ: true
    };

    static attributeTargetMap = {
        lang: true,
        autoFocus: true,
        placeholder: true,
        autoComplete: true,
        name: true,
        type: true,
        src: true,
        href: true,
        method: true,
        size: true,
        value: true,
        maxLength: true,
        minLength: true,
        max: true,
        min: true,
        readonly: true,
        required: true,
        alt: true,
        disabled: true,
        action: true,
        accept: true,
        selected: true,
        rows: true,
        cols: true,
        tabIndex: true,
        role: true,
        ariaLabel: true,
        ariaCurrent: true,
        ariaPressed: true
    };

    static mustExecuteTargets = {
        width: true,
        height: true,
        heightFromDom: true,
        widthFromDom: true,
        fetch: true,
        fetchImage: true
    };

    static ignoreRerun = {
        isVisible: true
    };

    static ignoreTargetMethodNameMap = {
        isVisible: true
    };

    static cssFunctionMap = {
        skew: { x: 0, y: 0 },
        translate3d: { x: 0, y: 0, z: 0 },
        rotate3d: { x: 0, y: 0, z: 0, a: 0 },
        scale3d: { x: 0, y: 0, z: 0 }
    };

    static bypassInitialProcessingTargetMap = {
        onChildrenChange: true,
        onVisibleChildrenChange: true,
        onPageClose: true
    };

    static controlTargetMap = {
        defaultStyling: true,
        styling: true,
        reuseDomDefinition: true,
        useWindowFrame: true,
        canDeleteDom: true,
        onDomEvent: true,
        canHaveDom: true
    };

    static events = {
        mouseStart: {
            pointerdown: { eventName: 'mousedown', inputType: 'pointer', eventType: 'start', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mousedown: { eventName: 'mousedown', inputType: 'mouse', eventType: 'start', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        mouseEnd: {
            pointerup: { eventName: 'mouseup', inputType: 'pointer', eventType: 'end', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mouseup: { eventName: 'mouseup', inputType: 'mouse', eventType: 'end', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        clickEvents: {
            click: { eventName: 'click', inputType: 'mouse', eventType: 'click', order: 1, windowEvent: false, queue: false, rateLimit: 0 }
        },

        touchStart: {
            touchstart: { eventName: 'touchstart', inputType: 'touch', eventType: 'start', order: 1, windowEvent: false, queue: true, rateLimit: 0 }
        },

        touchEnd: {
            touchend: { eventName: 'touchend', inputType: 'touch', eventType: 'end', order: 1, windowEvent: false, queue: true, rateLimit: 0 }
        },

        cancelEvents: {
            touchcancel: { eventName: 'touchend', inputType: 'touch', eventType: 'cancel', order: 1, windowEvent: false, queue: true, rateLimit: 0 },
            pointercancel: { eventName: 'mousecancel', inputType: 'pointer', eventType: 'cancel', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mousecancel: { eventName: 'mouseup', inputType: 'mouse', eventType: 'cancel', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        windowEvents: {
            keyup: { eventName: 'key', inputType: '', eventType: 'key', order: 1, windowEvent: true, queue: true, rateLimit: 50 },
            keydown: { eventName: 'keydown', inputType: '', eventType: 'keydown', order: 1, windowEvent: true, queue: true, rateLimit: 50 },            
            blur: { eventName: 'blur', inputType: 'mouse', eventType: 'cancel', order: 2, windowEvent: true, queue: true, rateLimit: 0 },
            resize: { eventName: 'resize', inputType: '', eventType: 'resize', order: 1, windowEvent: true, queue: true, rateLimit: 50 },
            orientationchange: { eventName: 'resize', inputType: '', eventType: 'resize', order: 1, windowEvent: true, queue: true, rateLimit: 50 },
            scroll: {eventName: 'scroll', inputType: '', eventType: 'scroll', order: 1, windowEvent: true, queue: true, rateLimit: 50}            
        },
        
        containerScroll: {
            scroll: {eventName: 'scroll', inputType: '', eventType: 'scroll', order: 1, windowEvent: false, queue: true, rateLimit: 50}
        },
        
        inputEvents: {
            input: { eventName: 'input',  inputType: '', eventType: 'input',  order: 1, windowEvent: false, queue: true,  rateLimit: 50 }
        },

        changeEvents: {
            change: { eventName: 'change', inputType: '', eventType: 'change', order: 1, windowEvent: false, queue: true,  rateLimit: 0 }
        },
        
        submitEvents: {
            submit: { eventName:'submit', inputType:'form', eventType:'submit', order:1, windowEvent:false, queue:true, rateLimit:0 }
        },
        
        popState: {
            popstate: { eventName: 'popstate', inputType: '', eventType: 'popstate', order: 1, windowEvent: true, queue: true, rateLimit: 0 }
        },

        leaveEvents: {
          pointerleave: { eventName: 'mouseleave', inputType: 'pointer', eventType: 'leave', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
          mouseleave:   { eventName: 'mouseleave', inputType: 'mouse',   eventType: 'leave', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        enterEvents: {
          pointerenter: { eventName: 'mouseenter', inputType: 'pointer', eventType: 'enter', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
          mouseenter:   { eventName: 'mouseenter', inputType: 'mouse',   eventType: 'enter', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        moveEvents: {
            touchmove: {eventName: 'touchmove', inputType: 'touch', eventType: 'move', order: 1, windowEvent: false, queue: true, rateLimit: 50},
            pointermove: {eventName: 'mousemove', inputType: 'pointer', eventType: 'move', order: 2, windowEvent: false, queue: true, rateLimit: 50},
            mousemove: {eventName: 'mousemove', inputType: 'mouse', eventType: 'move', order: 3, windowEvent: false, queue: true, rateLimit: 50}
        },

        documentEvents: {
            touchmove: {eventName: 'touchmove', inputType: 'touch', eventType: 'move', order: 1, windowEvent: false, queue: true, rateLimit: 50},
            pointermove: {eventName: 'mousemove', inputType: 'pointer', eventType: 'move', order: 2, windowEvent: false, queue: true, rateLimit: 50},
            mousemove: {eventName: 'mousemove', inputType: 'mouse', eventType: 'move', order: 3, windowEvent: false, queue: true, rateLimit: 50},
            mouseleave: {eventName: 'mouseleave', inputType: 'mouse', eventType: 'leave', order: 3, windowEvent: false, queue: true, rateLimit: 50},
            pointerup: {eventName: 'mouseup', inputType: 'pointer', eventType: 'end', order: 2, windowEvent: false, queue: true, rateLimit: 0},
            mouseup: {eventName: 'mouseup', inputType: 'mouse', eventType: 'end', order: 3, windowEvent: false, queue: true, rateLimit: 0},
            touchend: {eventName: 'touchend', inputType: 'touch', eventType: 'end', order: 1, windowEvent: false, queue: true, rateLimit: 0}
        },

        wheelEvents: {
            wheel: {eventName: 'wheel', inputType: '', eventType: 'wheel', order: 1, windowEvent: false, queue: true, rateLimit: 50},
            mousewheel: {eventName: 'wheel', inputType: '', eventType: 'wheel', order: 1, windowEvent: false, queue: true, rateLimit: 50}
        }
    };

    static attributesToTargets = {
        onstart: 'onStart',
        onend: 'onEnd',
        onkey: 'onKey',
        onkeydown: 'onKeyDown',
        onanykey: 'onAnyKey',
        onclick: 'onClick',
        onanyclick: 'onAnyClick',
        onhover: 'onHover',
        onswipe: 'onSwipe',
        onanyswipe: 'onAnySwipe',
        onpinch: 'onPinch',
        onenter: 'onEnter',
        onleave: 'onLeave',
        onblur: 'onBlur',
        onfocus: 'onFocus',
        onscroll: 'onScroll',
        onscrollleft: 'onScrollLeft',
        onscrolltop: 'onScrollTop',
        onwindowscroll: 'onWindowScroll',
        onpopstate: 'onPopState',
        onchange: 'onChange',
        oninput: 'onInput',
        onsubmit: 'onSubmit',
        onvisible: 'onVisible',
        onresize: 'onResize',
        textalign: 'textAlign',
        preventdefault: 'preventDefault',
        translatex: 'translateX',
        translatey: 'translateY',
        translatez: 'translateZ',
        rotate3dx: 'rotate3DX',
        rotate3dy: 'rotate3DY',
        rotate3dz: 'rotate3DZ',
        rotate3dangle: 'rotate3DAngle',
        scale3dx: 'scale3DX',
        scale3dy: 'scale3DY',
        scale3dz: 'scale3DZ',
        skewx: 'skewX',
        skewy: 'skewY',
        lineheight: 'lineHeight',
        fontsize: 'fontSize',
        borderradius: 'borderRadius',
        letterspacing: 'letterSpacing',
        backgroundcolor: 'backgroundColor',
        backgroundimage: 'backgroundImage',
        backgroundsize: 'backgroundSize',
        bordertop: 'borderTop',
        borderleft: 'borderLeft',
        borderright: 'borderRight',
        borderbottom: 'borderBottom',
        boxsizing: 'boxSizing',
        transformstyle: 'transformStyle',
        transformorigin: 'transformOrigin',
        justifycontent: 'justifyContent',
        flexdirection: 'flexDirection',
        flexwrap: 'flexWrap',
        alignitems: 'alignItems',
        fontfamily: 'fontFamily',
        overflowx: 'overflowX',
        overflowy: 'overflowY',
        textdecoration: 'textDecoration',
        boxshadow: 'boxShadow',
        fontweight: 'fontWeight',
        willchange: 'willChange',
        domholder: 'domHolder',
        shouldcalculatechildtargets: 'shouldCalculateChildTargets',
        domparent: 'domParent',
        containeroverflowmode: 'containerOverflowMode',
        itemoverflowmode: 'itemOverflowMode',
        onvisiblechildrenchange: 'onVisibleChildrenChange',
        onchildrenchange: 'onChildrenChange',
        isvisible: 'isVisible',
        isinflow: 'isInFlow',
        basewidth: 'baseWidth',
        baseheight: 'baseHeight',
        paddingleft: 'paddingLeft',
        paddingright: 'paddingRight',
        paddingtop: 'paddingTop',
        paddingbottom: 'paddingBottom',
        userselect: 'userSelect',
        arialabel: 'ariaLabel',
        ariacurrent: 'ariaCurrent',
        ariapressed: 'ariaPressed',
        tabindex: 'tabIndex',
        backfacevisibility: 'backfaceVisibility'
    };

    static targetToEventsMapping = {
        onStart: ['touchStart', 'mouseStart'],
        onEnd: [],
        onKey: [],
        onKeyDown: [],
        onAnyKey: [],
        onBlur: [],
        onFocus: [],
        onClick: ['clickEvents', 'touchStart', 'mouseStart'],
        onAnyClick: ['clickEvents', 'touchStart', 'mouseStart'],
        onHover: ['moveEvents'],
        onSwipe: ['touchStart', 'mouseStart'],
        onAnySwipe: ['touchStart', 'mouseStart'],
        onPinch: ['touchStart'],
        onEnter: ['enterEvents'],
        onLeave: ['leaveEvents'],
        onScroll: ['touchStart', 'mouseStart', 'wheelEvents'],
        onScrollLeft: ['touchStart', 'mouseStart', 'wheelEvents'],
        onScrollTop: ['touchStart', 'mouseStart', 'wheelEvents'],
        onWindowScroll: ['containerScroll'],
        onPopState: ['popState'],
        onChange: ['changeEvents'],
        onInput: ['inputEvents'],
        onSubmit: ['submitEvents']
    };

    static internalEventMap = {
        onDomEvent: tmodel => tmodel.hasDomNow,
        onVisible: tmodel => tmodel.isNowVisible,
        onResize: tmodel => {
            const lastUpdate = tmodel.getDimLastUpdate();
            if (!lastUpdate) {
                return false;
            }
            const parent = tmodel.getParent();
            const resizeLast = getResizeLastUpdate();
            const parentLast = parent ? parent.getDimLastUpdate() : 0;
            const resizeLastUpdate = parentLast > resizeLast ? parentLast : resizeLast;
            return resizeLastUpdate > lastUpdate;            
        }
    };

    static allEventMap = {
        onStart: tmodel => getEvents().isStartHandler(tmodel),
        onEnd: tmodel => getEvents().isEndHandler(tmodel),
        onAnySwipe: () => getEvents().isSwipeEvent() && TUtil.isDefined(getEvents().swipeStartX),
        onHover: tmodel => getEvents().isMoveEvent() && getEvents().isHoverHandler(tmodel),

        onClick: tmodel => getEvents().isClickEvent() && getEvents().isClickHandler(tmodel),
        onAnyClick: () => getEvents().isClickEvent(),
        onEnter: tmodel => getEvents().isEnterHandler(tmodel),
        onLeave: tmodel => getEvents().isLeaveHandler(tmodel),
        onSwipe: tmodel => getEvents().isSwipeHandler(tmodel) && getEvents().isSwipeEvent() && TUtil.isDefined(getEvents().swipeStartX),
        
        onFocus: tmodel => getEvents().onFocus(tmodel),
        onBlur: tmodel => getEvents().onBlur(tmodel),
        onPinch: tmodel => getEvents().isPinchHandler(tmodel),
        onKey: tmodel => getEvents().getEventType() === 'key' && getEvents().currentKey && getEvents().currentHandlers.focus === tmodel && getEvents().currentHandlers.justFocused !== tmodel,
        onKeyDown: tmodel => getEvents().getEventType() === 'keydown' && getEvents().currentKey && getEvents().currentHandlers.focus === tmodel && getEvents().currentHandlers.justFocused !== tmodel,
        onAnyKey: () => getEvents().getEventType() === 'key' && getEvents().currentKey,
        onScroll: tmodel => (getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX()) || (getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY()),
        onScrollTop: tmodel => getEvents().getOrientation() !== 'horizontal' && getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY(),
        onScrollLeft: tmodel => getEvents().getOrientation() !== 'vertical' && getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX(),
        onWindowScroll: () => getEvents().getEventType() === 'scroll',
        onPopState: () => getEvents().getEventType() === 'popstate',
        onChange: tmodel => getEvents().getEventType() === 'change' && getEvents().isFormHandler(tmodel),
        onInput: tmodel => getEvents().getEventType() === 'input' &&  getEvents().isFormHandler(tmodel),
        onSubmit: () => getEvents().getEventType() === 'submit'
    };


    static excludedTargetKeys = new Set([
            'originalTargetName',
            'originalTModel',
            'activateNextTarget',
            'invokerTarget',
            'invokerTModel',
            'active',
            'addChildAction',
            'childAction',
            'fetchAction'
    ]);

    static lifecycleCallbackSet = new Set([
        'onComplete', 'onValueChange', 'onImperativeEnd', 'onImperativeStep', 'onStepsEnd',
        'onSuccess', 'onError'
    ]);
    
    static lifecycleCoreSet = new Set([
        'value', 'steps', 'cycles', 'enabledOn', 'loop', 'interval'
    ]);    
    
    static lifecycleMethodSet = new Set([
        ...TargetData.lifecycleCallbackSet,        
        ...TargetData.lifecycleCoreSet       
    ]);    

    static lifecyclePatterns = {
        step: /^on[A-Za-z]+Step$/,
        end: /^on[A-Za-z]+End$/
    };
    
    static eventSet = new Set([
        ...Object.keys(TargetData.allEventMap),
        ...Object.keys(TargetData.internalEventMap),
    ]);

    static styleSet = new Set([
        ...Object.keys(TargetData.styleTargetMap),
        ...Object.keys(TargetData.asyncStyleTargetMap),
        ...Object.keys(TargetData.attributeTargetMap)
    ]);

    static reservedKeywordSet = new Set([
        ...TargetData.styleSet,
        ...Object.keys(TargetData.defaultActualValues()),
        ...Object.keys(TargetData.allEventMap),
        ...Object.keys(TargetData.internalEventMap),        
        'html', 'isInFlow', 'domHolder', 'domParent', 'gap', 'widthFromDom', 'heightFromDom',
        'requiresDom', 'preventDefault', 'canDeleteDom', 'textOnly', 'styling', '$dom',
        'defaultStyling', 'reuseDomDefinition', 'canHaveDom', 'excludeXYCalc', 'excludeX', 'excludeY',
        'containerOverflowMode', 'itemOverflowMode', 'baseElement', 'element', 'otype',
        'calculateChildren','domIsland', 'bracketThreshold', 'bracketSize', 'sourceDom'
    ]);
    
    static activationKeywordSet = new Set([
        'originalTModel', 'originalTargetName', 'activateNextTarget'
    ]);

    static toCanonicalKey(key) {
        const k = String(key);
        const lb = k.toLowerCase();
        return TargetData.attributesToTargets[lb] ?? k;
    }

    static isLifeCycleMethod(name) {
        return TargetData.lifecycleMethodSet.has(name) ||
                TargetData.lifecyclePatterns.step.test(name) ||
                TargetData.lifecyclePatterns.end.test(name);
    }  
    
    static isGpuPreferred(key) {
        return !!TargetData.gpuTargetMap[TargetUtil.getTargetName(key)];
    }
    
    static isTransformKey(key) {
        return !!TargetData.transformMap[key];
    }
}

export { TargetData };
