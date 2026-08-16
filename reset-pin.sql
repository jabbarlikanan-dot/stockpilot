UPDATE users SET salt='5n8V/7Qer+s/FGE6JrokOA==', password_hash='reset:5n8V/7Qer+s/FGE6JrokOA==:a2769997d94748446b00d1fb9a1a40c251a74283d9e97634b7f9ffcca955012d', password_iterations=0 WHERE username='krenz' COLLATE NOCASE;
DELETE FROM security_rate_limits;
