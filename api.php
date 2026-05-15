<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Для продакшену краще вказати конкретний домен

// Вмикаємо викидання виключень для mysqli (сучасний стандарт)
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'it_infrastructure_pro';

function jsonResponse($status, $dataOrMessage = null)
{
    $response = ["status" => $status];
    if ($status === 'success' && $dataOrMessage !== null) {
        $response['data'] = $dataOrMessage;
    } elseif ($status === 'error' && $dataOrMessage !== null) {
        $response['message'] = $dataOrMessage;
    }
    echo json_encode($response);
    exit;
}

try {
    $conn = new mysqli($host, $user, $pass, $db);
    $conn->set_charset("utf8mb4");
} catch (mysqli_sql_exception $e) {
    jsonResponse("error", "Помилка підключення до бази даних");
}

$request_body = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? $_POST['action'] ?? $request_body['action'] ?? '';

try {
    switch ($action) {
        case 'get_devices':
            $sql = "SELECT d.*, dt.name as type_name, dt.icon 
                    FROM devices d 
                    JOIN device_types dt ON d.type_id = dt.id";
            $result = $conn->query($sql);
            jsonResponse("success", $result->fetch_all(MYSQLI_ASSOC));
            break;

        case 'get_types':
            $result = $conn->query("SELECT * FROM device_types");
            jsonResponse("success", $result->fetch_all(MYSQLI_ASSOC));
            break;

        case 'add_device':
            $stmt = $conn->prepare("INSERT INTO devices (type_id, hostname, ip_address, mac_address, department, pos_x, pos_y, status, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', ?)");
            $stmt->bind_param(
                "issssiii",
                $request_body['type_id'],
                $request_body['hostname'],
                $request_body['ip_address'],
                $request_body['mac_address'],
                $request_body['department'],
                $request_body['pos_x'],
                $request_body['pos_y'],
                $request_body['location_id']
            );
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'move_device':
            // Додаємо location_id у запит, щоб пристрій "переїжджав" на потрібний поверх
            $stmt = $conn->prepare("UPDATE devices SET pos_x = ?, pos_y = ?, location_id = ? WHERE id = ?");
            $stmt->bind_param(
                "iiii",
                $request_body['pos_x'],
                $request_body['pos_y'],
                $request_body['location_id'],
                $request_body['id']
            );
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'edit_device':
            $stmt = $conn->prepare("UPDATE devices SET hostname=?, ip_address=?, mac_address=?, department=? WHERE id=?");
            $stmt->bind_param(
                "ssssi",
                $request_body['hostname'],
                $request_body['ip_address'],
                $request_body['mac_address'],
                $request_body['department'],
                $request_body['id']
            );
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'delete_device':
            $stmt = $conn->prepare("DELETE FROM devices WHERE id=?");
            $stmt->bind_param("i", $request_body['id']);
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'swap_devices':
            $id1 = (int) $request_body['id1'];
            $id2 = (int) $request_body['id2'];

            // Отримуємо поточні координати та імена
            $stmt1 = $conn->prepare("SELECT hostname, pos_x, pos_y FROM devices WHERE id=?");
            $stmt1->bind_param("i", $id1);
            $stmt1->execute();
            $res1 = $stmt1->get_result()->fetch_assoc();

            $stmt2 = $conn->prepare("SELECT hostname, pos_x, pos_y FROM devices WHERE id=?");
            $stmt2->bind_param("i", $id2);
            $stmt2->execute();
            $res2 = $stmt2->get_result()->fetch_assoc();

            if (!$res1 || !$res2)
                jsonResponse("error", "Пристрої не знайдено");

            // Міняємо координати
            $updateStmt = $conn->prepare("UPDATE devices SET pos_x=?, pos_y=? WHERE id=?");
            $updateStmt->bind_param("iii", $res2['pos_x'], $res2['pos_y'], $id1);
            $updateStmt->execute();

            $updateStmt->bind_param("iii", $res1['pos_x'], $res1['pos_y'], $id2);
            $updateStmt->execute();

            // Функція створення тікета
            $createTicket = function ($deviceId, $targetHostname) use ($conn) {
                $subject = "Переміщення робочого місця";
                $desc = "Необхідно фізично перемістити це обладнання на місце: " . $targetHostname;

                $checkStmt = $conn->prepare("SELECT id FROM tickets WHERE device_id = ? AND subject = ? AND status IN ('new', 'in_progress')");
                $checkStmt->bind_param("is", $deviceId, $subject);
                $checkStmt->execute();

                if ($checkStmt->get_result()->num_rows === 0) {
                    $insStmt = $conn->prepare("INSERT INTO tickets (device_id, subject, description, priority, status) VALUES (?, ?, ?, 'medium', 'new')");
                    $insStmt->bind_param("iss", $deviceId, $subject, $desc);
                    $insStmt->execute();

                    $updStatusStmt = $conn->prepare("UPDATE devices SET status = 'error' WHERE id = ?");
                    $updStatusStmt->bind_param("i", $deviceId);
                    $updStatusStmt->execute();
                }
            };

            $createTicket($id1, $res2['hostname']);
            $createTicket($id2, $res1['hostname']);

            jsonResponse("success");
            break;

        case 'add_ticket':
            $stmt = $conn->prepare("INSERT INTO tickets (device_id, subject, description, priority) VALUES (?, ?, ?, ?)");
            $stmt->bind_param(
                "isss",
                $request_body['device_id'],
                $request_body['subject'],
                $request_body['description'],
                $request_body['priority']
            );
            $stmt->execute();

            $updStmt = $conn->prepare("UPDATE devices SET status = 'error' WHERE id = ?");
            $updStmt->bind_param("i", $request_body['device_id']);
            $updStmt->execute();

            jsonResponse("success");
            break;

        case 'get_tickets':
            $sql = "SELECT t.*, d.hostname, d.ip_address, dt.icon, d.pos_x, d.pos_y, d.location_id 
                    FROM tickets t 
                    JOIN devices d ON t.device_id = d.id 
                    JOIN device_types dt ON d.type_id = dt.id 
                    WHERE t.status NOT IN ('closed', 'completed')
                    ORDER BY t.created_at DESC";
            $result = $conn->query($sql);
            jsonResponse("success", $result->fetch_all(MYSQLI_ASSOC));
            break;

        case 'update_device_field':
            $field = $request_body['field'];
            $allowed_fields = ['hostname', 'ip_address', 'mac_address', 'department'];

            if (in_array($field, $allowed_fields, true)) {
                // Пряма вставка імені стовпця тут безпечна, бо ми перевірили його через білий список (in_array)
                $stmt = $conn->prepare("UPDATE devices SET `$field` = ? WHERE id = ?");
                $stmt->bind_param("si", $request_body['value'], $request_body['id']);
                $stmt->execute();
                jsonResponse("success");
            } else {
                jsonResponse("error", "Недозволене поле");
            }
            break;

        case 'update_ticket_field':
            $field = $request_body['field'];
            $allowed_fields = ['subject', 'description'];

            if (in_array($field, $allowed_fields, true)) {
                $stmt = $conn->prepare("UPDATE tickets SET `$field` = ? WHERE id = ?");
                $stmt->bind_param("si", $request_body['value'], $request_body['id']);
                $stmt->execute();
                jsonResponse("success");
            } else {
                jsonResponse("error", "Недозволене поле");
            }
            break;

        case 'update_ticket_status':
            $stmt = $conn->prepare("UPDATE tickets SET status = ? WHERE id = ?");
            $stmt->bind_param("si", $request_body['status'], $request_body['ticket_id']);
            $stmt->execute();

            if (in_array($request_body['status'], ['completed', 'unresolved'], true)) {
                $checkStmt = $conn->prepare("SELECT id FROM tickets WHERE device_id = ? AND status IN ('new', 'in_progress')");
                $checkStmt->bind_param("i", $request_body['device_id']);
                $checkStmt->execute();

                if ($checkStmt->get_result()->num_rows === 0) {
                    $updStmt = $conn->prepare("UPDATE devices SET status = 'ok' WHERE id = ?");
                    $updStmt->bind_param("i", $request_body['device_id']);
                    $updStmt->execute();
                }
            } else {
                $updStmt = $conn->prepare("UPDATE devices SET status = 'error' WHERE id = ?");
                $updStmt->bind_param("i", $request_body['device_id']);
                $updStmt->execute();
            }
            jsonResponse("success");
            break;

        case 'get_desks':
            $loc_id = isset($_GET['location_id']) ? (int) $_GET['location_id'] : 1;
            $stmt = $conn->prepare("SELECT * FROM desks WHERE location_id = ?");
            $stmt->bind_param("i", $loc_id);
            $stmt->execute();
            jsonResponse("success", $stmt->get_result()->fetch_all(MYSQLI_ASSOC));
            break;

        case 'add_desk':
            $w = $request_body['width'] ?? 120;
            $h = $request_body['height'] ?? 80;
            $stmt = $conn->prepare("INSERT INTO desks (location_id, pos_x, pos_y, width, height) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("iiiii", $request_body['location_id'], $request_body['pos_x'], $request_body['pos_y'], $w, $h);
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'update_desk':
            $stmt = $conn->prepare("UPDATE desks SET pos_x=?, pos_y=?, width=?, height=? WHERE id=?");
            $stmt->bind_param("iiiii", $request_body['pos_x'], $request_body['pos_y'], $request_body['width'], $request_body['height'], $request_body['id']);
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'delete_desk':
            $stmt = $conn->prepare("DELETE FROM desks WHERE id=?");
            $stmt->bind_param("i", $request_body['id']);
            $stmt->execute();
            jsonResponse("success");
            break;

        case 'get_locations':
            $result = $conn->query("SELECT id, name FROM locations ORDER BY id ASC");
            jsonResponse("success", $result->fetch_all(MYSQLI_ASSOC));
            break;

        case 'get_departments':
            $result = $conn->query("SELECT * FROM departments ORDER BY name ASC");
            jsonResponse("success", $result->fetch_all(MYSQLI_ASSOC));
            break;

        default:
            jsonResponse("error", "Невідома дія: " . htmlspecialchars($action));
            break;
    }
} catch (mysqli_sql_exception $e) {
    // В продакшені логуємо $e->getMessage() у файл, а юзеру віддаємо загальну помилку
    jsonResponse("error", "Помилка бази даних під час виконання запиту.");
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}