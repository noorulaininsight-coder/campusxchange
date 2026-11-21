import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let passed = 0;
await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create role service_role bypassrls; create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
for (const file of (
  await readdir(new URL("../supabase/migrations/", import.meta.url))
)
  .filter((file) => file !== "202610040005_chat_and_deletion.sql")
  .sort())
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
async function as(role, id, fn) {
  await db.exec(
    `set role ${role};select set_config('request.jwt.claim.sub','${id || ""}',false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);",
    );
  }
}
async function ok(name, fn) {
  await fn();
  passed++;
  console.log("PASS", name);
}
async function deny(fn) {
  await assert.rejects(fn);
}
const u1 = "30000000-0000-0000-0000-000000000001",
  u2 = "30000000-0000-0000-0000-000000000002",
  admin = "30000000-0000-0000-0000-000000000003",
  outsider = "30000000-0000-0000-0000-000000000004";
await db.query(
  "insert into auth.users values($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,now())",
  [
    u1,
    "one@cuilahore.edu.pk",
    u2,
    "two@cuilahore.edu.pk",
    admin,
    "admin@cuilahore.edu.pk",
    outsider,
    "outsider@gmail.com",
  ],
);
await ok(
  "Auth hook accepts exact approved domain and rejects suffix spoof",
  async () => {
    for (const email of ["x@gmail.com", "x@cuilahore.edu.pk.attacker.com"]) {
      const r = await db.query(
        "select public.before_user_created($1) as result",
        [{ user: { email } }],
      );
      assert.equal(r.rows[0].result.error.http_code, 403);
    }
    const r = await db.query(
      "select public.before_user_created($1) as result",
      [{ user: { email: "X@CUILAHORE.EDU.PK" } }],
    );
    assert.deepEqual(r.rows[0].result, {});
  },
);
for (const [id, name, reg] of [
  [u1, "Student One", "FA24-001"],
  [u2, "Student Two", "FA24-002"],
  [admin, "Campus Admin", "ADMIN-001"],
])
  await as("authenticated", id, () =>
    db.query("select public.save_profile($1,$2,$3,$4,$5)", [
      name,
      "BSCS",
      reg,
      2028,
      "+923001234567",
    ]),
  );
await db.query(
  "update public.user_accounts set role='ADMIN' where user_id=$1",
  [admin],
);
await ok("Unapproved email cannot onboard", () =>
  as("authenticated", outsider, () =>
    deny(() =>
      db.query(
        "select public.save_profile('Outsider','BSCS','BAD-001',2028,'+923001234567')",
      ),
    ),
  ),
);
await ok(
  "Anonymous cannot read private contacts or invoke protected functions",
  () =>
    as("anon", null, async () => {
      await deny(() => db.query("select * from public.user_private_contacts"));
      await deny(() =>
        db.query(
          "select public.save_profile('Outsider','BSCS','BAD-001',2028,'+923001234567')",
        ),
      );
      await deny(() => db.query("select public.cleanup_candidates()"));
    }),
);
await ok("Student sees only own account and contact", () =>
  as("authenticated", u1, async () => {
    const a = await db.query("select * from public.user_accounts");
    const c = await db.query("select * from public.user_private_contacts");
    assert.equal(a.rows.length, 1);
    assert.equal(c.rows.length, 1);
    assert.equal(c.rows[0].user_id, u1);
  }),
);
await ok("Direct role and listing writes forbidden", () =>
  as("authenticated", u1, async () => {
    await deny(() => db.query("update public.user_accounts set role='ADMIN'"));
    await deny(() => db.query("delete from public.listings"));
    await deny(() => db.query("select public.admin_overview()"));
  }),
);
const payload = {
  type: "SALE",
  contact_mode: "BOTH",
  title: "Data structures textbook",
  description: "A useful second-hand textbook with all pages intact.",
  category: "books-notes",
  condition: "USED",
  price: 1200,
  rental_rate_daily: null,
  deposit: null,
  offered_budget: null,
  need_type: null,
  preferred_meetup_spot: "Library entrance",
  image_paths: [],
};
let lid;
await ok("Student creates listing; ownership derived server-side", () =>
  as("authenticated", u1, async () => {
    const r = await db.query("select public.save_listing($1) as id", [
      {
        ...payload,
        user_id: u2,
        campus_id: "99999999-0000-0000-0000-000000000000",
      },
    ]);
    lid = r.rows[0].id;
    const l = await db.query("select * from public.listings where id=$1", [
      lid,
    ]);
    assert.equal(l.rows[0].user_id, u1);
  }),
);
await ok("Anonymous sees active listings and safe profiles", () =>
  as("anon", null, async () => {
    assert.equal(
      (await db.query("select * from public.listings")).rows.length,
      1,
    );
    const p = (await db.query("select * from public.profiles")).rows[0];
    assert.equal("phone_number" in p, false);
    assert.equal("registration_number" in p, false);
  }),
);
await ok("Other student cannot edit, resolve or upload to listing", () =>
  as("authenticated", u2, async () => {
    await deny(() =>
      db.query("select public.save_listing($1,$2)", [payload, lid]),
    );
    await deny(() =>
      db.query(
        "select public.resolve_listing($1,'COMPLETED','SOLD_ON_CAMPUSXCHANGE')",
        [lid],
      ),
    );
    await deny(() =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('listing-images',$1)",
        [`${u1}/${lid}/1.webp`],
      ),
    );
  }),
);
await ok(
  "Owner may stage 3 slots but cannot upload a fourth or attach fake paths",
  () =>
    as("authenticated", u1, async () => {
      for (const n of [1, 2, 3])
        await db.query(
          "insert into storage.objects(bucket_id,name) values('listing-images',$1)",
          [`${u1}/${lid}/${n}.webp`],
        );
      await deny(() =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('listing-images',$1)",
          [`${u1}/${lid}/4.webp`],
        ),
      );
      await deny(() =>
        db.query("select public.save_listing($1,$2)", [
          { ...payload, image_paths: [`${u2}/${lid}/1.webp`] },
          lid,
        ]),
      );
      await db.query("select public.save_listing($1,$2)", [
        { ...payload, image_paths: [`${u1}/${lid}/1.webp`] },
        lid,
      ]);
    }),
);
await ok("Anonymous cannot read staged orphan images", () =>
  as("anon", null, async () => {
    const r = await db.query(
      "select name from storage.objects where bucket_id='listing-images'",
    );
    assert.deepEqual(
      r.rows.map((x) => x.name),
      [`${u1}/${lid}/1.webp`],
    );
  }),
);
await ok("Type/price constraint rejects impossible combinations", () =>
  as("authenticated", u1, () =>
    deny(() =>
      db.query("select public.save_listing($1)", [
        { ...payload, rental_rate_daily: 100 },
      ]),
    ),
  ),
);
await ok(
  "Upgrade preserves existing users, admin, listing and images; existing ads become chat-only",
  async () => {
    const before = (
      await db.query(
        "select title,image_paths from public.listings where id=$1",
        [lid],
      )
    ).rows[0];
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610040005_chat_and_deletion.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const after = (
      await db.query(
        "select title,image_paths,contact_mode from public.listings where id=$1",
        [lid],
      )
    ).rows[0];
    await as("authenticated", u1, async () => {
      assert.equal(
        (
          await db.query("select name from storage.objects where name=$1", [
            `${u1}/${lid}/2.webp`,
          ])
        ).rows.length,
        1,
      );
    });
    assert.equal(after.title, before.title);
    assert.deepEqual(after.image_paths, before.image_paths);
    assert.equal(after.contact_mode, "CHAT");
    assert.equal(
      (
        await db.query(
          "select role from public.user_accounts where user_id=$1",
          [admin],
        )
      ).rows[0].role,
      "ADMIN",
    );
    await as("authenticated", u2, () =>
      deny(() => db.query("select public.get_listing_contact($1)", [lid])),
    );
    await as("authenticated", u1, () =>
      db.query("select public.save_listing($1,$2)", [
        { ...payload, image_paths: before.image_paths },
        lid,
      ]),
    );
  },
);
await ok("Contact RPC returns phone only for active listing", () =>
  as("authenticated", u2, async () => {
    const r = await db.query("select public.get_listing_contact($1) as phone", [
      lid,
    ]);
    assert.equal(r.rows[0].phone, "+923001234567");
  }),
);
await ok("Wishlist unique, private, owner-controlled", () =>
  as("authenticated", u2, async () => {
    await db.query(
      "insert into public.wishlist(user_id,listing_id) values($1,$2)",
      [u2, lid],
    );
    await deny(() =>
      db.query(
        "insert into public.wishlist(user_id,listing_id) values($1,$2)",
        [u2, lid],
      ),
    );
    await deny(() =>
      db.query(
        "insert into public.wishlist(user_id,listing_id) values($1,$2)",
        [u1, lid],
      ),
    );
  }),
);
await ok("Reports are created but internal notes stay private", () =>
  as("authenticated", u2, async () => {
    await db.query(
      "select public.submit_report('SPAM','Please review',$1,null)",
      [lid],
    );
    assert.equal(
      (await db.query("select * from public.reports")).rows.length,
      0,
    );
    await deny(() => db.query("update public.reports set status='DISMISSED'"));
  }),
);
await ok("Moderation requires reason, cannot suspend admins", () =>
  as("authenticated", admin, async () => {
    await deny(() =>
      db.query("select public.admin_moderate('USER',$1,'SUSPENDED','')", [u2]),
    );
    await deny(() =>
      db.query(
        "select public.admin_moderate('USER',$1,'SUSPENDED','Testing protected administrator')",
        [admin],
      ),
    );
    await db.query(
      "select public.admin_moderate('USER',$1,'SUSPENDED','Suspicious account pending review')",
      [u2],
    );
  }),
);
await ok("Suspended session cannot contact, save, post or edit profile", () =>
  as("authenticated", u2, async () => {
    await deny(() => db.query("select public.get_listing_contact($1)", [lid]));
    await deny(() => db.query("select public.save_listing($1)", [payload]));
    await deny(() =>
      db.query(
        "select public.save_profile('Student Two','BSCS','FA24-002',2028,'+923001234567')",
      ),
    );
    await deny(() =>
      db.query(
        "insert into public.wishlist(user_id,listing_id) values($1,$2)",
        [u2, lid],
      ),
    );
  }),
);
await ok("Completion reason is required and type-specific", () =>
  as("authenticated", u1, async () => {
    await deny(() =>
      db.query("select public.resolve_listing($1,'COMPLETED',null)", [lid]),
    );
    await deny(() =>
      db.query(
        "select public.resolve_listing($1,'COMPLETED','RENTED_THROUGH_CAMPUSXCHANGE')",
        [lid],
      ),
    );
  }),
);
await ok("Completion atomically records telemetry and cannot repeat", () =>
  as("authenticated", u1, async () => {
    await db.query(
      "select public.resolve_listing($1,'COMPLETED','SOLD_ON_CAMPUSXCHANGE')",
      [lid],
    );
    await deny(() =>
      db.query(
        "select public.resolve_listing($1,'COMPLETED','SOLD_ON_CAMPUSXCHANGE')",
        [lid],
      ),
    );
    await deny(() =>
      db.query("select public.save_listing($1,$2)", [payload, lid]),
    );
    assert.equal(
      (await db.query("select * from public.listing_telemetry")).rows.length,
      0,
    );
  }),
);
await ok("Completed records hidden from public", () =>
  as("anon", null, async () => {
    assert.equal(
      (await db.query("select * from public.listings")).rows.length,
      0,
    );
  }),
);
await ok("Admin analytics and audit reflect transactions", () =>
  as("authenticated", admin, async () => {
    const r = await db.query("select public.admin_overview() as stats");
    assert.equal(r.rows[0].stats["Completed listings"], 1);
    assert.equal(r.rows[0].stats["Suspended users"], 1);
    assert.equal(
      (await db.query("select * from public.listing_telemetry")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.admin_audit_logs")).rows.length,
      1,
    );
  }),
);
await ok("Admin cannot disable their own campus", () =>
  as("authenticated", admin, () =>
    deny(() =>
      db.query("select public.admin_config($1,$2,$3)", [
        "CAMPUS",
        {
          university_id: "10000000-0000-0000-0000-000000000001",
          name: "Lahore Campus",
          city: "Lahore",
          is_active: false,
        },
        "20000000-0000-0000-0000-000000000001",
      ]),
    ),
  ),
);
await ok(
  "Rent and request completion accept their own resolution reasons",
  () =>
    as("authenticated", u1, async () => {
      for (const [type, reason] of [
        ["RENT", "RENTED_THROUGH_CAMPUSXCHANGE"],
        ["REQUEST", "RECEIVED_ITEM_THROUGH_CAMPUSXCHANGE"],
      ]) {
        const p = {
          ...payload,
          type,
          price: null,
          condition: type === "REQUEST" ? null : "USED",
          rental_rate_daily: type === "RENT" ? 100 : null,
          offered_budget: type === "REQUEST" ? 1000 : null,
          need_type: type === "REQUEST" ? "BUY" : null,
        };
        const r = await db.query("select public.save_listing($1) as id", [p]);
        await db.query("select public.resolve_listing($1,$2,$3)", [
          r.rows[0].id,
          "COMPLETED",
          reason,
        ]);
      }
    }),
);
let removedId;
await as("authenticated", u1, async () => {
  const r = await db.query("select public.save_listing($1) as id", [payload]);
  removedId = r.rows[0].id;
});
await ok(
  "Admin removal is audited and cannot be reversed by owner",
  async () => {
    await as("authenticated", admin, () =>
      db.query(
        "select public.admin_moderate('LISTING',$1,'REMOVED_BY_ADMIN','Content removed after review')",
        [removedId],
      ),
    );
    await as("authenticated", u1, () =>
      deny(() =>
        db.query("select public.save_listing($1,$2)", [payload, removedId]),
      ),
    );
  },
);
await ok("Admin report review writes notes and an audit entry", () =>
  as("authenticated", admin, async () => {
    const r = await db.query("select id from public.reports limit 1");
    await db.query(
      "select public.admin_review_report($1,'RESOLVED','Reviewed with reporter')",
      [r.rows[0].id],
    );
    const out = await db.query(
      "select status,admin_notes from public.reports where id=$1",
      [r.rows[0].id],
    );
    assert.equal(out.rows[0].status, "RESOLVED");
    assert.equal(out.rows[0].admin_notes, "Reviewed with reporter");
  }),
);
await ok("Admin configuration creates and updates without public grants", () =>
  as("authenticated", admin, async () => {
    const university = (
      await db.query("select public.admin_config($1,$2) as id", [
        "UNIVERSITY",
        { name: "Development University", short_name: "DEV", is_active: true },
      ])
    ).rows[0].id;
    const campus = (
      await db.query("select public.admin_config($1,$2) as id", [
        "CAMPUS",
        {
          name: "Test Campus",
          city: "Test City",
          university_id: university,
          is_active: true,
        },
      ])
    ).rows[0].id;
    const domain = (
      await db.query("select public.admin_config($1,$2) as id", [
        "DOMAIN",
        { domain: "example.edu.pk", campus_id: campus, is_active: true },
      ])
    ).rows[0].id;
    await db.query("select public.admin_config($1,$2,$3)", [
      "DOMAIN",
      { domain: "example.edu.pk", campus_id: campus, is_active: false },
      domain,
    ]);
    assert.equal(
      (
        await db.query(
          "select is_active from public.allowed_email_domains where id=$1",
          [domain],
        )
      ).rows[0].is_active,
      false,
    );
  }),
);
await ok(
  "Retention selects old orphan and closed images, not recent objects",
  async () => {
    await db.query(
      "update storage.objects set updated_at=now()-interval '2 days' where name=$1",
      [`${u1}/${lid}/2.webp`],
    );
    let candidates = (
      await db.query("select * from public.cleanup_candidates()")
    ).rows;
    assert.equal(
      candidates.some((x) => x.name === `${u1}/${lid}/2.webp`),
      true,
    );
    assert.equal(
      candidates.some((x) => x.name === `${u1}/${lid}/1.webp`),
      false,
    );
    assert.equal(
      candidates.some((x) => x.name === `${u1}/${lid}/3.webp`),
      false,
    );
    await db.query(
      "update public.listings set archived_at=now()-interval '91 days' where id=$1",
      [lid],
    );
    candidates = (await db.query("select * from public.cleanup_candidates()"))
      .rows;
    assert.equal(
      candidates.some((x) => x.name === `${u1}/${lid}/1.webp`),
      true,
    );
  },
);
await ok("Suspended users do not receive verified badge status", () =>
  as("anon", null, async () => {
    assert.equal(
      (
        await db.query("select public.profile_is_verified($1) as verified", [
          u2,
        ])
      ).rows[0].verified,
      false,
    );
  }),
);
// Chat/update authorization and lifecycle checks run against real SQL, not mocks.
await as("authenticated", admin, () =>
  db.query(
    "select public.admin_moderate('USER',$1,'ACTIVE','Re-enable for chat tests')",
    [u2],
  ),
);
let chatListing, cid, firstMessage;
await ok(
  "New listings default to private chat and old updates preserve explicit modes",
  async () => {
    await as("authenticated", u1, async () => {
      const { contact_mode, ...chatPayload } = payload;
      chatListing = (
        await db.query("select public.save_listing($1) as id", [chatPayload])
      ).rows[0].id;
      assert.equal(
        (
          await db.query(
            "select contact_mode from public.listings where id=$1",
            [chatListing],
          )
        ).rows[0].contact_mode,
        "CHAT",
      );
      await deny(() =>
        db.query("select public.save_listing($1,$2)", [
          { ...payload, contact_mode: "PUBLIC" },
          chatListing,
        ]),
      );
    });
    await as("authenticated", u2, () =>
      deny(() =>
        db.query("select public.get_listing_contact($1)", [chatListing]),
      ),
    );
  },
);
await ok("Anonymous chat and direct private-table access denied", async () => {
  await as("anon", null, async () => {
    await deny(() => db.query("select public.start_chat($1)", [chatListing]));
    await deny(() => db.query("select public.chat_inbox()"));
  });
  await as("authenticated", u2, async () => {
    await deny(() => db.query("select * from private.messages"));
    await deny(() => db.query("select * from private.conversations"));
    await deny(() => db.query("select private.pair_blocked($1,$2)", [u1, u2]));
  });
});
await ok(
  "No self chat; starting twice reuses the same listing-specific conversation",
  async () => {
    await as("authenticated", u1, () =>
      deny(() => db.query("select public.start_chat($1)", [chatListing])),
    );
    await as("authenticated", u2, async () => {
      cid = (
        await db.query("select public.start_chat($1) as id", [chatListing])
      ).rows[0].id;
      assert.equal(
        (await db.query("select public.start_chat($1) as id", [chatListing]))
          .rows[0].id,
        cid,
      );
    });
  },
);
await ok(
  "Message validates body and uses authenticated sender with idempotent retry",
  () =>
    as("authenticated", u2, async () => {
      const nonce = "50000000-0000-0000-0000-000000000001";
      for (const body of [null, "   ", "x".repeat(2001)])
        await deny(() =>
          db.query("select public.send_chat_message($1,$2,$3)", [
            cid,
            body,
            nonce,
          ]),
        );
      firstMessage = (
        await db.query(
          "select public.send_chat_message($1,'Is this available?',$2) as id",
          [cid, nonce],
        )
      ).rows[0].id;
      assert.equal(
        (
          await db.query(
            "select public.send_chat_message($1,'Is this available?',$2) as id",
            [cid, nonce],
          )
        ).rows[0].id,
        firstMessage,
      );
      const t = (await db.query("select public.chat_thread($1) as t", [cid]))
        .rows[0].t;
      assert.equal(t.messages.length, 1);
      assert.equal(t.messages[0].sender_id, u2);
    }),
);
await ok(
  "Nonparticipant including admin cannot read/send/mark/report a private thread",
  () =>
    as("authenticated", admin, async () => {
      assert.equal(
        (await db.query("select public.chat_inbox() as i")).rows[0].i.length,
        0,
      );
      await deny(() => db.query("select public.chat_thread($1)", [cid]));
      await deny(() =>
        db.query(
          "select public.send_chat_message($1,'Intrusion',gen_random_uuid())",
          [cid],
        ),
      );
      await deny(() =>
        db.query("select public.mark_chat_read($1,$2)", [cid, firstMessage]),
      );
      await deny(() =>
        db.query(
          "select public.report_chat($1,'Testing unauthorized report')",
          [cid],
        ),
      );
    }),
);
await ok(
  "Unread count and read watermark belong to each participant",
  async () => {
    await as("authenticated", u1, async () => {
      assert.equal(
        Number(
          (await db.query("select public.chat_unread_count() as n")).rows[0].n,
        ),
        1,
      );
      assert.equal(
        (await db.query("select public.chat_inbox() as i")).rows[0].i[0].unread,
        1,
      );
      await db.query("select public.mark_chat_read($1,$2)", [
        cid,
        firstMessage,
      ]);
      assert.equal(
        Number(
          (await db.query("select public.chat_unread_count() as n")).rows[0].n,
        ),
        0,
      );
      await db.query(
        "select public.send_chat_message($1,'Yes, it is available.',gen_random_uuid())",
        [cid],
      );
    });
    await as("authenticated", u2, async () =>
      assert.equal(
        Number(
          (await db.query("select public.chat_unread_count() as n")).rows[0].n,
        ),
        1,
      ),
    );
  },
);
await ok(
  "Blocked participant cannot message, start chat or obtain opted-in contact",
  async () => {
    await as("authenticated", u1, async () => {
      await db.query("select public.save_listing($1,$2)", [
        payload,
        chatListing,
      ]);
      await db.query("select public.set_chat_block($1,true)", [u2]);
    });
    for (const [who, other] of [
      [u1, u2],
      [u2, u1],
    ])
      await as("authenticated", who, async () => {
        await deny(() =>
          db.query(
            "select public.send_chat_message($1,'Blocked attempt',gen_random_uuid())",
            [cid],
          ),
        );
        assert.equal(
          (await db.query("select public.chat_thread($1) as t", [cid])).rows[0]
            .t.can_send,
          false,
        );
      });
    await as("authenticated", u2, async () => {
      await deny(() => db.query("select public.start_chat($1)", [chatListing]));
      await deny(() =>
        db.query("select public.get_listing_contact($1)", [chatListing]),
      );
      await db.query("select public.set_chat_block($1,false)", [u1]); // Cannot undo someone else's block.
      await deny(() => db.query("select public.start_chat($1)", [chatListing]));
    });
    await as("authenticated", u1, async () => {
      assert.equal(
        (await db.query("select public.chat_blocked_users() as b")).rows[0].b[0]
          .id,
        u2,
      );
      await db.query("select public.set_chat_block($1,false)", [u2]);
    });
  },
);
await ok(
  "Each explicit contact choice is saved; switching back to chat revokes phone RPC",
  async () => {
    for (const mode of ["WHATSAPP", "CALL", "BOTH", "CHAT"]) {
      await as("authenticated", u1, () =>
        db.query("select public.save_listing($1,$2)", [
          { ...payload, contact_mode: mode },
          chatListing,
        ]),
      );
      await as("authenticated", u2, async () => {
        if (mode === "CHAT")
          await deny(() =>
            db.query("select public.get_listing_contact($1)", [chatListing]),
          );
        else
          assert.equal(
            (
              await db.query("select public.get_listing_contact($1) as phone", [
                chatListing,
              ])
            ).rows[0].phone,
            "+923001234567",
          );
      });
    }
  },
);
await ok(
  "Chat reporting requires membership and reason, creates a private admin report",
  async () => {
    await as("authenticated", u2, async () => {
      await deny(() => db.query("select public.report_chat($1,' ')", [cid]));
      await db.query(
        "select public.report_chat($1,'The student is sending abusive messages.')",
        [cid],
      );
    });
    await as("authenticated", admin, async () => {
      const r = (
        await db.query(
          "select * from public.reports where comments like 'Chat report;%'",
        )
      ).rows[0];
      assert.equal(r.reported_user_id, u1);
      assert.equal(r.reporter_user_id, u2);
      assert.equal(r.reason, "HARASSMENT");
    });
  },
);
await ok(
  "Suspension revokes thread access and prevents messages to suspended peers",
  async () => {
    await as("authenticated", admin, () =>
      db.query(
        "select public.admin_moderate('USER',$1,'SUSPENDED','Suspend for safety test')",
        [u2],
      ),
    );
    await as("authenticated", u2, () =>
      deny(() => db.query("select public.chat_thread($1)", [cid])),
    );
    await as("authenticated", u1, () =>
      deny(() =>
        db.query(
          "select public.send_chat_message($1,'Cannot deliver',gen_random_uuid())",
          [cid],
        ),
      ),
    );
    await as("authenticated", admin, () =>
      db.query(
        "select public.admin_moderate('USER',$1,'ACTIVE','Restore after safety test')",
        [u2],
      ),
    );
  },
);
await ok(
  "Messages are cursor-paginated, and per-sender rate limits are enforced",
  async () => {
    await db.query(
      "insert into private.messages(conversation_id,sender_id,body,client_id) select $1,$2,'Earlier message '||g,gen_random_uuid() from generate_series(1,55) g",
      [cid, u2],
    );
    await as("authenticated", u2, () =>
      deny(() =>
        db.query(
          "select public.send_chat_message($1,'Too many',gen_random_uuid())",
          [cid],
        ),
      ),
    );
    await as("authenticated", u1, async () => {
      const t = (await db.query("select public.chat_thread($1) as t", [cid]))
        .rows[0].t;
      assert.equal(t.messages.length, 50);
      const old = (
        await db.query("select public.chat_thread($1,$2) as t", [
          cid,
          t.messages[0].id,
        ])
      ).rows[0].t;
      assert.equal(old.messages.length, 7);
      assert.ok(old.messages.at(-1).id < t.messages[0].id);
    });
  },
);
await ok(
  "Owner deletion requires reason; other students cannot delete",
  async () => {
    await as("authenticated", u2, () =>
      deny(() =>
        db.query("select public.delete_listing($1,'Not my listing')", [
          chatListing,
        ]),
      ),
    );
    await as("authenticated", u1, () =>
      deny(() =>
        db.query("select public.delete_listing($1,'  ')", [chatListing]),
      ),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from private.conversations where id=$1",
          [cid],
        )
      ).rows[0].n,
      1,
    );
  },
);
await ok(
  "Owner deletion atomically removes all chats/messages and wishlist, retaining removal reason",
  async () => {
    await as("authenticated", u2, () =>
      db.query(
        "insert into public.wishlist(user_id,listing_id) values($1,$2)",
        [u2, chatListing],
      ),
    );
    await as("authenticated", u1, () =>
      db.query(
        "select public.delete_listing($1,'No longer available to students')",
        [chatListing],
      ),
    );
    for (const table of ["private.messages", "private.conversations"]) {
      const col = table.endsWith("messages") ? "conversation_id" : "id";
      assert.equal(
        (
          await db.query(
            `select count(*)::int n from ${table} where ${col}=$1`,
            [cid],
          )
        ).rows[0].n,
        0,
      );
    }
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.wishlist where listing_id=$1",
          [chatListing],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select deletion_reason from public.listings where id=$1",
          [chatListing],
        )
      ).rows[0].deletion_reason,
      "No longer available to students",
    );
    await as("authenticated", u2, async () => {
      await deny(() => db.query("select public.chat_thread($1)", [cid]));
      await deny(() => db.query("select public.start_chat($1)", [chatListing]));
      assert.equal(
        (await db.query("select public.chat_inbox() as i")).rows[0].i.length,
        0,
      );
    });
    await as("anon", null, async () =>
      assert.equal(
        (
          await db.query("select id from public.listings where id=$1", [
            chatListing,
          ])
        ).rows.length,
        0,
      ),
    );
    await as("authenticated", u1, () =>
      deny(() =>
        db.query("select public.save_listing($1,$2)", [payload, chatListing]),
      ),
    );
  },
);
await ok(
  "Admin deletion through existing moderation RPC also destroys chats and records reason",
  async () => {
    const ad = (
      await as("authenticated", u1, () =>
        db.query("select public.save_listing($1) as id", [payload]),
      )
    ).rows[0].id;
    const c = (
      await as("authenticated", u2, () =>
        db.query("select public.start_chat($1) as id", [ad]),
      )
    ).rows[0].id;
    await as("authenticated", u1, () =>
      db.query(
        "select public.send_chat_message($1,'Test conversation',gen_random_uuid())",
        [c],
      ),
    );
    await as("authenticated", admin, () =>
      db.query(
        "select public.admin_moderate('LISTING',$1,'REMOVED_BY_ADMIN','Harmful listing removed after review')",
        [ad],
      ),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from private.messages where conversation_id=$1",
          [c],
        )
      ).rows[0].n,
      0,
    );
    await as("authenticated", u1, async () => {
      const l = (
        await db.query("select * from public.listings where id=$1", [ad])
      ).rows[0];
      assert.equal(l.deleted_by, admin);
      assert.equal(l.status, "REMOVED_BY_ADMIN");
      assert.ok(l.deletion_reason.includes("Harmful"));
    });
  },
);
await ok(
  "Disabled domain revokes existing student privileges immediately",
  async () => {
    await db.exec("update public.allowed_email_domains set is_active=false");
    await as("authenticated", u1, () =>
      deny(() => db.query("select public.save_listing($1)", [payload])),
    );
  },
);
console.log(`\n${passed} database authorization and workflow checks passed.`);
await db.close();
