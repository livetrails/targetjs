export type AttributeTargetName =
  | "lang"
  | "autoFocus"
  | "placeholder"
  | "autoComplete"
  | "name"
  | "type"
  | "src"
  | "href"
  | "method"
  | "size"
  | "value"
  | "maxLength"
  | "minLength"
  | "max"
  | "min"
  | "readOnly"
  | "required"
  | "alt"
  | "disabled"
  | "action"
  | "accept"
  | "selected"
  | "rows"
  | "cols"
  | "tabIndex"
  | "role"
  | "ariaLabel"
  | "ariaCurrent"
  | "ariaPressed";

export type AttributeTargetValue =
  | string
  | number
  | boolean
  | null
  | undefined;