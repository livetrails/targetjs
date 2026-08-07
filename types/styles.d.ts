import type { AttributeTargetName } from "./attributes.js";

export type TransformTargetName =
  | "x"
  | "y"
  | "z"
  | "translateX"
  | "translateY"
  | "translateZ"
  | "perspective"
  | "rotate"
  | "rotateX"
  | "rotateY"
  | "rotateZ"
  | "rotate3DX"
  | "rotate3DY"
  | "rotate3DZ"
  | "rotate3DAngle"
  | "scale"
  | "scaleX"
  | "scaleY"
  | "scaleZ"
  | "scale3DX"
  | "scale3DY"
  | "scale3DZ"
  | "skew"
  | "skewX"
  | "skewY";

export type UnitStyleTargetName =
  | "width"
  | "height"
  | "fontSize"
  | "lineHeight"
  | "borderRadius"
  | "padding"
  | "paddingLeft"
  | "paddingRight"
  | "paddingTop"
  | "paddingBottom"
  | "left"
  | "top"
  | "right"
  | "bottom"
  | "wordSpacing"
  | "letterSpacing";

export type ColorStyleTargetName =
  | "color"
  | "backgroundColor"
  | "borderColor"
  | "background";

export type DirectStyleTargetName =
  | "dim"
  | "opacity"
  | "zIndex"
  | "border"
  | "borderTop"
  | "borderLeft"
  | "borderRight"
  | "borderBottom";

export type AsyncStyleTargetName =
  | "position"
  | "css"
  | "style"
  | "textAlign"
  | "boxSizing"
  | "transformStyle"
  | "transformOrigin"
  | "attributes"
  | "justifyContent"
  | "flexDirection"
  | "alignItems"
  | "display"
  | "cursor"
  | "fontFamily"
  | "overflow"
  | "overflowX"
  | "overflowY"
  | "textDecoration"
  | "boxShadow"
  | "fontWeight"
  | "willChange"
  | "backgroundImage"
  | "backgroundSize"
  | "flexWrap"
  | "userSelect"
  | "outline"
  | "backfaceVisibility"
  | "filter";

export type StyleTargetName =
  | TransformTargetName
  | UnitStyleTargetName
  | ColorStyleTargetName
  | DirectStyleTargetName
  | AsyncStyleTargetName;

export type StylableTargetName =
  | StyleTargetName
  | AttributeTargetName;