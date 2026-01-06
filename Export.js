export * from "./build/App.js";
export * from "./build/TModel.js";
export * from "./build/Moves.js";
export * from "./build/SearchUtil.js";
export * from "./build/TargetData.js";
export * from "./build/TargetUtil.js";
export * from "./build/TargetParser.js";
export * from "./build/TModelUtil.js";
export * from "./build/TUtil.js";
export * from "./build/DomInit.js"
export * from "./build/$Dom.js";
export * from "./build/Bracket.js";
export * from "./build/BracketGenerator.js";
export * from "./build/ColorUtil.js";
export * from "./build/Easing.js";
export * from "./build/TargetExecutor.js";
export * from "./build/AnimationManager.js";
export * from "./build/AnimationUtil.js";

import * as App from './build/App.js';
import * as TModel from './build/TModel.js';
import * as Moves from './build/Moves.js';
import * as SearchUtil from './build/SearchUtil.js';
import * as TargetData from './build/TargetData.js';
import * as TargetUtil from './build/TargetUtil.js';
import * as TargetParser from './build/TargetParser.js';
import * as TModelUtil from './build/TModelUtil.js';
import * as TUtil from './build/TUtil.js';
import * as DomInit from './build/DomInit.js';
import * as Dom from './build/$Dom.js';
import * as Bracket from './build/Bracket.js';
import * as BracketGenerator from './build/BracketGenerator.js';
import * as ColorUtil from './build/ColorUtil.js';
import * as Easing from './build/Easing.js';
import * as TargetExecutor from './build/TargetExecutor.js';
import * as AnimationManager from './build/AnimationManager.js';
import * as AnimationUtil from './build/AnimationUtil.js';

const TargetJS = {
  ...App,
  ...TModel,
  ...Moves,
  ...SearchUtil,
  ...TargetData,
  ...TargetUtil,
  ...TModelUtil,
  ...TUtil,
  ...DomInit,
  ...Dom,
  ...Bracket,
  ...BracketGenerator,
  ...ColorUtil,
  ...Easing,
  ...TargetExecutor,
  ...AnimationManager,
  ...AnimationUtil
};

if (typeof window !== 'undefined') {
  window.TargetJS = TargetJS;
}

export default TargetJS;
