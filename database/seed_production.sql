-- ==============================================================
-- TITANIUM GYM - SEED DE PRODUCCIÓN
-- Ejecutar en Supabase SQL Editor después del schema principal
-- ==============================================================

-- 1. Corregir nombres de roles a español
UPDATE roles SET name = 'propietario',   description = 'Acceso total al sistema'               WHERE name = 'owner';
UPDATE roles SET name = 'administrador', description = 'Acceso administrativo general'          WHERE name = 'admin';
UPDATE roles SET name = 'entrenador',    description = 'Acceso a rutinas, clases y asistencia'  WHERE name = 'trainer';
UPDATE roles SET name = 'recepcionista', description = 'Acceso a check-ins y membresías'        WHERE name = 'receptionist';

-- 2. Agregar permisos adicionales (si no existen)
INSERT INTO permissions (name, module, description) VALUES
    ('users.edit_sensitive',  'users', 'Editar email y username de usuarios'),
    ('users.reset_password',  'users', 'Restablecer contraseña de otros usuarios')
ON CONFLICT (name) DO NOTHING;

-- 3. Asignar TODOS los permisos al propietario
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'propietario'
ON CONFLICT DO NOTHING;

-- 4. Asignar permisos al administrador (todo excepto configuración avanzada)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'administrador'
  AND p.name IN (
    'users.view', 'users.create', 'users.edit', 'users.delete',
    'users.reset_password',
    'members.view', 'members.create', 'members.edit', 'members.delete',
    'memberships.view', 'memberships.manage',
    'sales.view', 'sales.create', 'sales.cancel',
    'debts.view', 'debts.manage',
    'classes.view', 'classes.manage',
    'attendance.register',
    'routines.view', 'routines.manage',
    'inventory.view', 'inventory.manage',
    'reports.view'
  )
ON CONFLICT DO NOTHING;

-- 5. Asignar permisos al entrenador
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'entrenador'
  AND p.name IN (
    'members.view',
    'classes.view', 'classes.manage',
    'attendance.register',
    'routines.view', 'routines.manage'
  )
ON CONFLICT DO NOTHING;

-- 6. Asignar permisos al recepcionista
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'recepcionista'
  AND p.name IN (
    'members.view', 'members.create', 'members.edit',
    'memberships.view',
    'sales.view', 'sales.create',
    'debts.view',
    'attendance.register',
    'classes.view'
  )
ON CONFLICT DO NOTHING;

-- 7. Crear usuario propietario inicial
-- Contraseña: Gym2024!  (cámbiala después del primer login)
INSERT INTO users (
    id, role_id, first_name, last_name, email, username,
    password_hash, status, is_active
)
SELECT
    gen_random_uuid(),
    r.id,
    'Administrador',
    'Principal',
    'admin@titaniumgym.com',
    'admin',
    '$2b$12$UQgcprQmrZAgKofrrxwzquA/nbWxZf2nhJrJfR5Hptt4uUdddNePS',
    'active',
    true
FROM roles r
WHERE r.name = 'propietario'
ON CONFLICT (email) DO NOTHING;

-- Verificar resultado
SELECT 'Roles:'    AS tipo, name FROM roles
UNION ALL
SELECT 'Usuario:', email FROM users WHERE email = 'admin@titaniumgym.com';
