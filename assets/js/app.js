const API_URL = 'api.php';

// ==========================================
// 1. ГЛОБАЛЬНІ ЗМІННІ
// ==========================================
const mapViewport = document.getElementById('map-viewport');
const mapCanvas = document.getElementById('map-canvas');
const GRID_SIZE = 20;

let currentScale = 1;
let panX = -4500, panY = -4500;
let currentLocationId = 1;

let isPanning = false, isSpacePressed = false;
let startPanMouseX = 0, startPanMouseY = 0;

// УНІВЕРСАЛЬНЕ ВИДІЛЕННЯ (ПК + Столи)
let selectedItems = new Set(); 
let isDraggingItem = false;
let isResizingDesk = false;
let dragNode = null;
let hasDraggedItem = false;
let origX = 0, origY = 0;
let dragOffsets = new Map();

// Рамка виділення
let isSelecting = false;
let selStartX = 0, selStartY = 0;
const selectionBox = document.createElement('div');
selectionBox.id = 'selection-box';
selectionBox.style.position = 'absolute';
selectionBox.style.border = '1px solid rgba(13, 110, 253, 0.8)';
selectionBox.style.backgroundColor = 'rgba(13, 110, 253, 0.2)';
selectionBox.style.pointerEvents = 'none';
selectionBox.style.zIndex = '9999';
selectionBox.style.display = 'none';
if(mapCanvas) mapCanvas.appendChild(selectionBox);

// Інтерфейс
let allDevicesData = [];
const deviceModal = new bootstrap.Modal(document.getElementById('deviceModal'));
const detailsPanel = new bootstrap.Offcanvas(document.getElementById('deviceDetailsPanel'));
const ticketModal = new bootstrap.Modal(document.getElementById('ticketModal'));
let selectedTypeId = null;
let activeDeviceData = null;

// Історія та Буфер обміну
const actionHistory = [];
const MAX_HISTORY = 20;
let clipboard = [];

// ==========================================
// 2. РУШІЙ КАРТИ
// ==========================================
function updateCanvas() {
    if (mapCanvas) mapCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    if (btnZoomReset) btnZoomReset.innerText = Math.round(currentScale * 100) + '%';
}

function saveToHistory(actionType, itemsData) {
    actionHistory.push({ type: actionType, items: itemsData });
    if (actionHistory.length > MAX_HISTORY) actionHistory.shift();
}

document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { isSpacePressed = true; mapViewport.style.cursor = 'grab'; } });
document.addEventListener('keyup', (e) => { if (e.code === 'Space') { isSpacePressed = false; mapViewport.style.cursor = 'auto'; } });

mapViewport.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey || isSpacePressed) {
        e.preventDefault();
        const rect = mapViewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.2, Math.min(currentScale + delta, 4));

        const ratio = newScale / currentScale;
        panX = mouseX - (mouseX - panX) * ratio;
        panY = mouseY - (mouseY - panY) * ratio;
        currentScale = newScale; updateCanvas();
    }
}, { passive: false });

// ==========================================
// 3. УНІВЕРСАЛЬНА МИШКА
// ==========================================
mapViewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.selectable-item') || selectedTypeId || isResizingDesk) return;

    if (e.button === 1 || isSpacePressed) {
        e.preventDefault();
        isPanning = true;
        mapViewport.style.cursor = 'grabbing';
        startPanMouseX = e.clientX - panX;
        startPanMouseY = e.clientY - panY;
    } else if (e.button === 0) {
        isSelecting = true;
        if (!e.shiftKey && !e.ctrlKey) clearSelection();

        const rect = mapViewport.getBoundingClientRect();
        selStartX = ((e.clientX - rect.left) - panX) / currentScale;
        selStartY = ((e.clientY - rect.top) - panY) / currentScale;

        selectionBox.style.left = selStartX + 'px';
        selectionBox.style.top = selStartY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    }
});

