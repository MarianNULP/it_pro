<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'it_infrastructure_pro';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Помилка підключення до БД"]);
    exit;
}

$request_body = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? ($_POST['action'] ?? ($request_body['action'] ?? ''));

switch ($action) {
    case 'get_devices':
        $sql = "SELECT d.*, dt.name as type_name, dt.icon 
                FROM devices d 
                JOIN device_types dt ON d.type_id = dt.id";
        $result = $conn->query($sql);
        $devices = [];
        while ($row = $result->fetch_assoc()) {
            $devices[] = $row;
        }
        echo json_encode(["status" => "success", "data" => $devices]);
        break;

    case 'get_types':
        $result = $conn->query("SELECT * FROM device_types");
        $types = [];
        while ($row = $result->fetch_assoc()) {
            $types[] = $row;
        }
        echo json_encode(["status" => "success", "data" => $types]);
        break;

    case 'add_device':
        $type_id = (int) $request_body['type_id'];
        $hostname = $conn->real_escape_string($request_body['hostname']);
        $ip = $conn->real_escape_string($request_body['ip_address']);
        $mac = $conn->real_escape_string($request_body['mac_address']);
        $department = $conn->real_escape_string($request_body['department']);
        $x = (int) $request_body['pos_x'];
        $y = (int) $request_body['pos_y'];

        $sql = "INSERT INTO devices (type_id, hostname, ip_address, mac_address, department, pos_x, pos_y, status) 
                VALUES ($type_id, '$hostname', '$ip', '$mac', '$department', $x, $y, 'ok')";
        if ($conn->query($sql))
            echo json_encode(["status" => "success"]);
        else
            echo json_encode(["status" => "error", "message" => $conn->error]);
        break;

    case 'move_device':
        $id = (int) $request_body['id'];
        $x = (int) $request_body['pos_x'];
        $y = (int) $request_body['pos_y'];
        $loc_id = (int) $request_body['location_id'];
        $conn->query("UPDATE devices SET pos_x = $x, pos_y = $y WHERE id = $id");
        echo json_encode(["status" => "success"]);
        break;

    case 'edit_device':
        $id = (int) $request_body['id'];
        $hostname = $conn->real_escape_string($request_body['hostname']);
        $ip = $conn->real_escape_string($request_body['ip_address']);
        $mac = $conn->real_escape_string($request_body['mac_address']);
        $department = $conn->real_escape_string($request_body['department']);

        $sql = "UPDATE devices SET hostname='$hostname', ip_address='$ip', mac_address='$mac', department='$department' WHERE id=$id";
        if ($conn->query($sql))
            echo json_encode(["status" => "success"]);
        else
            echo json_encode(["status" => "error", "message" => $conn->error]);
        break;

    case 'delete_device':
        $id = (int) $request_body['id'];
        if ($conn->query("DELETE FROM devices WHERE id=$id"))
            echo json_encode(["status" => "success"]);
        else
            echo json_encode(["status" => "error", "message" => $conn->error]);
        break;

    case 'swap_devices':
        $id1 = (int) $request_body['id1'];
        $id2 = (int) $request_body['id2'];

        // Отримуємо поточні дані (нам потрібні імена для опису тікета)
        $res1 = $conn->query("SELECT hostname, pos_x, pos_y FROM devices WHERE id=$id1")->fetch_assoc();
        $res2 = $conn->query("SELECT hostname, pos_x, pos_y FROM devices WHERE id=$id2")->fetch_assoc();

        // 1. Міняємо координати місцями
        $conn->query("UPDATE devices SET pos_x={$res2['pos_x']}, pos_y={$res2['pos_y']} WHERE id=$id1");
        $conn->query("UPDATE devices SET pos_x={$res1['pos_x']}, pos_y={$res1['pos_y']} WHERE id=$id2");

        // 2. Розумна функція створення тікета (Тільки 1 активний тікет на 1 ПК)
        $createTicket = function ($deviceId, $targetHostname) use ($conn) {
            $subject = "Переміщення робочого місця";
            $desc = "Необхідно фізично перемістити це обладнання на місце: " . $targetHostname;

            // Перевіряємо, чи вже є відкритий тікет на переміщення для цього ПК
            $check = $conn->query("SELECT id FROM tickets WHERE device_id = $deviceId AND subject = '$subject' AND status IN ('new', 'in_progress')");

            if ($check->num_rows === 0) {
                // Якщо такого тікета ще немає - створюємо
                $conn->query("INSERT INTO tickets (device_id, subject, description, priority, status) 
                              VALUES ($deviceId, '$subject', '$desc', 'medium', 'new')");

                // Змінюємо статус ПК на 'error' (щоб він підсвітився червоним на карті)
                $conn->query("UPDATE devices SET status = 'error' WHERE id = $deviceId");
            }
        };

        // Запускаємо перевірку/створення для обох пристроїв
        $createTicket($id1, $res2['hostname']);
        $createTicket($id2, $res1['hostname']);

        echo json_encode(["status" => "success"]);
        break;

    case 'add_ticket':
        $device_id = (int) $request_body['device_id'];
        $subject = $conn->real_escape_string($request_body['subject']);
        $description = $conn->real_escape_string($request_body['description']);
        $priority = $conn->real_escape_string($request_body['priority']);

        $sql_ticket = "INSERT INTO tickets (device_id, subject, description, priority) 
                       VALUES ($device_id, '$subject', '$description', '$priority')";

        if ($conn->query($sql_ticket)) {
            $conn->query("UPDATE devices SET status = 'error' WHERE id = $device_id");
            echo json_encode(["status" => "success"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Помилка БД: " . $conn->error]);
        }
        break;

    case 'get_tickets':
        // Додали d.pos_x, d.pos_y, d.location_id щоб карта знала, куди летіти
        $sql = "SELECT t.*, d.hostname, d.ip_address, dt.icon, d.pos_x, d.pos_y, d.location_id 
                FROM tickets t 
                JOIN devices d ON t.device_id = d.id 
                JOIN device_types dt ON d.type_id = dt.id 
                WHERE t.status != 'closed' 
                ORDER BY t.created_at DESC";
        $result = $conn->query($sql);
        $tickets = [];
        while ($row = $result->fetch_assoc()) {
            $tickets[] = $row;
        }
        echo json_encode(["status" => "success", "data" => $tickets]);
        break;

    case 'update_device_field':
        $id = (int) $request_body['id'];
        $field = $request_body['field'];
        $value = $conn->real_escape_string($request_body['value']);

        $allowed_fields = ['hostname', 'ip_address', 'mac_address', 'department'];
        if (in_array($field, $allowed_fields)) {
            $conn->query("UPDATE devices SET `$field` = '$value' WHERE id = $id");
            echo json_encode(["status" => "success"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Недозволене поле"]);
        }
        break;

    case 'update_ticket_field':
        $id = (int) $request_body['id'];
        $field = $request_body['field'];
        $value = $conn->real_escape_string($request_body['value']);

        $allowed_fields = ['subject', 'description'];
        if (in_array($field, $allowed_fields)) {
            $conn->query("UPDATE tickets SET `$field` = '$value' WHERE id = $id");
            echo json_encode(["status" => "success"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Недозволене поле"]);
        }
        break;

    case 'update_ticket_status':
        $ticket_id = (int) $request_body['ticket_id'];
        $device_id = (int) $request_body['device_id'];
        $new_status = $conn->real_escape_string($request_body['status']);

        $conn->query("UPDATE tickets SET status = '$new_status' WHERE id = $ticket_id");

        if (in_array($new_status, ['completed', 'unresolved'])) {
            $check = $conn->query("SELECT id FROM tickets WHERE device_id = $device_id AND status IN ('new', 'in_progress')");
            if ($check->num_rows === 0) {
                $conn->query("UPDATE devices SET status = 'ok' WHERE id = $device_id");
            }
        } else {
            $conn->query("UPDATE devices SET status = 'error' WHERE id = $device_id");
        }
        echo json_encode(["status" => "success"]);
        break;

    // ==========================================
    // --- БЛОК СТОЛІВ ТА ЗОН ---
    // ==========================================
    case 'get_desks':
        $loc_id = isset($_GET['location_id']) ? (int) $_GET['location_id'] : 1;
        $res = $conn->query("SELECT * FROM desks WHERE location_id = $loc_id");
        $desks = [];
        while ($row = $res->fetch_assoc())
            $desks[] = $row;
        echo json_encode(["status" => "success", "data" => $desks]);
        break;

    case 'add_desk':
        $loc_id = (int) $request_body['location_id'];
        $x = (int) $request_body['pos_x'];
        $y = (int) $request_body['pos_y'];
        // Якщо передали розмір - беремо його, якщо ні - стандартний 120х80
        $w = isset($request_body['width']) ? (int) $request_body['width'] : 120;
        $h = isset($request_body['height']) ? (int) $request_body['height'] : 80;

        $conn->query("INSERT INTO desks (location_id, pos_x, pos_y, width, height) VALUES ($loc_id, $x, $y, $w, $h)");
        echo json_encode(["status" => "success"]);
        break;

    case 'update_desk':
        $id = (int) $request_body['id'];
        $x = (int) $request_body['pos_x'];
        $y = (int) $request_body['pos_y'];
        $w = (int) $request_body['width'];
        $h = (int) $request_body['height'];

        $conn->query("UPDATE desks SET pos_x=$x, pos_y=$y, width=$w, height=$h WHERE id=$id");
        echo json_encode(["status" => "success"]);
        break;

    case 'delete_desk':
        $id = (int) $request_body['id'];
        $conn->query("DELETE FROM desks WHERE id=$id");
        echo json_encode(["status" => "success"]);
        break;

    // ==========================================
    // --- БЛОК ЛОКАЦІЙ (ПОВЕРХІВ) ТА ФОНІВ ---
    // ==========================================

    case 'get_locations':
        $res = $conn->query("SELECT id, name FROM locations ORDER BY id ASC");
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(["status" => "success", "data" => $data]);
        break;

    case 'get_departments':
        $result = $conn->query("SELECT * FROM departments ORDER BY name ASC");
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = $row;
        }
        echo json_encode(["status" => "success", "data" => $data]);
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Невідома дія: " . $action]);
        break;
}

$conn->close();
?>