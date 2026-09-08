"""Run isolated directory SQL tests inside an ALREADY RUNNING disposable PostgreSQL container.

This script never starts Docker, pulls an image, exposes a port, or connects to a
remote/Supabase database. A labelled test container is mandatory. No checkout is
modified. See docs/OPERATIONS.md for setup and scope.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import pathlib
import re
import subprocess
import threading
import time
import uuid


ROOT = pathlib.Path(__file__).resolve().parent.parent
OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"


def literal(value: object) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def json_literal(value: object) -> str:
    return literal(json.dumps(value, ensure_ascii=False)) + "::jsonb"


class DatabaseError(RuntimeError):
    pass


class Harness:
    def __init__(self, container: str, database: str):
        self.container, self.database = container, database

    def sql(self, sql: str, *, role: str | None = "service_role", owner: str | None = None,
            database: str | None = None, timeout: int = 30) -> list[str]:
        if role and role not in {"service_role", "authenticated", "anon"}:
            raise ValueError("Unexpected test role")
        prefix = "begin; set local statement_timeout='15s'; set local lock_timeout='10s';"
        if role:
            prefix += f"set local role {role};"
        if owner:
            prefix += "set local request.jwt.claim.sub=" + literal(owner) + ";"
        # CREATE DATABASE must be outside a transaction.
        text = sql if database == "postgres" else prefix + sql + ";commit;"
        result = subprocess.run(
            ["docker", "exec", "-i", self.container, "psql", "-X", "-q", "-A", "-t",
             "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database or self.database],
            input=text, text=True, encoding="utf-8", capture_output=True, timeout=timeout,
        )
        if result.returncode:
            raise DatabaseError(result.stderr.strip() or result.stdout.strip())
        return [line for line in result.stdout.splitlines() if line.strip()]

    def value(self, sql: str, **kwargs):
        lines = self.sql(sql, **kwargs)
        if not lines:
            return None
        return json.loads(lines[-1])

    def submission(self, label: str, owner: str = OWNER_A):
        suffix = uuid.uuid4().hex[:10]
        origin = f"https://{label}-{suffix}.example"
        payload = {
            "kind": "server", "name": f"Fixture {label}",
            "summary": "Local SQL fixture for directory transaction verification.",
            "description": "This synthetic local fixture exercises transaction rules without invoking any external server or service.",
            "homepage": origin + "/", "repository": "https://github.com/test-owner/fixture",
            "documentation": "", "endpoint": origin + "/mcp", "category": "Developer tools",
            "tags": [], "pricing": "unknown", "transport": "streamable-http",
            "authentication": "unknown", "platforms": [], "license": "", "setup": "",
            "capabilities": [], "profileUrl": "", "readmeUrl": "",
        }
        return self.value("select to_jsonb(x) from public.save_submission(" +
                          ",".join([literal(owner), "null", "null", json_literal(payload), literal(origin)]) + ") x")

    def edit(self, submission: dict, *, expected="current"):
        payload = dict(submission["payload"])
        payload["description"] += " Updated content in the next revision."
        revision = submission["revision"] if expected == "current" else expected
        return self.value("select to_jsonb(x) from public.save_submission(" +
                          ",".join([literal(submission["owner_id"]), literal(submission["id"]),
                                    str(revision) if revision is not None else "null",
                                    json_literal(payload), literal(submission["identity_key"])]) + ") x")

    def checkout(self, submission: dict):
        return self.value("select to_jsonb(x) from public.begin_checkout(" +
                          ",".join([literal(submission["owner_id"]), literal(submission["id"]),
                                    str(submission["revision"]), "'2026-09-08'"]) + ") x")

    def audit(self, submission: dict):
        return self.value("insert into public.audit_runs(submission_id,revision,identity_key,profile_url,report,eligible) values(" +
                          ",".join([literal(submission["id"]), str(submission["revision"]),
                                    literal(submission["identity_key"]), literal(submission["identity_key"] + "/agentic.json"),
                                    json_literal({"reportVersion": "3", "valid": True}), "true"]) +
                          ") returning to_jsonb(audit_runs)")

    def publish(self, submission: dict, method: str, evidence: str):
        return self.value("select to_jsonb(x) from public.publish_submission(" +
                          ",".join([literal(submission["owner_id"]), literal(submission["id"]),
                                    str(submission["revision"]), literal(method), literal(evidence)]) + ") x")

    def fulfill(self, checkout: dict, *, event_suffix=""):
        token = checkout["id"].replace("-", "")
        return self.value("select public.fulfill_checkout(" +
                          ",".join([literal(checkout["id"]), literal("cs_local_" + token),
                                    literal("pi_local_" + token), literal("evt_local_" + token + event_suffix),
                                    "'checkout.session.completed'"]) + ")")

    def revoke(self, checkout: dict, *, state="refunded"):
        token = checkout["id"].replace("-", "")
        self.sql("select public.revoke_payment(" +
                 ",".join([literal("pi_local_" + token), literal(state), literal("evt_revoke_" + token + state)]) + ")")

    def entry(self, submission: dict):
        return self.value("select to_jsonb(e) from public.directory_entries e where submission_id=" + literal(submission["id"]))

    def expect_error(self, sql: str, *, contains: str | None = None, **kwargs):
        try:
            self.sql(sql, **kwargs)
        except DatabaseError as error:
            if contains and contains not in str(error):
                raise AssertionError(f"Expected {contains!r}, got {error}") from error
            return
        raise AssertionError("Statement unexpectedly succeeded")

    def counts(self, submission: dict):
        sid = literal(submission["id"])
        return self.value("select jsonb_build_object('events',(select count(*) from public.publication_events where submission_id=" + sid +
                          "),'emails',(select count(*) from public.email_outbox o join public.publication_events p on p.id=o.event_id where p.submission_id=" + sid + "))")


def bootstrap(h: Harness, migrations: list[str]):
    h.sql("create database " + h.database, role=None, database="postgres")
    h.sql("""
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
""", role=None)
    for migration in migrations:
        h.sql(migration, role=None)
    h.sql("insert into auth.users values(" + literal(OWNER_A) + ",'a@fixture.invalid',now()),(" +
          literal(OWNER_B) + ",'b@fixture.invalid',now())", role=None)


def run_tests(h: Harness):
    tests = []

    def case(name):
        def register(function):
            tests.append((name, function))
            return function
        return register

    @case("RLS: private owner rows and privileged RPCs")
    def rls():
        a, b = h.submission("rls-a"), h.submission("rls-b", OWNER_B)
        ca, cb = h.checkout(a), h.checkout(b)
        aa, ab = h.audit(a), h.audit(b)
        for table, key in [("submissions", b["id"]), ("checkout_attempts", cb["id"]), ("audit_runs", ab["id"])]:
            count = h.value(f"select to_jsonb(count(*)) from public.{table} where id={literal(key)}", role="authenticated", owner=OWNER_A)
            assert count == 0, f"A can see B's {table}"
        assert h.value("select to_jsonb(count(*)) from public.submissions where id=" + literal(a["id"]), role="authenticated", owner=OWNER_A) == 1
        h.expect_error("select public.begin_checkout(" + literal(OWNER_A) + "," + literal(a["id"]) + ",1,'terms')", role="authenticated", owner=OWNER_A, contains="permission denied")
        h.expect_error("update public.checkout_attempts set state='paid' where id=" + literal(ca["id"]), role="authenticated", owner=OWNER_A, contains="permission denied")
        h.expect_error("select public.publish_submission(" + literal(OWNER_A) + "," + literal(a["id"]) + ",1,'agentic'," + literal(aa["id"]) + ")", role="anon", contains="permission denied")

    @case("Optimistic revision: null expected revision is rejected")
    def null_revision():
        s = h.submission("null-revision")
        try:
            h.edit(s, expected=None)
        except DatabaseError:
            return
        raise AssertionError("Existing submission accepted NULL expected revision")

    @case("Immutable revision snapshot rejects update")
    def immutable_revision():
        s = h.submission("immutable")
        h.expect_error("update public.submission_revisions set payload=payload||'{\"name\":\"Changed\"}'::jsonb where submission_id=" + literal(s["id"]))

    @case("Audit and checkout require an existing matching revision")
    def revision_relations():
        s = h.submission("revision-fk")
        h.expect_error("insert into public.audit_runs(submission_id,revision,identity_key,profile_url,report,eligible) values(" +
                       literal(s["id"]) + ",999,'https://wrong.example','https://wrong.example/agentic.json','{}',true)")
        h.expect_error("insert into public.checkout_attempts(submission_id,revision,identity_key,terms_version) values(" +
                       literal(s["id"]) + ",999,'https://wrong.example','test')")

    @case("Paid first publication and repeated fulfillment commit once")
    def paid_once():
        s = h.submission("paid-once"); c = h.checkout(s)
        first = h.fulfill(c); before = h.entry(s)
        again = h.fulfill(c, event_suffix="-duplicate")
        assert first["slug"] == again["slug"]
        assert h.entry(s) == before
        assert h.counts(s) == {"events": 1, "emails": 1}

    @case("Same-service paid updates require explicit owner publication")
    def paid_updates():
        s = h.submission("paid-updates"); c = h.checkout(s); h.fulfill(c)
        old = h.entry(s); changed = h.edit(s)
        result = h.fulfill(c, event_suffix="-late")
        assert result.get("publication") == "review_required"
        assert h.entry(s) == old, "Automatic replay published the new revision"
        h.publish(changed, "payment", c["id"])
        assert h.entry(s)["data"]["description"] == changed["payload"]["description"]
        assert h.counts(s) == {"events": 2, "emails": 2}

    @case("Refund after an unpublished edit hides the active paid listing")
    def refund_after_edit():
        s = h.submission("refund-edit"); c = h.checkout(s); h.fulfill(c)
        h.edit(s); h.revoke(c)
        assert h.entry(s)["visible"] is False, "Refund looked at editing revision instead of active publication"

    @case("Refund before fulfillment cannot be lost")
    def refund_before_mapping():
        s = h.submission("refund-first"); c = h.checkout(s)
        h.revoke(c)
        h.fulfill(c)
        entry = h.entry(s)
        assert entry is None or entry["visible"] is False, "Unmapped refund was discarded and later fulfillment published"
        attempt = h.value("select to_jsonb(c) from public.checkout_attempts c where id=" + literal(c["id"]))
        assert attempt["state"] == "refunded", "Refunded checkout remained active and would block future editing"
        assert attempt["stripe_payment_id"], "Revoked fulfillment did not retain provider payment mapping"
        assert h.edit(s)["revision"] == 2

    @case("Dispute before fulfillment cannot be lost")
    def dispute_before_mapping():
        s = h.submission("dispute-first"); c = h.checkout(s)
        h.revoke(c, state="disputed")
        h.fulfill(c)
        entry = h.entry(s)
        assert entry is None or entry["visible"] is False, "Unmapped dispute was discarded"
        attempt = h.value("select to_jsonb(c) from public.checkout_attempts c where id=" + literal(c["id"]))
        assert attempt["state"] == "disputed", "Disputed checkout remained active"

    @case("Free publication refuses an active provider checkout")
    def free_open():
        s = h.submission("free-open"); h.checkout(s); a = h.audit(s)
        try:
            h.publish(s, "agentic", a["id"])
        except DatabaseError:
            return
        raise AssertionError("Free publication succeeded while a checkout was still creating/open")

    @case("Unrelated slug conflict cannot overwrite a catalog entry")
    def slug_conflict():
        s = h.submission("slug-conflict"); a = h.audit(s)
        slug = re.sub(r"[^a-z0-9]+", "-", s["payload"]["name"].lower()).strip("-")[:70] + "-" + s["id"].replace("-", "")[:10]
        h.sql("insert into public.directory_entries(slug,data) values(" + literal(slug) + ",' {\"sentinel\":true}'::jsonb)")
        try:
            h.publish(s, "agentic", a["id"])
        except DatabaseError:
            pass
        actual = h.value("select data from public.directory_entries where slug=" + literal(slug))
        assert actual == {"sentinel": True}, "Existing unrelated slug was overwritten"

    @case("Concurrent checkout creation returns one active attempt")
    def checkout_concurrent():
        s = h.submission("checkout-race"); gate = threading.Barrier(2)
        def work():
            gate.wait(); return h.checkout(s)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: work(), range(2)))
        assert results[0]["id"] == results[1]["id"]

    @case("Concurrent fulfillments create one publication and notification")
    def fulfill_concurrent():
        s = h.submission("fulfill-race"); c = h.checkout(s); gate = threading.Barrier(2)
        def work(n):
            gate.wait(); return h.fulfill(c, event_suffix="-" + str(n))
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(work, range(2)))
        assert h.counts(s) == {"events": 1, "emails": 1}

    @case("Concurrent refund and explicit update leave no revoked paid entry visible")
    def refund_concurrent():
        for _ in range(3):
            s = h.submission("refund-race"); c = h.checkout(s); h.fulfill(c); changed = h.edit(s)
            gate = threading.Barrier(2)
            def publish():
                gate.wait()
                try:
                    return h.publish(changed, "payment", c["id"])
                except DatabaseError:
                    return None
            def refund():
                gate.wait(); return h.revoke(c)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(publish), pool.submit(refund)]
                for future in futures:
                    future.result()
            assert h.entry(s)["visible"] is False

    @case("Independent current free publication survives old-payment refund")
    def free_after_paid():
        s = h.submission("new-free"); c = h.checkout(s); h.fulfill(c)
        changed = h.edit(s); a = h.audit(changed); h.publish(changed, "agentic", a["id"])
        h.revoke(c)
        assert h.entry(s)["visible"] is True

    @case("Public reads exclude withdrawn entries")
    def public_visibility():
        s = h.submission("withdraw"); a = h.audit(s); e = h.publish(s, "agentic", a["id"])
        h.sql("select public.withdraw_submission(" + literal(OWNER_A) + "," + literal(s["id"]) + ")")
        assert h.value("select to_jsonb(count(*)) from public.directory_entries where slug=" + literal(e["slug"]), role="anon") == 0

    @case("Withdrawn listing can be edited, checked out and republished with its slug")
    def republish_withdrawn():
        s = h.submission("republish"); a = h.audit(s); e = h.publish(s, "agentic", a["id"])
        h.sql("select public.withdraw_submission(" + literal(OWNER_A) + "," + literal(s["id"]) + ")")
        assert h.entry(s)["visible"] is False
        again = h.publish(s, "agentic", a["id"])
        assert again["visible"] is True and again["slug"] == e["slug"]
        assert h.value("select to_jsonb(state) from public.submissions where id=" + literal(s["id"])) == "published"
        counts = h.counts(s)
        assert counts["events"] == 1 and counts["emails"] == 1, "republishing a published revision must not duplicate events or emails"
        h.sql("select public.withdraw_submission(" + literal(OWNER_A) + "," + literal(s["id"]) + ")")
        changed = h.edit(s)
        assert h.checkout(changed)["state"] == "creating"

    @case("Suspended listing stays locked for publication and checkout")
    def suspended_locked():
        s = h.submission("suspended"); c = h.checkout(s); h.fulfill(c); h.revoke(c)
        assert h.value("select to_jsonb(state) from public.submissions where id=" + literal(s["id"])) == "suspended"
        h.expect_error("select public.publish_submission(" + ",".join([literal(OWNER_A), literal(s["id"]), str(s["revision"]), "'payment'", literal(c["id"])]) + ")", contains="submission_unavailable")
        h.expect_error("select public.begin_checkout(" + ",".join([literal(OWNER_A), literal(s["id"]), str(s["revision"]), "'terms'"]) + ")", contains="submission_unavailable")

    @case("Deleting a listing keeps its reports")
    def reports_survive_deletion():
        s = h.submission("reports"); a = h.audit(s); e = h.publish(s, "agentic", a["id"])
        report = h.value("insert into public.listing_reports(slug,reason) values(" + literal(e["slug"]) + ",'This fixture report must survive deletion.') returning to_jsonb(id)")
        h.sql("delete from public.submissions where id=" + literal(s["id"]))
        assert h.value("select to_jsonb(slug) from public.listing_reports where id=" + literal(report)) is None

    @case("Concurrent email claims are disjoint while locks are held")
    def email_concurrent():
        h.sql("update public.email_outbox set state='sent',lease_until=null")
        for n in range(2):
            s = h.submission("email-race-" + str(n)); h.publish(s, "agentic", h.audit(s)["id"])
        gate = threading.Barrier(2)
        def work():
            gate.wait()
            rows = h.sql("select to_jsonb(x) from public.claim_email_jobs(1) x;select pg_sleep(0.5)")
            return [json.loads(row)["id"] for row in rows if row.lstrip().startswith("{")]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: work(), range(2)))
        assert len(results[0]) == len(results[1]) == 1
        assert set(results[0]).isdisjoint(results[1])

    @case("Email attempt generation fences stale worker completion")
    def email_fence():
        h.sql("update public.email_outbox set state='sent',lease_until=null")
        s = h.submission("email-fence"); h.publish(s, "agentic", h.audit(s)["id"])
        one = h.value("select to_jsonb(x) from public.claim_email_jobs(1) x")
        h.sql("update public.email_outbox set lease_until=now()-interval '1 minute' where id=" + literal(one["id"]))
        two = h.value("select to_jsonb(x) from public.claim_email_jobs(1) x")
        assert two["id"] == one["id"] and two["attempts"] > one["attempts"]
        changed = h.value("with changed as(update public.email_outbox set state='sent' where id=" + literal(one["id"]) +
                          " and attempts=" + str(one["attempts"]) + " returning 1) select to_jsonb(count(*)) from changed")
        assert changed == 0

    @case("Uncertain delivery is not automatically retried after deduplication window")
    def email_window():
        h.sql("update public.email_outbox set state='sent',lease_until=null")
        s = h.submission("email-window"); h.publish(s, "agentic", h.audit(s)["id"])
        h.sql("update public.email_outbox set state='failed',attempts=1,first_attempt_at=now()-interval '25 hours',lease_until=null where event_id in(select id from public.publication_events where submission_id=" + literal(s["id"]) + ")")
        assert h.sql("select to_jsonb(x) from public.claim_email_jobs(10) x") == []
        state = h.value("select to_jsonb(state) from public.email_outbox where event_id in(select id from public.publication_events where submission_id=" + literal(s["id"]) + ")")
        assert state == "uncertain"

    results = []
    for name, function in tests:
        started = time.monotonic()
        try:
            function()
            result = {"name": name, "passed": True}
        except Exception as error:
            result = {"name": name, "passed": False, "error": str(error)[:3000]}
        result["durationSeconds"] = round(time.monotonic() - started, 3)
        results.append(result)
        print(("PASS " if result["passed"] else "FAIL ") + name, flush=True)
        if not result["passed"]:
            print("  " + result["error"], flush=True)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True, help="Already-running container named ruagentic-db-test* with label ruagentic.db-test=true")
    parser.add_argument("--migration", type=pathlib.Path, action="append", default=None,
                        help="Migration file to apply, repeatable. Defaults to every supabase/migrations/*.sql in order.")
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "work/directory-db-test-results.json")
    args = parser.parse_args()
    if not re.fullmatch(r"ruagentic-db-test[a-zA-Z0-9_.-]*", args.container):
        parser.error("Only an explicitly named ruagentic-db-test container is accepted")
    inspected = subprocess.run(["docker", "inspect", args.container], capture_output=True, text=True, encoding="utf-8", timeout=10, check=True)
    container = json.loads(inspected.stdout)[0]
    if (container.get("Config", {}).get("Labels") or {}).get("ruagentic.db-test") != "true":
        parser.error("Refusing unlabelled container; require ruagentic.db-test=true")
    if not container.get("State", {}).get("Running"):
        parser.error("Container must already be running; this harness never starts services")
    database = "ruagentic_test_" + uuid.uuid4().hex[:12]
    files = args.migration or sorted((ROOT / "supabase/migrations").glob("*.sql"))
    migration_bytes = [path.resolve(strict=True).read_bytes() for path in files]
    h = Harness(args.container, database)
    bootstrap(h, [chunk.decode("utf-8-sig") for chunk in migration_bytes])
    results = run_tests(h)
    report = {"observedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "container": args.container,
              "database": database, "migrations": [str(path.resolve()) for path in files],
              "migrationSha256": hashlib.sha256(b"".join(migration_bytes)).hexdigest(),
              "passed": all(r["passed"] for r in results), "tests": results,
              "scope": "Isolated PostgreSQL SQL/RLS/concurrency only. No Stripe, Resend, Supabase or other network services called.",
              "databaseRetained": True}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Report: {args.report}\nRetained isolated database: {database}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
