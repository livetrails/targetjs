export * from "./build/App.js";
export * from "./build/TModel.js";
export * from "./build/Moves.js";
export * from "./build/SearchUtil.js";
export * from "./build/TargetData.js";
export * from "./build/TargetUtil.js";
export * from "./build/TargetParser.js";
export * from "./build/TModelUtil.js";
export * from "./build/TUtil.js";
export * from "./build/DomInit.js";
export * from "./build/$Dom.js";
export * from "./build/Bracket.js";
export * from "./build/BracketGenerator.js";
export * from "./build/ColorUtil.js";
export * from "./build/Easing.js";
export * from "./build/TargetExecutor.js";
export * from "./build/AnimationManager.js";
export * from "./build/AnimationUtil.js";
export * from "./build/VisibilityUtil.js";
export * from "./build/ScheduleUtil.js";
export * from "./build/StateUtil.js";

import * as AppModule from "./build/App.js";
import * as TModelModule from "./build/TModel.js";
import * as MovesModule from "./build/Moves.js";
import * as SearchUtilModule from "./build/SearchUtil.js";
import * as TargetDataModule from "./build/TargetData.js";
import * as TargetUtilModule from "./build/TargetUtil.js";
import * as TargetParserModule from "./build/TargetParser.js";
import * as TModelUtilModule from "./build/TModelUtil.js";
import * as TUtilModule from "./build/TUtil.js";
import * as DomInitModule from "./build/DomInit.js";
import * as DomModule from "./build/$Dom.js";
import * as BracketModule from "./build/Bracket.js";
import * as BracketGeneratorModule from "./build/BracketGenerator.js";
import * as ColorUtilModule from "./build/ColorUtil.js";
import * as EasingModule from "./build/Easing.js";
import * as TargetExecutorModule from "./build/TargetExecutor.js";
import * as AnimationManagerModule from "./build/AnimationManager.js";
import * as AnimationUtilModule from "./build/AnimationUtil.js";
import * as VisibilityUtilModule from "./build/VisibilityUtil.js";
import * as ScheduleUtilModule from "./build/ScheduleUtil.js";
import * as StateUtilModule from "./build/StateUtil.js";

const TargetJS = {
    ...AppModule,
    ...TModelModule,
    ...MovesModule,
    ...SearchUtilModule,
    ...TargetDataModule,
    ...TargetUtilModule,
    ...TargetParserModule,
    ...TModelUtilModule,
    ...TUtilModule,
    ...DomInitModule,
    ...DomModule,
    ...BracketModule,
    ...BracketGeneratorModule,
    ...ColorUtilModule,
    ...EasingModule,
    ...TargetExecutorModule,
    ...AnimationManagerModule,
    ...AnimationUtilModule,
    ...VisibilityUtilModule,
    ...ScheduleUtilModule,
    ...StateUtilModule
};

if (typeof window !== "undefined") {
    window.TargetJS = TargetJS;
}

export default TargetJS;