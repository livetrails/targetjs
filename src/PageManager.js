import { TUtil } from "./TUtil.js";
import { tApp, getRunScheduler, getLocationManager, getEvents } from "./App.js";

/**
 * It enables opening new pages and managing history. It alo provide page caching.
 * It is used to provide a single page app experience.
 */
class PageManager {
    constructor() {
        this.lastLink = TUtil.getFullLink(document.URL);
        this.pageCache = {};
    }

    async openPage(link) {
        await tApp.stop();
        tApp.reset();
                
        link = TUtil.getFullLink(link);

        if (!this.pageCache[link]) {
            if (tApp.tRoot.hasDom()) {
                tApp.tRoot.$dom.innerHTML("");                
            }
            tApp.tRoot = tApp.tRootFactory();
            this.lastLink = link;
            tApp.start();
        } else {
            tApp.tRoot = this.pageCache[link].tRoot;
            tApp.tRoot.$dom.innerHTML(this.pageCache[link].html);

            TUtil.initDoms(this.pageCache[link].visibleList);
            tApp.manager.lists.visible = [...this.pageCache[link].visibleList];
            this.lastLink = link;
            tApp.start();
        }
    }

    openLinkFromHistory(state) {        
        if (state.link) {
            this.onPageClose();
            this.openPage(state.link);
        } else if (state.browserUrl) {
            history.replaceState({ link: state.browserUrl }, "", state.browserUrl);
            this.openPage(state.browserUrl);
        }

        getRunScheduler().schedule(0, "pagemanager-openLinkFromHistory");
    }
    
    onPageClose() {        
        tApp.resizeLastUpdate = TUtil.now();
        getEvents().resizeRoot();
        tApp.manager.lists.visible.forEach(tmodel => {
            getLocationManager().runEventTargets(tmodel, ['onPageClose']);             
        });          
    }

    openLink(link) {    
        link = TUtil.getFullLink(link);

        if (this.lastLink) {
            this.onPageClose();
                        
            this.pageCache[this.lastLink] = {
                link: this.lastLink,
                html: tApp.tRoot.$dom.innerHTML(),
                visibleList: [...tApp.manager.lists.visible],
                tRoot: tApp.tRoot
            };
        }

        history.pushState({ link }, "", link);

        this.openPage(link);

        getRunScheduler().schedule(0, "pagemanager-processOpenLink");
    }

    updateBrowserUrl(link) {
        const currentState = window.history.state;

        if (!currentState.browserUrl) {
            this.pageCache[document.URL] = {
                link: document.URL,
                htms: tApp.tRoot.$dom.innerHTML(),
                visibleList: [...tApp.manager.lists.visible],
                tRoot: tApp.tRoot
            };
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
