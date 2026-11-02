"""Run as a non-root user with initdb/pg_ctl in PATH and psycopg 3 installed.
Starts a fresh socket-only PostgreSQL cluster; does not use a Supabase URL.
Auth claims are simulated. No GoTrue, PostgREST, scheduler or browser involved.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
import json
import os
import subprocess
import tempfile
import time

import psycopg

MIG = Path(__file__).resolve().parents[2] / "supabase/migrations"
VERSIONS = ["20261005211816", "20261007125240", "20261007174853", "20261007182712",
            "20261031163157", "20261031212211", "20261102125416", "20261102131112"]

def run(sock):
    def connect():
        return psycopg.connect(host=sock, port=55432, user="postgres", dbname="postgres",
                               options="-c statement_timeout=15000")
    def actor(conn, user):
        conn.execute("set local role authenticated")
        conn.execute("select set_config('request.jwt.claims',%s,true)",
                     (json.dumps({"sub": str(user), "is_anonymous": False}),))
    with connect() as db:
        db.execute("""
          create role anon; create role authenticated; create role service_role;
          create schema auth; create schema wellness_private;
          grant usage on schema auth,wellness_private to authenticated;
          create table auth.users(id uuid primary key);
          create function auth.jwt() returns jsonb language sql stable as
            $$select current_setting('request.jwt.claims',true)::jsonb$$;
          create function auth.uid() returns uuid language sql stable as
            $$select (auth.jwt()->>'sub')::uuid$$;
        """)
        for version in VERSIONS:
            sql, = MIG.glob(version + "_*.sql")
            body = sql.read_text()
            if version == "20261102125416":
                # The job registration is external to this contention test.
                marker = "create extension if not exists pg_cron;"
                assert marker in body
                body = body.split(marker)[0]
            db.execute(body)
        pro, s1, s2, admin = [uuid4() for _ in range(4)]
        for u, role in [(pro,"profissional"),(s1,"aluno"),(s2,"aluno"),(admin,"admin")]:
            db.execute("insert into auth.users values(%s)",(u,))
            db.execute("insert into public.profiles(id,display_name,role,approved) values(%s,'QA',%s,true)",(u,role))
        actor(db,admin)
        db.execute("select public.set_booking_hold_minutes(0,10)")
        actor(db,pro)
        day = db.execute("select (now() at time zone 'America/Sao_Paulo')::date+3").fetchone()[0]
        db.execute("select public.save_professional_availability(%s,0,array[9,10]::smallint[],true)",(day,))
        terms = db.execute("select id from public.save_professional_booking_terms(%s,0,9000,2500,24)",(uuid4(),)).fetchone()[0]
    def hold(conn, hour):
        return conn.execute("select id from public.create_booking_hold(%s,%s,%s,%s,1,%s)",
                            (uuid4(),pro,day,hour,terms)).fetchone()[0]
    for hour, commit_first in [(9,True),(10,False)]:
        with connect() as a, connect() as b, connect() as obs, ThreadPoolExecutor(1) as pool:
            actor(a,s1); actor(b,s2)
            for c in (a,b):
                c.execute("select terms_id from public.quote_booking_slot(%s,%s,%s)",(pro,day,hour)).fetchone()
            first = hold(a,hour)
            future = pool.submit(hold,b,hour)
            try:
                deadline=time.monotonic()+6
                while time.monotonic()<deadline:
                    if obs.execute("select %s=any(pg_blocking_pids(%s))",(a.info.backend_pid,b.info.backend_pid)).fetchone()[0]:
                        break
                    time.sleep(.02)
                else:
                    raise AssertionError("No observed contention: test inconclusive")
            finally:
                if commit_first: a.commit()
                else: a.rollback()
            if commit_first:
                try: future.result(timeout=10)
                except psycopg.errors.NoDataFound: b.rollback()
                else: raise AssertionError("Second hold unexpectedly accepted")
                winner,loser,expected=s1,s2,first
            else:
                expected=future.result(timeout=10);b.commit()
                winner,loser=s2,s1
            # New sessions exercise RLS after both contenders have disconnected
            # from their original transactions (no superuser assertions here).
            for reader,count in [(pro,1),(winner,1),(loser,0)]:
                with connect() as check:
                    actor(check,reader)
                    rows=check.execute("""select id,status from public.booking_reservations
                      where starts_at=(%s::date+make_interval(hours=>%s)) at time zone 'America/Sao_Paulo'""",
                      (day,hour)).fetchall()
                    assert rows == ([(expected,"pending_payment")] if count else []), rows
            print("PASS: lock observed; "+("commit rejects competitor" if commit_first else "rollback admits competitor")+"; participant visibility verified")

if __name__=="__main__":
    if os.geteuid()==0: raise SystemExit("Use an unprivileged OS user")
    with tempfile.TemporaryDirectory(prefix="369qa-") as sock:
        data=str(Path(sock)/"db")
        subprocess.run(["initdb","-D",data,"-U","postgres","-A","trust","--no-locale","-E","UTF8"],check=True,stdout=subprocess.DEVNULL)
        subprocess.run(["pg_ctl","-D",data,"-l",sock+"/server.log","-o",f"-k {sock} -p 55432 -c listen_addresses=''","-w","start"],check=True,stdout=subprocess.DEVNULL)
        try: run(sock)
        finally: subprocess.run(["pg_ctl","-D",data,"-m","fast","-w","stop"],check=True,stdout=subprocess.DEVNULL)
