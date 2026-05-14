const API_URL = 'api.php';
let deviceListModal;
let loadedDevices = []; // Пам'ять для редагування

async function init() {
        deviceListModal = new bootstrap.Modal(document.getElementById('deviceListModal'));
        
        // Завантажуємо ТИПИ пристроїв
        const resTypes = await fetch(`${API_URL}?action=get_types`);
        const resultTypes = await resTypes.json();
        if(resultTypes.status === 'success') {
            const selectTypes = document.getElementById('form_type_id');
            selectTypes.innerHTML = '';
            resultTypes.data.forEach(t => selectTypes.innerHTML += `<option value="${t.id}">${t.name}</option>`);
        }

        // Завантажуємо ВІДДІЛИ (ГРУПИ)
        const resDeps = await fetch(`${API_URL}?action=get_departments`);
        const resultDeps = await resDeps.json();
        if(resultDeps.status === 'success') {
            const selectDeps = document.getElementById('form_department_id');
            selectDeps.innerHTML = '<option value="0">-- Без відділу --</option>'; // 0 якщо відділ не обрано
            resultDeps.data.forEach(d => selectDeps.innerHTML += `<option value="${d.id}">${d.name}</option>`);
        }

        loadDevicesList();
    }

async function loadDevicesList() {
    const response = await fetch(`${API_URL}?action=get_devices&t=${new Date().getTime()}`);
    const result = await response.json();
    if (result.status === 'success') {
        loadedDevices = result.data; // Зберігаємо всі дані в пам'ять
        renderDevicesTable(); // Викликаємо відмальовку
    }
}

// НОВА ФУНКЦІЯ: Відмальовка таблиці з урахуванням пошуку
// Відмальовка таблиці
function renderDevicesTable() {
    const tbody = document.getElementById('devices-table-body');
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const statusQuery = document.getElementById('statusFilter').value;

    const filtered = loadedDevices.filter(d => {
        const matchesSearch = (d.hostname || '').toLowerCase().includes(searchQuery) ||
            (d.ip_address || '').toLowerCase().includes(searchQuery) ||
            (d.mac_address || '').toLowerCase().includes(searchQuery) ||
            (d.department || '').toLowerCase().includes(searchQuery);
        const matchesStatus = statusQuery === 'all' || d.status === statusQuery;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length > 0) {
        filtered.forEach(device => {
            let statusBadge = '';
            if (device.status === 'ok') statusBadge = '<span class="badge bg-success">OK</span>';
            else if (device.status === 'warning') statusBadge = '<span class="badge bg-warning text-dark">Увага</span>';
            else if (device.status === 'error') statusBadge = '<span class="badge bg-danger">Тікет</span>';
            else statusBadge = '<span class="badge bg-secondary">Офлайн</span>';

            const tr = document.createElement('tr');

            // ТУТ МАГІЯ: Додаємо клас editable-cell та ondblclick на конкретні колонки
            tr.innerHTML = `
                    <td class="text-muted fw-bold">#${device.id}</td>
                    <td><i class="fa-solid ${device.icon} text-secondary fa-lg"></i></td>
                    <td class="fw-bold editable-cell" title="Подвійний клік для редагування" ondblclick="editCell(this, ${device.id}, 'hostname')">${device.hostname}</td>
                    <td class="editable-cell" title="Подвійний клік для редагування" ondblclick="editCell(this, ${device.id}, 'ip_address')"><code>${device.ip_address || '---'}</code></td>
                    <td class="editable-cell" title="Подвійний клік для редагування" ondblclick="editCell(this, ${device.id}, 'mac_address')"><small class="text-muted">${device.mac_address || '---'}</small></td>
                    <td class="editable-cell" title="Подвійний клік для редагування" ondblclick="editCell(this, ${device.id}, 'department')">${device.department || '---'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteDevice(${device.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">За вашим запитом нічого не знайдено</td></tr>`;
    }
}

// НОВА ФУНКЦІЯ: Редагування прямо в клітинці
async function editCell(td, deviceId, fieldName) {
    // Якщо клітинка вже редагується - ігноруємо
    if (td.querySelector('input')) return;

    // Дістаємо старе значення з пам'яті
    const device = loadedDevices.find(d => parseInt(d.id) === parseInt(deviceId));
    const oldValue = device[fieldName] || '';

    // Створюємо інпут
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control form-control-sm shadow-none border-primary';
    input.value = oldValue;

    // Очищаємо клітинку і вставляємо інпут
    td.innerHTML = '';
    td.appendChild(input);
    input.focus(); // Одразу ставимо курсор у поле

    // Функція для збереження
    const saveChange = async () => {
        const newValue = input.value.trim();

        // Якщо нічого не змінили - просто повертаємо як було
        if (newValue === oldValue) {
            renderDevicesTable();
            return;
        }

        // Зберігаємо в БД
        const payload = { action: 'update_device_field', id: deviceId, field: fieldName, value: newValue };
        await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        // Оновлюємо локальну пам'ять і перемальовуємо таблицю
        device[fieldName] = newValue;
        renderDevicesTable();
    };

    // Зберігаємо, коли клікаємо мишкою деінде (blur)
    input.onblur = saveChange;

    // Керування клавіатурою
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            input.blur(); // Зберегти
        } else if (e.key === 'Escape') {
            renderDevicesTable(); // Скасувати без збереження
        }
    };
}

function openDeviceModal() {
    document.getElementById('deviceListForm').reset();
    document.getElementById('form_id').value = '';
    document.getElementById('deviceModalTitle').innerText = 'Додати обладнання';
    deviceListModal.show();
}


async function deleteDevice(id) {

    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_device', id: id }) });
    loadDevicesList();

}

document.getElementById('deviceListForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('form_id').value;
        const payload = {
            action: id ? 'edit_device' : 'add_device',
            id: id,
            type_id: document.getElementById('form_type_id').value,
            hostname: document.getElementById('form_hostname').value,
            ip_address: document.getElementById('form_ip').value,
            mac_address: document.getElementById('form_mac').value,
            // БЕРЕМО ДАНІ З НОВОГО SELECT (department_id)
            department_id: document.getElementById('form_department_id').value, 
            pos_x: -1000, 
            pos_y: -1000
        };
        await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        deviceListModal.hide();
        loadDevicesList();
    };

document.addEventListener('DOMContentLoaded', init);