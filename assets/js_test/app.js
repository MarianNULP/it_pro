/**
 * it_infrastructure_pro - Core Logic (Refactored)
 */

const App = {
    // Конфігурація
    config: {
        apiUrl: 'api.php',
        gridSize: 20,
        zoomStep: 0.1,
        minScale: 0.2,
        maxScale: 4,
        maxHistory: 20
    },

    // Поточний стан додатку
    state: {
        currentScale: 1,
        panX: -4500,
        panY: -4500,
        currentLocationId: 1,
        isPanning: false,
        isSpacePressed: false,
        selectedItems: new Set(),
        isDraggingItem: false,
        dragNode: null,
        actionHistory: [],
        allDevices: [],
        clipboard: [],
        settings: {
            showLabels: true,
            snapToGrid: true,
            darkMode: false
        }
    },

    // Елементи DOM (кешуємо для швидкості)
    el: {
        viewport: document.getElementById('map-viewport'),
        canvas: document.getElementById('map-canvas'),
        locationSelect: document.getElementById('locationSelect'),
        zoomResetBtn: document.getElementById('btn-zoom-reset')
    },

    // --- СЕРВІСНІ ФУНКЦІЇ ---

    async request(action, data = null, method = 'POST') {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (data) options.body = JSON.stringify({ action, ...data });
        else if (method === 'GET') { /* обробка GET параметрів за потреби */ }

        try {
            const response = await fetch(data ? this.config.apiUrl : `${this.config.apiUrl}?action=${action}`, options);
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            return result;
        } catch (error) {
            this.showToast(error.message || 'Помилка мережі', 'danger');
            return { status: 'error' };
        }
    },

    showToast(message, type = 'success') {
        const toastEl = document.getElementById('systemToast');
        if (!toastEl) return console.log(message);

        toastEl.className = `toast align-items-center border-0 shadow-lg bg-${type} ${type === 'warning' ? 'text-dark' : 'text-white'}`;
        document.getElementById('toastMessage').innerText = message;
        new bootstrap.Toast(toastEl, { delay: 3000 }).show();
    },

    // --- РУШІЙ КАРТИ ---

    updateCanvas() {
        // Використовуємо шаблонні рядки та округлення для кращої продуктивності
        const transform = `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.currentScale})`;
        requestAnimationFrame(() => {
            if (this.el.canvas) {
                this.el.canvas.style.transform = transform;
            }
            if (this.el.zoomResetBtn) {
                this.el.zoomResetBtn.innerText = Math.round(this.state.currentScale * 100) + '%';
            }
        });
    },

    handleZoom(e) {
        if (!e.ctrlKey && !e.metaKey && !this.state.isSpacePressed) return;
        e.preventDefault();

        const rect = this.el.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? -this.config.zoomStep : this.config.zoomStep;
        const oldScale = this.state.currentScale;
        const newScale = Math.max(this.config.minScale, Math.min(oldScale + delta, this.config.maxScale));

        const ratio = newScale / oldScale;

        // Зум відносно курсора миші
        this.state.panX = mouseX - (mouseX - this.state.panX) * ratio;
        this.state.panY = mouseY - (mouseY - this.state.panY) * ratio;
        this.state.currentScale = newScale;

        this.updateCanvas();
    },

    initSettings() {
        // 1. Перемикач назв
        const labelToggle = document.getElementById('setting-show-labels');
        if (labelToggle) {
            labelToggle.onchange = (e) => {
                this.state.settings.showLabels = e.target.checked;
                this.applyLabelSettings();
            };
        }

        // 2. Розмір сітки
        const gridRange = document.getElementById('setting-grid-size');
        const gridBadge = document.getElementById('grid-size-value');
        gridRange.oninput = (e) => {
            const val = e.target.value;
            this.config.gridSize = parseInt(val);
            gridBadge.innerText = val + 'px';

            // Оновлюємо візуал сітки на полотні
            this.el.canvas.style.backgroundSize = `${val}px ${val}px`;
        };

        // 3. Прив'язка до сітки
        document.getElementById('setting-grid-snap').onchange = (e) => {
            this.state.settings.snapToGrid = e.target.checked;
        };

        // 4. Темна тема (спрощена версія для візуалу)
        document.getElementById('btn-toggle-theme').onclick = () => {
            this.state.settings.darkMode = !this.state.settings.darkMode;
            document.body.classList.toggle('dark-theme');
            this.showToast(this.state.settings.darkMode ? "Темна тема активована" : "Світла тема активована", "info");
        };
    },

    applyLabelSettings() {
        const opacity = this.state.settings.showLabels ? '1' : '0';
        document.querySelectorAll('.device-label').forEach(el => {
            el.style.opacity = opacity;
        });
    },

    initMapEngine() {
        // Клавіатура
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                this.state.isSpacePressed = true;
                this.el.viewport.style.cursor = 'grab';
            }

            // Слухачі для кнопок масштабу
            document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.zoom('in'));
            document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.zoom('out'));
            document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
                this.state.currentScale = 1;
                this.state.panX = -4500;
                this.state.panY = -4500;
                this.updateCanvas();
            });
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.state.isSpacePressed = false;
                this.el.viewport.style.cursor = 'auto';
            }
        });

        // Миша (Panning)
        this.el.viewport.addEventListener('mousedown', (e) => {
            if (e.button === 1 || this.state.isSpacePressed) {
                e.preventDefault();
                this.state.isPanning = true;
                this.el.viewport.style.cursor = 'grabbing';
                this.state.startPanMouseX = e.clientX - this.state.panX;
                this.state.startPanMouseY = e.clientY - this.state.panY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.state.isPanning) {
                this.state.panX = e.clientX - this.state.startPanMouseX;
                this.state.panY = e.clientY - this.state.startPanMouseY;
                this.updateCanvas();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.state.isPanning) {
                this.state.isPanning = false;
                this.el.viewport.style.cursor = this.state.isSpacePressed ? 'grab' : 'auto';
            }
        });

        this.el.viewport.addEventListener('wheel', (e) => this.handleZoom(e), { passive: false });

        this.updateCanvas();
    },

    // --- ЗАВАНТАЖЕННЯ ДАНИХ ТА РЕНДЕРИНГ ---

    async loadLocations() {
        const result = await this.request('get_locations', null, 'GET');
        if (result.status === 'success' && this.el.locationSelect) {
            this.el.locationSelect.innerHTML = '';
            result.data.forEach(loc => {
                const opt = new Option(loc.name, loc.id);
                // ДОДАНО: Примусово робимо текст темним, а фон білим для випадаючого списку
                opt.className = 'text-dark bg-white';
                this.el.locationSelect.add(opt);
            });
            this.state.currentLocationId = this.el.locationSelect.value;
        }
    },

    async refreshMap() {
        // Паралельне завантаження даних для швидкодії
        const [desksRes, devicesRes] = await Promise.all([
            this.request(`get_desks&location_id=${this.state.currentLocationId}`, null, 'GET'),
            this.request(`get_devices`, null, 'GET')
        ]);

        if (devicesRes.status === 'success') {
            this.state.allDevices = devicesRes.data;
        }

        this.renderMap(desksRes.data || [], this.state.allDevices || []);

        // ВИПРАВЛЕНО: Тепер правильно викликаємо внутрішній метод об'єкта
        this.loadTicketsRightPanel();
    },

    renderMap(desks, devices) {
        // Безпечно очищаємо полотно, залишаючи службові елементи (як-от рамку виділення)
        Array.from(this.el.canvas.children).forEach(child => {
            if (child.id !== 'selection-box') child.remove();
        });

        // 1. Рендеримо столи (вони мають бути під ПК, z-index регулюється в CSS)
        desks.forEach(desk => this.createDeskNode(desk));

        // 2. Рендеримо пристрої тільки для поточного поверху та якщо вони розміщені
        devices.forEach(device => {
            if (parseInt(device.pos_x) >= 0 && parseInt(device.pos_y) >= 0 && parseInt(device.location_id) === parseInt(this.state.currentLocationId)) {
                this.createDeviceNode(device);
            }
        });

        // Оновлюємо склад
        this.renderInventory();
        this.applyLabelSettings();
    },

    createDeskNode(deskData) {
        const node = document.createElement('div');
        node.className = 'desk-node selectable-item';
        node.style.left = `${deskData.pos_x}px`;
        node.style.top = `${deskData.pos_y}px`;
        node.style.width = `${deskData.width}px`;
        node.style.height = `${deskData.height}px`;
        node.setAttribute('data-id', deskData.id);
        node.setAttribute('data-item-type', 'desk');
        node.setAttribute('data-json', JSON.stringify(deskData));

        this.restoreSelectionState(node, deskData.id, 'desk');

        // Обробник кліку ми додамо в блоці подій
        node.addEventListener('mousedown', (e) => this.handleItemMouseDown(e, node));
        this.el.canvas.appendChild(node);
    },

    createDeviceNode(deviceData) {
        const node = document.createElement('div');
        node.className = `device-node selectable-item status-${deviceData.status}`;
        node.style.left = `${deviceData.pos_x}px`;
        node.style.top = `${deviceData.pos_y}px`;
        node.setAttribute('data-id', deviceData.id);
        node.setAttribute('data-item-type', 'device');
        node.setAttribute('data-json', JSON.stringify(deviceData));

        node.innerHTML = `
            <div class="device-icon"><i class="fa-solid ${deviceData.icon}"></i></div>
            <div class="device-label">${deviceData.hostname}</div>
        `;

        this.restoreSelectionState(node, deviceData.id, 'device');

        node.addEventListener('mousedown', (e) => this.handleItemMouseDown(e, node));
        node.addEventListener('click', (e) => this.handleDeviceClick(e, node, deviceData));

        this.el.canvas.appendChild(node);
    },

    // Відновлює виділення об'єкта після перемальовування карти
    restoreSelectionState(node, id, type) {
        Array.from(this.state.selectedItems).forEach(si => {
            if (si.getAttribute('data-id') == id && si.getAttribute('data-item-type') == type) {
                node.classList.add('selected');
                this.state.selectedItems.delete(si);
                this.state.selectedItems.add(node);
            }
        });
    },

    // Оновлений метод зміни поверху
    async changeLocation() {
        this.state.currentLocationId = this.el.locationSelect.value;
        this.state.currentScale = 1;
        this.state.panX = -4500;
        this.state.panY = -4500;
        this.updateCanvas();
        this.clearSelection();
        await this.refreshMap();
        this.showToast("Локацію змінено", "info");
    },

    // --- ІНТЕРАКТИВНІСТЬ (Виділення та Перетягування) ---

    // Обробка кліку на сам об'єкт (ПК або Стіл)
    handleItemMouseDown(e, node) {
        if (e.button !== 0 || this.state.isSpacePressed) return;
        e.stopPropagation();

        // 1. Обробка ресайзу столу
        if (node.getAttribute('data-item-type') === 'desk') {
            const rect = node.getBoundingClientRect();
            // Якщо клікнули в правий нижній кут (зона ресайзу)
            if ((e.clientX - rect.left) > (rect.width - 20) && (e.clientY - rect.top) > (rect.height - 20)) {
                this.state.isResizingDesk = true;

                const onMouseUpResize = async () => {
                    window.removeEventListener('mouseup', onMouseUpResize);
                    this.state.isResizingDesk = false;

                    const payload = {
                        action: 'update_desk',
                        id: node.getAttribute('data-id'),
                        pos_x: parseInt(node.style.left),
                        pos_y: parseInt(node.style.top),
                        width: node.offsetWidth,
                        height: node.offsetHeight
                    };
                    await this.request(payload.action, payload);
                };
                window.addEventListener('mouseup', onMouseUpResize);
                return;
            }
        }

        // 2. Логіка виділення об'єктів (Multi-select)
        if (e.ctrlKey || e.shiftKey) {
            if (this.state.selectedItems.has(node)) {
                this.state.selectedItems.delete(node);
                node.classList.remove('selected');
            } else {
                this.state.selectedItems.add(node);
                node.classList.add('selected');
            }
        } else {
            if (!this.state.selectedItems.has(node)) {
                this.clearSelection();
                this.state.selectedItems.add(node);
                node.classList.add('selected');
            }
        }

        // 3. Підготовка до перетягування
        this.state.isDraggingItem = true;
        this.state.dragNode = node;
        this.state.hasDraggedItem = false;

        const rect = this.el.viewport.getBoundingClientRect();
        this.state.origX = Math.round((((e.clientX - rect.left) - this.state.panX) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;
        this.state.origY = Math.round((((e.clientY - rect.top) - this.state.panY) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;

        // Кешуємо початкові позиції всіх виділених об'єктів
        this.state.dragOffsets = new Map();
        this.state.selectedItems.forEach(n => {
            n.style.transition = 'none'; // Вимикаємо CSS анімацію для плавності
            this.state.dragOffsets.set(n, {
                x: parseInt(n.style.left),
                y: parseInt(n.style.top)
            });
        });
    },

    // Очищення виділення
    clearSelection() {
        document.querySelectorAll('.selectable-item.selected').forEach(n => n.classList.remove('selected'));
        this.state.selectedItems.clear();
    },

    // Оновлена ініціалізація подій миші для карти
    initMouseEvents() {
        // Рамка виділення (Lasso)
        const selectionBox = document.createElement('div');
        selectionBox.id = 'selection-box';
        // Стилі винесені в CSS, тут лише початкові налаштування
        selectionBox.style.display = 'none';
        if (this.el.canvas) this.el.canvas.appendChild(selectionBox);

        this.el.viewport.addEventListener('mousedown', (e) => {
            if (e.target.closest('.selectable-item') || this.state.isResizingDesk) return;

            if (e.button === 0 && !this.state.isSpacePressed) {
                this.state.isSelecting = true;
                if (!e.shiftKey && !e.ctrlKey) this.clearSelection();

                const rect = this.el.viewport.getBoundingClientRect();
                this.state.selStartX = ((e.clientX - rect.left) - this.state.panX) / this.state.currentScale;
                this.state.selStartY = ((e.clientY - rect.top) - this.state.panY) / this.state.currentScale;

                selectionBox.style.left = this.state.selStartX + 'px';
                selectionBox.style.top = this.state.selStartY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                selectionBox.style.display = 'block';
            }
        });

        this.el.viewport.addEventListener('mousemove', (e) => {
            const rect = this.el.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            let canvasX = (mouseX - this.state.panX) / this.state.currentScale;
            let canvasY = (mouseY - this.state.panY) / this.state.currentScale;

            // Логіка малювання рамки
            if (this.state.isSelecting) {
                let boxLeft = Math.min(this.state.selStartX, canvasX);
                let boxTop = Math.min(this.state.selStartY, canvasY);
                let boxWidth = Math.abs(canvasX - this.state.selStartX);
                let boxHeight = Math.abs(canvasY - this.state.selStartY);

                selectionBox.style.left = boxLeft + 'px';
                selectionBox.style.top = boxTop + 'px';
                selectionBox.style.width = boxWidth + 'px';
                selectionBox.style.height = boxHeight + 'px';

                // Перевірка, які елементи потрапили в рамку
                requestAnimationFrame(() => {
                    document.querySelectorAll('.selectable-item').forEach(node => {
                        let nodeX = parseInt(node.style.left);
                        let nodeY = parseInt(node.style.top);
                        let nW = node.offsetWidth || this.config.gridSize;
                        let nH = node.offsetHeight || this.config.gridSize;

                        let centerX = nodeX + (nW / 2);
                        let centerY = nodeY + (nH / 2);

                        if (centerX >= boxLeft && centerX <= boxLeft + boxWidth && centerY >= boxTop && centerY <= boxTop + boxHeight) {
                            this.state.selectedItems.add(node);
                            node.classList.add('selected');
                        } else if (!e.shiftKey && !e.ctrlKey) {
                            this.state.selectedItems.delete(node);
                            node.classList.remove('selected');
                        }
                    });
                });
                return;
            }

            // Перетягування виділених об'єктів (з прив'язкою до сітки)
            // Перетягування виділених об'єктів
            if (this.state.isDraggingItem && this.state.dragNode && !this.state.isResizingDesk) {
                this.state.hasDraggedItem = true;

                // --- НОВИЙ КОД ПОЧИНАЄТЬСЯ ТУТ ---
                let newX = canvasX;
                let newY = canvasY;

                // Перевіряємо, чи увімкнена галочка "Прив'язка до сітки" в налаштуваннях
                if (this.state.settings && this.state.settings.snapToGrid) {
                    newX = Math.round(canvasX / this.config.gridSize) * this.config.gridSize;
                    newY = Math.round(canvasY / this.config.gridSize) * this.config.gridSize;
                }

                let dx = newX - this.state.origX;
                let dy = newY - this.state.origY;
                // --- НОВИЙ КОД ЗАКІНЧУЄТЬСЯ ТУТ ---

                requestAnimationFrame(() => {
                    this.state.selectedItems.forEach(n => {
                        let start = this.state.dragOffsets.get(n);
                        if (start) {
                            n.style.left = `${start.x + dx}px`;
                            n.style.top = `${start.y + dy}px`;
                        }
                    });
                });
            }
        });

        window.addEventListener('mouseup', async () => {
            if (this.state.isSelecting) {
                this.state.isSelecting = false;
                selectionBox.style.display = 'none';
            }

            // Збереження нових позицій після перетягування
            if (this.state.isDraggingItem && this.state.dragNode && this.state.hasDraggedItem && !this.state.isResizingDesk) {
                await this.handleDragEnd();
            }

            this.state.isDraggingItem = false;
            this.state.dragNode = null;
            this.state.isResizingDesk = false;
        });
    },

    // Обробка завершення перетягування (включно зі Swap логікою)
    async handleDragEnd() {
        let historyEntry = [];
        let promises = [];
        let isSwap = false;

        // 1. Логіка обміну ПК місцями
        if (this.state.selectedItems.size === 1 && this.state.dragNode.getAttribute('data-item-type') === 'device') {
            const dragId = this.state.dragNode.getAttribute('data-id');
            const newX = parseInt(this.state.dragNode.style.left);
            const newY = parseInt(this.state.dragNode.style.top);

            let targetNode = Array.from(document.querySelectorAll('.device-node')).find(node =>
                node !== this.state.dragNode && parseInt(node.style.left) === newX && parseInt(node.style.top) === newY
            );

            if (targetNode) {
                isSwap = true;
                const tData = JSON.parse(targetNode.getAttribute('data-json'));
                const dData = JSON.parse(this.state.dragNode.getAttribute('data-json'));

                if (confirm(`Поміняти місцями "${dData.hostname}" та "${tData.hostname}"?\nБудуть створені тікети на переміщення.`)) {
                    await this.request('swap_devices', { id1: dragId, id2: tData.id });
                    this.showToast("Тікети створено!", "warning");
                } else {
                    // Скасування обміну
                    this.state.dragNode.style.left = `${this.state.origX}px`;
                    this.state.dragNode.style.top = `${this.state.origY}px`;
                }
                await this.refreshMap();
            }
        }

        // 2. Звичайне збереження координат
        if (!isSwap) {
            this.state.selectedItems.forEach(n => {
                let start = this.state.dragOffsets.get(n);
                let endX = parseInt(n.style.left);
                let endY = parseInt(n.style.top);

                if (start && (start.x !== endX || start.y !== endY)) {
                    let id = n.getAttribute('data-id');
                    let type = n.getAttribute('data-item-type');

                    historyEntry.push({ id, type, oldX: start.x, oldY: start.y });

                    let payload = {
                        action: type === 'device' ? 'move_device' : 'update_desk',
                        id: id,
                        pos_x: endX,
                        pos_y: endY,
                        location_id: this.state.currentLocationId
                    };

                    if (type === 'device') payload.location_id = this.state.currentLocationId;
                    if (type === 'desk') {
                        payload.width = n.offsetWidth;
                        payload.height = n.offsetHeight;
                    }

                    promises.push(this.request(payload.action, payload));
                }
            });

            if (historyEntry.length > 0) {
                this.saveToHistory('move', historyEntry);
                await Promise.all(promises);
                await this.refreshMap();
            }
        }

        // Повертаємо CSS анімації
        this.state.selectedItems.forEach(n => n.style.transition = '');
    },

    saveToHistory(actionType, itemsData) {
        this.state.actionHistory.push({ type: actionType, items: itemsData });
        if (this.state.actionHistory.length > this.config.maxHistory) {
            this.state.actionHistory.shift();
        }
    },

    // --- ГАРЯЧІ КЛАВІШІ ---
    initKeyboardEvents() {
        document.addEventListener('keydown', async (e) => {
            // Ігноруємо, якщо користувач вводить текст у форму
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            // ВИДАЛЕННЯ (Delete)
            if (e.code === 'Delete' && this.state.selectedItems.size > 0) {
                if (confirm(`Видалити обрані елементи (${this.state.selectedItems.size} шт.)?`)) {
                    let promises = [];
                    this.state.selectedItems.forEach(n => {
                        let id = n.getAttribute('data-id');
                        let type = n.getAttribute('data-item-type');
                        let action = type === 'device' ? 'delete_device' : 'delete_desk';
                        promises.push(this.request(action, { id }));
                    });
                    await Promise.all(promises);
                    this.clearSelection();
                    await this.refreshMap();
                    this.showToast("Видалено", "success");
                }
            }

            // КОПІЮВАННЯ (Ctrl + C)
            if (e.ctrlKey && e.code === 'KeyC' && this.state.selectedItems.size > 0) {
                this.state.clipboard = [];
                this.state.selectedItems.forEach(n => {
                    this.state.clipboard.push({
                        type: n.getAttribute('data-item-type'),
                        data: JSON.parse(n.getAttribute('data-json'))
                    });
                });
                this.showToast(`Скопійовано елементів: ${this.state.clipboard.length}`, "success");
            }

            // ВСТАВКА (Ctrl + V)
            if (e.ctrlKey && e.code === 'KeyV' && this.state.clipboard.length > 0) {
                let promises = [];
                this.state.clipboard.forEach(item => {
                    if (item.type === 'device') {
                        promises.push(this.request('add_device', {
                            type_id: item.data.type_id,
                            hostname: item.data.hostname + '-copy',
                            ip_address: '', mac_address: '', department: item.data.department,
                            pos_x: parseInt(item.data.pos_x) + this.config.gridSize * 2,
                            pos_y: parseInt(item.data.pos_y) + this.config.gridSize * 2,
                            location_id: this.state.currentLocationId
                        }));
                    } else if (item.type === 'desk') {
                        promises.push(this.request('add_desk', {
                            location_id: this.state.currentLocationId,
                            pos_x: parseInt(item.data.pos_x) + this.config.gridSize * 2,
                            pos_y: parseInt(item.data.pos_y) + this.config.gridSize * 2,
                            width: item.data.width, height: item.data.height
                        }));
                    }
                });
                await Promise.all(promises);
                await this.refreshMap();
                this.showToast("Елементи вставлено", "success");
            }

            // СКАСУВАННЯ (Ctrl + Z)
            if (e.ctrlKey && e.code === 'KeyZ' && this.state.actionHistory.length > 0) {
                let lastAction = this.state.actionHistory.pop();
                if (lastAction.type === 'move') {
                    let promises = [];
                    lastAction.items.forEach(item => {
                        let action = item.type === 'device' ? 'move_device' : 'update_desk';
                        let payload = { action: action, id: item.id, pos_x: item.oldX, pos_y: item.oldY };

                        if (item.type === 'device') payload.location_id = this.state.currentLocationId;
                        if (item.type === 'desk') {
                            const existingNode = document.querySelector(`.desk-node[data-id="${item.id}"]`);
                            if (existingNode) {
                                payload.width = existingNode.offsetWidth;
                                payload.height = existingNode.offsetHeight;
                            }
                        }
                        promises.push(this.request(action, payload));
                    });
                    await Promise.all(promises);
                    await this.refreshMap();
                    this.showToast("Переміщення скасовано", "warning");
                }
            }
        });
    },

    // --- СКЛАД ТА DRAG-N-DROP ---
    renderInventory() {
        const list = document.getElementById('inventoryList');
        const searchInput = document.getElementById('invSearch');
        const filterSelect = document.getElementById('invFilter');
        if (!list || !searchInput || !filterSelect) return;

        list.innerHTML = '';
        const search = searchInput.value.toLowerCase();
        const filter = filterSelect.value;

        this.state.allDevices.forEach(d => {
            const isPlaced = parseInt(d.pos_x) >= 0 && parseInt(d.pos_y) >= 0;
            const isCurrentFloor = parseInt(d.location_id) === parseInt(this.state.currentLocationId);

            if (filter === 'placed' && !isPlaced) return;
            if (filter === 'unplaced' && isPlaced) return;
            if (search && !(d.hostname || '').toLowerCase().includes(search) && !(d.ip_address || '').toLowerCase().includes(search)) return;

            const item = document.createElement('div');
            item.className = `card shadow-sm border-0 ${isPlaced ? 'opacity-50' : 'border-primary border-start border-4'}`;

            if (!isPlaced) {
                item.draggable = true;
                item.style.cursor = 'grab';
                item.ondragstart = (e) => e.dataTransfer.setData('new_device_id', d.id);
            } else {
                item.style.cursor = 'pointer';
                item.onclick = () => {
                    if (!isCurrentFloor) {
                        this.showToast("Пристрій на іншому поверсі!", "warning");
                        return;
                    }
                    this.state.currentScale = 1;
                    this.state.panX = (this.el.viewport.clientWidth / 2) - parseInt(d.pos_x);
                    this.state.panY = (this.el.viewport.clientHeight / 2) - parseInt(d.pos_y);
                    this.updateCanvas();

                    const node = document.querySelector(`.device-node[data-id="${d.id}"]`);
                    if (node) {
                        node.classList.add('selected');
                        setTimeout(() => { if (!this.state.selectedItems.has(node)) node.classList.remove('selected'); }, 1500);
                    }
                };
            }
            item.innerHTML = `<div class="card-body p-2" style="font-size:0.85rem;"><b>${d.hostname}</b><br><small class="text-muted">${d.ip_address || 'Немає IP'}</small></div>`;
            list.appendChild(item);
        });
    },

    initInventoryDragAndDrop() {
        this.el.viewport.addEventListener('dragover', (e) => e.preventDefault());
        this.el.viewport.addEventListener('drop', async (e) => {
            e.preventDefault();
            const deviceId = e.dataTransfer.getData('new_device_id');
            if (!deviceId) return;

            const rect = this.el.viewport.getBoundingClientRect();
            let x = Math.round(((e.clientX - rect.left - this.state.panX) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;
            let y = Math.round(((e.clientY - rect.top - this.state.panY) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;

            await this.request('move_device', { id: deviceId, pos_x: x, pos_y: y, location_id: this.state.currentLocationId });
            await this.refreshMap();
        });
    },

    // --- ПРАВА ПАНЕЛЬ ТІКЕТІВ ---
    async loadTicketsRightPanel() {
        const result = await this.request('get_tickets', null, 'GET');
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

                item.onclick = async () => {
                    if (this.state.currentLocationId != t.location_id) {
                        this.el.locationSelect.value = t.location_id;
                        await this.changeLocation();
                    }

                    this.state.currentScale = 1;
                    this.state.panX = (this.el.viewport.clientWidth / 2) - parseInt(t.pos_x);
                    this.state.panY = (this.el.viewport.clientHeight / 2) - parseInt(t.pos_y);
                    this.updateCanvas();

                    const node = document.querySelector(`.device-node[data-id="${t.device_id}"]`);
                    if (node) {
                        this.clearSelection();
                        this.state.selectedItems.add(node);
                        node.classList.add('selected');
                        node.classList.add('pulse-highlight');
                        setTimeout(() => node.classList.remove('pulse-highlight'), 3000);
                    }
                };
                panel.appendChild(item);
            });
        } else {
            panel.innerHTML = '<div class="text-muted small text-center mt-4"><i class="fa-solid fa-check-circle me-1 text-success"></i>Все працює ідеально</div>';
        }
    },

    // --- ПАНЕЛЬ ДЕТАЛЕЙ ТА ФОРМИ ---

    // Обробка кліку по пристрою на карті
    handleDeviceClick(e, node, deviceData) {
        e.stopPropagation();
        // Якщо ми зараз перетягуємо щось, або обрали інструмент з тулбару — ігноруємо
        if (this.state.hasDraggedItem || window.selectedTypeId) return;

        // Відкриваємо деталі тільки якщо виділений рівно 1 пристрій (без Shift/Ctrl)
        if (!e.ctrlKey && !e.shiftKey && this.state.selectedItems.size === 1) {
            this.state.activeDeviceData = deviceData;

            document.getElementById('detail-hostname').innerText = deviceData.hostname;
            document.getElementById('detail-icon').innerHTML = `<i class="fa-solid ${deviceData.icon}"></i>`;
            document.getElementById('detail-ip').innerText = deviceData.ip_address || '---';
            document.getElementById('detail-mac').innerText = deviceData.mac_address || '---';
            document.getElementById('detail-department').innerText = deviceData.department || '---';

            this.ui.detailsPanel.show();
        }
    },

    // Ініціалізація кнопок у панелі деталей та обробників форм
    initUIForms() {
        // Кнопка: Видалити пристрій з панелі деталей
        const btnDelete = document.getElementById('btn-delete-device');
        if (btnDelete) {
            btnDelete.onclick = async () => {
                if (confirm(`Видалити пристрій ${this.state.activeDeviceData.hostname}?`)) {
                    await this.request('delete_device', { id: this.state.activeDeviceData.id });
                    this.ui.detailsPanel.hide();
                    this.clearSelection();
                    await this.refreshMap();
                    this.showToast("Видалено", "success");
                }
            };
        }

        // Кнопка: Відкрити форму тікета з панелі деталей
        const btnCreateTicket = document.getElementById('btn-create-ticket');
        if (btnCreateTicket) {
            btnCreateTicket.onclick = () => {
                this.ui.detailsPanel.hide();
                document.getElementById('ticket_device_id').value = this.state.activeDeviceData.id;
                document.getElementById('ticketForm').reset();
                this.ui.ticketModal.show();
            };
        }

        // Відправка форми тікета
        const ticketForm = document.getElementById('ticketForm');
        if (ticketForm) {
            ticketForm.onsubmit = async (e) => {
                e.preventDefault();
                const payload = {
                    device_id: document.getElementById('ticket_device_id').value,
                    subject: document.getElementById('ticket_subject').value,
                    description: document.getElementById('ticket_description').value,
                    priority: document.getElementById('ticket_priority').value
                };
                await this.request('add_ticket', payload);
                this.ui.ticketModal.hide();
                await this.refreshMap();
                this.showToast("Інцидент відкрито!", "danger");
            };
        }

        // Відправка форми ДОДАВАННЯ/РЕДАГУВАННЯ ОБЛАДНАННЯ на карті
        const deviceForm = document.getElementById('deviceForm');
        if (deviceForm) {
            deviceForm.onsubmit = async (e) => {
                e.preventDefault(); // Зупиняємо перезавантаження сторінки

                const formId = document.getElementById('form_id').value;
                const payload = {
                    action: formId ? 'edit_device' : 'add_device',
                    id: formId,
                    type_id: document.getElementById('form_type_id').value,
                    hostname: document.getElementById('form_hostname').value,
                    ip_address: document.getElementById('form_ip').value,
                    mac_address: document.getElementById('form_mac').value,
                    department: document.getElementById('form_department').value,
                    pos_x: document.getElementById('form_pos_x').value,
                    pos_y: document.getElementById('form_pos_y').value,
                    location_id: this.state.currentLocationId
                };

                const res = await this.request(payload.action, payload);
                if (res.status === 'success') {
                    this.ui.deviceModal.hide();
                    await this.refreshMap();
                    this.showToast("Обладнання успішно збережено!", "success");
                }
            };
        }
    },

    // --- КАТАЛОГ (Вкладка Створити) ---
    async loadToolbar() {
        const result = await this.request('get_types', null, 'GET');
        const toolbar = document.getElementById('toolbar-tools');
        if (!toolbar || result.status !== 'success') return;

        toolbar.innerHTML = '';
        result.data.forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-dark tool-btn text-start p-2 fw-bold small mb-2 w-100';
            btn.innerHTML = `<i class="fa-solid ${type.icon} me-2 text-primary"></i> ${type.name}`;

            btn.onclick = () => {
                // Вимикаємо попередні активні кнопки
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active', 'btn-dark', 'text-white'));

                // Активуємо поточну
                btn.classList.add('active', 'btn-dark', 'text-white');
                this.state.selectedTypeId = type.id;
                this.el.viewport.style.cursor = 'crosshair';
                document.getElementById('cancelSelectionBtn').classList.remove('d-none');
            };
            toolbar.appendChild(btn);
        });
    },

    cancelSelection() {
        this.state.selectedTypeId = null;
        this.el.viewport.style.cursor = 'auto';
        document.getElementById('cancelSelectionBtn').classList.add('d-none');
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active', 'btn-dark', 'text-white'));
    },

    // --- КЕРУВАННЯ МАСШТАБОМ ---
    zoom(direction) {
        const delta = direction === 'in' ? this.config.zoomStep : -this.config.zoomStep;
        const oldScale = this.state.currentScale;
        const newScale = Math.max(this.config.minScale, Math.min(oldScale + delta, this.config.maxScale));

        // Масштабуємо відносно центру екрана
        const centerX = this.el.viewport.clientWidth / 2;
        const centerY = this.el.viewport.clientHeight / 2;
        const ratio = newScale / oldScale;

        this.state.panX = centerX - (centerX - this.state.panX) * ratio;
        this.state.panY = centerY - (centerY - this.state.panY) * ratio;
        this.state.currentScale = newScale;

        this.updateCanvas();
    },

    // --- АНАЛІТИКА ТА СТАТИСТИКА ---
    showAnalytics() {
        // Рахуємо статистику з масиву allDevices
        const total = this.state.allDevices.length;
        let okCount = 0, warningCount = 0, errorCount = 0;

        this.state.allDevices.forEach(d => {
            if (d.status === 'ok') okCount++;
            else if (d.status === 'warning') warningCount++;
            else if (d.status === 'error') errorCount++;
        });

        // Заповнюємо цифри
        document.getElementById('stat-total-devices').innerText = total;
        document.getElementById('stat-total-tickets').innerText = errorCount;

        // Ініціалізуємо модалку, якщо вона ще не створена
        if (!this.ui.analyticsModal) {
            this.ui.analyticsModal = new bootstrap.Modal(document.getElementById('analyticsModal'));
        }

        // Малюємо графік
        const ctx = document.getElementById('devicesChart').getContext('2d');
        
        // Знищуємо старий графік, якщо він був (щоб при повторному відкритті вони не накладались)
        if (this.state.chartInstance) {
            this.state.chartInstance.destroy();
        }

        // Створюємо новий красивий doughnut (кільцевий) графік
        this.state.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Працює (OK)', 'Попередження', 'Інциденти (Тікет)'],
                datasets: [{
                    data: [okCount, warningCount, errorCount],
                    backgroundColor: ['#198754', '#ffc107', '#dc3545'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                cutout: '75%', // Робить дірку всередині графіка більшою (сучасний стиль)
                plugins: {
                    legend: { position: 'bottom' }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });

        this.ui.analyticsModal.show();
    },

    async init() {
        console.log("IT Infra PRO Engine Loading...");

        // Ініціалізація Bootstrap компонентів (додаємо їх до об'єкта)
        this.ui = {
            deviceModal: new bootstrap.Modal(document.getElementById('deviceModal')),
            detailsPanel: new bootstrap.Offcanvas(document.getElementById('deviceDetailsPanel')),
            ticketModal: new bootstrap.Modal(document.getElementById('ticketModal'))
        };

        // Ініціалізуємо слухачів
        this.initMapEngine();
        this.initMouseEvents();
        this.initKeyboardEvents();
        this.initInventoryDragAndDrop();
        this.initUIForms();

        // Перше завантаження
        await this.loadLocations();
        await this.refreshMap();
        await this.loadToolbar();
        this.updateCanvas();

        // Прив'язуємо глобальні функції для HTML (onclick, onchange атрибути)
        // Це необхідно, бо ми сховали логіку в об'єкт App, а HTML шукає функції в window
        window.changeLocation = () => this.changeLocation();
        window.renderInventory = () => this.renderInventory();
        window.cancelSelection = () => this.cancelSelection();
        window.showAnalytics = () => this.showAnalytics();
        window.addDesk = async () => {
            const centerX = Math.round(((-this.state.panX + this.el.viewport.clientWidth / 2) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;
            const centerY = Math.round(((-this.state.panY + this.el.viewport.clientHeight / 2) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;
            await this.request('add_desk', { location_id: this.state.currentLocationId, pos_x: centerX, pos_y: centerY });
            await this.refreshMap();
        };

        // Логіка кліку по карті для створення нового пристрою
        this.el.canvas.onclick = (e) => {
            if (!this.state.selectedTypeId || this.state.isPanning || this.state.isSelecting || e.target.closest('.selectable-item')) return;

            const rect = this.el.viewport.getBoundingClientRect();
            let x = Math.round(((e.clientX - rect.left - this.state.panX) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;
            let y = Math.round(((e.clientY - rect.top - this.state.panY) / this.state.currentScale) / this.config.gridSize) * this.config.gridSize;

            document.getElementById('modalTitle').innerText = 'Додати обладнання';
            document.getElementById('form_id').value = '';
            document.getElementById('form_type_id').value = this.state.selectedTypeId;
            document.getElementById('form_pos_x').value = x;
            document.getElementById('form_pos_y').value = y;
            document.getElementById('deviceForm').reset();
            this.ui.deviceModal.show();
        };

        const depsRes = await this.request('get_departments', null, 'GET');
        if (depsRes.status === 'success') {
            document.getElementById('form_department').innerHTML = '<option value="">-- Без відділу --</option>' +
                depsRes.data.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
        }
    }
};




// Запуск при завантаженні
document.addEventListener('DOMContentLoaded', () => App.init());



