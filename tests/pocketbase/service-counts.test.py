"""Execute the actual legacy aggregation in SQLite; no live PocketBase writes."""
import re, sqlite3, unittest
from pathlib import Path
SOURCE=Path('pocketbase/hooks/admin_recalculate_rank.js').read_text()
QUERY=re.search(r'\.newQuery\(`([\s\S]*?FROM services[\s\S]*?)`\)', SOURCE).group(1).replace('{:monthStart}', ':monthStart')
class Counts(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.executescript('CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,approved INTEGER); CREATE TABLE services(id TEXT PRIMARY KEY,professional TEXT,student TEXT,status TEXT,validated INTEGER,created TEXT,type TEXT);')
  self.db.executemany('INSERT INTO users VALUES(?,?,?)',[('p','profissional',1),('a','aluno',1),('b','aluno',1),('admin','admin',1),('pending','profissional',0)])
 def tearDown(self):self.db.close()
 def service(self,id,p='p',a='a',status='concluido',valid=1,created='2026-10-02',kind='consulta'):
  self.db.execute('INSERT INTO services VALUES(?,?,?,?,?,?,?)',(id,p,a,status,valid,created,kind))
 def counts(self):return dict(self.db.execute(QUERY,{'monthStart':'2026-10-01'}))
 def test_shared_service_counts_for_both_correct_roles(self):
  self.service('one');self.service('two',a='b');self.assertEqual(self.counts(),{'p':2,'a':1,'b':1})
 def test_ineligible_status_validation_and_previous_month_are_excluded(self):
  self.service('cancel',status='cancelado');self.service('unvalidated',valid=0);self.service('old',created='2026-09-30');self.assertEqual(self.counts(),{})
 def test_unaccompanied_workouts_excluded_but_null_type_matches_event_behavior(self):
  self.service('solo',p='',kind='TREINO_IA');self.service('solo2',p=None,kind='workout');self.service('nulltype',kind=None);self.assertEqual(self.counts(),{'p':1,'a':1})
 def test_roles_approval_and_same_identity_cannot_double_count(self):
  self.service('same',p='a',a='a');self.service('wrong',p='admin',a='admin');self.service('pending',p='pending',a='b');self.assertEqual(self.counts(),{'a':1,'b':1})
if __name__=='__main__':unittest.main()
