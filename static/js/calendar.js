class CalendarComponent {
    constructor(container, options = {}) {
        this.container = container;
        this.currentDate = new Date();
        this.viewMode = options.viewMode || 'month';
        this.events = [];
        this.filterProject = options.filterProject || '';
        this.filterType = options.filterType || '';
        this.filterResource = options.filterResource || '';
        this.searchQuery = '';
        this.draggedEvent = null;
        this.onEventClick = options.onEventClick || null;
        this.onDateClick = options.onDateClick || null;
        this.onEventDrop = options.onEventDrop || null;
        this.eventCache = {};
        this.init();
    }

    init() {
        this.render();
        this.loadEvents();
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
        this.loadEvents();
    }

    setDate(date) {
        this.currentDate = new Date(date);
        this.render();
        this.loadEvents();
    }

    prev() {
        if (this.viewMode === 'day') {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
        } else if (this.viewMode === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        } else {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        }
        this.render();
        this.loadEvents();
    }

    next() {
        if (this.viewMode === 'day') {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
        } else if (this.viewMode === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        } else {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        }
        this.render();
        this.loadEvents();
    }

    today() {
        this.currentDate = new Date();
        this.render();
        this.loadEvents();
    }

    getDateRange() {
        const start = new Date(this.currentDate);
        const end = new Date(this.currentDate);

        if (this.viewMode === 'day') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (this.viewMode === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    }

    async loadEvents() {
        const { start, end } = this.getDateRange();
        const cacheKey = `${start.toISOString()}_${end.toISOString()}_${this.filterProject}_${this.filterType}_${this.filterResource}`;
        
        if (this.eventCache[cacheKey]) {
            this.events = this.eventCache[cacheKey];
            this.renderEvents();
            return;
        }

        const params = new URLSearchParams({
            start: start.toISOString(),
            end: end.toISOString()
        });
        if (this.filterProject) params.append('project_id', this.filterProject);
        if (this.filterType) params.append('event_type', this.filterType);
        if (this.filterResource) params.append('resource_type', this.filterResource);

        try {
            const result = await api.get(`/calendar/events?${params.toString()}`);
            this.events = result.events || [];
            this.eventCache[cacheKey] = this.events;
            this.renderEvents();
        } catch (error) {
            console.error('加载日历事件失败:', error);
        }
    }

    clearCache() {
        this.eventCache = {};
    }

    setFilter(key, value) {
        if (key === 'project') this.filterProject = value;
        else if (key === 'type') this.filterType = value;
        else if (key === 'resource') this.filterResource = value;
        else if (key === 'search') this.searchQuery = value;
        this.render();
        this.loadEvents();
    }

    getFilteredEvents() {
        let events = [...this.events];
        
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            events = events.filter(e => 
                e.title.toLowerCase().includes(query) ||
                (e.description && e.description.toLowerCase().includes(query)) ||
                (e.location && e.location.toLowerCase().includes(query))
            );
        }

        return events;
    }

    render() {
        this.container.innerHTML = `
            <div class="calendar-wrapper">
                <div class="calendar-header">
                    <div class="calendar-nav">
                        <button class="btn btn-outline btn-sm" onclick="calendarInstance.prev()">
                            ◀
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="calendarInstance.today()">
                            今天
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="calendarInstance.next()">
                            ▶
                        </button>
                        <span class="calendar-title" id="calendar-title"></span>
                    </div>
                    <div class="calendar-view-switch">
                        <button class="btn btn-sm ${this.viewMode === 'day' ? 'btn-primary' : 'btn-outline'}" 
                                onclick="calendarInstance.setViewMode('day')">日</button>
                        <button class="btn btn-sm ${this.viewMode === 'week' ? 'btn-primary' : 'btn-outline'}" 
                                onclick="calendarInstance.setViewMode('week')">周</button>
                        <button class="btn btn-sm ${this.viewMode === 'month' ? 'btn-primary' : 'btn-outline'}" 
                                onclick="calendarInstance.setViewMode('month')">月</button>
                    </div>
                </div>
                <div class="calendar-body" id="calendar-body"></div>
            </div>
        `;

        this.updateTitle();

        if (this.viewMode === 'day') {
            this.renderDayView();
        } else if (this.viewMode === 'week') {
            this.renderWeekView();
        } else {
            this.renderMonthView();
        }
    }

    updateTitle() {
        const titleEl = document.getElementById('calendar-title');
        if (!titleEl) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth() + 1;
        const date = this.currentDate.getDate();

        if (this.viewMode === 'day') {
            titleEl.textContent = `${year}年${month}月${date}日`;
        } else if (this.viewMode === 'week') {
            const { start, end } = this.getDateRange();
            const startMonth = start.getMonth() + 1;
            const startDate = start.getDate();
            const endMonth = end.getMonth() + 1;
            const endDate = end.getDate();
            titleEl.textContent = `${year}年 ${startMonth}月${startDate}日 - ${endMonth}月${endDate}日`;
        } else {
            titleEl.textContent = `${year}年${month}月`;
        }
    }

    renderDayView() {
        const body = document.getElementById('calendar-body');
        if (!body) return;

        const hours = [];
        for (let i = 0; i < 24; i++) {
            hours.push(i);
        }

        body.innerHTML = `
            <div class="day-view">
                <div class="day-header">
                    <div class="day-name">${this.getDayName(this.currentDate.getDay())}</div>
                    <div class="day-number ${this.isToday(this.currentDate) ? 'today' : ''}">
                        ${this.currentDate.getDate()}
                    </div>
                </div>
                <div class="day-time-grid" id="day-time-grid">
                    ${hours.map(hour => `
                        <div class="time-slot" data-hour="${hour}">
                            <div class="time-label">${hour.toString().padStart(2, '0')}:00</div>
                            <div class="time-events" data-hour="${hour}"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.renderDayEvents();
        this.setupDayDrag();
    }

    renderWeekView() {
        const body = document.getElementById('calendar-body');
        if (!body) return;

        const { start } = this.getDateRange();
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }

        const hours = [];
        for (let i = 0; i < 24; i++) {
            hours.push(i);
        }

        body.innerHTML = `
            <div class="week-view">
                <div class="week-header">
                    <div class="week-time-col"></div>
                    ${days.map(day => `
                        <div class="week-day-header">
                            <div class="day-name">${this.getDayName(day.getDay())}</div>
                            <div class="day-number ${this.isToday(day) ? 'today' : ''}">
                                ${day.getDate()}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="week-time-grid" id="week-time-grid">
                    ${hours.map(hour => `
                        <div class="week-hour-row">
                            <div class="time-label">${hour.toString().padStart(2, '0')}:00</div>
                            ${days.map((day, dayIdx) => `
                                <div class="week-day-cell" data-date="${day.toDateString()}" data-hour="${hour}">
                                    <div class="time-events"></div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.renderWeekEvents();
        this.setupWeekDrag();
    }

    renderMonthView() {
        const body = document.getElementById('calendar-body');
        if (!body) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthLastDay - i);
            days.push({ date: d, isOtherMonth: true });
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(year, month, i);
            days.push({ date: d, isOtherMonth: false });
        }

        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(year, month + 1, i);
            days.push({ date: d, isOtherMonth: true });
        }

        const dayNames = ['一', '二', '三', '四', '五', '六', '日'];

        body.innerHTML = `
            <div class="month-view">
                <div class="month-header">
                    ${dayNames.map(name => `<div class="month-day-name">${name}</div>`).join('')}
                </div>
                <div class="month-grid" id="month-grid">
                    ${days.map(({ date, isOtherMonth }) => `
                        <div class="month-cell ${isOtherMonth ? 'other-month' : ''} ${this.isToday(date) ? 'today' : ''}" 
                             data-date="${date.toISOString().split('T')[0]}">
                            <div class="month-cell-header">
                                <span class="cell-date">${date.getDate()}</span>
                            </div>
                            <div class="month-cell-events"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.renderMonthEvents();
        this.setupMonthClick();
    }

    renderEvents() {
        if (this.viewMode === 'day') {
            this.renderDayEvents();
        } else if (this.viewMode === 'week') {
            this.renderWeekEvents();
        } else {
            this.renderMonthEvents();
        }
    }

    renderDayEvents() {
        const grid = document.getElementById('day-time-grid');
        if (!grid) return;

        const events = this.getFilteredEvents().filter(e => 
            this.isSameDay(new Date(e.start_time), this.currentDate)
        );

        const timeEvents = grid.querySelectorAll('.time-events');
        timeEvents.forEach(el => el.innerHTML = '');

        events.forEach(event => {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            const startHour = start.getHours() + start.getMinutes() / 60;
            const duration = (end - start) / (1000 * 60 * 60);

            const hourEl = grid.querySelector(`[data-hour="${Math.floor(startHour)}"] .time-events`);
            if (hourEl) {
                const top = (startHour % 1) * 100;
                const height = Math.max(duration * 100, 20);

                const eventEl = document.createElement('div');
                eventEl.className = `calendar-event event-${event.event_type}`;
                eventEl.style.backgroundColor = event.color;
                eventEl.style.top = `${top}%`;
                eventEl.style.height = `${height}%`;
                eventEl.draggable = true;
                eventEl.dataset.eventId = event.id;
                eventEl.innerHTML = `
                    <div class="event-title">${escapeHtml(event.title)}</div>
                    <div class="event-time">
                        ${this.formatTime(start)} - ${this.formatTime(end)}
                    </div>
                `;
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.onEventClick) this.onEventClick(event);
                });
                eventEl.addEventListener('dragstart', (e) => this.handleDragStart(e, event));
                eventEl.addEventListener('dragend', (e) => this.handleDragEnd(e));
                hourEl.appendChild(eventEl);
            }
        });
    }

    renderWeekEvents() {
        const grid = document.getElementById('week-time-grid');
        if (!grid) return;

        const events = this.getFilteredEvents();

        grid.querySelectorAll('.time-events').forEach(el => el.innerHTML = '');

        events.forEach(event => {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            const dateStr = start.toDateString();

            const cell = grid.querySelector(`[data-date="${dateStr}"] .time-events`);
            if (cell) {
                const startHour = start.getHours() + start.getMinutes() / 60;
                const duration = (end - start) / (1000 * 60 * 60);

                const eventEl = document.createElement('div');
                eventEl.className = `calendar-event event-${event.event_type}`;
                eventEl.style.backgroundColor = event.color;
                eventEl.style.top = '0';
                eventEl.style.height = `${Math.max(duration * 60, 24)}px`;
                eventEl.draggable = true;
                eventEl.dataset.eventId = event.id;
                eventEl.innerHTML = `
                    <div class="event-title">${escapeHtml(event.title)}</div>
                    <div class="event-time">${this.formatTime(start)} - ${this.formatTime(end)}</div>
                `;
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.onEventClick) this.onEventClick(event);
                });
                eventEl.addEventListener('dragstart', (e) => this.handleDragStart(e, event));
                eventEl.addEventListener('dragend', (e) => this.handleDragEnd(e));
                cell.appendChild(eventEl);
            }
        });
    }

    renderMonthEvents() {
        const grid = document.getElementById('month-grid');
        if (!grid) return;

        const events = this.getFilteredEvents();
        const eventsByDate = {};

        events.forEach(event => {
            const dateKey = new Date(event.start_time).toISOString().split('T')[0];
            if (!eventsByDate[dateKey]) {
                eventsByDate[dateKey] = [];
            }
            eventsByDate[dateKey].push(event);
        });

        grid.querySelectorAll('.month-cell').forEach(cell => {
            const dateStr = cell.dataset.date;
            const eventsContainer = cell.querySelector('.month-cell-events');
            if (!eventsContainer) return;

            eventsContainer.innerHTML = '';
            const dayEvents = eventsByDate[dateStr] || [];

            dayEvents.slice(0, 3).forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = `month-event event-${event.event_type}`;
                eventEl.style.borderLeftColor = event.color;
                eventEl.innerHTML = `<span class="month-event-time">${this.formatTime(new Date(event.start_time))}</span> ${escapeHtml(event.title)}`;
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.onEventClick) this.onEventClick(event);
                });
                eventsContainer.appendChild(eventEl);
            });

            if (dayEvents.length > 3) {
                const moreEl = document.createElement('div');
                moreEl.className = 'more-events';
                moreEl.textContent = `+${dayEvents.length - 3} 更多`;
                eventsContainer.appendChild(moreEl);
            }
        });
    }

    setupMonthClick() {
        const grid = document.getElementById('month-grid');
        if (!grid) return;

        grid.querySelectorAll('.month-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.dataset.date;
                if (this.onDateClick) {
                    this.onDateClick(new Date(dateStr));
                }
            });
        });
    }

    setupDayDrag() {
        const grid = document.getElementById('day-time-grid');
        if (!grid) return;

        grid.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                slot.classList.add('drag-over');
            });
            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                if (this.draggedEvent && this.onEventDrop) {
                    const hour = parseInt(slot.dataset.hour);
                    const newDate = new Date(this.currentDate);
                    newDate.setHours(hour, 0, 0, 0);
                    this.onEventDrop(this.draggedEvent, newDate);
                }
            });
        });
    }

    setupWeekDrag() {
        const grid = document.getElementById('week-time-grid');
        if (!grid) return;

        grid.querySelectorAll('.week-day-cell').forEach(cell => {
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                cell.classList.add('drag-over');
            });
            cell.addEventListener('dragleave', () => {
                cell.classList.remove('drag-over');
            });
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                if (this.draggedEvent && this.onEventDrop) {
                    const hour = parseInt(cell.dataset.hour);
                    const date = new Date(cell.dataset.date);
                    date.setHours(hour, 0, 0, 0);
                    this.onEventDrop(this.draggedEvent, date);
                }
            });
        });
    }

    handleDragStart(e, event) {
        this.draggedEvent = event;
        e.target.style.opacity = '0.5';
    }

    handleDragEnd(e) {
        e.target.style.opacity = '1';
        this.draggedEvent = null;
    }

    isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    isToday(date) {
        return this.isSameDay(date, new Date());
    }

    getDayName(dayIndex) {
        const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return names[dayIndex];
    }

    formatTime(date) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    addEvent(event) {
        this.events.push(event);
        this.clearCache();
        this.renderEvents();
    }

    updateEvent(event) {
        const idx = this.events.findIndex(e => e.id === event.id);
        if (idx !== -1) {
            this.events[idx] = event;
            this.clearCache();
            this.renderEvents();
        }
    }

    removeEvent(eventId) {
        this.events = this.events.filter(e => e.id !== eventId);
        this.clearCache();
        this.renderEvents();
    }
}

let calendarInstance = null;
