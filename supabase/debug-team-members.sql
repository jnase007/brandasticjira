-- Debug: Check all profiles and their roles
SELECT 
  id,
  full_name,
  email,
  role,
  active,
  created_at
FROM profiles
ORDER BY full_name;

-- Count by role
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role;

-- Check if team members have role set
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN role IN ('team', 'admin') THEN 1 END) as team_admin_count,
  COUNT(CASE WHEN role IS NULL THEN 1 END) as null_role_count,
  COUNT(CASE WHEN active = true THEN 1 END) as active_true,
  COUNT(CASE WHEN active = false THEN 1 END) as active_false,
  COUNT(CASE WHEN active IS NULL THEN 1 END) as active_null
FROM profiles;
