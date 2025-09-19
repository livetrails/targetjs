import { TUtil } from "./TUtil.js";
import { tApp, App, getRunScheduler, getLocationManager, getEvents } from "./App.js";
import { DomInit } from "./DomInit.js";
import { $Dom } from "./$Dom.js";

/**
 * It enables opening new pages and managing history. It alo provide page caching.
 * It is used to provide a single page app experience.
 */
class PageManager {
    constructor() {
        this.lastLink = TUtil.getFullLink(document.URL);
        this.pageCache = {};
    }
    
    initPage(html) {
        tApp.tRoot.$dom.outerHTML(html);
        tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
        DomInit.initPageDoms(tApp.tRoot.$dom);
    }

    async openPage(link) {        
        await tApp.stop();
        await tApp.reset();
                
        link = TUtil.getFullLink(link);

        if (!this.pageCache[link]) {
            tApp.tRoot.$dom.innerHTML(""); 
            App.oids = {};
            App.tmodelIdMap = {};            
            tApp.tRoot = tApp.tRootFactory();
            this.lastLink = link;
                        
            tApp.start();
        } else {
            tApp.tRoot = this.pageCache[link].tRoot;
            App.oids = this.pageCache[link].oids;
            App.tmodelIdMap = this.pageCache[link].tmodelIdMap;
            
            tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
            tApp.tRoot.$dom.innerHTML(this.pageCache[link].html);
            
            const visibles = Object.values(this.pageCache[link].visibleOidMap);
            DomInit.initCacheDoms(visibles);
            visibles.forEach(tmodel => {
                tmodel.visibilityStatus = undefined;
            });

            tApp.manager.visibleOidMap = { ...this.pageCache[link].visibleOidMap };
            this.lastLink = link;  
            tApp.start();    
        }
    }

    openLinkFromHistory(state) {        
        if (state.link) {
            this.onPageClose();
            this.openLink(state.link, false);
        } else if (state.browserUrl) {
            history.replaceState({ link: state.browserUrl }, "", state.browserUrl);
            this.openPage(state.browserUrl);
        }
    }
    
    onPageClose() {        
        tApp.resizeLastUpdate = TUtil.now();
        getEvents().resizeRoot();
        tApp.manager.getVisibles().forEach(tmodel => {
            getLocationManager().runEventTargets(tmodel, ['onPageClose']);             
        });          
    }

    openLink(link, updateHistory = true) {
        link = TUtil.getFullLink(link);
        
        if (this.lastLink) {
            tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
            const html = tApp.tRoot.$dom.innerHTML();
            
            this.onPageClose();
                              
            this.pageCache[this.lastLink] = {
                link: this.lastLink,
                html: html,
                oids: { ...App.oids },
                tmodelIdMap:  { ...App.tmodelIdMap },
                visibleOidMap: { ...tApp.manager.visibleOidMap },
                tRoot: tApp.tRoot
            };
        }

        if (updateHistory) {
            history.pushState({ link }, "", link);
        }
        
        this.openPage(link);
                
        getRunScheduler().schedule(0, "pagemanager-processOpenLink");
    }

    updateBrowserUrl(link, updateHistory) {
        
        tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
        this.pageCache[document.URL] = {
            link: document.URL,
            html: tApp.tRoot.$dom.innerHTML(),
            oids: { ...App.oids },
            tmodelIdMap:  { ...App.tmodelIdMap },
            visibleOidMap: { ...tApp.manager.visibleOidMap },
            tRoot: tApp.tRoot
        };
        
        if (updateHistory) {  
            history.pushState({ browserUrl: link }, "", link);
        } else {
            history.replaceState({ browserUrl: link }, "", link);
        }
        
        getRunScheduler().schedule(0, "pagemanager-processUpdateBrowserUrl");
    }

    back() {
        return history.back();
    }
}

export { PageManager };