mapViewport.addEventListener('mousemove', (e) => {
    const rect = mapViewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let canvasX = (mouseX - panX) / currentScale;
    let canvasY = (mouseY - panY) / currentScale;

    // 1. Рух карти
    if (isPanning) {
        panX = e.clientX - startPanMouseX; panY = e.clientY - startPanMouseY;
        updateCanvas(); return;
    }

    // 2. Рамка виділення
    if (isSelecting) {
        let boxLeft = Math.min(selStartX, canvasX);
        let boxTop = Math.min(selStartY, canvasY);
        let boxWidth = Math.abs(canvasX - selStartX);
        let boxHeight = Math.abs(canvasY - selStartY);

        selectionBox.style.left = boxLeft + 'px'; selectionBox.style.top = boxTop + 'px';
        selectionBox.style.width = boxWidth + 'px'; selectionBox.style.height = boxHeight + 'px';

        document.querySelectorAll('.selectable-item').forEach(node => {
            let nodeX = parseInt(node.style.left); let nodeY = parseInt(node.style.top);
            let nW = node.offsetWidth || GRID_SIZE; let nH = node.offsetHeight || GRID_SIZE;

            // МАГІЯ ТУТ: Перевіряємо, чи ЦЕНТР об'єкта потрапив у рамку (а не просто краєчок)
            let centerX = nodeX + (nW / 2);
            let centerY = nodeY + (nH / 2);

            if (centerX >= boxLeft && centerX <= boxLeft + boxWidth && centerY >= boxTop && centerY <= boxTop + boxHeight) {
                selectedItems.add(node); node.classList.add('selected');
            } else if (!e.shiftKey && !e.ctrlKey) {
                selectedItems.delete(node); node.classList.remove('selected');
            }
        });
        return;
    }

    // 3. Універсальне перетягування (ПК та Столи)
    if (isDraggingItem && dragNode && !isResizingDesk) {
        hasDraggedItem = true;
        let newX = Math.round(canvasX / GRID_SIZE) * GRID_SIZE;
        let newY = Math.round(canvasY / GRID_SIZE) * GRID_SIZE;
        let dx = newX - origX;
        let dy = newY - origY;

        selectedItems.forEach(n => {
            let start = dragOffsets.get(n);
            if (start) { n.style.left = `${start.x + dx}px`; n.style.top = `${start.y + dy}px`; }
        });
    }
});

window.addEventListener('mouseup', async () => {
    if (isPanning) { isPanning = false; mapViewport.style.cursor = isSpacePressed ? 'grab' : 'auto'; }
    if (isSelecting) { isSelecting = false; selectionBox.style.display = 'none'; }

    if (isDraggingItem && dragNode && hasDraggedItem && !isResizingDesk) {
        let historyEntry = [];
        let promises = [];
        let isSwap = false; // Прапорець для обміну

        // --- 1. ЛОГІКА ОБМІНУ (ТІЛЬКИ ДЛЯ ПРИСТРОЇВ) ---
        if (selectedItems.size === 1 && dragNode.getAttribute('data-item-type') === 'device') {
            const dragId = dragNode.getAttribute('data-id');
            const newX = parseInt(dragNode.style.left);
            const newY = parseInt(dragNode.style.top);

            let targetNode = null;
            // Шукаємо, чи є під нами інший комп'ютер
            document.querySelectorAll('.device-node').forEach(node => {
                if (node !== dragNode && parseInt(node.style.left) === newX && parseInt(node.style.top) === newY) {
                    targetNode = node;
                }
            });

            if (targetNode) {
                isSwap = true; // Знайшли колізію!
                const tData = JSON.parse(targetNode.getAttribute('data-json'));
                const dData = JSON.parse(dragNode.getAttribute('data-json'));

                if (confirm(`Поміняти місцями "${dData.hostname}" та "${tData.hostname}"?\nБудуть створені тікети на переміщення.`)) {
                    await fetch(API_URL, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ action: 'swap_devices', id1: dragId, id2: tData.id }) 
                    });
                    if(typeof showToast === 'function') showToast("Тікети створено!", "warning");
                } else {
                    // Якщо натиснули "Скасувати" - повертаємо ПК на старе місце
                    dragNode.style.left = `${origX}px`; 
                    dragNode.style.top = `${origY}px`;
                }
                await refreshMap(); // Перемальовуємо карту
            }
        }

        // --- 2. ЛОГІКА ЗВИЧАЙНОГО ПЕРЕМІЩЕННЯ (ЯКЩО ЦЕ НЕ ОБМІН) ---
        if (!isSwap) {
            selectedItems.forEach(n => {
                let start = dragOffsets.get(n);
                let endX = parseInt(n.style.left); let endY = parseInt(n.style.top);
                
                if (start && (start.x !== endX || start.y !== endY)) {
                    let id = n.getAttribute('data-id');
                    let type = n.getAttribute('data-item-type'); // 'device' або 'desk'
                    
                    historyEntry.push({ id: id, type: type, oldX: start.x, oldY: start.y });
                    
                    let endpoint = type === 'device' ? 'move_device' : 'update_desk';
                    let payload = { action: endpoint, id: id, pos_x: endX, pos_y: endY };
                    
                    // Додаткові параметри залежно від типу об'єкта
                    if (type === 'device') payload.location_id = currentLocationId;
                    if (type === 'desk') { payload.width = n.offsetWidth; payload.height = n.offsetHeight; }

                    promises.push(fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
                }
            });

            if (historyEntry.length > 0) {
                saveToHistory('move', historyEntry);
                await Promise.all(promises);
                await refreshMap();
            }
        }
        
        selectedItems.forEach(n => n.style.transition = '');
    }
    isDraggingItem = false; dragNode = null; isResizingDesk = false;
});

