/**
 * @name MarketCalendar
 * @author Antigravity
 * @description Menampilkan Kalender Libur Pasar (US, INDO, BOTH) langsung di dalam Discord Client dengan grid seamless, kolom nomor minggu, highlight hari ini berwarna oranye, dan input event via modal.
 * @version 1.1.0
 * @authorLink https://github.com/google-deepmind
 */

module.exports = (() => {
    const config = {
        info: {
            name: "MarketCalendar",
            authors: [{ name: "Antigravity" }],
            version: "1.1.0",
            description: "Menampilkan Kalender Libur Pasar langsung di Discord."
        },
        defaultConfig: [
            {
                type: "textbox",
                id: "apiUrl",
                name: "API URL Dashboard",
                note: "URL Server Next.js API Kalender (Contoh: http://localhost:3001)",
                value: "http://localhost:3001"
            },
            {
                type: "textbox",
                id: "apiToken",
                name: "API Secret Token",
                note: "Token otentikasi (NEXTAUTH_SECRET di .env)",
                value: "super_secret_calendar_key_123!"
            }
        ]
    };

    return class MarketCalendar {
        constructor() {
            this._config = config;
            this.apiUrl = "";
            this.apiToken = "";
            this._calendarComponent = null;
            this._currentFormValues = null;
        }

        getName() { return config.info.name; }
        getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return config.info.description; }
        getVersion() { return config.info.version; }

        loadSettings() {
            this.apiUrl = BdApi.Data.load("MarketCalendar", "apiUrl") || "https://market-calendar-web.vercel.app";
            if (this.apiUrl === "http://localhost:3001") {
                this.apiUrl = "https://market-calendar-web.vercel.app";
                BdApi.Data.save("MarketCalendar", "apiUrl", this.apiUrl);
            }
            this.apiToken = BdApi.Data.load("MarketCalendar", "apiToken") || "super_secret_calendar_key_123!";
        }

        start() {
            this.loadSettings();
            this.injectStyles();
            this.addCalendarButton();
            this.updateChannelView();
            
            // Observer untuk memantau perubahan DOM, menyisipkan kembali tombol & mendeteksi channel kalender
            this.observer = new MutationObserver(() => {
                if (!document.getElementById("bd-calendar-btn")) {
                    this.addCalendarButton();
                }
                this.updateChannelView();
            });
            this.observer.observe(document.body, { childList: true, subtree: true });

            console.log("[MarketCalendar] Plugin started.");
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.removeCalendarButton();
            this.removeFullCalendar();
            this.clearStyles();
            
            document.body.classList.remove("mc-in-calendar-channel");
            console.log("[MarketCalendar] Plugin stopped.");
        }

        onSwitch() {
            this.addCalendarButton();
            this.updateChannelView();
        }

        getSettingsPanel() {
            const panel = document.createElement("div");
            panel.style.padding = "16px";
            panel.style.color = "var(--text-normal)";
            panel.style.fontFamily = "sans-serif";
            panel.style.display = "flex";
            panel.style.flexDirection = "column";
            panel.style.gap = "14px";

            const title = document.createElement("h3");
            title.textContent = "Market Calendar Settings";
            title.style.fontWeight = "bold";
            title.style.fontSize = "16px";
            panel.appendChild(title);

            // Field 1: API URL
            const urlGroup = document.createElement("div");
            const urlLabel = document.createElement("label");
            urlLabel.textContent = "Next.js Web Dashboard URL:";
            urlLabel.style.display = "block";
            urlLabel.style.marginBottom = "6px";
            urlLabel.style.fontSize = "13px";
            const urlInput = document.createElement("input");
            urlInput.type = "text";
            urlInput.value = BdApi.Data.load("MarketCalendar", "apiUrl") || "https://market-calendar-web.vercel.app";
            urlInput.style.width = "100%";
            urlInput.style.padding = "8px 12px";
            urlInput.style.backgroundColor = "var(--background-secondary)";
            urlInput.style.color = "var(--text-normal)";
            urlInput.style.border = "1px solid var(--background-tertiary)";
            urlInput.style.borderRadius = "4px";
            urlInput.style.boxSizing = "border-box";
            urlInput.addEventListener("change", (e) => {
                let val = e.target.value.trim();
                if (val.endsWith("/")) val = val.slice(0, -1);
                BdApi.Data.save("MarketCalendar", "apiUrl", val);
                this.apiUrl = val;
                BdApi.showToast("API URL saved!", { type: "success" });
            });
            urlGroup.appendChild(urlLabel);
            urlGroup.appendChild(urlInput);
            panel.appendChild(urlGroup);

            // Field 2: API Token
            const tokenGroup = document.createElement("div");
            const tokenLabel = document.createElement("label");
            tokenLabel.textContent = "API Secret Token (NEXTAUTH_SECRET):";
            tokenLabel.style.display = "block";
            tokenLabel.style.marginBottom = "6px";
            tokenLabel.style.fontSize = "13px";
            const tokenInput = document.createElement("input");
            tokenInput.type = "password";
            tokenInput.value = BdApi.Data.load("MarketCalendar", "apiToken") || "super_secret_calendar_key_123!";
            tokenInput.style.width = "100%";
            tokenInput.style.padding = "8px 12px";
            tokenInput.style.backgroundColor = "var(--background-secondary)";
            tokenInput.style.color = "var(--text-normal)";
            tokenInput.style.border = "1px solid var(--background-tertiary)";
            tokenInput.style.borderRadius = "4px";
            tokenInput.style.boxSizing = "border-box";
            tokenInput.addEventListener("change", (e) => {
                let val = e.target.value.trim();
                BdApi.Data.save("MarketCalendar", "apiToken", val);
                this.apiToken = val;
                BdApi.showToast("API Token saved!", { type: "success" });
            });
            tokenGroup.appendChild(tokenLabel);
            tokenGroup.appendChild(tokenInput);
            panel.appendChild(tokenGroup);

            return panel;
        }

        injectStyles() {
            const css = `
                /* CSS untuk menyembunyikan chat room bawaan di channel kalender */
                .mc-in-calendar-channel [class*="chatContent-"] > :not(#mc-full-calendar-container),
                .mc-in-calendar-channel [class*="chatContent"] > :not(#mc-full-calendar-container) {
                    display: none !important;
                }

                .mc-header-button {
                    cursor: pointer;
                    margin: 0 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6272a4;
                    transition: color 0.2s;
                }
                .mc-header-button:hover {
                    color: #ff79c6;
                }
                .mc-header-button svg {
                    width: 22px;
                    height: 22px;
                }
                
                /* Layout Modal Popup */
                .mc-modal-container {
                    display: flex;
                    flex-direction: column;
                    width: 360px;
                    background: #282a36;
                    border-radius: 14px;
                    padding: 20px;
                    color: #f8f8f2;
                    font-family: 'gg sans', 'Segoe UI', sans-serif;
                }
                .mc-cal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .mc-nav-btn {
                    background: #44475a;
                    border: 1px solid #6272a4;
                    color: #f8f8f2;
                    cursor: pointer;
                    font-size: 13px;
                    padding: 6px 12px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .mc-nav-btn:hover {
                    background: #6272a4;
                    color: #f8f8f2;
                }
                .mc-cal-title {
                    font-weight: 700;
                    font-size: 18px;
                    color: #f8f8f2;
                }
                .mc-grid-labels {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    text-align: center;
                    margin-bottom: 8px;
                }
                .mc-fv-labels {
                    grid-template-columns: 40px repeat(7, 1fr) !important;
                }
                .mc-label {
                    font-size: 11px;
                    color: #bd93f9;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .mc-grid-days {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 6px;
                    margin-bottom: 16px;
                }
                .mc-day {
                    aspect-ratio: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    background: #21222c;
                    cursor: pointer;
                    position: relative;
                    transition: background 0.2s, transform 0.1s;
                    border: 1px solid transparent;
                }
                .mc-day:hover {
                    background: #44475a;
                    transform: translateY(-1px);
                }
                .mc-day.empty {
                    background: transparent;
                    border: none;
                    cursor: default;
                    pointer-events: none;
                }
                .mc-day.today {
                    border: 2px solid #ffb86c;
                }
                .mc-day-number {
                    font-size: 13px;
                    font-weight: 600;
                    color: #f8f8f2;
                }
                .mc-event-dots {
                    display: flex;
                    gap: 2.5px;
                    margin-top: 2px;
                    position: absolute;
                    bottom: 4px;
                }
                .mc-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                }
                .mc-loading {
                    grid-column: span 8;
                    text-align: center;
                    padding: 24px 0;
                    color: #6272a4;
                    font-size: 13px;
                }
                .mc-event-detail {
                    background: #21222c;
                    border-radius: 10px;
                    padding: 12px;
                    border: 1px solid #44475a;
                    margin-top: 8px;
                    animation: mcFadeIn 0.2s ease-out;
                }
                @keyframes mcFadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .mc-detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                }
                .mc-market-badge {
                    font-size: 9px;
                    font-weight: 800;
                    color: #282a36;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .mc-close-detail {
                    background: transparent;
                    border: none;
                    color: #6272a4;
                    cursor: pointer;
                    font-size: 12px;
                }
                .mc-close-detail:hover {
                    color: #f8f8f2;
                }
                .mc-detail-title {
                    font-size: 14px;
                    font-weight: 700;
                    margin: 4px 0;
                    color: #f8f8f2;
                }
                .mc-detail-desc {
                    font-size: 12px;
                    color: #f8f8f2;
                    margin: 4px 0 8px 0;
                    line-height: 1.4;
                }
                .mc-detail-img {
                    width: 100%;
                    height: 100px;
                    object-fit: cover;
                    border-radius: 6px;
                    margin-top: 6px;
                }
                .mc-footer-info {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    align-items: center;
                    border-top: 1px solid #44475a;
                    padding-top: 12px;
                }
                .mc-legend {
                    display: flex;
                    gap: 12px;
                    font-size: 11px;
                    color: #6272a4;
                }
                .mc-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .mc-dot-legend {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    display: inline-block;
                }
                .mc-dot-legend.US { background-color: #bd93f9; }
                .mc-dot-legend.INDO { background-color: #ff5555; }
                .mc-dot-legend.BOTH { background-color: #ff79c6; }
                .mc-dot-legend.PROJECTS { background-color: #50fa7b; }
                .mc-dot-legend.OTHER { background-color: #ffb86c; }
                .mc-manage-btn {
                    background: #bd93f9;
                    color: #282a36;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                    width: 100%;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .mc-manage-btn:hover {
                    background: #ff79c6;
                }

                /* Layout Full Channel View (Grid Seamless ala Google Calendar / Screenshot) */
                #mc-full-calendar-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                    background: #282a36;
                    box-sizing: border-box;
                    padding: 16px 24px;
                    overflow: hidden;
                    font-family: 'gg sans', 'Segoe UI', sans-serif;
                }
                .mc-fv-left {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                .mc-fv-grid-days {
                    display: grid;
                    grid-template-columns: 40px repeat(7, 1fr);
                    grid-template-rows: repeat(6, 1fr);
                    gap: 0;
                    flex: 1;
                    overflow: hidden;
                    border-top: 1px solid rgba(98, 114, 164, 0.3);
                    border-left: 1px solid rgba(98, 114, 164, 0.3);
                }
                .mc-fv-week-num-cell {
                    border-right: 1px solid rgba(98, 114, 164, 0.3);
                    border-bottom: 1px solid rgba(98, 114, 164, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: #6272a4;
                    font-weight: 700;
                    background: #1e1f29;
                }
                .mc-fv-day {
                    background: transparent;
                    border-right: 1px solid rgba(98, 114, 164, 0.3);
                    border-bottom: 1px solid rgba(98, 114, 164, 0.3);
                    padding: 8px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    align-items: stretch;
                    transition: background 0.15s;
                    height: 100%;
                    min-height: 0;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                .mc-fv-day:hover {
                    background: rgba(68, 71, 90, 0.3);
                }
                .mc-fv-day.empty {
                    background: rgba(33, 34, 44, 0.4);
                    cursor: default;
                    pointer-events: none;
                }
                .mc-fv-day.today {
                    background: rgba(255, 184, 108, 0.04);
                }
                .mc-fv-day-header {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    width: 100%;
                    margin-bottom: 6px;
                }
                .mc-fv-day-num {
                    font-size: 11px;
                    color: #f8f8f2;
                    font-weight: 600;
                }
                .mc-fv-day.today .mc-fv-day-num {
                    background: #ffb86c;
                    color: #282a36;
                    font-weight: bold;
                    width: 22px;
                    height: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                .mc-fv-day-events {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    width: 100%;
                    overflow-y: auto;
                    flex: 1;
                    padding-right: 2px;
                }
                .mc-fv-day-events::-webkit-scrollbar {
                    width: 3px;
                }
                .mc-fv-day-events::-webkit-scrollbar-thumb {
                    background: #44475a;
                    border-radius: 2px;
                }
                .mc-fv-event-item {
                    font-size: 10px;
                    padding: 3px 6px;
                    border-radius: 4px;
                    color: #282a36;
                    font-weight: 750;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* Form & Detail modal classes */
                .mc-form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-bottom: 12px;
                    font-family: 'gg sans', 'Segoe UI', sans-serif;
                }
                .mc-form-label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #6272a4;
                    text-transform: uppercase;
                }
                .mc-form-input, .mc-form-select, .mc-form-textarea {
                    background: #21222c;
                    border: 1px solid #44475a;
                    color: #f8f8f2;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    outline: none;
                    transition: border 0.2s;
                }
                .mc-form-input:focus, .mc-form-select:focus, .mc-form-textarea:focus {
                    border-color: #bd93f9;
                }
                .mc-form-textarea {
                    height: 80px;
                    resize: vertical;
                }
                .mc-modal-detail-item {
                    border-bottom: 1px solid #44475a;
                    padding-bottom: 16px;
                    margin-bottom: 16px;
                }
                .mc-modal-detail-item:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                    margin-bottom: 0;
                }
            `;
            BdApi.DOM.addStyle("MarketCalendarStyles", css);
        }

        clearStyles() {
            BdApi.DOM.removeStyle("MarketCalendarStyles");
        }

        getCurrentChannelName() {
            try {
                const SelectedChannelStore = BdApi.Webpack.getStore("SelectedChannelStore");
                const ChannelStore = BdApi.Webpack.getStore("ChannelStore");
                if (SelectedChannelStore && ChannelStore) {
                    const channelId = SelectedChannelStore.getChannelId();
                    if (channelId) {
                        const channel = ChannelStore.getChannel(channelId);
                        if (channel && channel.name) {
                            return channel.name.toLowerCase();
                        }
                    }
                }
            } catch (e) {
                console.error("[MarketCalendar] getStore error:", e);
            }

            try {
                const SelectedChannelStore = BdApi.Webpack.getModule(m => m.getChannelId && m.getVoiceChannelId);
                const ChannelStore = BdApi.Webpack.getModule(m => m.getChannel && m.hasChannel);
                if (SelectedChannelStore && ChannelStore) {
                    const channelId = SelectedChannelStore.getChannelId();
                    if (channelId) {
                        const channel = ChannelStore.getChannel(channelId);
                        if (channel && channel.name) {
                            return channel.name.toLowerCase();
                        }
                    }
                }
            } catch (e) {
                console.error("[MarketCalendar] getModule error:", e);
            }

            const activeChannelEl = document.querySelector('[class*="selected-"] [class*="name-"], [class*="selected-"] [class*="channelName-"], [class*="channelName-"][class*="selected-"]');
            if (activeChannelEl) {
                return activeChannelEl.textContent.trim().toLowerCase();
            }

            const titleEl = document.querySelector('section[class*="title-"] h2, section[class*="title-"] h1, [class*="title-"] [class*="name-"], [class*="channelName-"]');
            if (titleEl) {
                return titleEl.textContent.trim().toLowerCase();
            }
            return "";
        }

        updateChannelView() {
            const channelName = this.getCurrentChannelName();
            const isCalendarChannel = channelName.includes("market-calendar") || channelName.includes("marketcalendar");

            if (isCalendarChannel) {
                document.body.classList.add("mc-in-calendar-channel");
                this.injectFullCalendar();
            } else {
                document.body.classList.remove("mc-in-calendar-channel");
                this.removeFullCalendar();
            }
        }

        reactRender(element, container) {
            const ReactDOM = BdApi.ReactDOM;
            if (ReactDOM.createRoot) {
                if (!container._reactRoot) {
                    container._reactRoot = ReactDOM.createRoot(container);
                }
                container._reactRoot.render(element);
            } else {
                ReactDOM.render(element, container);
            }
        }

        reactUnmount(container) {
            const ReactDOM = BdApi.ReactDOM;
            if (container._reactRoot) {
                container._reactRoot.unmount();
                container._reactRoot = null;
            } else {
                ReactDOM.unmountComponentAtNode(container);
            }
        }

        injectFullCalendar() {
            const chatContent = document.querySelector('[class*="chatContent-"], [class*="chatContent"]');
            if (!chatContent) return;

            // Jika sudah ter-inject, jangan lakukan apa-apa
            if (document.getElementById("mc-full-calendar-container")) return;

            const container = document.createElement("div");
            container.id = "mc-full-calendar-container";
            chatContent.appendChild(container);

            const h = BdApi.React.createElement;
            const CalendarComponent = this.getCalendarComponent();

            this.reactRender(h(CalendarComponent, { layout: "full" }), container);
        }

        removeFullCalendar() {
            const container = document.getElementById("mc-full-calendar-container");
            if (container) {
                this.reactUnmount(container);
                container.remove();
            }
        }

        getToolbar() {
            let toolbar = document.querySelector('[class*="toolbar-"]');
            if (toolbar) return toolbar;

            const siblings = [
                '[aria-label="Pinned Messages"]',
                '[aria-label="Member List"]',
                '[aria-label="Inbox"]',
                '[aria-label="Help"]',
                '[class*="search-"]'
            ];
            for (const selector of siblings) {
                const el = document.querySelector(selector);
                if (el) {
                    let parent = el.parentElement;
                    while (parent && parent !== document.body) {
                        const classList = Array.from(parent.classList || []);
                        if (classList.some(c => c.includes("toolbar") || c.includes("upperContainer"))) {
                            if (classList.some(c => c.includes("toolbar"))) return parent;
                            const tb = parent.querySelector('[class*="toolbar-"]');
                            if (tb) return tb;
                        }
                        parent = parent.parentElement;
                    }
                    if (el.parentElement && el.parentElement.tagName === "DIV") {
                        return el.parentElement;
                    }
                }
            }

            return document.querySelector('.header-toolbar, [class*="headerToolbar-"]');
        }

        addCalendarButton() {
            if (document.getElementById("bd-calendar-btn")) return;

            const toolbar = this.getToolbar();
            if (!toolbar) return;

            const btn = document.createElement("div");
            btn.id = "bd-calendar-btn";
            btn.className = "mc-header-button";
            btn.setAttribute("role", "button");
            btn.setAttribute("aria-label", "Market Closed Calendar");
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            `;
            
            btn.addEventListener("click", () => this.showCalendarModal());
            
            if (toolbar.firstChild) {
                toolbar.insertBefore(btn, toolbar.firstChild);
            } else {
                toolbar.appendChild(btn);
            }
        }

        removeCalendarButton() {
            const btn = document.getElementById("bd-calendar-btn");
            if (btn) btn.remove();
        }

        getWeekNumber(d) {
            const date = new Date(d.getTime());
            date.setHours(0, 0, 0, 0);
            // Thursday in current week decides the year.
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            // January 4 is always in week 1.
            const week1 = new Date(date.getFullYear(), 0, 4);
            // Adjust to Thursday in week 1 and calculate difference in weeks
            return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
                                  - 3 + (week1.getDay() + 6) % 7) / 7);
        }

        showDayEventsModal(day, monthIndex, year, dayEvents, refetch) {
            const h = BdApi.React.createElement;
            const self = this;
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            const dateStr = `${day} ${monthNames[monthIndex]} ${year}`;

            const DetailsContent = () => {
                return h("div", { style: { display: "flex", flexDirection: "column", gap: "16px", color: "#f8fafc", fontFamily: "'gg sans', 'Segoe UI', sans-serif" } },
                    dayEvents.map((event, idx) => {
                        let color = "#bd93f9";
                        if (event.market === "INDO") color = "#ff5555";
                        if (event.market === "BOTH") color = "#ff79c6";
                        if (event.market === "PROJECTS") color = "#50fa7b";
                        if (event.market === "OTHER") color = "#ffb86c";

                        return h("div", { key: event.id || idx, className: "mc-modal-detail-item" },
                            h("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" } },
                                h("span", { 
                                    className: "mc-market-badge",
                                    style: { backgroundColor: color }
                                }, `${event.market}`),
                                h("span", { style: { fontSize: "12px", color: "#94a3b8" } }, new Date(event.startTime).toLocaleDateString("id-ID")),
                                h("button", {
                                    style: { marginLeft: "auto", background: "transparent", border: "none", color: "#ff5555", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
                                    onClick: () => {
                                        if (confirm("Are you sure you want to delete this event?")) {
                                            fetch(`${self.apiUrl}/api/events/${event.id}`, {
                                                method: "DELETE",
                                                headers: { "Authorization": `Bearer ${self.apiToken}` }
                                            }).then(res => {
                                                if(!res.ok) throw new Error("Failed");
                                                BdApi.showToast("Event deleted!", { type: "success" });
                                                if (refetch) refetch();
                                            }).catch(err => {
                                                BdApi.showToast("Failed to delete event", { type: "error" });
                                            });
                                        }
                                    }
                                }, "🗑 Delete")
                            ),
                            h("h4", { style: { fontSize: "16px", fontWeight: "bold", color: "#f8fafc", marginBottom: "4px" } }, event.title),
                            event.description && h("p", { 
                                style: { fontSize: "13px", color: "#cbd5e1", lineHeight: "1.4" },
                                dangerouslySetInnerHTML: { __html: event.description }
                            }),
                            event.image && h("img", { 
                                src: event.image, 
                                style: { width: "100%", borderRadius: "8px", marginTop: "8px", maxHeight: "180px", objectFit: "cover" } 
                            })
                        );
                    })
                );
            };

            const formattedMonth = String(monthIndex + 1).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            const defaultDate = `${year}-${formattedMonth}-${formattedDay}`;

            BdApi.UI.showConfirmationModal(
                `📅 Events on ${dateStr}`,
                h(DetailsContent),
                {
                    confirmText: "Close",
                    cancelText: "➕ Add Another Event",
                    onCancel: () => {
                        self.showAddEventModal(defaultDate, refetch);
                    }
                }
            );
        }

        showAddEventModal(defaultDate, refetch) {
            const h = BdApi.React.createElement;
            const self = this;

            const AddEventForm = () => {
                const [title, setTitle] = BdApi.React.useState("");
                const [market, setMarket] = BdApi.React.useState("US");
                const [date, setDate] = BdApi.React.useState(defaultDate || "");
                const [description, setDescription] = BdApi.React.useState("");
                const [image, setImage] = BdApi.React.useState("");

                BdApi.React.useEffect(() => {
                    self._currentFormValues = { title, market, date, description, image };
                }, [title, market, date, description, image]);

                return h("div", { style: { display: "flex", flexDirection: "column", color: "#f8fafc", fontFamily: "'gg sans', 'Segoe UI', sans-serif" } },
                    h("div", { className: "mc-form-group" },
                        h("label", { className: "mc-form-label" }, "Event Title *"),
                        h("input", { 
                            className: "mc-form-input", 
                            type: "text", 
                            value: title, 
                            placeholder: "e.g. Thanksgiving Day / Libur Natal",
                            onChange: (e) => setTitle(e.target.value) 
                        })
                    ),
                    h("div", { className: "mc-form-group" },
                        h("label", { className: "mc-form-label" }, "Tipe *"),
                        h("select", { 
                            className: "mc-form-select", 
                            value: market,
                            onChange: (e) => setMarket(e.target.value) 
                        },
                            h("option", { value: "US" }, "US"),
                            h("option", { value: "INDO" }, "INDO"),
                            h("option", { value: "BOTH" }, "BOTH"),
                            h("option", { value: "PROJECTS" }, "PROJECTS"),
                            h("option", { value: "OTHER" }, "OTHER")
                        )
                    ),
                    h("div", { className: "mc-form-group" },
                        h("label", { className: "mc-form-label" }, "Event Date *"),
                        h("input", { 
                            className: "mc-form-input", 
                            type: "date", 
                            value: date,
                            onChange: (e) => setDate(e.target.value) 
                        })
                    ),
                    h("div", { className: "mc-form-group" },
                        h("label", { className: "mc-form-label" }, "Description (HTML supported)"),
                        h("textarea", { 
                            className: "mc-form-textarea", 
                            value: description,
                            placeholder: "e.g. Bursa saham AS tutup sepanjang hari.",
                            onChange: (e) => setDescription(e.target.value) 
                        })
                    ),
                    h("div", { className: "mc-form-group" },
                        h("label", { className: "mc-form-label" }, "Image URL (Optional)"),
                        h("input", { 
                            className: "mc-form-input", 
                            type: "text", 
                            value: image,
                            placeholder: "e.g. https://domain.com/image.png",
                            onChange: (e) => setImage(e.target.value) 
                        })
                    )
                );
            };

            BdApi.UI.showConfirmationModal(
                "➕ Add New Event",
                h(AddEventForm),
                {
                    confirmText: "Save Event",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        const vals = self._currentFormValues;
                        if (!vals || !vals.title.trim() || !vals.date) {
                            BdApi.showToast("Title and Date are required!", { type: "error" });
                            return;
                        }

                        const currentUser = BdApi.Webpack.getStore("UserStore")?.getCurrentUser();
                        const createdBy = currentUser ? currentUser.id : "system";

                        const payload = {
                            title: vals.title.trim(),
                            market: vals.market,
                            startTime: `${vals.date}T00:00:00.000Z`,
                            endTime: `${vals.date}T23:59:59.000Z`,
                            description: vals.description.trim(),
                            image: vals.image.trim() || null,
                            createdBy
                        };

                        fetch(`${self.apiUrl}/api/events`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${self.apiToken}`
                            },
                            body: JSON.stringify(payload)
                        })
                        .then(async res => {
                            if (!res.ok) {
                                const errData = await res.json().catch(() => ({}));
                                throw new Error(errData.error || "Failed to save event");
                            }
                            return res.json();
                        })
                        .then(() => {
                            BdApi.showToast("Event successfully saved!", { type: "success" });
                            if (refetch) refetch();
                        })
                        .catch(err => {
                            console.error("[MarketCalendar] Save error:", err);
                            BdApi.showToast(err.message, { type: "error" });
                        });
                    }
                }
            );
        }

        getCalendarComponent() {
            if (this._calendarComponent) return this._calendarComponent;

            const h = BdApi.React.createElement;
            const self = this;

            this._calendarComponent = ({ layout = "modal" }) => {
                const [currentDate, setCurrentDate] = BdApi.React.useState(new Date());
                const [events, setEvents] = BdApi.React.useState([]);
                const [loading, setLoading] = BdApi.React.useState(true);
                const [selectedEvent, setSelectedEvent] = BdApi.React.useState(null);

                const fetchEvents = () => {
                    setLoading(true);
                    fetch(`${self.apiUrl}/api/events?t=${Date.now()}`)
                        .then(res => {
                            if (!res.ok) throw new Error("Server error");
                            return res.json();
                        })
                        .then(data => {
                            setEvents(Array.isArray(data) ? data : []);
                            setLoading(false);
                        })
                        .catch(err => {
                            console.error("[MarketCalendar]", err);
                            BdApi.showToast("Failed to fetch events from Dashboard API", { type: "error" });
                            setLoading(false);
                        });
                };

                BdApi.React.useEffect(() => {
                    fetchEvents();
                }, []);

                // Simpan callback refetch di instansi kelas agar modal eksternal dapat memanggilnya
                self.refetchCalendarEvents = fetchEvents;

                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();

                const firstDayIndex = new Date(year, month, 1).getDay();
                const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Mon first
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];

                const handlePrev = () => {
                    setCurrentDate(new Date(year, month - 1, 1));
                    setSelectedEvent(null);
                };

                const handleNext = () => {
                    setCurrentDate(new Date(year, month + 1, 1));
                    setSelectedEvent(null);
                };

                const handleToday = () => {
                    setCurrentDate(new Date());
                    setSelectedEvent(null);
                };

                const days = [];
                for (let i = 0; i < offset; i++) {
                    days.push({ day: null, key: `empty-${i}` });
                }
                for (let d = 1; d <= daysInMonth; d++) {
                    const dayEvents = events.filter(e => {
                        const eDate = new Date(e.startTime);
                        return eDate.getFullYear() === year && eDate.getMonth() === month && eDate.getDate() === d;
                    });
                    days.push({ day: d, events: dayEvents, key: `day-${d}` });
                }

                // Tambahkan sisa hari kosong di akhir grid agar pas 42 sel (6 baris x 7 kolom)
                const totalCells = 42;
                const remaining = totalCells - days.length;
                for (let i = 0; i < remaining; i++) {
                    days.push({ day: null, key: `empty-end-${i}` });
                }

                const dayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

                // layout === "full" (Full screen channel view)
                if (layout === "full") {
                    return h("div", { id: "mc-full-calendar-container" },
                        h("div", { className: "mc-fv-left" },
                            h("div", { className: "mc-cal-header" },
                                h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
                                    h("button", { className: "mc-nav-btn", onClick: handleToday }, "Today"),
                                    h("button", { className: "mc-nav-btn", onClick: handlePrev }, "◀"),
                                    h("button", { className: "mc-nav-btn", onClick: handleNext }, "▶")
                                ),
                                h("span", { className: "mc-cal-title", style: { fontSize: "20px" } }, `${monthNames[month]} ${year}`),
                                h("div", { style: { display: "flex", gap: "10px" } },
                                    h("button", { 
                                        className: "mc-nav-btn", 
                                        style: { background: "#50fa7b", border: "none", color: "#282a36", fontWeight: "800" },
                                        onClick: () => self.showAddEventModal(null, fetchEvents)
                                    }, "➕ Add Event"),
                                    h("button", { 
                                        className: "mc-nav-btn", 
                                        onClick: () => window.open(self.apiUrl, "_blank")
                                    }, "🌐 Web Dashboard")
                                )
                            ),
                            h("div", { className: "mc-grid-labels mc-fv-labels" },
                                h("div", { className: "mc-label", style: { width: "40px" } }), // Spacer untuk kolom nomor minggu
                                dayLabels.map(label => h("div", { className: "mc-label", key: label }, label))
                            ),
                            h("div", { className: "mc-fv-grid-days" },
                                loading 
                                    ? h("div", { className: "mc-loading" }, "Loading market events...")
                                    : Array.from({ length: 6 }).map((_, rowIndex) => {
                                        // Hitung nomor minggu ISO untuk baris ini
                                        const firstDayOfRowDate = new Date(year, month, (rowIndex * 7) - offset + 1);
                                        const weekNum = self.getWeekNumber(firstDayOfRowDate);

                                        // Ambil 7 sel hari untuk baris ini
                                        const rowCells = days.slice(rowIndex * 7, (rowIndex + 1) * 7);

                                        return [
                                            // Sel nomor minggu (kolom pertama)
                                            h("div", { className: "mc-fv-week-num-cell", key: `week-${rowIndex}` }, weekNum),
                                            // 7 Sel hari
                                            ...rowCells.map(cell => {
                                                if (cell.day === null) {
                                                    return h("div", { className: "mc-fv-day empty", key: cell.key });
                                                }
                                                const hasEvents = cell.events && cell.events.length > 0;
                                                const today = new Date();
                                                const isToday = today.getDate() === cell.day && today.getMonth() === month && today.getFullYear() === year;
                                                
                                                // Tampilkan label bulan jika tanggal 1
                                                const dayLabel = cell.day === 1 
                                                    ? `1 ${monthNames[month].substring(0, 3)}` 
                                                    : `${cell.day}`;

                                                return h("div", { 
                                                    className: `mc-fv-day${isToday ? " today" : ""}`, 
                                                    key: cell.key,
                                                    onClick: () => {
                                                        if (hasEvents) {
                                                            self.showDayEventsModal(cell.day, month, year, cell.events, fetchEvents);
                                                        } else {
                                                            const formattedMonth = String(month + 1).padStart(2, '0');
                                                            const formattedDay = String(cell.day).padStart(2, '0');
                                                            const defaultDate = `${year}-${formattedMonth}-${formattedDay}`;
                                                            self.showAddEventModal(defaultDate, fetchEvents);
                                                        }
                                                    }
                                                },
                                                    h("div", { className: "mc-fv-day-header" },
                                                        h("span", { className: "mc-fv-day-num" }, dayLabel)
                                                    ),
                                                    hasEvents && h("div", { className: "mc-fv-day-events" },
                                                        cell.events.map((e, idx) => {
                                                            let color = "#bd93f9";
                                                            if (e.market === "INDO") color = "#ff5555";
                                                            if (e.market === "BOTH") color = "#ff79c6";
                                                            if (e.market === "PROJECTS") color = "#50fa7b";
                                                            if (e.market === "OTHER") color = "#ffb86c";
                                                            return h("div", { 
                                                                className: "mc-fv-event-item", 
                                                                style: { backgroundColor: color }, 
                                                                key: idx,
                                                                title: e.title 
                                                            }, e.title);
                                                        })
                                                    )
                                                );
                                            })
                                        ];
                                    }).flat()
                            ),
                            // Footer Kalender dengan Legenda
                            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", borderTop: "1px solid var(--border-muted, rgba(255,255,255,0.08))", paddingTop: "12px" } },
                                h("div", { className: "mc-legend" },
                                    h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend US" }), " US"),
                                    h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend INDO" }), " INDO"),
                                    h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend BOTH" }), " BOTH"),
                                    h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend PROJECTS" }), " PROJECTS"),
                                    h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend OTHER" }), " OTHER")
                                ),
                                h("span", { style: { fontSize: "11px", color: "var(--text-muted, #64748b)" } }, "* Tip: Click on any empty day to add a new event.")
                            )
                        )
                    );
                }

                // layout === "modal" (Popup view)
                return h("div", { className: "mc-modal-container" },
                    h("div", { className: "mc-cal-header" },
                        h("button", { className: "mc-nav-btn", onClick: handlePrev }, "◀"),
                        h("span", { className: "mc-cal-title" }, `${monthNames[month]} ${year}`),
                        h("button", { className: "mc-nav-btn", onClick: handleNext }, "▶")
                    ),
                    h("div", { className: "mc-grid-labels" },
                        dayLabels.map(label => h("div", { className: "mc-label", key: label }, label))
                    ),
                    h("div", { className: "mc-grid-days" },
                        loading 
                            ? h("div", { className: "mc-loading" }, "Loading market events...")
                            : days.map(cell => {
                                if (cell.day === null) {
                                    return h("div", { className: "mc-day empty", key: cell.key });
                                }
                                const hasEvents = cell.events && cell.events.length > 0;
                                const today = new Date();
                                const isToday = today.getDate() === cell.day && today.getMonth() === month && today.getFullYear() === year;
                                
                                return h("div", { 
                                    className: `mc-day${isToday ? " today" : ""}`, 
                                    key: cell.key,
                                    onClick: () => {
                                        if (hasEvents) {
                                            self.showDayEventsModal(cell.day, month, year, cell.events, fetchEvents);
                                        } else {
                                            const formattedMonth = String(month + 1).padStart(2, '0');
                                            const formattedDay = String(cell.day).padStart(2, '0');
                                            const defaultDate = `${year}-${formattedMonth}-${formattedDay}`;
                                            self.showAddEventModal(defaultDate, fetchEvents);
                                        }
                                    }
                                },
                                    h("span", { className: "mc-day-number" }, cell.day),
                                    hasEvents && h("div", { className: "mc-event-dots" },
                                        cell.events.map((e, idx) => {
                                            let color = "#bd93f9";
                                            if (e.market === "INDO") color = "#ff5555";
                                            if (e.market === "BOTH") color = "#ff79c6";
                                            if (e.market === "PROJECTS") color = "#50fa7b";
                                            if (e.market === "OTHER") color = "#ffb86c";
                                            return h("span", { 
                                                className: "mc-dot", 
                                                style: { backgroundColor: color }, 
                                                key: idx 
                                            });
                                        })
                                    )
                                );
                            })
                    ),
                    selectedEvent 
                        ? h("div", { className: "mc-event-detail" },
                            h("div", { className: "mc-detail-header" },
                                h("span", { 
                                    className: "mc-market-badge",
                                    style: { backgroundColor: selectedEvent.market === "INDO" ? "#ff5555" : selectedEvent.market === "BOTH" ? "#ff79c6" : selectedEvent.market === "PROJECTS" ? "#50fa7b" : selectedEvent.market === "OTHER" ? "#ffb86c" : "#bd93f9" }
                                }, `${selectedEvent.market}`),
                                h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
                                    h("button", {
                                        style: { background: "transparent", border: "none", color: "#ff5555", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
                                        onClick: () => {
                                            if (confirm("Are you sure you want to delete this event?")) {
                                                fetch(`${self.apiUrl}/api/events/${selectedEvent.id}`, {
                                                    method: "DELETE",
                                                    headers: { "Authorization": `Bearer ${self.apiToken}` }
                                                }).then(res => {
                                                    if(!res.ok) throw new Error("Failed");
                                                    BdApi.showToast("Event deleted!", { type: "success" });
                                                    setSelectedEvent(null);
                                                    fetchEvents();
                                                }).catch(err => {
                                                    BdApi.showToast("Failed to delete event", { type: "error" });
                                                });
                                            }
                                        }
                                    }, "🗑 Delete"),
                                    h("button", { className: "mc-close-detail", onClick: () => setSelectedEvent(null) }, "✖")
                                )
                            ),
                            h("h4", { className: "mc-detail-title" }, selectedEvent.title),
                            selectedEvent.description && h("p", { 
                                className: "mc-detail-desc",
                                dangerouslySetInnerHTML: { __html: selectedEvent.description }
                            }),
                            selectedEvent.image && h("img", { className: "mc-detail-img", src: selectedEvent.image })
                        )
                        : h("div", { className: "mc-footer-info" },
                            h("div", { className: "mc-legend" },
                                h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend US" }), " US"),
                                h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend INDO" }), " INDO"),
                                h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend BOTH" }), " BOTH"),
                                h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend PROJECTS" }), " PROJECTS"),
                                h("span", { className: "mc-legend-item" }, h("span", { className: "mc-dot-legend OTHER" }), " OTHER")
                            ),
                            h("button", { 
                                className: "mc-manage-btn",
                                onClick: () => window.open(self.apiUrl, "_blank")
                            }, "🌐 Manage in Web Dashboard")
                        )
                );
            };

            return this._calendarComponent;
        }

        showCalendarModal() {
            const h = BdApi.React.createElement;
            const CalendarComponent = this.getCalendarComponent();

            // Open custom modal directly with React Element
            BdApi.UI.showConfirmationModal(
                "", // No title header needed, we custom render it
                h(CalendarComponent, { layout: "modal" }),
                {
                    confirmText: "Close",
                    cancelText: null
                }
            );
        }
    };
})();
