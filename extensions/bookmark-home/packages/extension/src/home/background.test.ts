import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedBackgroundFile,
  MAX_BACKGROUND_FILE_BYTES,
} from "./background";

test("background validation accepts local raster images within the input budget", () => {
  assert.equal(
    isSupportedBackgroundFile({ type: "image/jpeg", size: 1024 }),
    true,
  );
  assert.equal(
    isSupportedBackgroundFile({ type: "image/svg+xml", size: 1024 }),
    false,
  );
  assert.equal(
    isSupportedBackgroundFile({
      type: "image/png",
      size: MAX_BACKGROUND_FILE_BYTES + 1,
    }),
    false,
  );
});
