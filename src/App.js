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
import { SearchUtil } from "./SearchUtil.js";

let tApp;

const AppFn = () => {
    const my = {};

    my.throttle = 0;
    my.debugLevel = 0;
    my.runningFlag = false;
    my.resizeLastUpdate = 0;
    my.pageIsEmpty = false;

    my.init = function() {
        my.browser = new Browser();
        my.browser.setup();
        
        my.$window = new $Dom(window);
        my.$window.addEvent("popstate", function(event) {
            if (event.state) {
                tApp.pager.openLinkFromHistory(event.state);
            }
        });

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
                width() {
                    const width = $Dom.getScreenWidth();
                    if (width !== tmodel.val('width')) {
                        my.resizeLastUpdate = TUtil.now();     
                    }
                    return width;
                },
                height() {
                    const height = $Dom.getScreenHeight();
                    if (height !== tmodel.val('height')) {
                        my.resizeLastUpdate = TUtil.now();     
                    }
                    return height;
                },
                initPageDom() {
                    TUtil.initPageDoms(this.$dom);                    
                }
            });
            
            tmodel.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');

            tmodel.val('width', $Dom.getScreenWidth());                
            tmodel.val('height', $Dom.getScreenHeight());            
           
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
                
        TargetExecutor.executeDeclarativeTarget(my.tRoot, 'width');
        TargetExecutor.executeDeclarativeTarget(my.tRoot, 'height');
        
        my.events.detachAll();        
        my.events.detachWindowEvents();
        my.events.attachWindowEvents();
        my.events.clearAll();
        my.events.attachEvents(my.manager.lists.visible);
        
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

    my.reset = function() {
        my.manager.lists.visible.forEach(tmodel => { 
            tmodel.transformMap = {};
            tmodel.styleMap = {};
            tmodel.allStyleTargetList.forEach(function(key) {
                if (TUtil.isDefined(tmodel.val(key))) {
                    tmodel.addToStyleTargetList(key);
                }
            });             
        });
        my.manager.clear();
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
    if (tApp) {
        if (firstChild) {
            tApp.tRoot.addChild(firstChild);
            tApp.runScheduler.schedule(0, "appStart");
        }
    } else {
        tApp = AppFn();
        tApp.init().start();
    }
};

App.oids = {};
App.getOid = type => {
    const oids = App.oids;
    if (!TUtil.isDefined(oids[type])) {
        oids[type] = 0;
    }

    const num = oids[type]++;
    return { oid: num > 0 || type.endsWith('_') ? `${type}${num}` : type, num };
};

App();

const isRunning = () => tApp ? tApp.runningFlag : false;
const tRoot = () => tApp?.tRoot;
const getEvents = () => tApp?.events;
const getPager = () => tApp?.pager;
const getLoader = () => tApp?.loader;
const fetch = (tmodel, url, query, cacheId) => tApp?.loader?.fetch(tmodel, url, query, cacheId);
const fetchImage = (tmodel, src, cacheId) => tApp?.loader?.fetchImage(tmodel, src, cacheId);
const getManager = () => tApp?.manager;
const getRunScheduler = () => tApp?.runScheduler;
const getLocationManager = () => tApp?.locationManager;
const getBrowser = () => tApp?.browser;
const getScreenWidth = () => tApp?.tRoot?.getWidth() ?? 0;
const getScreenHeight = () => tApp?.tRoot?.getHeight() ?? 0;
const getVisibles = () => tApp?.manager?.lists.visible;
const getResizeLastUpdate = () => tApp?.resizeLastUpdate;

window.t = window.t || SearchUtil.find;

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
    getRunScheduler,
    getLocationManager,
    getBrowser,
    getScreenWidth,
    getScreenHeight,
    getVisibles,
    getResizeLastUpdate
};
