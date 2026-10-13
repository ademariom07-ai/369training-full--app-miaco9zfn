import re, sqlite3, unittest
from pathlib import Path
class FeeSourceSQL(unittest.TestCase):
 def setUp(self):
  source=Path('pocketbase/hooks/admin_fee_source.js').read_text()
  self.sql=re.search(r'newQuery\(`(SELECT t.id.*?)`\)',source,re.S).group(1)
  self.sql=re.sub(r'\{:(\w+)\}',r':\1',self.sql)
  self.db=sqlite3.connect(':memory:')
  self.db.executescript('CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT);CREATE TABLE wallet_transactions(id TEXT PRIMARY KEY,user TEXT,amount REAL,status TEXT,reference_id TEXT,reference_type TEXT,type TEXT,created TEXT);')
  self.db.executemany('INSERT INTO users VALUES (?,?)',[('a','aluno'),('p','profissional')])
 def add(self,id,created,user='a',type='tarifa'):
  self.db.execute('INSERT INTO wallet_transactions VALUES (?,?,?,?,?,?,?,?)',(id,user,-1,'concluido','svc','service',type,created))
 def query(self,offset=0):
  return self.db.execute(self.sql,dict(from_='',**{'from':'2026-10-01 03:00:00.000Z','to':'2026-11-01 03:00:00.000Z','offset':offset})).fetchall()
 def test_half_open_window_and_fee_type(self):
  for id,date in [('before','2026-10-01 02:59:59.999Z'),('first','2026-10-01 03:00:00.000Z'),('last','2026-11-01 02:59:59.999Z'),('after','2026-11-01 03:00:00.000Z')]:self.add(id,date)
  self.add('deposit','2026-10-15 00:00:00.000Z',type='deposito')
  self.assertEqual([r[0] for r in self.query()],['first','last'])
 def test_both_payers_preserved_and_unknown_user_not_silently_dropped(self):
  for id,user in [('1','a'),('2','p'),('3','missing')]:self.add(id,'2026-10-15 00:00:00.000Z',user)
  self.assertEqual([(r[0],r[2]) for r in self.query()],[('1','aluno'),('2','profissional'),('3','')])
 def test_pagination_is_deterministic_with_equal_timestamps(self):
  for i in range(501):self.add(str(i).zfill(4),'2026-10-15 00:00:00.000Z')
  first,second=self.query(),self.query(500)
  self.assertEqual(len(first),500);self.assertEqual([r[0] for r in second],['0500']);self.assertEqual(len(set(r[0] for r in first+second)),501)
 def tearDown(self):self.db.close()
if __name__=='__main__':unittest.main()
