const DevicesApp = {
    config: { apiUrl: 'api.php' },
    state: { devices: [], modal: null },
    
    el: {}, // Порожній об'єкт, який безпечно заповниться після завантаження сторінки

    async request(action, data = null, method = 'POST') {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (data) options.body = JSON.stringify({ action, ...data });
        try {
            const url = data ? this.config.apiUrl : `${this.config.apiUrl}?action=${action}&t=${Date.now()}`;
            const response = await fetch(url, data ? options : undefined);
            
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`[API Error] Action: ${action}`, error);
            return { status: 'error', message: error.message };
        }
    },

    async init() {
        try {
            // 1. БЕЗПЕЧНО кешуємо елементи
            this.el = {
                tbody: document.getElementById('devices-table-body'),
                searchInput: document.getElementById('searchInput'),
                statusFilter: document.getElementById('statusFilter'),
                form: document.getElementById('deviceListForm')
            };

            // Перевіряємо, чи існує таблиця на сторінці
            if (!this.el.tbody) {
                console.error("Критична помилка: Не знайдено таблицю #devices-table-body");
                return;
            }

            this.state.modal = new bootstrap.Modal(document.getElementById('deviceListModal'));

            // 2. Ініціалізуємо події
            this.bindEvents();

            // 3. Завантажуємо дані
            const [typesRes, depsRes] = await Promise.all([
                this.request('get_types', null, 'GET'),
                this.request('get_departments', null, 'GET')
            ]);

            if (typesRes.status === 'success' && document.getElementById('form_type_id')) {
                document.getElementById('form_type_id').innerHTML = typesRes.data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }

            if (depsRes.status === 'success' && document.getElementById('form_department_id')) {
                document.getElementById('form_department_id').innerHTML = '<option value="">-- Без відділу --</option>' +
                    depsRes.data.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
            }

            // 4. Завантажуємо самі пристрої
            await this.loadData();

        } catch (e) {
            console.error("Помилка ініціалізації DevicesApp:", e);
            if (this.el.tbody) {
                this.el.tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger fw-bold">Критична помилка JS: ${e.message}</td></tr>`;
            }
        }
    },

    bindEvents() {
        if(this.el.searchInput) this.el.searchInput.addEventListener('input', () => this.renderTable());
        if(this.el.statusFilter) this.el.statusFilter.addEventListener('change', () => this.renderTable());

        this.el.tbody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('.editable-cell');
            if (cell) {
                const id = cell.parentElement.dataset.id;
                const field = cell.dataset.field;
                this.editCell(cell, id, field);
            }
        });

        this.el.tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-delete');
            if (btn) {
                const id = btn.closest('tr').dataset.id;
                if (confirm('Видалити цей пристрій?')) {
                    await this.request('delete_device', { id });
                    await this.loadData();
                }
            }
        });

        if(this.el.form) {
            this.el.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('form_id').value;
                const payload = {
                    action: id ? 'edit_device' : 'add_device',
                    id: id,
                    type_id: document.getElementById('form_type_id').value,
                    hostname: document.getElementById('form_hostname').value,
                    ip_address: document.getElementById('form_ip').value,
                    mac_address: document.getElementById('form_mac').value,
                    department: document.getElementById('form_department_id').value,
                    pos_x: -1000,
                    pos_y: -1000,
                    location_id: 1 // Дефолтний поверх для нових пристроїв зі списку
                };
                
                const res = await this.request(payload.action, payload);
                if (res.status === 'success') {
                    this.state.modal.hide();
                    await this.loadData();
                } else {
                    alert("Помилка бази даних: " + res.message);
                }
            });
        }
    },

    async loadData() {
        const result = await this.request('get_devices', null, 'GET');
        
        if (result.status === 'success') {
            this.state.devices = result.data || [];
            this.renderTable();
        } else {
            // Ось тут магія! Тепер замість безкінечного завантаження ми побачимо причину помилки
            this.el.tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation me-2"></i>Помилка бекенду: ${result.message || 'Не вдалося завантажити'}</td></tr>`;
        }
    },

    renderTable() {
        const searchQuery = this.el.searchInput ? this.el.searchInput.value.toLowerCase() : '';
        const statusQuery = this.el.statusFilter ? this.el.statusFilter.value : 'all';

        const filtered = this.state.devices.filter(d => {
            const textToSearch = `${d.hostname} ${d.ip_address} ${d.mac_address} ${d.department}`.toLowerCase();
            const matchesSearch = textToSearch.includes(searchQuery);
            const matchesStatus = statusQuery === 'all' || d.status === statusQuery;
            return matchesSearch && matchesStatus;
        });

        if (filtered.length === 0) {
            this.el.tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted fw-bold">Нічого не знайдено</td></tr>`;
            return;
        }

        const badges = {
            'ok': '<span class="badge bg-success">OK</span>',
            'warning': '<span class="badge bg-warning text-dark">Увага</span>',
            'error': '<span class="badge bg-danger">Тікет</span>'
        };

        this.el.tbody.innerHTML = filtered.map(d => `
            <tr data-id="${d.id}">
                <td class="text-muted fw-bold">#${d.id}</td>
                <td><i class="fa-solid ${d.icon} text-secondary fa-lg"></i></td>
                <td class="fw-bold editable-cell" data-field="hostname" title="Подвійний клік для редагування">${d.hostname}</td>
                <td class="editable-cell" data-field="ip_address" title="Подвійний клік для редагування"><code>${d.ip_address || '---'}</code></td>
                <td class="editable-cell" data-field="mac_address" title="Подвійний клік для редагування"><small class="text-muted">${d.mac_address || '---'}</small></td>
                <td class="editable-cell" data-field="department" title="Подвійний клік для редагування">${d.department || '---'}</td>
                <td>${badges[d.status] || '<span class="badge bg-secondary">Офлайн</span>'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger btn-delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },

    async editCell(td, id, fieldName) {
        if (td.querySelector('input')) return;

        const device = this.state.devices.find(d => parseInt(d.id) === parseInt(id));
        const oldValue = device[fieldName] || '';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm shadow-none border-primary inline-edit-input';
        input.value = oldValue;

        td.innerHTML = '';
        td.appendChild(input);
        input.focus();

        const saveChange = async () => {
            const newValue = input.value.trim();
            if (newValue === oldValue) {
                this.renderTable();
                return;
            }
            const res = await this.request('update_device_field', { id, field: fieldName, value: newValue });
            if(res.status === 'success') {
                device[fieldName] = newValue;
            } else {
                alert("Не вдалося оновити: " + res.message);
            }
            this.renderTable();
        };

        input.onblur = saveChange;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') this.renderTable();
        };
    }
};

// Глобальна функція для HTML-кнопки
window.openDeviceModal = () => {
    if(!DevicesApp.el.form) return;
    DevicesApp.el.form.reset();
    document.getElementById('form_id').value = '';
    document.getElementById('deviceModalTitle').innerText = 'Додати обладнання';
    DevicesApp.state.modal.show();
};

document.addEventListener('DOMContentLoaded', () => DevicesApp.init());