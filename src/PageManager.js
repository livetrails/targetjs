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
        this.lastCachedLink = undefined;
        this.pageCache = {};
        this.initHistory();
    }
    
    initHistory() {
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }

        const link = TUtil.getFullLink(document.URL);

        const st = history.state;

        if (!st || (!st.link && !st.browserUrl)) {
            history.replaceState({ link }, "", link);
        }

        this.lastLink = link;
    }
    
    initPage(html) {
        tApp.tRoot.$dom.outerHTML(html);
        tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
        if (tApp.tRoot.$dom.getTagName() !== 'body') {
            tApp.tRoot.$dom.attr('data-tj-no-slot', 'true');
        }

        DomInit.initPageDoms(tApp.tRoot.$dom);
    }

    async openPage(link, shouldReset = true) {
        if (shouldReset) {
            await tApp.stop();
            getLocationManager().cancelCurrentCalculation();
            await tApp.reset();
        }

        link = TUtil.getFullLink(link);

        if (!this.pageCache[link]) {
            tApp.tRoot.$dom.innerHTML("");
            App.oids = {};
            App.tmodelIdMap = {};
            tApp.tRoot = tApp.tRootFactory();
            this.lastLink = link;
            await tApp.start();
        } else {
            tApp.tRoot = this.pageCache[link].tRoot;
            App.oids = this.pageCache[link].oids;
            App.tmodelIdMap = this.pageCache[link].tmodelIdMap;

            tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
            tApp.tRoot.$dom.innerHTML(this.pageCache[link].html);

            const visibles = Object.values(this.pageCache[link].visibleOidMap);
            const newVisibles = DomInit.initCacheDoms(visibles);
            const restored = [...visibles, ...newVisibles];

            for (const tmodel of restored) {
                tmodel.visibilityStatus = undefined;

                if (!tmodel.hasDom()) {
                    tmodel.markLayoutDirty('pageRestoreNoDom');
                }
                
                if (tmodel.hasAnimatingTargets()) {
                    tmodel.getAnimatingTargets().forEach(key => {
                        tmodel.setTargetStatus(key, 'updating');
                        tmodel.removeFromAnimatingMap(key);
                    });
                }
            }

            tApp.manager.visibleOidMap = {};

            for (const tmodel of restored) {
                if (tmodel.isIncluded()) {
                    tApp.manager.visibleOidMap[tmodel.oid] = tmodel;
                }
            }  
            
            tApp.manager.activatePendingTargetsAfterDom(restored, { restoredDoneTargets: true });

            this.lastLink = link;
            
            await this.restoreScroll(this.pageCache[link]);

            await tApp.start();

            getRunScheduler().restoreSnapshot(this.pageCache[link].runSnapshot);

        }
    }

    async openLinkFromHistory(state) {
        const link = state.link || state.browserUrl;

        if (!link) {
            return;
        }

        if (state.browserUrl) {
            history.replaceState({ link }, "", link);
        }

        await this.openLink(link, false);
    }
    
    onPageClose() {        
        tApp.resizeLastUpdate = TUtil.now();
        getEvents().resizeRoot();
        tApp.manager.getAvailableDoms().forEach(tmodel => {
            getLocationManager().runEventTargets(tmodel, ['onPageClose']);             
        });          
    }

    async openLink(link, updateHistory = true) {
        link = TUtil.getFullLink(link);
        
        if (this.lastLink) {
            const runSnapshot = getRunScheduler().getSnapshot();
            
            await tApp.stop();

            getLocationManager().cancelCurrentCalculation();

            this.onPageClose();

            tApp.tRoot.$dom = $Dom.query('#tgjs-root') ? new $Dom('#tgjs-root') : new $Dom('body');
            const html = tApp.tRoot.$dom.innerHTML();

            this.pageCache[this.lastLink] = {
                link: this.lastLink,
                html,
                oids: { ...App.oids },
                tmodelIdMap: { ...App.tmodelIdMap },
                visibleOidMap: { ...tApp.manager.visibleOidMap },
                scrollLeft: $Dom.getWindowScrollLeft() || 0,
                scrollTop: $Dom.getWindowScrollTop() || 0,
                tRoot: tApp.tRoot,
                runSnapshot
            };
            
            this.lastCachedLink = this.lastLink;

            await tApp.reset();
        }

        if (updateHistory) {
            history.pushState({ link }, "", link);
        }

        await this.openPage(link, false);

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
            scrollLeft: $Dom.getWindowScrollLeft() || 0,
            scrollTop: $Dom.getWindowScrollTop() || 0,
            tRoot: tApp.tRoot,
            runSnapshot: getRunScheduler().getSnapshot()
        };
        
        if (updateHistory) {  
            history.pushState({ browserUrl: link }, "", link);
        } else {
            history.replaceState({ browserUrl: link }, "", link);
        }
        
        getRunScheduler().schedule(0, "pagemanager-processUpdateBrowserUrl");
    }
    
    async restoreScroll(page) {
        const left = page.scrollLeft || 0;
        const top = page.scrollTop || 0;

        window.scrollTo(left, top);

        await new Promise(requestAnimationFrame);
        window.scrollTo(left, top);

        await new Promise(requestAnimationFrame);
        window.scrollTo(left, top);
    }

    back() {
        return history.back();
    }
    
    getCachedPage(link = this.lastCachedLink) {
        if (!link) {
            return undefined;
        }

        link = TUtil.getFullLink(link);

        return this.pageCache[link];
    }

    getCachedTModel(id, link = this.lastCachedLink) {
        const page = this.getCachedPage(link);

        return page?.tmodelIdMap?.[id];
    }

}

export { PageManager };
