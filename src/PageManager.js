import { TUtil } from "./TUtil.js";
import { tApp, App, getLocationManager, getEvents, getRunScheduler } from "./App.js";
import { DomInit } from "./DomInit.js";
import { TModelUtil } from "./TModelUtil.js";

/**
 * It enables opening new pages and managing history. It also provide page caching.
 * It is used to provide a single page app experience.
 */
class PageManager {
    constructor() {
        this.currentLink = TUtil.getFullLink(document.URL);
        this.pageCache = new Map();        
        this.initHistory();
    }
    
    initHistory() {
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }

        const st = history.state;

        if (!st || (!st.link && !st.browserUrl)) {
            history.replaceState({ link: this.currentLink }, "", this.currentLink);
        }
    }
    
    initPage(html) {
        tApp.tRoot.$dom.outerHTML(html);
        tApp.tRoot.$dom = TModelUtil.getRootDom();
        if (tApp.tRoot.$dom.getTagName() !== 'body') {
            tApp.tRoot.$dom.attr('data-tj-no-slot', 'true');
        }

        DomInit.initPageDoms(tApp.tRoot.$dom);
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

        if (link === this.currentLink) {
            return;
        }

        await this.storePage(this.currentLink);

        if (updateHistory) {
            history.pushState({ link }, "", link);
        }

        this.currentLink = link;

        if (this.pageCache.has(link)) {
            await this.restorePage(link);
            return;
        }

        // Application was already stopped and reset by storePage().
        tApp.tRoot.$dom.innerHTML("");

        App.oids = {};
        App.tmodelIdMap = {};

        tApp.tRoot = tApp.tRootFactory();

        await tApp.start({ skipSchedulerReset: true });

        getRunScheduler().schedule(0, "pagemanager-processOpenLink");
    }  
    
    back() {
        return history.back();
    }
    
    getStateKey(link) {
        return `page:${TUtil.getFullLink(link)}`;
    }

    async storePage(link) {
        link = TUtil.getFullLink(link);

        const runSnapshot = getRunScheduler().getSnapshot();

        await tApp.stop();
        getLocationManager().cancelCurrentCalculation();

        this.onPageClose();

        this.pageCache.set(link, {
            html: TModelUtil.getPageDom().innerHTML(),
            tRoot: tApp.tRoot,
            oids: { ...App.oids },
            tmodelIdMap: { ...App.tmodelIdMap },
            visibleOidMap: { ...tApp.manager.visibleOidMap },
            scrollLeft: window.scrollX,
            scrollTop: window.scrollY,
            runSnapshot
        });

        await tApp.reset({
            preserveCachedModels: true,
            skipSchedulerReset: true
        });
    }

    async restorePage(link) {
        const cached = this.pageCache.get(TUtil.getFullLink(link));

        if (!cached) {
            return false;
        }

        tApp.tRoot = cached.tRoot;
        App.oids = { ...cached.oids };
        App.tmodelIdMap = { ...cached.tmodelIdMap };

        TModelUtil.getPageDom().innerHTML(cached.html);
        tApp.tRoot.$dom = TModelUtil.getRootDom();

        const visibles = Object.values(cached.visibleOidMap);
        const newVisibles = DomInit.initCacheDoms(visibles);
        
        visibles.forEach(tmodel => {
            tmodel.visibilityStatus = undefined;
        });

        tApp.manager.visibleOidMap = { ...cached.visibleOidMap };

        newVisibles.forEach(tmodel => {
            tApp.manager.visibleOidMap[tmodel.oid] = tmodel;
        });

        const restored = [...new Set([...visibles, ...newVisibles])];

        tApp.manager.activatePendingTargetsAfterDom(restored);

        window.scrollTo(cached.scrollLeft, cached.scrollTop);

        tApp.tRoot.markLayoutDirty("pageCacheRestore");

        await tApp.start({ skipSchedulerReset: true });

        getRunScheduler().restoreSnapshot(cached.runSnapshot);

        return true;
    }

}

export { PageManager };
