import { getEvents, getResizeLastUpdate } from "./App.js";

class TargetData {
    
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
        height: true
    };
    
    static styleWithUnitMap = {
        fontSize: true,
        lineHeight: true,
        borderRadius: true,
        padding: true,
        left: true,
        top: true,
        letterSpacing: true
    }

    static colorMap = {
        color: true,
        background: true,
        backgroundColor: true
    };
    
    static styleTargetMap = {
        ...TargetData.transformMap,
        ...TargetData.dimMap,
        ...TargetData.styleWithUnitMap,
        ...TargetData.colorMap,
        opacity: true,
        zIndex: true,
        border: true,
        borderTop: true,
        borderLeft: true,
        borderRight: true,
        borderBottom: true
    };
    
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
        alignItems: true, 
        display: true, 
        cursor: true, 
        fontFamily: true, 
        overflow: true,
        textDecoration: true, 
        boxShadow: true, 
        fontWeight: true
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
        autofocus: true, 
        placeholder: true, 
        autocomplete: true, 
        name: true,
        type: true, 
        src: true, 
        href: true, 
        method: true, 
        size: true, 
        value: true,
        maxlength: true, 
        minlength: true, 
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
        tabindex: true
    };

    static mustExecuteTargets = {
        width: true, 
        height: true, 
        canHandleEvents: true, 
        heightFromDom: true, 
        widthFromDom: true
    };

    static coreTargetMap = { 
        x: true, 
        y: true 
    };
    
    static ignoreTargetMethodNameMap = {
        ...TargetData.coreTargetMap,
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
        domHolder: true,
        interval: true,
        onDomEvent: true,
        canHaveDom: true
    };

    static targetToEventsMapping = {
        onClickEvent: [ 'clickEvents', 'touchStart', 'touchEnd', 'startEvents' ],
        onTouchStart: [ 'touchStart', 'startEvents' ],
        onTouchEnd: [ 'touchEnd', 'endEvents' ],
        onSwipeEvent: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents' ],
        onAnySwipeEvent: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents' ],
        onTouchEvent: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents' ],
        onEnterEvent: [ 'moveEvents', 'leaveEvents' ],
        onLeaveEvent: [ 'moveEvents', 'leaveEvents' ],
        onScrollEvent: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents', 'wheelEvents' ],
        onWindowScrollEvent: [ 'windowScrollEvents' ],

        onClick: [ 'clickEvents', 'touchStart', 'touchEnd', 'startEvents' ],
        onSwipe: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents' ],
        onAnySwipe: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents' ],
        onTouch: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents' ],
        onEnter: [ 'moveEvents', 'leaveEvents' ],
        onLeave: [ 'moveEvents', 'leaveEvents' ],
        onScroll: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents', 'wheelEvents' ],
        onScrollLeft: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents', 'wheelEvents' ],
        onScrollTop: [ 'touchStart', 'startEvents', 'touchEnd', 'endEvents', 'cancelEvents', 'moveEvents', 'wheelEvents' ],        
        onWindowScroll: [ 'windowScrollEvents' ]
    };

    static touchEventMap = {
        onClickEvent: tmodel => getEvents().getEventType() === 'click' && getEvents().isClickHandler(tmodel),
        onTouchStart: tmodel => getEvents().isStartEvent() && getEvents().containsTouchHandler(tmodel),
        onTouchEnd: tmodel => getEvents().isEndEvent() && getEvents().containsTouchHandler(tmodel),
        onEnterEvent: tmodel => getEvents().isEnterEventHandler(tmodel),
        onLeaveEvent: tmodel => getEvents().isLeaveEventHandler(tmodel),        
        onSwipeEvent: tmodel => getEvents().containsTouchHandler(tmodel) && getEvents().isSwipeEvent(),        
        onAnySwipeEvent: () => getEvents().isSwipeEvent(),
        onTouchEvent: tmodel => getEvents().isTouchHandler(tmodel),

        onClick: tmodel => getEvents().getEventType() === 'click' && getEvents().isClickHandler(tmodel),
        onEnter: tmodel => getEvents().isEnterEventHandler(tmodel),
        onLeave: tmodel => getEvents().isLeaveEventHandler(tmodel),        
        onSwipe: tmodel => getEvents().containsTouchHandler(tmodel) && getEvents().isSwipeEvent(),        
        onAnySwipe: () => getEvents().isSwipeEvent(),
        onTouch: tmodel => getEvents().isTouchHandler(tmodel)
    };

    static internalEventMap = {
        onVisibleEvent: tmodel => tmodel.isNowVisible,
        onDomEvent: tmodel => tmodel.hasDomNow,
        onVisible: tmodel => tmodel.isNowVisible,
        onResize: tmodel => {            
            const lastUpdate = tmodel.getDimLastUpdate();
            const parent = tmodel.getParent();
            const resizeLastUpdate = parent ? Math.max(parent.getDimLastUpdate(), getResizeLastUpdate()) : getResizeLastUpdate();
            return lastUpdate > 0 && resizeLastUpdate > lastUpdate;
        }       
    };

    static allEventMap = {
        ...TargetData.touchEventMap,
        onFocusEvent: tmodel => getEvents().onFocus(tmodel),
        onBlurEvent: tmodel => getEvents().onBlur(tmodel),
        onKeyEvent: () => getEvents().getEventType() === 'key' && getEvents().currentKey, 
        onScrollEvent: tmodel => (getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX()) || 
              (getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY()),    
        onWindowScrollEvent: () => getEvents().getEventType() === 'windowScroll',

        onFocus: tmodel => getEvents().onFocus(tmodel),
        onBlur: tmodel => getEvents().onBlur(tmodel),
        onKey: () => getEvents().getEventType() === 'key' && getEvents().currentKey, 
        onScroll: tmodel => (getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX()) || 
              (getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY()),
        onScrollTop: tmodel => getEvents().getOrientation() !== 'horizontal' && getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY(), 
        onScrollLeft: tmodel => getEvents().getOrientation() !== 'vertical' && getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX(),
        onWindowScroll: () => getEvents().getEventType() === 'windowScroll'        
    };
}

export { TargetData };
