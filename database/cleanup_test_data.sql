-- ================================================================
-- TITANIUM GYM — Limpieza de datos de prueba
-- Ejecutar en pgAdmin contra la BD de producción en Render
--
-- SE ELIMINAN:  miembros, ventas, membresías, productos, ejercicios,
--               rutinas, casilleros, cortes de caja, clases,
--               asistencias, deudas, movimientos de inventario
--
-- SE CONSERVAN: usuarios, roles, permisos, métodos de pago,
--               grupos musculares, planes de membresía,
--               categorías de productos, categorías de clases
-- ================================================================

BEGIN;

-- 1. Pagos de deudas
DELETE FROM debt_payments;

-- 2. Denominaciones de cortes de caja
DELETE FROM cash_closing_denominations;

-- 3. Movimientos de inventario
DELETE FROM inventory_movements;

-- 4. Rentas de casilleros
DELETE FROM locker_rentals;

-- 5. Rutinas asignadas a miembros
DELETE FROM member_routines;

-- 6. Inscripciones a clases
DELETE FROM class_enrollments;

-- 7. Asistencias
DELETE FROM attendance_records;

-- 8. Logs de notificaciones
DELETE FROM notification_logs;

-- 9. Recordatorios
DELETE FROM reminders;

-- 10. Contactos de emergencia
DELETE FROM member_emergency_contacts;

-- 11. Estadísticas físicas
DELETE FROM member_physical_stats;

-- 12. Pagos de ventas
DELETE FROM sale_payments;

-- 13. Detalles de ventas
DELETE FROM sale_details;

-- 14. Deudas
DELETE FROM debts;

-- 15. Ventas
DELETE FROM sales;

-- 16. Membresías de miembros
DELETE FROM member_memberships;

-- 17. Ejercicios de rutinas
DELETE FROM routine_exercises;

-- 18. Horarios de clases
DELETE FROM class_schedules;

-- 19. Rutinas
DELETE FROM routines;

-- 20. Ejercicios
DELETE FROM exercises;

-- 21. Clases
DELETE FROM classes;

-- 22. Cortes de caja
DELETE FROM cash_closings;

-- 23. Casilleros
DELETE FROM lockers;

-- 24. Miembros
DELETE FROM members;

-- 25. Productos
DELETE FROM products;

-- 26. Promociones
DELETE FROM promotions;

-- ================================================================
-- Verificación — debe mostrar 0 en todo
-- ================================================================
SELECT 'members'            AS tabla, COUNT(*) AS registros FROM members
UNION ALL SELECT 'sales',              COUNT(*) FROM sales
UNION ALL SELECT 'member_memberships', COUNT(*) FROM member_memberships
UNION ALL SELECT 'products',           COUNT(*) FROM products
UNION ALL SELECT 'exercises',          COUNT(*) FROM exercises
UNION ALL SELECT 'routines',           COUNT(*) FROM routines
UNION ALL SELECT 'debts',              COUNT(*) FROM debts
UNION ALL SELECT 'cash_closings',      COUNT(*) FROM cash_closings
UNION ALL SELECT 'lockers',            COUNT(*) FROM lockers
-- Lo que se conserva
UNION ALL SELECT '--- CONSERVADO ---', 0
UNION ALL SELECT 'users',              COUNT(*) FROM users
UNION ALL SELECT 'roles',              COUNT(*) FROM roles
UNION ALL SELECT 'membership_plans',   COUNT(*) FROM membership_plans
UNION ALL SELECT 'payment_methods',    COUNT(*) FROM payment_methods
UNION ALL SELECT 'muscle_groups',      COUNT(*) FROM muscle_groups
UNION ALL SELECT 'product_categories', COUNT(*) FROM product_categories;

COMMIT;
