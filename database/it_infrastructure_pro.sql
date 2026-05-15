-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 15, 2026 at 04:13 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `it_infrastructure_pro`
--

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `desks`
--

CREATE TABLE `desks` (
  `id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL DEFAULT 1,
  `pos_x` int(11) NOT NULL,
  `pos_y` int(11) NOT NULL,
  `width` int(11) NOT NULL DEFAULT 120,
  `height` int(11) NOT NULL DEFAULT 80
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `desks`
--

INSERT INTO `desks` (`id`, `location_id`, `pos_x`, `pos_y`, `width`, `height`) VALUES
(1, 1, 4040, 4300, 602, 258),
(2, 1, 4840, 4300, 508, 262),
(3, 1, 4300, 4880, 339, 243),
(4, 1, 4720, 4880, 556, 244),
(5, 1, 5420, 5200, 239, 560),
(6, 1, 5760, 5220, 241, 640),
(7, 2, 5140, 4900, 124, 194),
(8, 2, 4500, 4500, 420, 178),
(17, 2, 4840, 4900, 120, 80);

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `type_id` int(11) NOT NULL,
  `hostname` varchar(100) NOT NULL,
  `ip_address` varchar(15) DEFAULT NULL,
  `mac_address` varchar(17) DEFAULT NULL,
  `department` varchar(50) DEFAULT 'Загальний',
  `department_id` int(11) DEFAULT NULL,
  `pos_x` int(11) NOT NULL,
  `pos_y` int(11) NOT NULL,
  `status` enum('ok','warning','error','offline') DEFAULT 'ok',
  `location_id` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `devices`
--

INSERT INTO `devices` (`id`, `type_id`, `hostname`, `ip_address`, `mac_address`, `department`, `department_id`, `pos_x`, `pos_y`, `status`, `location_id`) VALUES
(82, 1, 'Aleksandr_Kosmos', '', '', '', NULL, 4540, 4500, 'ok', 1),
(83, 1, 'Anna_Rander', '', '', '', NULL, 4440, 4500, 'ok', 1),
(84, 1, 'Artur_Foster', '', '', '', NULL, 4340, 4500, 'ok', 1),
(85, 1, 'David_Lapa', '', '', '', NULL, 4140, 4340, 'ok', 1),
(87, 1, 'Mark_Vares', '', '', '', NULL, 4440, 4340, 'ok', 1),
(88, 1, 'Oskar_Radin', '', '', '', NULL, 4540, 4340, 'ok', 1),
(89, 1, 'Emil_Maier', '', '', '', NULL, 4240, 4340, 'ok', 1),
(90, 1, 'Viktor_Barinov', '', '', '', NULL, 4980, 4360, 'ok', 1),
(91, 1, 'Amina_Karaeva', '', '', '', NULL, 5060, 4360, 'ok', 1),
(92, 1, 'Anatoliy_sylyanov', '', '', '', NULL, 5220, 4360, 'ok', 1),
(93, 1, 'Andrey_Nikulin', '', '', '', NULL, 5060, 4500, 'ok', 1),
(94, 1, 'Dmitriy_Alekseev', '', '', '', NULL, 4900, 4360, 'ok', 1),
(95, 1, 'Liliya_Tsvetkova', '', '', '', NULL, 4980, 4500, 'ok', 1),
(96, 1, 'Emma_Dragosh', '', '', '', NULL, 5140, 4360, 'ok', 1),
(97, 1, 'Yuriy_Moretti', '', '', '', NULL, 5140, 4500, 'ok', 1),
(98, 1, 'Roman_Kalachev', '', '', '', NULL, 5220, 4500, 'ok', 1),
(99, 1, 'Danil_Ratas', '', '', '', NULL, 4600, 4420, 'ok', 1),
(100, 1, 'Mark_Kolesnikov', '', '', '', NULL, 5300, 4420, 'ok', 1),
(101, 1, 'Jana_Tomasova', '', '', '', NULL, 4440, 5080, 'ok', 1),
(102, 1, 'Augustin_Nedved', '192.168.100.3', 'o7.cloud.081  748', '', NULL, 4340, 5080, 'ok', 1),
(103, 1, 'Adela Novakova', '', '', '', NULL, 4540, 5080, 'ok', 1),
(104, 1, 'Erik_Barta', '', '', '', NULL, 4540, 4920, 'ok', 1),
(105, 1, 'Jana_Tomasova', '', '', '', NULL, 4440, 4920, 'ok', 1),
(106, 1, 'Jan_Anders', '', '', '', NULL, 4600, 5000, 'ok', 1),
(114, 1, 'HAVIER_ROTLANT', '', '', '', NULL, 4860, 4920, 'ok', 1),
(118, 1, 'Maksim_Karelin', '', '', '', NULL, 5160, 4920, 'ok', 1),
(119, 1, 'Igor_Morozov', '', '', '', NULL, 4960, 4920, 'ok', 1),
(120, 1, 'Aleksandr_Vasilliev', '', '', '', NULL, 5060, 4920, 'ok', 1),
(124, 1, 'DMITRIY_SOBOLEV', '', '', '', NULL, 4760, 5080, 'ok', 1),
(131, 1, 'Adam_Larin', '', '', '', NULL, 5060, 5080, 'ok', 1),
(134, 1, 'Victor Naumov', '', '', '', NULL, 4860, 5080, 'ok', 1),
(135, 1, 'Timur_Veinbergs', '', '', '', NULL, 5160, 5080, 'ok', 1),
(136, 1, 'Aleksey_Vinn', '', '', '', NULL, 4960, 5080, 'ok', 1),
(137, 1, 'Andrey_Martynov', '', '', '', NULL, 5240, 5000, 'ok', 1),
(139, 1, 'Sеm.ozturk', '', '', '', NULL, 5480, 5360, 'ok', 1),
(140, 1, 'Ferit_Buyukhan', '', '', '', NULL, 5600, 5460, 'ok', 1),
(142, 1, 'Gokhan_Yildirim', '', '', '', NULL, 5480, 5460, 'ok', 1),
(144, 1, 'can_ozturk', '', '', '', NULL, 5480, 5560, 'ok', 1),
(145, 1, 'Alp_Sevimlisoy', '', '', '', NULL, 5600, 5660, 'ok', 1),
(146, 1, 'Ansel_Kasparov', '', '', '', NULL, 5540, 5260, 'ok', 1),
(147, 1, 'Artur_Rossmann', '', '', '', NULL, 5800, 5520, 'ok', 1),
(148, 1, 'Aleksandr_Weber', '', '', '', NULL, 5800, 5420, 'ok', 1),
(149, 1, 'Giulia_Mahlig', '', '', '', NULL, 5800, 5620, 'ok', 1),
(150, 1, 'David_Walker', '', '', '', NULL, 5800, 5720, 'ok', 1),
(152, 1, 'Monica Beckj', '', '', '', NULL, 5960, 5520, 'ok', 1),
(153, 1, 'Emily_Bergman', '', '', '', NULL, 5960, 5420, 'ok', 1),
(154, 1, 'sofia.lallinger', '', '', '', NULL, 5960, 5320, 'ok', 1),
(155, 1, 'Michaela_Kraft', '', '', '', NULL, 5960, 5620, 'ok', 1),
(156, 1, 'lisa.berger', '', '', '', NULL, 5960, 5720, 'ok', 1),
(158, 1, 'Kevin_Schmidt', '', '', '', NULL, 5880, 5260, 'ok', 1),
(159, 1, 'Aria Malek', '', '', '', NULL, 5960, 5800, 'ok', 1),
(166, 1, '123', '', '', '', NULL, 4880, 4640, 'ok', 2),
(170, 1, '12345', '', '', '', NULL, 4800, 4640, 'ok', 2),
(171, 1, '123', '', '', '', NULL, 5800, 5320, 'ok', 1),
(172, 1, 'Papaz', '', '', '', NULL, 5600, 5360, 'error', 1),
(173, 1, 'Ilyaz.bakinskiy', '', '', '', NULL, 5600, 5560, 'ok', 1),
(174, 1, 'Aras Tasdemir', '', '', '', NULL, 5480, 5660, 'ok', 1);

-- --------------------------------------------------------

--
-- Table structure for table `device_types`
--

CREATE TABLE `device_types` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `icon` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `device_types`
--

INSERT INTO `device_types` (`id`, `name`, `icon`) VALUES
(1, 'Робоча станція', 'fa-desktop'),
(2, 'Сервер', 'fa-server'),
(3, 'Мережевий комутатор', 'fa-network-wired'),
(4, 'Принтер', 'fa-print'),
(5, 'Wi-Fi Точка', 'fa-wifi');

-- --------------------------------------------------------

--
-- Table structure for table `locations`
--

CREATE TABLE `locations` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `bg_image` varchar(255) DEFAULT NULL,
  `bg_scale` float DEFAULT 100,
  `bg_rotate` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `locations`
--

INSERT INTO `locations` (`id`, `name`, `bg_image`, `bg_scale`, `bg_rotate`) VALUES
(1, '7-й поверх', NULL, 100, 0),
(2, '5-й поверх', NULL, 100, 0);

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(11) NOT NULL,
  `bg_image` varchar(255) DEFAULT NULL,
  `bg_scale` float DEFAULT 100,
  `bg_rotate` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `bg_image`, `bg_scale`, `bg_rotate`) VALUES
(1, 'uploads/bg_1778679692_Креслення2.png', 130, 90);

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `subject` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `status` enum('new','in_progress','unresolved','completed') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tickets`
--

INSERT INTO `tickets` (`id`, `device_id`, `subject`, `description`, `priority`, `status`, `created_at`) VALUES
(16, 156, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Aria Malek', 'medium', 'completed', '2026-05-13 15:45:08'),
(17, 96, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Andrey_Nikulin', 'medium', 'completed', '2026-05-14 07:49:58'),
(18, 93, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Emma_Dragosh', 'medium', 'completed', '2026-05-14 07:49:58'),
(19, 139, 'Створити WA', 'Немає номерів, треба чекати', 'medium', 'completed', '2026-05-14 08:19:10'),
(21, 140, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Ilyas_Aydin', 'medium', 'completed', '2026-05-15 07:37:08'),
(22, 85, '123', '123', 'medium', 'completed', '2026-05-15 08:10:11'),
(23, 150, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: lisa.berger', 'medium', 'completed', '2026-05-15 09:19:48'),
(24, 156, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: David_Walker', 'medium', 'completed', '2026-05-15 09:19:48'),
(25, 118, '123', '123', 'medium', 'completed', '2026-05-15 10:36:58'),
(26, 172, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Gokhan_Yildirim', 'medium', 'new', '2026-05-15 11:05:49'),
(27, 142, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Papaz', 'medium', 'completed', '2026-05-15 11:05:49'),
(28, 140, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Araz', 'medium', 'completed', '2026-05-15 11:20:08'),
(29, 174, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Ferit_Buyukhan', 'medium', 'completed', '2026-05-15 11:20:08'),
(30, 145, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Ilyaz.bakinskiy', 'medium', 'completed', '2026-05-15 11:41:19'),
(31, 173, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Alp_Sevimlisoy', 'medium', 'completed', '2026-05-15 11:41:19'),
(32, 144, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Aras Tasdemir', 'medium', 'completed', '2026-05-15 11:41:25'),
(33, 139, 'Переміщення робочого місця', 'Необхідно фізично перемістити це обладнання на місце: Gokhan_Yildirim', 'medium', 'completed', '2026-05-15 11:41:31');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `desks`
--
ALTER TABLE `desks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `type_id` (`type_id`);

--
-- Indexes for table `device_types`
--
ALTER TABLE `device_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `device_id` (`device_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `desks`
--
ALTER TABLE `desks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=175;

--
-- AUTO_INCREMENT for table `device_types`
--
ALTER TABLE `device_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `locations`
--
ALTER TABLE `locations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `devices`
--
ALTER TABLE `devices`
  ADD CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`type_id`) REFERENCES `device_types` (`id`);

--
-- Constraints for table `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
