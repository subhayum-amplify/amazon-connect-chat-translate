"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
const backend_1 = require("@aws-amplify/backend");
const schema = backend_1.a.schema({
    // This is a minimal schema - you can expand it based on your needs
    // For now, we're keeping it simple since your app primarily uses the REST API
    Todo: backend_1.a
        .model({
        content: backend_1.a.string(),
    })
        .authorization((allow) => [allow.owner()]),
});
exports.data = (0, backend_1.defineData)({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'userPool',
    },
});
//# sourceMappingURL=resource.js.map