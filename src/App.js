import { $Dom } from "./$Dom.js";
import { TModel } from "./TModel.js";
import { Browser } from "./Browser.js";
import { EventListener } from "./EventListener.js";
import { LoadingManager } from "./LoadingManager.js";
import { LocationManager } from "./LocationManager.js";
import { PageManager } from "./PageManager.js";
import { TModelManager } from "./TModelManager.js";
import { RunScheduler } from "./RunScheduler.js";
import { TargetManager } from "./TargetManager.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { TUtil } from "./TUtil.js";
import { DomInit } from "./DomInit.js";
import { SearchUtil } from "./SearchUtil.js";

let tApp;
let queuedAppCall = null;

const AppFn = () => {
    const my = {};

    my.throttle = 0;
    my.debugLevel = 0;
    my.runningFlag = false;
    my.resizeLastUpdate = 0;

    my.init = function() {
        my.browser = new Browser();
        my.browser.setup();

        my.$window = new $Dom(window);

        my.loader = new LoadingManager();
        my.pager = new PageManager();
        my.events = new EventListener();
        my.locationManager = new LocationManager();
        my.targetManager = new TargetManager();
        my.manager = new TModelManager();
        my.runScheduler = new RunScheduler();

        my.tRootFactory = () => {
            const tmodel = new TModel('tRoot', {
                styling: false,
                domHolder: true,
                isVisible: true,
                screenWidth() {
                    const width = $Dom.getScreenWidth();
                    if (width !== tmodel.val('screenWidth')) {
                        my.resizeLastUpdate = TUtil.now();     
                    }
                    return width;
                },
                screenHeight() {
                    const height = $Dom.getScreenHeight();
                    if (height !== tmodel.val('screenHeight')) {
                        my.resizeLastUpdate = TUtil.now();     
                    }
                    return height;
                },
                initPageDom() {
                    DomInit.initPageDoms(this.$dom); 
                    
                    if (queuedAppCall) {
                        this.addChild(queuedAppCall);
                        queuedAppCall = undefined;
                    }
                }
            });

            tmodel.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');

            tmodel.val('screenWidth', $Dom.getScreenWidth());                
            tmodel.val('screenHeight', $Dom.getScreenHeight());            

            if (my.tRoot) {
                my.tRoot.getChildren().forEach(t => {
                    if (t.val('sourceDom')) {
                        return;
                    }
                    const child = new TModel(t.type, t.targets);
                    tmodel.addChild(child);
                });
            }

            return tmodel;
        };

        my.tRoot = my.tRootFactory();

        window.history.pushState({ link: document.URL }, "", document.URL);

        return my;
    };

    my.start = async function() {
        my.runningFlag = false;

        TargetExecutor.executeDeclarativeTarget(my.tRoot, 'screenWidth');
        TargetExecutor.executeDeclarativeTarget(my.tRoot, 'screenHeight');

        my.events.detachAll();        
        my.events.detachWindowEvents();
        my.events.attachWindowEvents();
        my.events.clearAll();
        my.events.attachEvents(my.manager.getVisibles());

        await my.runScheduler.resetRuns();

        my.runningFlag = true;
        my.runScheduler.schedule(0, "appStart");

        return my;
    };

    my.stop = async function() {
        my.runningFlag = false;

        my.events.detachAll();
        my.events.detachWindowEvents();        
        my.events.clearAll();

        await my.runScheduler.resetRuns();

        return my;
    };

    my.reset = async function() {
        my.manager.getVisibles().forEach(tmodel => { 
            tmodel.transformMap = {};
            tmodel.styleMap = {};
            tmodel.allStyleTargetList.forEach(function(key) {
                if (TUtil.isDefined(tmodel.val(key))) {
                    tmodel.addToStyleTargetList(key);
                }
            });             
        });
        await my.runScheduler.resetRuns();
        
        my.manager.clearAll();
        my.locationManager.clear();
        SearchUtil.clear();
    };

    my.isRunning = function() {
        return my.runningFlag;
    };

    my.find = function(oid) {
        return SearchUtil.find(oid);
    };

    return my;
};

const App = firstChild => {
    if (!tApp?.tRoot) {
        queuedAppCall = firstChild;
    } else if (firstChild) {
        tApp?.tRoot.addChild(firstChild);
    }
};

App.oids = {};
App.tmodelIdMap = {};

App.getOid = type => {
    const oids = App.oids;
    if (!TUtil.isDefined(oids[type])) {
        oids[type] = 0;
    }

    const num = oids[type]++;
    return { oid: num > 0 || type.endsWith('_') ? `${type}${num}` : type, num };
};

const isRunning = () => tApp ? tApp.runningFlag : false;
const tRoot = () => tApp?.tRoot;
const getEvents = () => tApp?.events;
const getPager = () => tApp?.pager;
const getLoader = () => tApp?.loader;
const fetch = (tmodel, url, query, cacheId) => tApp?.loader?.fetch(tmodel, url, query, cacheId);
const fetchImage = (tmodel, src, cacheId) => tApp?.loader?.fetchImage(tmodel, src, cacheId);
const getManager = () => tApp?.manager;
const getTargetManager = () => tApp?.targetManager;
const getRunScheduler = () => tApp?.runScheduler;
const getLocationManager = () => tApp?.locationManager;
const getBrowser = () => tApp?.browser;
const getScreenWidth = () => tApp?.tRoot?.val('screenWidth') ?? 0;
const getScreenHeight = () => tApp?.tRoot?.val('screenHeight') ?? 0;
const getVisibles = () => tApp?.manager?.getVisibles();
const getResizeLastUpdate = () => tApp?.resizeLastUpdate;
const getTModelById = id => App.tmodelIdMap[id];
const getDomTModelById = id => {
    const tmodel = App.tmodelIdMap[id];
    return tmodel && tmodel.targets['sourceDom'] ? tmodel : undefined;
};

window.t = window.t || getTModelById;

const runApp = () => {
    tApp = AppFn();
    tApp.init().start();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runApp);
} else {
    runApp();
}


export {
    tApp,
    App,
    tRoot,
    isRunning,
    getEvents,
    getPager,
    getLoader,
    fetch,
    fetchImage,
    getManager,
    getTargetManager,
    getRunScheduler,
    getLocationManager,
    getBrowser,
    getScreenWidth,
    getScreenHeight,
    getVisibles,
    getResizeLastUpdate,
    getTModelById,
    getDomTModelById
};
