import { describe, expect, it } from "vitest";
import {
  api,
  must,
  seedAdmin,
  seedArtisan,
  seedCustomer,
  seedWorker,
  setupTest,
} from "./convexHarness";

const base = {
  name: "Kurnool District artisans Cooperative",
  district: "Kurnool",
  state: "Andhra Pradesh",
};

describe("societies:register", () => {
  it("is admin-only", async () => {
    const t = setupTest();
    await expect(t.mutation(api.societies.register, base)).rejects.toThrow("Not authenticated");
    const c = await seedCustomer(t);
    await expect(c.as.mutation(api.societies.register, base)).rejects.toThrow("Forbidden");
  });

  it("requires a name, district and state", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    for (const patch of [{ name: " " }, { district: " " }, { state: " " }]) {
      await expect(
        a.as.mutation(api.societies.register, { ...base, ...patch }),
      ).rejects.toThrow("is required");
    }
  });

  it("mints a state-district code and a charter reference", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const res = await a.as.mutation(api.societies.register, base);
    expect(res.code).toBe("AP-KUR-01");
    expect(res.registrationNo).toMatch(/^SSC\/REG\/\d{4}\/001$/);

    const row = must(await t.run((ctx) => ctx.db.get(res.id)), "society");
    expect(row.status).toBe("pending");
    expect(row.registeredBy).toBe(a.id);
  });

  it("increments the sequence per state-district without colliding", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const first = await a.as.mutation(api.societies.register, base);
    const second = await a.as.mutation(api.societies.register, {
      ...base,
      name: "Second society",
    });
    const otherDistrict = await a.as.mutation(api.societies.register, {
      ...base,
      district: "Nandyal",
    });
    const otherState = await a.as.mutation(api.societies.register, {
      ...base,
      state: "Telangana",
    });

    expect(first.code).toBe("AP-KUR-01");
    expect(second.code).toBe("AP-KUR-02");
    expect(otherDistrict.code).toBe("AP-NAN-01");
    expect(otherState.code).toBe("TS-KUR-01");
  });
});

describe("societies:directory", () => {
  it("lists only active societies, with member counts", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const { id } = await a.as.mutation(api.societies.register, base);
    await a.as.mutation(api.societies.review, { id, status: "active" });
    await a.as.mutation(api.societies.register, { ...base, name: "Still pending" });

    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { societyId: id });

    // Readable with no session at all.
    const dir = await t.query(api.societies.directory);
    expect(dir).toHaveLength(1);
    expect(dir[0].name).toBe(base.name);
    expect(dir[0].memberCount).toBe(1);
  });
});

describe("societies:listForAdmin", () => {
  it("is admin-only and returns every society with counts", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    await expect(t.query(api.societies.listForAdmin)).rejects.toThrow("Not authenticated");
    await expect(c.as.query(api.societies.listForAdmin)).rejects.toThrow("Forbidden");

    const a = await seedAdmin(t);
    const { id } = await a.as.mutation(api.societies.register, base);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { societyId: id });

    const all = await a.as.query(api.societies.listForAdmin);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("pending");
    expect(all[0].memberCount).toBe(1);
  });
});

describe("societies:review", () => {
  it("is admin-only and rejects an unknown status", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const { id } = await a.as.mutation(api.societies.register, base);

    await expect(
      c.as.mutation(api.societies.review, { id, status: "active" }),
    ).rejects.toThrow("Forbidden");
    await expect(
      a.as.mutation(api.societies.review, { id, status: "banished" }),
    ).rejects.toThrow("Invalid status");
  });

  it("activates, suspends and records the officer's note", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const { id } = await a.as.mutation(api.societies.register, base);

    await a.as.mutation(api.societies.review, {
      id,
      status: "active",
      note: "  Charter granted  ",
    });
    let row = must(await t.run((ctx) => ctx.db.get(id)), "society");
    expect(row.status).toBe("active");
    expect(row.reviewNote).toBe("Charter granted");
    expect(row.reviewedAt).toBeGreaterThan(0);

    await a.as.mutation(api.societies.review, { id, status: "suspended" });
    row = must(await t.run((ctx) => ctx.db.get(id)), "society");
    expect(row.status).toBe("suspended");
  });

  it("refuses a society that does not exist", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const { id } = await a.as.mutation(api.societies.register, base);
    await t.run((ctx) => ctx.db.delete(id));
    await expect(
      a.as.mutation(api.societies.review, { id, status: "active" }),
    ).rejects.toThrow("Society not found");
  });
});
