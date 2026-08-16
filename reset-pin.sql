UPDATE users SET salt='Wk49/C56ymiGwNr1L8sH+w==', password_hash='CTdjtuB40xyaKdQO5wNCSzq3JakuIuis/7cJhntwFMA=', password_iterations=210000 WHERE username='krenz' COLLATE NOCASE;
DELETE FROM security_rate_limits;
