const API_URL = 'api.php';

let loadedTickets = []; // Пам'ять для тікетів

// Завантажуємо дані з бази один раз
async function loadTickets() {
    try {
        const response = await fetch(`${API_URL}?action=get_tickets&t=${new Date().getTime()}`);
        const result = await response.json();

        if (result.status === 'success') {
            loadedTickets = result.data;
            renderTicketsTable(); // Викликаємо відмальовку з фільтрами
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
}

// Відмальовуємо таблицю (з урахуванням пошуку, фільтрів та сортування)
// Оновлена функція відмальовки з підтримкою Inline Edit
function renderTicketsTable() {
    const tbody = document.getElementById('tickets-table-body');
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('searchTicketInput').value.toLowerCase();
    const statusQuery = document.getElementById('statusTicketFilter').value;
    const sortQuery = document.getElementById('sortTicketFilter').value;

    let filtered = loadedTickets.filter(t => {
        const textToSearch = ((t.hostname || '') + ' ' + (t.subject || '') + ' ' + (t.description || '')).toLowerCase();
        return textToSearch.includes(searchQuery) && (statusQuery === 'all' || t.status === statusQuery);
    });

    // Сортування (залишаємо як було)
    filtered.sort((a, b) => {
        if (sortQuery === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
        if (sortQuery === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
        if (sortQuery === 'priority_desc') {
            const weights = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return weights[b.priority] - weights[a.priority];
        }
        return 0;
    });

    if (filtered.length > 0) {
        filtered.forEach(ticket => {
            let priorityBadge = '';
            switch (ticket.priority) {
                case 'low': priorityBadge = '<span class="badge bg-success">Низький</span>'; break;
                case 'medium': priorityBadge = '<span class="badge bg-warning text-dark">Середній</span>'; break;
                case 'high': priorityBadge = '<span class="badge bg-orange" style="background-color: #fd7e14;">Високий</span>'; break;
                case 'critical': priorityBadge = '<span class="badge bg-danger shadow-sm">Критичний</span>'; break;
            }

            let statusClass = '';
            switch (ticket.status) {
                case 'new': statusClass = 'bg-primary text-white'; break;
                case 'in_progress': statusClass = 'bg-warning text-dark'; break;
                case 'unresolved': statusClass = 'bg-secondary text-white'; break;
                case 'completed': statusClass = 'bg-success text-white'; break;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                    <td><span class="text-muted fw-bold">#${ticket.id}</span></td>
                    <td>
                        <i class="fa-solid ${ticket.icon} text-secondary me-2"></i><strong>${ticket.hostname}</strong><br>
                        <small class="text-muted">${ticket.ip_address || 'No IP'}</small>
                    </td>
                    
                    <td class="fw-bold editable-cell" title="Подвійний клік для редагування" 
                        ondblclick="editTicketCell(this, ${ticket.id}, 'subject')">${ticket.subject}</td>
                    
                    <td class="text-muted small editable-cell" title="Подвійний клік для редагування" 
                        style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                        ondblclick="editTicketCell(this, ${ticket.id}, 'description')">${ticket.description}</td>
                    
                    <td>${priorityBadge}</td>
                    <td><small class="text-muted">${new Date(ticket.created_at).toLocaleString('uk-UA')}</small></td>
                    
                    <td class="text-end">
                        <select class="form-select form-select-sm fw-bold ${statusClass}" 
                                style="border: none; box-shadow: none;"
                                onchange="changeTicketStatus(${ticket.id}, ${ticket.device_id}, this.value)">
                            <option value="new" class="bg-white text-dark fw-normal" ${ticket.status === 'new' ? 'selected' : ''}>Нове</option>
                            <option value="in_progress" class="bg-white text-dark fw-normal" ${ticket.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                            <option value="unresolved" class="bg-white text-dark fw-normal" ${ticket.status === 'unresolved' ? 'selected' : ''}>Немає рішення</option>
                            <option value="completed" class="bg-white text-dark fw-normal" ${ticket.status === 'completed' ? 'selected' : ''}>Виконано</option>
                        </select>
                    </td>
                `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted fw-bold">Нічого не знайдено</td></tr>`;
    }
}

// Функція швидкого редагування тікета
async function editTicketCell(td, ticketId, fieldName) {
    if (td.querySelector('input') || td.querySelector('textarea')) return;

    const ticket = loadedTickets.find(t => parseInt(t.id) === parseInt(ticketId));
    const oldValue = ticket[fieldName] || '';

    // Для опису використовуємо textarea, для теми - звичайний input
    const input = document.createElement(fieldName === 'description' ? 'textarea' : 'input');
    input.className = 'form-control form-control-sm shadow-none border-primary';
    input.value = oldValue;
    if (fieldName === 'description') input.rows = 3;

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();

    const saveChange = async () => {
        const newValue = input.value.trim();
        if (newValue === oldValue) {
            renderTicketsTable();
            return;
        }

        const payload = { action: 'update_ticket_field', id: ticketId, field: fieldName, value: newValue };
        await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        ticket[fieldName] = newValue;
        renderTicketsTable();
    };

    input.onblur = saveChange;
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter дозволяє перенос рядка в описі
            input.blur();
        } else if (e.key === 'Escape') {
            renderTicketsTable();
        }
    };
}

async function changeTicketStatus(ticketId, deviceId, newStatus) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_ticket_status', ticket_id: ticketId, device_id: deviceId, status: newStatus })
        });
        const result = await response.json();
        if (result.status === 'success') {
            loadTickets(); // Оновлюємо таблицю для перемальовки кольорів
        }
    } catch (error) { console.error('Помилка оновлення:', error); }
}

// Завантажуємо дані при старті сторінки
document.addEventListener('DOMContentLoaded', loadTickets);

// --- ЛОГІКА СТВОРЕННЯ НОВОГО ТІКЕТА ---
let dashboardTicketModal;

// Ініціалізуємо модалку при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    dashboardTicketModal = new bootstrap.Modal(document.getElementById('dashboardTicketModal'));
});

// Відкриваємо вікно і підтягуємо список комп'ютерів із бази
async function openTicketModal() {
    const res = await fetch(`${API_URL}?action=get_devices`);
    const result = await res.json();

    const select = document.getElementById('ticket_device_select');
    select.innerHTML = '<option value="">-- Виберіть пристрій --</option>';

    if (result.status === 'success') {
        result.data.forEach(d => {
            // Показуємо назву і відділ, щоб було зручно шукати
            select.innerHTML += `<option value="${d.id}">${d.hostname} (${d.department || 'Без відділу'})</option>`;
        });
    }

    document.getElementById('dashboardTicketForm').reset();
    dashboardTicketModal.show();
}

// Відправляємо тікет у базу
document.getElementById('dashboardTicketForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        action: 'add_ticket',
        device_id: document.getElementById('ticket_device_select').value,
        subject: document.getElementById('ticket_subject').value,
        description: document.getElementById('ticket_description').value,
        priority: document.getElementById('ticket_priority').value
    };

    await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    dashboardTicketModal.hide();
    loadTickets(); // Одразу оновлюємо таблицю, щоб побачити новий тікет
};