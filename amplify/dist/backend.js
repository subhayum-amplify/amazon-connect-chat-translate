"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backend = void 0;
const backend_1 = require("@aws-amplify/backend");
const resource_1 = require("./auth/resource");
const resource_2 = require("./data/resource");
const resource_3 = require("./functions/translate/resource");
exports.backend = (0, backend_1.defineBackend)({
    auth: resource_1.auth,
    data: resource_2.data,
    translateFunction: resource_3.translateFunction,
});
//# sourceMappingURL=backend.js.map