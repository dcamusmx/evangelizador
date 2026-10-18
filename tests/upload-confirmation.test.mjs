import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Run the actual handlers without TanStack's build transform or external services.
// Projecting selected columns makes this catch the original missing-state bug.
function loadModule(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

const database = loadModule("../src/types/database.ts");
const createServerFn = () => ({
  middleware() {
    return this;
  },
  inputValidator() {
    return this;
  },
  handler(fn) {
    return fn;
  },
});
const common = {
  "@tanstack/react-start": { createServerFn },
  "@/integrations/supabase/auth-middleware": { requireSupabaseAuth: {} },
  "@/types/database": database,
};
const r2 = loadModule("../src/lib/r2.functions.ts", {
  ...common,
  "@/lib/r2.constants": {},
  "@/lib/r2.server": {
    obtenerConfigR2: async () => ({}),
    cabecerasObjeto: async () => ({ size: 123, contentType: "video/mp4", etag: "etag" }),
  },
}).confirmarSubidaR2;
const pcloud = loadModule("../src/lib/pcloud.functions.ts", {
  ...common,
  "@/lib/pcloud.server": {
    obtenerConfigPcloud: async () => ({}),
    borrarEnlaceSubida: async () => {},
    buscarArchivo: async () => ({ fileid: 123, name: "video.mp4" }),
    obtenerLinkPublico: async () => "https://storage.example/video",
  },
}).confirmarSubida;

const publication = {
  link_youtube: "https://youtube.example/published",
  link_facebook: "https://facebook.example/published",
  youtubepostid: "youtube-existing-id",
  facebookpostid: "facebook-existing-id",
};

function mockContext(row, readError = null) {
  const writes = [];
  const supabase = {
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      assert.equal(table, "contenido_diario");
      return {
        select(columns) {
          return {
            eq(column, value) {
              assert.equal(column, "fecha");
              assert.equal(value, "2026-10-18");
              return {
                async maybeSingle() {
                  const selected =
                    row &&
                    Object.fromEntries(
                      columns.split(",").map((key) => [key.trim(), row[key.trim()]]),
                    );
                  return { data: readError ? null : selected, error: readError };
                },
              };
            },
          };
        },
        async upsert(payload, options) {
          assert.equal(options.onConflict, "fecha");
          writes.push(payload);
          return { error: null };
        },
      };
    },
  };
  return { context: { supabase, userId: "test-user" }, writes };
}

const input = {
  fecha: "2026-10-18",
  objectKey: "EvangelioDiario/2026/10/video.mp4",
  folderid: 1,
  uploadlinkid: 2,
  nombreArchivo: "video.mp4",
};

for (const [provider, handler] of [
  ["R2", r2],
  ["pCloud", pcloud],
]) {
  for (const state of ["publicado", "programado"]) {
    for (const reflection of [null, "Reflexión existente"]) {
      test(`${provider}: preserves ${state}, reflection=${Boolean(reflection)}, and publication fields`, async () => {
        const row = { ...publication, estado: state, reflexion: reflection };
        const { context, writes } = mockContext(row);
        const result = await handler({ data: input, context });
        assert.equal(result.estado, state);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].estado, state);
        for (const key of Object.keys(publication)) {
          assert.equal(Object.hasOwn(writes[0], key), false, `${key} must not be written`);
        }
        assert.deepEqual({ ...row, ...writes[0] }, { ...row, ...writes[0], ...publication });
      });
    }
  }

  for (const state of ["pendiente_reflexion", "pendiente_video", "listo_para_publicar", "error"]) {
    for (const [reflection, expected] of [
      [null, "pendiente_reflexion"],
      ["  ", "pendiente_reflexion"],
      ["Reflexión", "listo_para_publicar"],
    ]) {
      test(`${provider}: ${state} + ${JSON.stringify(reflection)} => ${expected}`, async () => {
        const { context, writes } = mockContext({ estado: state, reflexion: reflection });
        const result = await handler({ data: input, context });
        assert.equal(result.estado, expected);
        assert.equal(writes[0].estado, expected);
      });
    }
  }

  test(`${provider}: new record requires reflection`, async () => {
    const { context, writes } = mockContext(null);
    await handler({ data: input, context });
    assert.equal(writes[0].estado, "pendiente_reflexion");
  });

  test(`${provider}: read failure must not overwrite an unknown publication state`, async () => {
    const { context, writes } = mockContext(null, { message: "Read failed" });
    await assert.rejects(handler({ data: input, context }), /leer el estado/);
    assert.equal(writes.length, 0);
  });
}

test("without a video, an unpublished record with reflection still requires video", () => {
  assert.equal(
    database.derivarEstadoContenido({ reflexion: "Reflexión", estadoActual: "error" }),
    "pendiente_video",
  );
});
