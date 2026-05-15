const DashboardApp = {
    config: { apiUrl: 'api.php' },
    state: { tickets: [], ticketModal: null },

    el: {
        tbody: document.getElementById('tickets-table-body'),
        searchInput: document.getElementById('searchTicketInput'),
        statusFilter: document.getElementById('statusTicketFilter'),
        sortFilter: document.getElementById('sortTicketFilter'),
        form: document.getElementById('dashboardTicketForm')
    },

    async request(action, data = null, method = 'POST') {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (data) options.body = JSON.stringify({ action, ...data });
        try {
            const url = data ? this.config.apiUrl : `${this.config.apiUrl}?action=${action}&t=${Date.now()}`;
            const response = await fetch(url, data ? options : undefined);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { status: 'error' };
        }
    },

    async init() {
        this.state.ticketModal = new bootstrap.Modal(document.getElementById('dashboardTicketModal'));
        this.bindEvents();
        await this.loadData();
    },

    bindEvents() {
        // Делегування подій для редагування та зміни статусу
        this.el.tbody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('.editable-cell');
            if (cell) {
                const id = cell.parentElement.dataset.id;
                const field = cell.dataset.field;
                this.editCell(cell, id, field);
            }
        });

        this.el.tbody.addEventListener('change', async (e) => {
            if (e.target.classList.contains('status-select')) {
                const tr = e.target.closest('tr');
                const ticketId = tr.dataset.id;
                const deviceId = tr.dataset.deviceId;
                await this.request('update_ticket_status', { ticket_id: ticketId, device_id: deviceId, status: e.target.value });
                await this.loadData();
            }
        });

        this.el.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                device_id: document.getElementById('ticket_device_select').value,
                subject: document.getElementById('ticket_subject').value,
                description: document.getElementById('ticket_description').value,
                priority: document.getElementById('ticket_priority').value
            };
            await this.request('add_ticket', payload);
            this.state.ticketModal.hide();
            await this.loadData();
        });

        this.el.searchInput.addEventListener('input', () => this.renderTable());
        this.el.statusFilter.addEventListener('change', () => this.renderTable());
        this.el.sortFilter.addEventListener('change', () => this.renderTable());
    },

    async loadData() {
        const result = await this.request('get_tickets', null, 'GET');
        if (result.status === 'success') {
            this.state.tickets = result.data;
            this.renderTable();
        }
    },

    renderTable() {
        const searchQuery = this.el.searchInput.value.toLowerCase();
        const statusQuery = this.el.statusFilter.value;
        const sortQuery = this.el.sortFilter.value;

        let filtered = this.state.tickets.filter(t => {
            const textToSearch = `${t.hostname} ${t.subject} ${t.description}`.toLowerCase();
            return textToSearch.includes(searchQuery) && (statusQuery === 'all' || t.status === statusQuery);
        });

        // Сортування
        filtered.sort((a, b) => {
            if (sortQuery === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
            if (sortQuery === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
            if (sortQuery === 'priority_desc') {
                const weights = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
                return weights[b.priority] - weights[a.priority];
            }
            return 0;
        });

        if (filtered.length === 0) {
            this.el.tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted fw-bold">Нічого не знайдено</td></tr>`;
            return;
        }

        const priorityBadges = {
            'low': '<span class="badge bg-success">Низький</span>',
            'medium': '<span class="badge bg-warning text-dark">Середній</span>',
            'high': '<span class="badge bg-orange" style="background-color: #fd7e14;">Високий</span>',
            'critical': '<span class="badge bg-danger shadow-sm">Критичний</span>'
        };

        const statusClasses = {
            'new': 'bg-primary text-white',
            'in_progress': 'bg-warning text-dark',
            'unresolved': 'bg-secondary text-white',
            'completed': 'bg-success text-white'
        };

        this.el.tbody.innerHTML = filtered.map(t => {
            const sClass = statusClasses[t.status] || '';
            return `
                <tr data-id="${t.id}" data-device-id="${t.device_id}">
                    <td><span class="text-muted fw-bold">#${t.id}</span></td>
                    <td>
                        <i class="fa-solid ${t.icon} text-secondary me-2"></i><strong>${t.hostname}</strong><br>
                        <small class="text-muted">${t.ip_address || 'No IP'}</small>
                    </td>
                    <td class="fw-bold editable-cell" data-field="subject" title="Подвійний клік для редагування">${t.subject}</td>
                    <td class="text-muted small editable-cell" data-field="description" title="Подвійний клік для редагування" 
                        style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.description}</td>
                    <td>${priorityBadges[t.priority]}</td>
                    <td><small class="text-muted">${new Date(t.created_at).toLocaleString('uk-UA')}</small></td>
                    <td class="text-end">
                        <select class="form-select form-select-sm fw-bold status-select ${sClass}" style="border: none; box-shadow: none;">
                            <option value="new" class="bg-white text-dark fw-normal" ${t.status === 'new' ? 'selected' : ''}>Нове</option>
                            <option value="in_progress" class="bg-white text-dark fw-normal" ${t.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                            <option value="unresolved" class="bg-white text-dark fw-normal" ${t.status === 'unresolved' ? 'selected' : ''}>Немає рішення</option>
                            <option value="completed" class="bg-white text-dark fw-normal" ${t.status === 'completed' ? 'selected' : ''}>Виконано</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async editCell(td, id, fieldName) {
        if (td.querySelector('input') || td.querySelector('textarea')) return;

        const ticket = this.state.tickets.find(t => parseInt(t.id) === parseInt(id));
        const oldValue = ticket[fieldName] || '';

        const input = document.createElement(fieldName === 'description' ? 'textarea' : 'input');
        input.className = 'form-control form-control-sm shadow-none border-primary inline-edit-input';
        input.value = oldValue;
        if (fieldName === 'description') input.rows = 3;

        td.innerHTML = '';
        td.appendChild(input);
        input.focus();

        const saveChange = async () => {
            const newValue = input.value.trim();
            if (newValue === oldValue) {
                this.renderTable();
                return;
            }
            await this.request('update_ticket_field', { id, field: fieldName, value: newValue });
            ticket[fieldName] = newValue;
            this.renderTable();
        };

        input.onblur = saveChange;
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) input.blur();
            if (e.key === 'Escape') this.renderTable();
        };
    }
};

// Глобальна функція для HTML-кнопки "Створити інцидент"
window.openTicketModal = async () => {
    const res = await DashboardApp.request('get_devices', null, 'GET');
    const select = document.getElementById('ticket_device_select');
    select.innerHTML = '<option value="">-- Виберіть пристрій --</option>';

    if (res.status === 'success') {
        res.data.forEach(d => {
            select.innerHTML += `<option value="${d.id}">${d.hostname} (${d.department || 'Без відділу'})</option>`;
        });
    }

    DashboardApp.el.form.reset();
    DashboardApp.state.ticketModal.show();
};

document.addEventListener('DOMContentLoaded', () => DashboardApp.init());