function clearSelection() {
    document.querySelectorAll('.selectable-item.selected').forEach(n => n.classList.remove('selected'));
    selectedItems.clear();
}

function handleItemMouseDown(e, node) {
    if (e.button !== 0 || selectedTypeId || isSpacePressed) return;
    e.stopPropagation();
    hasDraggedItem = false; 

    // Якщо це стіл і клік у зоні ресайзу (правий нижній кут)
    if (node.getAttribute('data-item-type') === 'desk') {
        const rect = node.getBoundingClientRect();
        if ((e.clientX - rect.left) > (rect.width - 20) && (e.clientY - rect.top) > (rect.height - 20)) {
            isResizingDesk = true;
            const onMouseUpResize = async () => {
                window.removeEventListener('mouseup', onMouseUpResize);
                isResizingDesk = false;
                await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_desk', id: node.getAttribute('data-id'), pos_x: parseInt(node.style.left), pos_y: parseInt(node.style.top), width: node.offsetWidth, height: node.offsetHeight }) });
            };
            window.addEventListener('mouseup', onMouseUpResize);
            return; // Виходимо, бо це ресайз, а не драг
        }
    }

    if (e.ctrlKey || e.shiftKey) {
        if (selectedItems.has(node)) { selectedItems.delete(node); node.classList.remove('selected'); } 
        else { selectedItems.add(node); node.classList.add('selected'); }
    } else {
        if (!selectedItems.has(node)) { clearSelection(); selectedItems.add(node); node.classList.add('selected'); }
    }

    isDraggingItem = true; dragNode = node;
    const rect = mapViewport.getBoundingClientRect();
    origX = Math.round((((e.clientX - rect.left) - panX) / currentScale) / GRID_SIZE) * GRID_SIZE;
    origY = Math.round((((e.clientY - rect.top) - panY) / currentScale) / GRID_SIZE) * GRID_SIZE;

    dragOffsets.clear();
    selectedItems.forEach(n => { n.style.transition = 'none'; dragOffsets.set(n, { x: parseInt(n.style.left), y: parseInt(n.style.top) }); });
}

async function refreshMap() {
    await loadDesks();
    await loadDevices();
    await loadTicketsRightPanel(); // <--- Оновлюємо праву панель при кожній зміні
}

