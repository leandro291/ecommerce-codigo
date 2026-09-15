import assert from "node:assert/strict";
import { test } from "node:test";

import { getApiErrorMessage, isConflict } from "../api-error.ts";

function axiosError(status: number, data?: { error?: string }) {
  return {
    isAxiosError: true,
    message: "Request failed",
    response: { status, data },
  };
}

test("getApiErrorMessage devuelve el mensaje del servidor si el error axios trae data.error", () => {
  const error = axiosError(400, { error: "Stock insuficiente" });
  assert.equal(getApiErrorMessage(error, "fallback"), "Stock insuficiente");
});

test("getApiErrorMessage cae al fallback si el error no es de axios", () => {
  assert.equal(getApiErrorMessage(new Error("boom"), "fallback"), "fallback");
});

test("isConflict da true solo cuando el status es 409", () => {
  assert.equal(isConflict(axiosError(409)), true);
  assert.equal(isConflict(axiosError(400)), false);
});

test("isConflict da false si el error no es de axios", () => {
  assert.equal(isConflict(new Error("boom")), false);
});

test("getApiErrorMessage usa error.message si el error axios no trae response (fallo de red)", () => {
  const error = { isAxiosError: true, message: "Network Error" };
  assert.equal(getApiErrorMessage(error, "fallback"), "Network Error");
});

test("getApiErrorMessage usa error.message si la respuesta no trae data.error", () => {
  assert.equal(getApiErrorMessage(axiosError(500, {}), "fallback"), "Request failed");
});

test("isConflict da false si el error axios no trae response", () => {
  assert.equal(isConflict({ isAxiosError: true, message: "Network Error" }), false);
});
