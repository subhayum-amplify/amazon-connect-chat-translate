"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateFunction = void 0;
const backend_1 = require("@aws-amplify/backend");
exports.translateFunction = (0, backend_1.defineFunction)({
    name: 'translate',
    entry: './handler.ts',
    environment: {
    // Add any environment variables if needed
    },
});
//# sourceMappingURL=resource.js.map