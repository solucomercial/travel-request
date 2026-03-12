"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = requireRoles;
function requireRoles(roles) {
    return async function (request, reply) {
        await request.jwtVerify();
        if (!roles.includes(request.user.role)) {
            return reply.status(403).send({ message: 'Acesso negado' });
        }
    };
}
