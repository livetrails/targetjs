import { TUtil } from "./TUtil.js";
import { tApp, App, getRunScheduler, getLocationManager, getEvents } from "./App.js";
import { DomInit } from "./DomInit.js";
import { $Dom } from "./$Dom.js";
import { TargetUtil } from "./TargetUtil.js";
import { TModelUtil } from "./TModelUtil.js";

/**
 * It enables opening new pages and managing history. It also provide page caching.
 * It is used to provide a single page app experience.
 */
class PageManager {
    constructor() {
        this.currentLink = TUtil.getFullLink(document.URL);
        this.lastCachedLink = undefined;
        this.pageCache = {};
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

        await this.storePage(this.currentLink);

        this.lastCachedLink = this.currentLink;

        await tApp.reset();
        
        if (updateHistory) {
            history.pushState({ link }, "", link);
        }
        
        this.currentLink = link;

        if (!this.pageCache[link]) {
            tApp.tRoot.$dom.innerHTML("");
            App.oids = {};
            App.tmodelIdMap = {};
            tApp.tRoot = tApp.tRootFactory();
            await tApp.start();
            return;
        }

        await this.restorePage(link, { shouldReset: false });

        getRunScheduler().schedule(0, "pagemanager-processOpenLink");
    }

    back() {
        return history.back();
    }
    
    async storePage(link) {
        const runSnapshot = getRunScheduler().getSnapshot();

        link = TUtil.getFullLink(link);

        await tApp.stop();
        getLocationManager().cancelCurrentCalculation();
 
        this.onPageClose();

        const $pageDom = TModelUtil.getPageDom();
        const html = $pageDom.innerHTML();

        this.pageCache[link] = {
            link,
            html,
            domState: TModelUtil.captureDomState($pageDom),
            oids: { ...App.oids },
            tmodelIdMap: { ...App.tmodelIdMap },
            visibleOidMap: { ...tApp.manager.visibleOidMap },
            scrollLeft: $Dom.getWindowScrollLeft() || 0,
            scrollTop: $Dom.getWindowScrollTop() || 0,
            tRoot: tApp.tRoot,
            runSnapshot
        };
        
        return this.pageCache[link];
    } 
    
    async restorePage(link) {   
        const cache = this.pageCache[link];

        if (!cache) {
            return false;
        }

        tApp.tRoot = cache.tRoot;

        App.oids = { ...cache.oids };
        App.tmodelIdMap = { ...cache.tmodelIdMap };

        const $pageDom = TModelUtil.getPageDom();

        $pageDom.innerHTML(cache.html);
        TModelUtil.restoreDomState($pageDom, cache.domState);

        tApp.tRoot.$dom = TModelUtil.getRootDom();

        const visibles = Object.values(cache.visibleOidMap);
        const newVisibles = DomInit.initCacheDoms(visibles);
        const restored = TUtil.uniqueTModels([...visibles, ...newVisibles]);

        for (const tmodel of restored) {
            tmodel.visibilityStatus = undefined;

            if (!tmodel.hasDom()) {
                tmodel.markLayoutDirty('pageRestoreNoDom');
            }
        }
        
        TargetUtil.convertAnimatingTargetsToUpdating(restored);

        tApp.manager.visibleOidMap = {};

        for (const tmodel of restored) {
            if (tmodel.isIncluded()) {
                tApp.manager.visibleOidMap[tmodel.oid] = tmodel;
            }
        }  
            
        tApp.manager.activatePendingTargetsAfterDom(restored, { restoredDoneTargets: true });
            
        tApp.tRoot.markLayoutDirty("pageRestore");

        await TModelUtil.restoreScroll(cache);
        await tApp.start();

        getRunScheduler().restoreSnapshot(cache.runSnapshot);

        const $restoredPageDom = TModelUtil.getPageDom();

        TModelUtil.restoreDomState($restoredPageDom, cache.domState);
        await TModelUtil.restoreScroll(cache);
        await TModelUtil.restoreDomInteractionState($restoredPageDom, cache.domState);

        return true;      
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