// НОВА ФУНКЦІЯ: Права панель інцидентів
async function loadTicketsRightPanel() {
    const res = await fetch(`${API_URL}?action=get_tickets`);
    const result = await res.json();
    const panel = document.getElementById('ticketsRightPanel');
    if (!panel) return;
    panel.innerHTML = '';

    if (result.status === 'success' && result.data.length > 0) {
        result.data.forEach(t => {
            const item = document.createElement('div');
            item.className = 'card shadow-sm border-0 border-start border-danger border-4 mb-2';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <div class="card-body p-2" style="font-size: 0.8rem;">
                    <strong class="text-danger"><i class="fa-solid fa-desktop me-1"></i>${t.hostname}</strong>
                    <div class="text-truncate text-muted mt-1" title="${t.subject}">${t.subject}</div>
                </div>
            `;
            
            // КЛІК ПО ТІКЕТУ
            item.onclick = async () => {
                // Якщо ПК на іншому поверсі - автоматично перемикаємо поверх
                if (currentLocationId != t.location_id) {
                    document.getElementById('locationSelect').value = t.location_id;
                    await changeLocation();
                }

                // Перелітаємо камерою до ПК
                currentScale = 1;
                panX = (mapViewport.clientWidth / 2) - parseInt(t.pos_x);
                panY = (mapViewport.clientHeight / 2) - parseInt(t.pos_y);
                updateCanvas();

                // Знаходимо ПК, виділяємо і запускаємо анімацію пульсації
                const node = document.querySelector(`.device-node[data-id="${t.device_id}"]`);
                if (node) {
                    clearSelection();
                    selectedItems.add(node);
                    node.classList.add('selected');
                    node.classList.add('pulse-highlight'); // Клас з CSS
                    setTimeout(() => node.classList.remove('pulse-highlight'), 3000); // Знімаємо пульсацію через 3 сек
                }
            };
            panel.appendChild(item);
        });
    } else {
        panel.innerHTML = '<div class="text-muted small text-center mt-4"><i class="fa-solid fa-check-circle me-1 text-success"></i>Все працює ідеально</div>';
    }
}
async function loadLocations() {
    const res = await fetch(`${API_URL}?action=get_locations`);
    const result = await res.json();
    const sel = document.getElementById('locationSelect');
    if(!sel) return; sel.innerHTML = '';
    result.data.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.id; opt.innerText = loc.name; sel.appendChild(opt);
    });
    currentLocationId = sel.value;
}

async function changeLocation() {
    currentLocationId = document.getElementById('locationSelect').value;
    currentScale = 1; panX = -4500; panY = -4500; updateCanvas();
    clearSelection();
    await refreshMap();
    showToast("Локацію змінено", "success");
}

async function loadDesks() {
    const res = await fetch(`${API_URL}?action=get_desks&location_id=${currentLocationId}`);
    const result = await res.json();
    document.querySelectorAll('.desk-node').forEach(n => n.remove());
    
    if(result.status === 'success') {
        result.data.forEach(d => {
            const node = document.createElement('div');
            node.className = 'desk-node selectable-item'; 
            node.style.left = d.pos_x + 'px'; node.style.top = d.pos_y + 'px';
            node.style.width = d.width + 'px'; node.style.height = d.height + 'px';
            node.setAttribute('data-id', d.id);
            node.setAttribute('data-item-type', 'desk');
            node.setAttribute('data-json', JSON.stringify(d));

            // ВИПРАВЛЕННЯ: Array.from запобігає нескінченному циклу!
            Array.from(selectedItems).forEach(si => { 
                if(si.getAttribute('data-id') == d.id && si.getAttribute('data-item-type') == 'desk') { 
                    node.classList.add('selected'); 
                    selectedItems.delete(si); 
                    selectedItems.add(node); 
                }
            });
            
            node.addEventListener('mousedown', (e) => handleItemMouseDown(e, node));
            mapCanvas.appendChild(node);
        });
    }
}

async function loadDevices() {
    const response = await fetch(`${API_URL}?action=get_devices&t=${new Date().getTime()}`);
    const result = await response.json();
    if (result.status === 'success') {
        allDevicesData = result.data;
        document.querySelectorAll('.device-node').forEach(n => n.remove());

        result.data.forEach(device => {
            if (parseInt(device.pos_x) >= 0 && parseInt(device.pos_y) >= 0 && parseInt(device.location_id) === parseInt(currentLocationId)) {
                const node = document.createElement('div');
                node.className = `device-node selectable-item status-${device.status}`; 
                node.style.left = `${device.pos_x}px`; node.style.top = `${device.pos_y}px`;
                node.setAttribute('data-id', device.id);
                node.setAttribute('data-item-type', 'device');
                node.setAttribute('data-json', JSON.stringify(device));

                // ВИПРАВЛЕННЯ: Array.from запобігає нескінченному циклу!
                Array.from(selectedItems).forEach(si => { 
                    if(si.getAttribute('data-id') == device.id && si.getAttribute('data-item-type') == 'device') { 
                        node.classList.add('selected'); 
                        selectedItems.delete(si); 
                        selectedItems.add(node); 
                    }
                });

                node.innerHTML = `<div class="device-icon"><i class="fa-solid ${device.icon}"></i></div><div class="device-label">${device.hostname}</div>`;

                node.addEventListener('mousedown', (e) => handleItemMouseDown(e, node));
                node.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (selectedTypeId || hasDraggedItem) return;
                    if (!e.ctrlKey && !e.shiftKey && selectedItems.size === 1) {
                        activeDeviceData = JSON.parse(this.getAttribute('data-json'));
                        showDetails();
                    }
                });
                mapCanvas.appendChild(node);
            }
        });
        renderInventory();
    }
}

async function addDesk() {
    const centerX = Math.round(((-panX + mapViewport.clientWidth/2) / currentScale) / GRID_SIZE) * GRID_SIZE;
    const centerY = Math.round(((-panY + mapViewport.clientHeight/2) / currentScale) / GRID_SIZE) * GRID_SIZE;
    await fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'add_desk', location_id: currentLocationId, pos_x: centerX, pos_y: centerY }) });
    await refreshMap();
}

// ==========================================
// 5. ГАРЯЧІ КЛАВІШІ (УНІВЕРСАЛЬНІ)
// ==========================================
document.addEventListener('keydown', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // ВИДАЛЕННЯ (Delete)
    if (e.code === 'Delete' && selectedItems.size > 0) {
        if(confirm(`Видалити обрані елементи (${selectedItems.size} шт.)?`)) {
            let promises = [];
            selectedItems.forEach(n => {
                let id = n.getAttribute('data-id');
                let type = n.getAttribute('data-item-type');
                let action = type === 'device' ? 'delete_device' : 'delete_desk';
                promises.push(fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: action, id: id }) }));
            });
            await Promise.all(promises);
            clearSelection();
            await refreshMap();
            showToast("Видалено", "success");
        }
    }

    // КОПІЮВАННЯ (Ctrl + C)
    if (e.ctrlKey && e.code === 'KeyC' && selectedItems.size > 0) {
        clipboard = [];
        selectedItems.forEach(n => {
            clipboard.push({
                type: n.getAttribute('data-item-type'),
                data: JSON.parse(n.getAttribute('data-json'))
            });
        });
        showToast(`Скопійовано елементів: ${clipboard.length}`, "success");
    }

    // ВСТАВКА (Ctrl + V)
    if (e.ctrlKey && e.code === 'KeyV' && clipboard.length > 0) {
        let promises = [];
        clipboard.forEach(item => {
            if(item.type === 'device') {
                promises.push(fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    action: 'add_device', type_id: item.data.type_id, hostname: item.data.hostname + '-copy', ip_address: '', mac_address: '', department: item.data.department,
                    pos_x: parseInt(item.data.pos_x) + GRID_SIZE * 2, pos_y: parseInt(item.data.pos_y) + GRID_SIZE * 2, location_id: currentLocationId
                })}));
            } else if (item.type === 'desk') {
                promises.push(fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    action: 'add_desk', location_id: currentLocationId, pos_x: parseInt(item.data.pos_x) + GRID_SIZE * 2, pos_y: parseInt(item.data.pos_y) + GRID_SIZE * 2, width: item.data.width, height: item.data.height
                })}));
            }
        });
        await Promise.all(promises);
        await refreshMap();
        showToast("Елементи вставлено", "success");
    }

    // СКАСУВАННЯ (Ctrl + Z)
    if (e.ctrlKey && e.code === 'KeyZ' && actionHistory.length > 0) {
        let lastAction = actionHistory.pop();
        if (lastAction.type === 'move') {
            let promises = [];
            lastAction.items.forEach(item => {
                let action = item.type === 'device' ? 'move_device' : 'update_desk';
                let payload = { action: action, id: item.id, pos_x: item.oldX, pos_y: item.oldY };
                if (item.type === 'device') payload.location_id = currentLocationId;
                
                // Для столу нам треба передати його поточну ширину/висоту, щоб вона не збилася.
                if (item.type === 'desk') {
                    const existingNode = document.querySelector(`.desk-node[data-id="${item.id}"]`);
                    if(existingNode) { payload.width = existingNode.offsetWidth; payload.height = existingNode.offsetHeight; }
                }

                promises.push(fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
            });
            await Promise.all(promises);
            await refreshMap();
            showToast("Переміщення скасовано (Ctrl+Z)", "warning");
        }
    }
});

// ==========================================
// Інші функції (Каталог, Склад, Тікети)
// ==========================================
function renderInventory() {
    const list = document.getElementById('inventoryList');
    if (!list) return; list.innerHTML = '';
    const search = document.getElementById('invSearch').value.toLowerCase();
    const filter = document.getElementById('invFilter').value;

    allDevicesData.forEach(d => {
        const isPlaced = parseInt(d.pos_x) >= 0 && parseInt(d.pos_y) >= 0;
        const isCurrentFloor = parseInt(d.location_id) === parseInt(currentLocationId);
        if (filter === 'placed' && !isPlaced) return;
        if (filter === 'unplaced' && isPlaced) return;
        if (search && !(d.hostname || '').toLowerCase().includes(search) && !(d.ip_address || '').toLowerCase().includes(search)) return;

        const item = document.createElement('div');
        item.className = `card shadow-sm border-0 ${isPlaced ? 'opacity-50' : 'border-primary border-start border-4'}`;
        if (!isPlaced) {
            item.draggable = true; item.style.cursor = 'grab';
            item.ondragstart = (e) => e.dataTransfer.setData('new_device_id', d.id);
        } else {
            item.style.cursor = 'pointer';
            item.onclick = () => {
                if (!isCurrentFloor) { showToast("Пристрій на іншому поверсі!", "warning"); return; }
                currentScale = 1; panX = (mapViewport.clientWidth / 2) - parseInt(d.pos_x); panY = (mapViewport.clientHeight / 2) - parseInt(d.pos_y); updateCanvas();
                const node = document.querySelector(`.device-node[data-id="${d.id}"]`);
                if (node) { node.classList.add('selected'); setTimeout(() => { if(!selectedItems.has(node)) node.classList.remove('selected'); }, 1500); }
            };
        }
        item.innerHTML = `<div class="card-body p-2" style="font-size:0.85rem;"><b>${d.hostname}</b><br><small class="text-muted">${d.ip_address || 'Немає IP'}</small></div>`;
        list.appendChild(item);
    });
}

mapViewport.addEventListener('dragover', (e) => e.preventDefault());
mapViewport.addEventListener('drop', async (e) => {
    e.preventDefault();
    const deviceId = e.dataTransfer.getData('new_device_id');
    if (!deviceId) return;
    const rect = mapViewport.getBoundingClientRect();
    let x = Math.round(((e.clientX - rect.left - panX) / currentScale) / GRID_SIZE) * GRID_SIZE;
    let y = Math.round(((e.clientY - rect.top - panY) / currentScale) / GRID_SIZE) * GRID_SIZE;
    await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move_device', id: deviceId, pos_x: x, pos_y: y, location_id: currentLocationId }) });
    await refreshMap();
});

mapCanvas.onclick = (e) => {
    if (!selectedTypeId || isPanning || isSelecting || e.target.closest('.selectable-item')) return;
    const rect = mapViewport.getBoundingClientRect();
    let x = Math.round(((e.clientX - rect.left - panX) / currentScale) / GRID_SIZE) * GRID_SIZE;
    let y = Math.round(((e.clientY - rect.top - panY) / currentScale) / GRID_SIZE) * GRID_SIZE;
    document.getElementById('modalTitle').innerText = 'Додати обладнання';
    document.getElementById('form_id').value = '';
    document.getElementById('form_type_id').value = selectedTypeId;
    document.getElementById('form_pos_x').value = x;
    document.getElementById('form_pos_y').value = y;
    document.getElementById('deviceForm').reset();
    deviceModal.show();
};

async function loadToolbar() {
    const res = await fetch(`${API_URL}?action=get_types`);
    const result = await res.json();
    const toolbar = document.getElementById('toolbar-tools');
    if (!toolbar) return; toolbar.innerHTML = '';
    result.data.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-dark tool-btn text-start p-2 fw-bold small';
        btn.innerHTML = `<i class="fa-solid ${type.icon} me-2 text-primary"></i> ${type.name}`;
        btn.onclick = () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active', 'btn-dark', 'text-white'));
            btn.classList.add('active', 'btn-dark', 'text-white');
            selectedTypeId = type.id; mapViewport.style.cursor = 'crosshair';
            document.getElementById('cancelSelectionBtn').classList.remove('d-none');
        };
        toolbar.appendChild(btn);
    });
}

function cancelSelection() {
    selectedTypeId = null; mapViewport.style.cursor = 'auto';
    document.getElementById('cancelSelectionBtn').classList.add('d-none');
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active', 'btn-dark', 'text-white'));
}

function showDetails() { /* Код панелі деталей без змін */
    document.getElementById('detail-hostname').innerText = activeDeviceData.hostname;
    document.getElementById('detail-icon').innerHTML = `<i class="fa-solid ${activeDeviceData.icon}"></i>`;
    document.getElementById('detail-ip').innerText = activeDeviceData.ip_address || '---';
    document.getElementById('detail-mac').innerText = activeDeviceData.mac_address || '---';
    document.getElementById('detail-department').innerText = activeDeviceData.department || '---';
    detailsPanel.show();
}

document.getElementById('btn-edit-device').onclick = () => {
    detailsPanel.hide(); document.getElementById('form_id').value = activeDeviceData.id;
    document.getElementById('form_hostname').value = activeDeviceData.hostname;
    document.getElementById('form_ip').value = activeDeviceData.ip_address;
    document.getElementById('form_mac').value = activeDeviceData.mac_address;
    document.getElementById('form_department').value = activeDeviceData.department;
    deviceModal.show();
};

// --- КНОПКА ВИДАЛЕННЯ З ПАНЕЛІ ДЕТАЛЕЙ ---
document.getElementById('btn-delete-device').onclick = async () => {
    if (confirm(`Видалити пристрій ${activeDeviceData.hostname}?`)) {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_device', id: activeDeviceData.id }) });
        detailsPanel.hide();
        clearSelection();
        await refreshMap();
        showToast("Видалено", "success");
    }
};

// --- СТВОРЕННЯ ТІКЕТА ---
document.getElementById('btn-create-ticket').onclick = () => {
    detailsPanel.hide(); // Ховаємо бічну панель
    document.getElementById('ticket_device_id').value = activeDeviceData.id;
    document.getElementById('ticketForm').reset();
    ticketModal.show(); // Показуємо модальне вікно тікета
};

document.getElementById('ticketForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        action: 'add_ticket',
        device_id: document.getElementById('ticket_device_id').value,
        subject: document.getElementById('ticket_subject').value,
        description: document.getElementById('ticket_description').value,
        priority: document.getElementById('ticket_priority').value
    };
    await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    ticketModal.hide();
    await refreshMap();
    showToast("Інцидент відкрито!", "danger");
};

document.getElementById('deviceForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        action: document.getElementById('form_id').value ? 'edit_device' : 'add_device',
        id: document.getElementById('form_id').value, type_id: document.getElementById('form_type_id').value,
        hostname: document.getElementById('form_hostname').value, ip_address: document.getElementById('form_ip').value,
        mac_address: document.getElementById('form_mac').value, department: document.getElementById('form_department').value,
        pos_x: document.getElementById('form_pos_x').value, pos_y: document.getElementById('form_pos_y').value
    };
    await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    deviceModal.hide(); cancelSelection(); await refreshMap(); showToast("Збережено!", "success");
};

function showToast(message, type = 'success') {
    const toastEl = document.getElementById('systemToast');
    if (!toastEl) return alert(message);
    toastEl.className = `toast align-items-center border-0 shadow-lg bg-${type} ${type === 'warning' ? 'text-dark' : 'text-white'}`;
    document.getElementById('toastMessage').innerText = message;
    new bootstrap.Toast(toastEl, { delay: 3000 }).show();
}

// ==========================================
// 6. ЗАПУСК
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadLocations();
    loadToolbar();
    await refreshMap();
    updateCanvas();
});