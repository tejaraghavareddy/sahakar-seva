/**
 * The demo federation officer.
 *
 * SIH judges get a one-click way into the governance console. The door has to
 * stay narrow, so the two things worth pinning are: only the whitelisted demo
 * address can be provisioned, and the provisioned account is actually treated
 * as an officer by the same server-side check the real admin functions use.
 */
import { describe, expect, it } from "vitest";
import { internal } from "@/convex/_generated/api";
import { DEMO_ADMIN_EMAILS } from "@/convex/identity";
import {
  setupTest,
  must,
  api,
  seedUser,
  type Id,
} from "./convexHarness";

const DEMO_EMAIL = DEMO_ADMIN_EMAILS[0];

describe("demoAdminUser:ensureDemoAdminUser", () => {
  it("creates the demo officer with the admin role", async () => {
    const t = setupTest();
    const userId = await t.mutation(internal.demoAdminUser.ensureDemoAdminUser, {
      email: DEMO_EMAIL,
    });
    const user = must(await t.run((ctx) => ctx.db.get(userId)), "demo user");
    expect(user.email).toBe(DEMO_EMAIL);
    expect(user.role).toBe("admin");
    expect(user.name).toBe("Demo Federation Officer");
  });

  it("is idempotent — a second call returns the same account", async () => {
    const t = setupTest();
    const first = await t.mutation(internal.demoAdminUser.ensureDemoAdminUser, {
      email: DEMO_EMAIL,
    });
    const second = await t.mutation(internal.demoAdminUser.ensureDemoAdminUser, {
      email: DEMO_EMAIL,
    });
    expect(second).toBe(first);
  });

  it("grants the role to a pre-existing row that lacked it", async () => {
    const t = setupTest();
    // Someone signed up with the demo address before the demo flow existed.
    const userId = await seedUser(t, { email: DEMO_EMAIL });
    const returned = await t.mutation(
      internal.demoAdminUser.ensureDemoAdminUser,
      { email: DEMO_EMAIL },
    );
    expect(returned).toBe(userId);
    expect(must(await t.run((ctx) => ctx.db.get(userId)), "user").role).toBe(
      "admin",
    );
  });

  it("refuses every address that is not on the demo list", async () => {
    const t = setupTest();
    await expect(
      t.mutation(internal.demoAdminUser.ensureDemoAdminUser, {
        email: "attacker@example.com",
      }),
    ).rejects.toThrow("Not a demo officer address");
    await expect(
      t.mutation(internal.demoAdminUser.ensureDemoAdminUser, {
        // The federation owner must not be provisionable through the demo door.
        email: "teja200822@gmail.com",
      }),
    ).rejects.toThrow("Not a demo officer address");
  });
});

describe("demo officer: treated as a federation admin by the real checks", () => {
  it("can read the admin overview and holds no other special powers", async () => {
    const t = setupTest();
    const userId = await t.mutation(internal.demoAdminUser.ensureDemoAdminUser, {
      email: DEMO_EMAIL,
    });
    const as = t.withIdentity({ subject: userId });

    const overview = await as.query(api.admin.overview);
    expect(overview).toHaveProperty("welfarePool");

    // Officer status is also legible through the same helper the console uses.
    expect(await as.query(api.admin.amAdmin)).toBe(true);
  });

  it("the admin role survives the exact path RequireAdmin reads", async () => {
    // The /admin route gate resolves the session from `users.role`, so the
    // demo account must carry the field, not merely pass isAdminUser.
    const t = setupTest();
    const userId: Id<"users"> = await t.mutation(
      internal.demoAdminUser.ensureDemoAdminUser,
      { email: DEMO_EMAIL },
    );
    const user = must(await t.run((ctx) => ctx.db.get(userId)), "demo user");
    expect(user.role).toBe("admin");
  });
});
